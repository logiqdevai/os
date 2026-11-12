import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CommChannel, CommDeliveryEventType, CommMessageKind, CommMessageStatus, CommRecipientStatus, Prisma } from 'generated/prisma';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import { normalizeAddress, randomToken, smsSegments } from '../common/comm.utils';
import { CommProviderService, ProviderError } from './comm-provider.service';
import { CommStatsService } from './comm-stats.service';

const MAX_ATTEMPTS = 3;

export type BlockReason = 'suppressed' | 'no_consent' | 'invalid_address' | 'topic_unsubscribed';

/**
 * Sends one CommMessage through the organization's provider. Consent and suppression are enforced HERE, server-side,
 * on every send (11 "Recipients"): REST, MCP, campaigns, automation and module sends all end in this method.
 */
@Injectable()
export class CommDispatchService {
    private readonly logger = new Logger(CommDispatchService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly providers: CommProviderService,
        private readonly stats: CommStatsService,
        private readonly config: ConfigService,
    ) { }

    get apiBase() {
        return (this.config.get<string>('API_URL') ?? 'http://localhost:3000').replace(/\/+$/, '');
    }

    unsubscribeUrl(token: string) {
        return `${this.apiBase}/communications/u/${token}`;
    }

    /** Public preference center (topics) for the recipient of a message. */
    preferencesUrl(token: string) {
        return `${this.apiBase}/communications/p/${token}`;
    }

    /** Topic subscription (11 preference center): an explicit choice wins, otherwise the topic default. */
    async topicAllows(topicId: string, contactId: string) {
        const [topic, sub] = await Promise.all([
            this.prisma.commTopic.findUnique({ where: { id: topicId }, select: { default_opt_in: true, archived_at: true } }),
            this.prisma.commTopicSubscription.findUnique({ where: { contact_id_topic_id: { contact_id: contactId, topic_id: topicId } }, select: { status: true } }),
        ]);
        return sub ? sub.status === 'OPTED_IN' : !!topic?.default_opt_in;
    }

    /** Active suppression for an address (marketing sends are blocked by every entry; transactional only by blocks_transactional). */
    async findSuppression(organizationId: string, channel: CommChannel, address: string, transactional: boolean) {
        const normalized = normalizeAddress(channel, address);
        if (!normalized) return null;
        return this.prisma.commSuppression.findFirst({
            where: {
                organization_id: organizationId,
                channel,
                address: normalized,
                removed_at: null,
                OR: [{ expires_at: null }, { expires_at: { gt: new Date() } }],
                ...(transactional ? { blocks_transactional: true } : {}),
            },
            select: { id: true, reason: true },
        });
    }

    async hasConsent(contactId: string, channel: CommChannel) {
        const consent = await this.prisma.commConsent.findUnique({ where: { contact_id_channel: { contact_id: contactId, channel } }, select: { status: true } });
        return consent?.status === 'OPTED_IN';
    }

    /** Why this message may not be sent, or null. */
    async blockReason(message: { organization_id: string; channel: CommChannel; kind: CommMessageKind; to_address: string; recipient_contact_id: string | null; campaign_id: string | null }): Promise<{ code: BlockReason; detail: string } | null> {
        if (!normalizeAddress(message.channel, message.to_address)) {
            return { code: 'invalid_address', detail: message.channel === CommChannel.EMAIL ? 'Invalid email address' : 'Invalid phone number (use E.164, e.g. +306912345678)' };
        }
        const transactional = message.kind === CommMessageKind.TRANSACTIONAL || message.kind === CommMessageKind.NOTIFICATION;
        const suppression = await this.findSuppression(message.organization_id, message.channel, message.to_address, transactional);
        if (suppression) return { code: 'suppressed', detail: `Address is on the suppression list (${suppression.reason.toLowerCase().replace(/_/g, ' ')})` };
        if (message.kind === CommMessageKind.CAMPAIGN && message.campaign_id && message.recipient_contact_id) {
            const campaign = await this.prisma.campaign.findUnique({ where: { id: message.campaign_id }, select: { require_consent: true, topic_id: true } });
            if (campaign?.require_consent && !(await this.hasConsent(message.recipient_contact_id, message.channel))) {
                return { code: 'no_consent', detail: 'Contact has not opted in on this channel' };
            }
            if (campaign?.topic_id && !(await this.topicAllows(campaign.topic_id, message.recipient_contact_id))) {
                return { code: 'topic_unsubscribed', detail: 'Contact is not subscribed to the topic of this campaign' };
            }
        }
        return null;
    }

    /**
     * Claim and send a message. Safe to call concurrently: the QUEUED/SCHEDULED → SENDING transition is the lock.
     * Never throws; failures are written to the message.
     */
    async dispatch(messageId: string): Promise<CommMessageStatus> {
        const claimed = await this.prisma.commMessage.updateMany({
            where: { id: messageId, status: { in: [CommMessageStatus.QUEUED, CommMessageStatus.SCHEDULED] }, deleted_at: null },
            data: { status: CommMessageStatus.SENDING, attempt_count: { increment: 1 } },
        });
        if (!claimed.count) {
            const current = await this.prisma.commMessage.findUnique({ where: { id: messageId }, select: { status: true } });
            return current?.status ?? CommMessageStatus.FAILED;
        }
        const message = await this.prisma.commMessage.findUnique({
            where: { id: messageId },
            include: { sender_identity: { select: { address: true, display_name: true, reply_to_address: true, status: true } } },
        });
        if (!message) return CommMessageStatus.FAILED;

        try {
            const blocked = await this.blockReason(message);
            if (blocked) {
                await this.prisma.commMessage.update({ where: { id: message.id }, data: { status: CommMessageStatus.CANCELLED, cancelled_at: new Date(), failure_reason: blocked.detail } });
                await this.prisma.commMessageRecipient.updateMany({ where: { message_id: message.id }, data: { status: CommRecipientStatus.EXCLUDED, failure_reason: blocked.detail } });
                await this.prisma.campaignRecipient.updateMany({ where: { message_id: message.id }, data: { status: CommRecipientStatus.EXCLUDED, exclusion_reason: blocked.code } });
                if (message.campaign_id) await this.prisma.campaign.update({ where: { id: message.campaign_id }, data: { excluded_count: { increment: 1 } } }).catch(() => undefined);
                return CommMessageStatus.CANCELLED;
            }

            const provider = await this.providers.resolve(message.organization_id, message.channel, message.branch_id);
            if (!provider) return this.fail(message, this.providers.noProviderReason(message.channel), true);

            let providerMessageId: string | null = null;
            let segments: number | null = null;
            if (message.channel === CommChannel.EMAIL) {
                const fromAddress = message.from_address ?? message.sender_identity?.address ?? provider.config.default_from ?? null;
                if (!fromAddress) return this.fail(message, 'No sender address. Add a verified sender identity in Campaigns → Senders, or set a default from address on the Resend connection.', true);
                const fromName = message.from_name ?? message.sender_identity?.display_name ?? null;
                const from = fromAddress.includes('<') || !fromName ? fromAddress : `${fromName} <${fromAddress}>`;
                const html = message.body_html ? await this.prepareHtml(message) : null;
                const headers: Record<string, string> = { 'X-Entity-Ref-ID': message.id };
                if (message.unsubscribe_token) {
                    headers['List-Unsubscribe'] = `<${this.unsubscribeUrl(message.unsubscribe_token)}>`;
                    headers['List-Unsubscribe-Post'] = 'List-Unsubscribe=One-Click';
                }
                const res = await this.providers.sendEmail(provider, {
                    from,
                    to: message.to_name ? `${message.to_name.replace(/[<>"]/g, '')} <${message.to_address}>` : message.to_address,
                    subject: message.subject ?? '(no subject)',
                    html,
                    text: message.body_text,
                    reply_to: message.reply_to_address ?? message.sender_identity?.reply_to_address ?? null,
                    headers,
                    tags: [{ name: 'message_id', value: message.id.replace(/-/g, '_') }],
                });
                providerMessageId = res.provider_message_id;
            } else {
                let body = message.body_text ?? '';
                if (message.kind === CommMessageKind.CAMPAIGN && !/\bSTOP\b/i.test(body)) body = `${body}\nReply STOP to opt out.`;
                segments = smsSegments(body);
                const res = await this.providers.sendSms(provider, {
                    to: message.to_address,
                    body,
                    from: message.from_address ?? message.sender_identity?.address ?? null,
                    status_callback: provider.webhook_token ? `${this.apiBase}/communications/webhooks/twilio/${provider.webhook_token}` : null,
                });
                providerMessageId = res.provider_message_id;
            }

            const now = new Date();
            await this.prisma.commMessage.update({
                where: { id: message.id },
                data: {
                    status: CommMessageStatus.SENT,
                    sent_at: now,
                    provider: provider.provider,
                    provider_message_id: providerMessageId,
                    last_error: null,
                    next_attempt_at: null,
                    sms_segment_count: segments,
                    provider_metadata: { connection_id: provider.connection_id } as Prisma.InputJsonValue,
                },
            });
            await this.prisma.commMessageRecipient.updateMany({ where: { message_id: message.id, status: { in: [CommRecipientStatus.PENDING, CommRecipientStatus.QUEUED] } }, data: { status: CommRecipientStatus.SENT } });
            await this.prisma.campaignRecipient.updateMany({ where: { message_id: message.id }, data: { status: CommRecipientStatus.SENT, sent_at: now } });
            await this.prisma.commDeliveryEvent.create({ data: { organization_id: message.organization_id, message_id: message.id, type: CommDeliveryEventType.SENT, occurred_at: now, provider: provider.provider } });
            if (!message.is_test) {
                await this.stats.bumpDaily(message.organization_id, message.channel, message.kind, message.campaign_id, { sent_count: 1 }, now);
                await this.stats.bumpCampaign(message.campaign_id, { sent_count: 1 });
                if (message.campaign_run_id) await this.prisma.campaignRun.update({ where: { id: message.campaign_run_id }, data: { sent_count: { increment: 1 } } }).catch(() => undefined);
            }
            if (message.thread_id) await this.prisma.commThread.update({ where: { id: message.thread_id }, data: { last_message_at: now, message_count: { increment: 1 } } }).catch(() => undefined);
            if (message.template_id) await this.prisma.commTemplate.update({ where: { id: message.template_id }, data: { usage_count: { increment: 1 }, last_used_at: now } }).catch(() => undefined);
            return CommMessageStatus.SENT;
        } catch (error) {
            const permanent = error instanceof ProviderError ? error.permanent : false;
            const reason = (error as Error).message ?? 'Send failed';
            if (!(error instanceof ProviderError)) this.logger.error(`dispatch ${message.id} failed: ${reason}`);
            return this.fail(message, reason, permanent);
        }
    }

    private async fail(message: { id: string; attempt_count: number; campaign_run_id: string | null }, reason: string, permanent: boolean): Promise<CommMessageStatus> {
        // attempt_count was already incremented when the message was claimed.
        const attempts = message.attempt_count;
        if (!permanent && attempts < MAX_ATTEMPTS) {
            await this.prisma.commMessage.update({
                where: { id: message.id },
                data: { status: CommMessageStatus.QUEUED, last_error: reason.slice(0, 1000), next_attempt_at: new Date(Date.now() + 2 ** attempts * 60_000) },
            });
            return CommMessageStatus.QUEUED;
        }
        await this.prisma.commMessage.update({ where: { id: message.id }, data: { last_error: reason.slice(0, 1000) } });
        await this.stats.record(message.id, { type: CommDeliveryEventType.FAILED, reason });
        if (message.campaign_run_id) await this.prisma.campaignRun.update({ where: { id: message.campaign_run_id }, data: { failed_count: { increment: 1 } } }).catch(() => undefined);
        return CommMessageStatus.FAILED;
    }

    /** Rewrite links for click tracking, add the open pixel and the marketing footer. */
    private async prepareHtml(message: { id: string; organization_id: string; campaign_id: string | null; kind: CommMessageKind; body_html: string | null; tracking_enabled: boolean; unsubscribe_token: string | null; is_test: boolean }) {
        let html = message.body_html ?? '';
        if (message.unsubscribe_token && message.kind === CommMessageKind.CAMPAIGN) {
            const url = this.unsubscribeUrl(message.unsubscribe_token);
            if (!html.includes(url)) {
                const settings = await this.prisma.commSettings.findUnique({ where: { organization_id: message.organization_id }, select: { footer_address: true } });
                const prefs = this.preferencesUrl(message.unsubscribe_token);
                const footer = `<p style="margin-top:32px;font-size:12px;color:#6b7280">${settings?.footer_address ? `${settings.footer_address.replace(/</g, '&lt;')}<br/>` : ''}You receive this email because you subscribed to our updates. <a href="${prefs}" style="color:#6b7280">Manage preferences</a> · <a href="${url}" style="color:#6b7280">Unsubscribe</a></p>`;
                html = /<\/body>/i.test(html) ? html.replace(/<\/body>/i, `${footer}</body>`) : `${html}${footer}`;
            }
        }
        if (!message.tracking_enabled || message.is_test) return html;
        const urls = new Set<string>();
        for (const m of html.matchAll(/href="(https?:\/\/[^"]+)"/gi)) {
            if (!m[1].startsWith(`${this.apiBase}/communications/`)) urls.add(m[1]);
        }
        const tokens = new Map<string, string>();
        for (const url of urls) {
            const existing = await this.prisma.commTrackedLink.findFirst({
                where: message.campaign_id ? { campaign_id: message.campaign_id, original_url: url } : { message_id: message.id, original_url: url },
                select: { token: true },
            });
            const token = existing?.token ?? (await this.prisma.commTrackedLink.create({
                data: { organization_id: message.organization_id, campaign_id: message.campaign_id, message_id: message.campaign_id ? null : message.id, token: randomToken(12), original_url: url },
                select: { token: true },
            })).token;
            tokens.set(url, token);
        }
        html = html.replace(/href="(https?:\/\/[^"]+)"/gi, (full, url: string) => {
            const token = tokens.get(url);
            return token ? `href="${this.apiBase}/communications/t/c/${token}?m=${message.id}"` : full;
        });
        const pixel = `<img src="${this.apiBase}/communications/t/o/${message.id}" width="1" height="1" alt="" style="display:none" />`;
        return /<\/body>/i.test(html) ? html.replace(/<\/body>/i, `${pixel}</body>`) : `${html}${pixel}`;
    }
}
