import { Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { randomUUID } from 'crypto';
import {
    CampaignRunStatus, CampaignStatus, CommMessageKind, CommMessageSource, CommMessageStatus, CommRecipientStatus, ModuleKey, Prisma, RecordEntityType,
} from 'generated/prisma';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import { AuditService } from '@/shared/audit/audit.service';
import { EventsService } from '@/shared/events/events.service';
import { AuthorizationService } from '@/shared/authorization/authorization.service';
import { OrgContext } from '@/shared/authorization/interfaces/org-context.interface';
import { randomToken, renderTemplate } from '../common/comm.utils';
import { AudienceService } from '../audience/audience.service';
import { CommDispatchService } from '../delivery/comm-dispatch.service';

const TICK_MS = 15_000;
const BATCH = 100;
const CONCURRENCY = 5;
const CHUNK = 500;

/** Append UTM parameters to http(s) links in an HTML body. */
function withUtm(html: string | null, utm: Record<string, string> | null): string | null {
    if (!html || !utm || !Object.keys(utm).length) return html;
    return html.replace(/href="(https?:\/\/[^"]+)"/gi, (full, url: string) => {
        try {
            const u = new URL(url.replace(/&amp;/g, '&'));
            for (const [k, v] of Object.entries(utm)) if (v && !u.searchParams.has(k)) u.searchParams.set(k, v);
            return `href="${u.toString()}"`;
        } catch {
            return full;
        }
    });
}

/**
 * Background sender for module 11 (runs every 15 s via @nestjs/schedule; a Redis queue is not wired in this app).
 *  1. Starts due SCHEDULED campaigns: re-checks that the member who scheduled still holds communications.campaigns.send,
 *     resolves the audience (suppression + consent), creates the CampaignRun, CampaignRecipients and one CommMessage each.
 *  2. Dispatches due QUEUED / SCHEDULED messages in batches (campaign throttling, paused campaigns skipped, retries with backoff).
 *  3. Completes campaigns with nothing left to send and recovers messages stuck in SENDING after a crash.
 * The QUEUED → SENDING transition is the per-message lock, so several API instances can run this safely.
 */
@Injectable()
export class CampaignRunnerService {
    private readonly logger = new Logger(CampaignRunnerService.name);
    private running = false;
    private again = false;

    constructor(
        private readonly prisma: PrismaService,
        private readonly audit: AuditService,
        private readonly events: EventsService,
        private readonly authorization: AuthorizationService,
        private readonly audience: AudienceService,
        private readonly dispatch: CommDispatchService,
    ) { }

    /** Run a tick soon (after "send now", resume, or a one-off send). */
    kick() {
        setImmediate(() => void this.tick());
    }

    @Interval(TICK_MS)
    async tick() {
        if (this.running) {
            this.again = true;
            return;
        }
        this.running = true;
        try {
            do {
                this.again = false;
                await this.recoverStuck();
                await this.startDueCampaigns();
                await this.dispatchDue();
                await this.completeFinished();
            } while (this.again);
        } catch (error) {
            this.logger.error(`campaign runner tick failed: ${(error as Error).message}`);
        } finally {
            this.running = false;
        }
    }

    private async recoverStuck() {
        await this.prisma.commMessage.updateMany({
            where: { status: CommMessageStatus.SENDING, updated_at: { lt: new Date(Date.now() - 10 * 60_000) } },
            data: { status: CommMessageStatus.QUEUED, next_attempt_at: new Date() },
        });
    }

    /** Context of the member / service account who scheduled the campaign (from the audit trail). */
    private async schedulerContext(campaign: { id: string; organization_id: string; owner_membership_id: string | null }): Promise<OrgContext | null> {
        const event = await this.prisma.auditEvent.findFirst({
            where: { organization_id: campaign.organization_id, resource_type: 'campaign', resource_id: campaign.id, event_type: 'communications.campaign.scheduled' },
            orderBy: { created_at: 'desc' },
            select: { actor_service_account_id: true, metadata: true },
        });
        const membershipId = ((event?.metadata ?? {}) as Record<string, unknown>).actor_membership_id as string | undefined;
        if (!event?.actor_service_account_id && !membershipId && !campaign.owner_membership_id) return null;
        try {
            return await this.authorization.contextFor({
                organization_id: campaign.organization_id,
                membership_id: event?.actor_service_account_id ? null : membershipId ?? campaign.owner_membership_id,
                service_account_id: event?.actor_service_account_id ?? null,
                channel: 'automation',
            });
        } catch {
            return null;
        }
    }

    private async failCampaign(ctx: OrgContext | null, campaign: { id: string; name: string; branch_id: string | null }, reason: string) {
        await this.prisma.campaign.update({ where: { id: campaign.id }, data: { status: CampaignStatus.FAILED, failure_reason: reason } });
        await this.audit.record(ctx, 'communications.campaign.failed', { resource_type: 'campaign', resource_id: campaign.id, branch_id: campaign.branch_id, metadata: { reason } });
        if (ctx) this.events.publish(ctx, { event_key: 'communications.campaign.failed', module: ModuleKey.COMMUNICATION, entity_type: RecordEntityType.CAMPAIGN, entity_id: campaign.id, payload: { name: campaign.name, reason } });
    }

    private async startDueCampaigns() {
        const due = await this.prisma.campaign.findMany({
            where: { status: CampaignStatus.SCHEDULED, scheduled_at: { lte: new Date() }, archived_at: null },
            include: { audiences: true },
            take: 5,
            orderBy: { scheduled_at: 'asc' },
        });
        for (const campaign of due) {
            const claimed = await this.prisma.campaign.updateMany({ where: { id: campaign.id, status: CampaignStatus.SCHEDULED }, data: { status: CampaignStatus.SENDING, started_at: new Date(), next_run_at: null } });
            if (!claimed.count) continue;
            try {
                await this.startCampaign(campaign);
            } catch (error) {
                this.logger.error(`campaign ${campaign.id} could not start: ${(error as Error).message}`);
                await this.failCampaign(null, campaign, `Could not start: ${(error as Error).message}`);
            }
        }
    }

    private async startCampaign(campaign: Prisma.CampaignGetPayload<{ include: { audiences: true } }>) {
        const ctx = await this.schedulerContext(campaign);
        if (!ctx || !ctx.can('communications.campaigns.send')) {
            await this.failCampaign(ctx, campaign, 'The member who scheduled this campaign no longer has permission to send campaigns.');
            return;
        }
        const resolved = await this.audience.resolveCampaign(campaign.organization_id, campaign);
        const runNumber = (await this.prisma.campaignRun.count({ where: { campaign_id: campaign.id } })) + 1;
        const run = await this.prisma.campaignRun.create({
            data: { campaign_id: campaign.id, run_number: runNumber, status: CampaignRunStatus.RUNNING, scheduled_for: campaign.scheduled_at ?? new Date(), started_at: new Date(), audience_count: resolved.counts.included },
        });
        const utm = (campaign.utm ?? null) as Record<string, string> | null;
        const html = withUtm(campaign.body_html, utm);
        const now = new Date();

        for (let i = 0; i < resolved.included.length; i += CHUNK) {
            const chunk = resolved.included.slice(i, i + CHUNK);
            const messages: Prisma.CommMessageCreateManyInput[] = [];
            const recipients: Prisma.CampaignRecipientCreateManyInput[] = [];
            const messageRecipients: Prisma.CommMessageRecipientCreateManyInput[] = [];
            for (const r of chunk) {
                const id = randomUUID();
                const unsubscribe_token = randomToken(18);
                const context = { ...r.context, unsubscribe_url: this.dispatch.unsubscribeUrl(unsubscribe_token) };
                messages.push({
                    id,
                    organization_id: campaign.organization_id,
                    branch_id: campaign.branch_id,
                    channel: campaign.channel,
                    kind: CommMessageKind.CAMPAIGN,
                    source: CommMessageSource.CAMPAIGN,
                    status: CommMessageStatus.QUEUED,
                    template_id: campaign.template_id,
                    template_version_id: campaign.template_version_id,
                    subject: campaign.subject ? renderTemplate(campaign.subject, context) : null,
                    preheader: campaign.preheader ? renderTemplate(campaign.preheader, context) : null,
                    body_html: html ? renderTemplate(html, context, 'html') : null,
                    body_text: campaign.body_text ? renderTemplate(campaign.body_text, context) : null,
                    render_context: context as Prisma.InputJsonValue,
                    language: r.language ?? campaign.language,
                    sender_identity_id: campaign.sender_identity_id,
                    from_name: campaign.from_name,
                    reply_to_address: campaign.reply_to_address,
                    sent_by_membership_id: ctx.membership_id,
                    owner_membership_id: campaign.owner_membership_id,
                    recipient_kind: r.kind,
                    to_address: r.address,
                    to_name: r.name,
                    recipient_contact_id: r.contact_id,
                    recipient_membership_id: r.membership_id,
                    campaign_id: campaign.id,
                    campaign_run_id: run.id,
                    tracking_enabled: campaign.tracking_enabled,
                    unsubscribe_token,
                    queued_at: now,
                });
                recipients.push({ campaign_id: campaign.id, run_id: run.id, kind: r.kind, address: r.address, name: r.name, contact_id: r.contact_id, membership_id: r.membership_id, status: CommRecipientStatus.QUEUED, message_id: id, render_context: r.context as Prisma.InputJsonValue });
                messageRecipients.push({ message_id: id, role: 'TO', kind: r.kind, address: r.address, name: r.name, contact_id: r.contact_id, membership_id: r.membership_id, status: CommRecipientStatus.QUEUED });
            }
            await this.prisma.$transaction([
                this.prisma.commMessage.createMany({ data: messages }),
                this.prisma.commMessageRecipient.createMany({ data: messageRecipients, skipDuplicates: true }),
                this.prisma.campaignRecipient.createMany({ data: recipients, skipDuplicates: true }),
            ]);
        }
        if (resolved.excluded.length) {
            const seen = new Set<string>();
            const rows = resolved.excluded
                .filter((e) => {
                    const k = e.address ?? `contact:${e.contact_id}`;
                    if (seen.has(k) || resolved.included.some((r) => r.address === e.address)) return false;
                    seen.add(k);
                    return true;
                })
                .map<Prisma.CampaignRecipientCreateManyInput>((e) => ({ campaign_id: campaign.id, run_id: run.id, kind: e.contact_id ? 'CRM_CONTACT' : 'EXTERNAL', address: e.address ?? `contact:${e.contact_id}`, name: e.name, contact_id: e.contact_id, status: CommRecipientStatus.EXCLUDED, exclusion_reason: e.reason }));
            for (let i = 0; i < rows.length; i += CHUNK) await this.prisma.campaignRecipient.createMany({ data: rows.slice(i, i + CHUNK), skipDuplicates: true });
        }
        await this.prisma.campaign.update({ where: { id: campaign.id }, data: { audience_count: resolved.counts.included, excluded_count: resolved.counts.excluded } });
        await this.audit.record(ctx, 'communications.campaign.started', { resource_type: 'campaign', resource_id: campaign.id, branch_id: campaign.branch_id, metadata: { run_id: run.id, audience_count: resolved.counts.included, excluded: resolved.counts.by_reason } });
        this.events.publish(ctx, {
            event_key: 'communications.campaign.started', module: ModuleKey.COMMUNICATION, entity_type: RecordEntityType.CAMPAIGN, entity_id: campaign.id,
            payload: { name: campaign.name, run_id: run.id, audience_count: resolved.counts.included }, activity: { summary: `Campaign "${campaign.name}" started sending to ${resolved.counts.included} recipient(s)`, entity_label: campaign.name },
        });
    }

    private async dispatchDue() {
        const now = new Date();
        const candidates = await this.prisma.commMessage.findMany({
            where: {
                status: { in: [CommMessageStatus.QUEUED, CommMessageStatus.SCHEDULED] },
                deleted_at: null,
                AND: [
                    { OR: [{ scheduled_at: null }, { scheduled_at: { lte: now } }] },
                    { OR: [{ next_attempt_at: null }, { next_attempt_at: { lte: now } }] },
                    { OR: [{ campaign_id: null }, { campaign: { status: CampaignStatus.SENDING } }] },
                ],
            },
            select: { id: true, campaign_id: true, campaign: { select: { send_rate_per_hour: true } } },
            orderBy: [{ priority: 'desc' }, { created_at: 'asc' }],
            take: BATCH * 3,
        });
        const perCampaign = new Map<string, number>();
        const batch: string[] = [];
        for (const m of candidates) {
            if (batch.length >= BATCH) break;
            if (m.campaign_id && m.campaign?.send_rate_per_hour) {
                const cap = Math.max(1, Math.ceil((m.campaign.send_rate_per_hour * TICK_MS) / 3_600_000));
                const used = perCampaign.get(m.campaign_id) ?? 0;
                if (used >= cap) continue;
                perCampaign.set(m.campaign_id, used + 1);
            }
            batch.push(m.id);
        }
        for (let i = 0; i < batch.length; i += CONCURRENCY) {
            await Promise.all(batch.slice(i, i + CONCURRENCY).map((id) => this.dispatch.dispatch(id).catch((e) => this.logger.warn(`dispatch ${id}: ${(e as Error).message}`))));
        }
        if (batch.length === BATCH) this.again = true;
    }

    private async completeFinished() {
        const sending = await this.prisma.campaign.findMany({ where: { status: CampaignStatus.SENDING }, select: { id: true, name: true, organization_id: true, owner_membership_id: true, branch_id: true, sent_count: true, failed_count: true } });
        for (const c of sending) {
            const open = await this.prisma.commMessage.count({ where: { campaign_id: c.id, status: { in: [CommMessageStatus.QUEUED, CommMessageStatus.SENDING, CommMessageStatus.SCHEDULED] } } });
            if (open) continue;
            const now = new Date();
            const done = await this.prisma.campaign.updateMany({ where: { id: c.id, status: CampaignStatus.SENDING }, data: { status: CampaignStatus.COMPLETED, completed_at: now } });
            if (!done.count) continue;
            await this.prisma.campaignRun.updateMany({ where: { campaign_id: c.id, status: CampaignRunStatus.RUNNING }, data: { status: CampaignRunStatus.COMPLETED, completed_at: now } });
            const ctx = await this.schedulerContext(c);
            await this.audit.record(ctx, 'communications.campaign.completed', { resource_type: 'campaign', resource_id: c.id, branch_id: c.branch_id, metadata: { sent_count: c.sent_count, failed_count: c.failed_count } });
            if (ctx) {
                this.events.publish(ctx, {
                    event_key: 'communications.campaign.completed', module: ModuleKey.COMMUNICATION, entity_type: RecordEntityType.CAMPAIGN, entity_id: c.id,
                    payload: { name: c.name, sent_count: c.sent_count, failed_count: c.failed_count, owner_membership_id: c.owner_membership_id },
                    activity: { summary: `Campaign "${c.name}" finished sending`, entity_label: c.name },
                });
            }
        }
    }
}
