import { Injectable, Logger } from '@nestjs/common';
import {
    CommBounceType,
    CommChannel,
    CommDeliveryEventType,
    CommMessageKind,
    CommMessageStatus,
    CommProviderKind,
    CommRecipientStatus,
    CommSuppressionReason,
    Prisma,
} from 'generated/prisma';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import { isUniqueError, normalizeAddress, utcDay } from '../common/comm.utils';

type DailyField =
    | 'sent_count' | 'delivered_count' | 'opened_count' | 'unique_opened_count' | 'clicked_count' | 'unique_clicked_count'
    | 'replied_count' | 'bounced_count' | 'failed_count' | 'complained_count' | 'unsubscribed_count';

type CampaignField = 'sent_count' | 'delivered_count' | 'opened_count' | 'clicked_count' | 'replied_count' | 'bounced_count' | 'failed_count' | 'complained_count' | 'unsubscribed_count';

export interface DeliveryEventInput {
    type: CommDeliveryEventType;
    occurred_at?: Date;
    provider?: CommProviderKind | null;
    provider_event_id?: string | null;
    tracked_link_id?: string | null;
    url?: string | null;
    user_agent?: string | null;
    ip_address?: string | null;
    bounce_type?: CommBounceType | null;
    bounce_code?: string | null;
    reason?: string | null;
    payload?: Record<string, unknown> | null;
}

/** Event → message status (only moves forward). */
const STATUS_RANK: Record<CommMessageStatus, number> = {
    DRAFT: 0, SCHEDULED: 1, QUEUED: 2, SENDING: 3, SENT: 4, DELIVERED: 5, FAILED: 6, BOUNCED: 6, CANCELLED: 6,
};

const RECIPIENT_RANK: Record<CommRecipientStatus, number> = {
    PENDING: 0, EXCLUDED: 0, QUEUED: 1, SENT: 2, DELIVERED: 3, OPENED: 4, CLICKED: 5, REPLIED: 6, BOUNCED: 7, FAILED: 7, UNSUBSCRIBED: 8,
};

/**
 * Delivery-tracking writer (11 "Delivery Tracking", "Analytics & Reporting"): appends CommDeliveryEvent rows
 * idempotently and keeps CommMessage timestamps, recipient statuses, Campaign counters, CommDailyStat rollups and
 * the suppression list (hard bounces, complaints, unsubscribes) consistent. Used by the dispatcher, tracking pixels /
 * links, unsubscribe pages and provider webhooks.
 */
@Injectable()
export class CommStatsService {
    private readonly logger = new Logger(CommStatsService.name);

    constructor(private readonly prisma: PrismaService) { }

    async bumpDaily(organizationId: string, channel: CommChannel, kind: CommMessageKind, campaignId: string | null, fields: Partial<Record<DailyField, number>>, at = new Date()) {
        const date = utcDay(at);
        const increment = Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, { increment: v }]));
        for (let attempt = 0; attempt < 2; attempt++) {
            const existing = await this.prisma.commDailyStat.findFirst({ where: { organization_id: organizationId, date, channel, kind, campaign_id: campaignId }, select: { id: true } });
            if (existing) {
                await this.prisma.commDailyStat.update({ where: { id: existing.id }, data: increment });
                return;
            }
            try {
                await this.prisma.commDailyStat.create({ data: { organization_id: organizationId, date, channel, kind, campaign_id: campaignId, ...(fields as Record<string, number>) } });
                return;
            } catch (error) {
                if (!isUniqueError(error)) throw error;
            }
        }
    }

    async bumpCampaign(campaignId: string | null | undefined, fields: Partial<Record<CampaignField, number>>) {
        if (!campaignId) return;
        const data = Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, { increment: v }]));
        await this.prisma.campaign.update({ where: { id: campaignId }, data: { ...data, stats_refreshed_at: new Date() } }).catch(() => undefined);
    }

    /**
     * Record one delivery event for a message. Returns false when the event was already recorded
     * (same provider event id) so webhook retries never double-count.
     */
    async record(messageId: string, input: DeliveryEventInput): Promise<boolean> {
        const message = await this.prisma.commMessage.findUnique({
            where: { id: messageId },
            select: {
                id: true, organization_id: true, channel: true, kind: true, status: true, campaign_id: true, campaign_run_id: true,
                to_address: true, recipient_contact_id: true, first_opened_at: true, first_clicked_at: true, delivered_at: true,
                bounced_at: true, complained_at: true, unsubscribed_at: true, replied_at: true, read_at: true, is_test: true,
            },
        });
        if (!message) return false;
        const at = input.occurred_at ?? new Date();

        try {
            await this.prisma.commDeliveryEvent.create({
                data: {
                    organization_id: message.organization_id,
                    message_id: message.id,
                    type: input.type,
                    occurred_at: at,
                    provider: input.provider ?? null,
                    provider_event_id: input.provider_event_id ?? null,
                    tracked_link_id: input.tracked_link_id ?? null,
                    url: input.url ?? null,
                    user_agent: input.user_agent?.slice(0, 500) ?? null,
                    ip_address: input.ip_address ?? null,
                    bounce_type: input.bounce_type ?? null,
                    bounce_code: input.bounce_code ?? null,
                    reason: input.reason?.slice(0, 1000) ?? null,
                    payload: (input.payload ?? undefined) as Prisma.InputJsonValue,
                },
            });
        } catch (error) {
            if (isUniqueError(error)) return false;
            throw error;
        }

        const msgData: Prisma.CommMessageUpdateInput = {};
        let recipientStatus: CommRecipientStatus | null = null;
        const daily: Partial<Record<DailyField, number>> = {};
        const camp: Partial<Record<CampaignField, number>> = {};
        let suppress: CommSuppressionReason | null = null;

        switch (input.type) {
            case CommDeliveryEventType.DELIVERED:
                if (!message.delivered_at) {
                    msgData.delivered_at = at;
                    daily.delivered_count = 1;
                    camp.delivered_count = 1;
                }
                if (STATUS_RANK[message.status] < STATUS_RANK.DELIVERED) msgData.status = CommMessageStatus.DELIVERED;
                recipientStatus = CommRecipientStatus.DELIVERED;
                break;
            case CommDeliveryEventType.OPENED:
            case CommDeliveryEventType.READ:
                msgData.open_count = { increment: 1 };
                msgData.last_opened_at = at;
                daily.opened_count = 1;
                if (!message.first_opened_at) {
                    msgData.first_opened_at = at;
                    daily.unique_opened_count = 1;
                    camp.opened_count = 1;
                }
                if (input.type === CommDeliveryEventType.READ && !message.read_at) msgData.read_at = at;
                if (!message.delivered_at) msgData.delivered_at = at;
                if (STATUS_RANK[message.status] < STATUS_RANK.DELIVERED) msgData.status = CommMessageStatus.DELIVERED;
                recipientStatus = CommRecipientStatus.OPENED;
                break;
            case CommDeliveryEventType.CLICKED:
                msgData.click_count = { increment: 1 };
                daily.clicked_count = 1;
                if (!message.first_clicked_at) {
                    msgData.first_clicked_at = at;
                    daily.unique_clicked_count = 1;
                    camp.clicked_count = 1;
                    // A click implies an open (image blocking hides many opens).
                    if (!message.first_opened_at) {
                        msgData.first_opened_at = at;
                        daily.unique_opened_count = 1;
                        camp.opened_count = 1;
                    }
                }
                if (STATUS_RANK[message.status] < STATUS_RANK.DELIVERED) msgData.status = CommMessageStatus.DELIVERED;
                recipientStatus = CommRecipientStatus.CLICKED;
                break;
            case CommDeliveryEventType.REPLIED:
                if (!message.replied_at) {
                    msgData.replied_at = at;
                    daily.replied_count = 1;
                    camp.replied_count = 1;
                }
                recipientStatus = CommRecipientStatus.REPLIED;
                break;
            case CommDeliveryEventType.BOUNCED:
                if (!message.bounced_at) {
                    msgData.bounced_at = at;
                    msgData.bounce_type = input.bounce_type ?? CommBounceType.HARD;
                    msgData.failure_reason = input.reason ?? 'Bounced';
                    daily.bounced_count = 1;
                    camp.bounced_count = 1;
                }
                msgData.status = CommMessageStatus.BOUNCED;
                recipientStatus = CommRecipientStatus.BOUNCED;
                suppress = (input.bounce_type ?? CommBounceType.HARD) === CommBounceType.HARD ? CommSuppressionReason.HARD_BOUNCE : CommSuppressionReason.SOFT_BOUNCE;
                break;
            case CommDeliveryEventType.COMPLAINED:
                if (!message.complained_at) {
                    msgData.complained_at = at;
                    daily.complained_count = 1;
                    camp.complained_count = 1;
                }
                suppress = CommSuppressionReason.COMPLAINT;
                break;
            case CommDeliveryEventType.UNSUBSCRIBED:
                if (!message.unsubscribed_at) {
                    msgData.unsubscribed_at = at;
                    daily.unsubscribed_count = 1;
                    camp.unsubscribed_count = 1;
                }
                recipientStatus = CommRecipientStatus.UNSUBSCRIBED;
                suppress = CommSuppressionReason.UNSUBSCRIBE;
                break;
            case CommDeliveryEventType.FAILED:
                msgData.status = CommMessageStatus.FAILED;
                msgData.failed_at = at;
                msgData.failure_reason = input.reason ?? 'Delivery failed';
                daily.failed_count = 1;
                camp.failed_count = 1;
                recipientStatus = CommRecipientStatus.FAILED;
                break;
            default:
                break;
        }

        if (Object.keys(msgData).length) await this.prisma.commMessage.update({ where: { id: message.id }, data: msgData });
        if (recipientStatus) await this.advanceRecipients(message.id, recipientStatus, at);
        if (!message.is_test) {
            if (Object.keys(daily).length) await this.bumpDaily(message.organization_id, message.channel, message.kind, message.campaign_id, daily, at);
            if (Object.keys(camp).length) await this.bumpCampaign(message.campaign_id, camp);
            if (camp.delivered_count && message.campaign_run_id) {
                await this.prisma.campaignRun.update({ where: { id: message.campaign_run_id }, data: { delivered_count: { increment: 1 } } }).catch(() => undefined);
            }
        }
        if (suppress) await this.suppress(message, suppress);
        return true;
    }

    private async advanceRecipients(messageId: string, status: CommRecipientStatus, at: Date) {
        const rank = RECIPIENT_RANK[status];
        const lower = (Object.keys(RECIPIENT_RANK) as CommRecipientStatus[]).filter((s) => RECIPIENT_RANK[s] < rank);
        const stamp: Prisma.CommMessageRecipientUpdateManyMutationInput =
            status === 'DELIVERED' ? { delivered_at: at } : status === 'OPENED' ? { opened_at: at } : status === 'CLICKED' ? { clicked_at: at } : status === 'BOUNCED' ? { bounced_at: at } : status === 'FAILED' ? { failed_at: at } : {};
        await this.prisma.commMessageRecipient.updateMany({ where: { message_id: messageId, role: 'TO', status: { in: lower } }, data: { status, ...stamp } });
        await this.prisma.campaignRecipient.updateMany({ where: { message_id: messageId, status: { in: lower } }, data: { status } });
    }

    private async suppress(message: { id: string; organization_id: string; channel: CommChannel; to_address: string; recipient_contact_id: string | null; campaign_id: string | null }, reason: CommSuppressionReason) {
        const address = normalizeAddress(message.channel, message.to_address);
        if (!address) return;
        const soft = reason === CommSuppressionReason.SOFT_BOUNCE;
        const expires_at = soft ? new Date(Date.now() + 7 * 24 * 3600 * 1000) : null;
        await this.prisma.commSuppression.upsert({
            where: { organization_id_channel_address: { organization_id: message.organization_id, channel: message.channel, address } },
            update: { reason, removed_at: null, removed_by_membership_id: null, expires_at, source_message_id: message.id, campaign_id: message.campaign_id, blocks_transactional: reason === CommSuppressionReason.HARD_BOUNCE },
            create: {
                organization_id: message.organization_id,
                channel: message.channel,
                address,
                reason,
                contact_id: message.recipient_contact_id,
                source_message_id: message.id,
                campaign_id: message.campaign_id,
                expires_at,
                // Hard bounces block every send; complaints and unsubscribes block marketing only.
                blocks_transactional: reason === CommSuppressionReason.HARD_BOUNCE,
            },
        }).catch((e) => this.logger.warn(`suppression not written: ${(e as Error).message}`));
        if (reason === CommSuppressionReason.UNSUBSCRIBE && message.recipient_contact_id) {
            await this.prisma.commConsent.upsert({
                where: { contact_id_channel: { contact_id: message.recipient_contact_id, channel: message.channel } },
                update: { status: 'OPTED_OUT', marketing_opted_in: false, withdrawn_at: new Date(), source: 'UNSUBSCRIBE_LINK' },
                create: { organization_id: message.organization_id, contact_id: message.recipient_contact_id, channel: message.channel, status: 'OPTED_OUT', source: 'UNSUBSCRIBE_LINK', withdrawn_at: new Date() },
            }).catch(() => undefined);
        }
    }
}
