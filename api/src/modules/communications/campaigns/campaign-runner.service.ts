import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { DateTime } from 'luxon';
import {
    CampaignRunStatus, CampaignStatus, CommMessageKind, CommMessageSource, CommMessageStatus, CommRecipientStatus, ModuleKey, Prisma, RecordEntityType,
} from 'generated/prisma';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import { AuditService } from '@/shared/audit/audit.service';
import { EventsService } from '@/shared/events/events.service';
import { AuthorizationService } from '@/shared/authorization/authorization.service';
import { OrgContext } from '@/shared/authorization/interfaces/org-context.interface';
import { expandOccurrences } from '@/modules/calendar/utils/recurrence.utils';
import { randomToken, renderTemplate } from '../common/comm.utils';
import { AudienceCandidate, AudienceService } from '../audience/audience.service';
import { CommDispatchService } from '../delivery/comm-dispatch.service';
import { CommQueueService, MessageDue } from '../delivery/comm-queue.service';
import { CampaignVariantsService, normalizeShares } from './campaign-variants.service';

const CHUNK = 500;
/** Holdout recipients turned into messages per release-winner job (the job queues itself again for the rest). */
const RELEASE_BATCH = 5000;
/** A message stuck in SENDING this long (worker died mid-send) is queued again. */
const STUCK_MS = 10 * 60_000;
/** The sweep only re-queues work overdue by this much: anything newer is still on its way through the queue. */
const SWEEP_GRACE_MS = 2 * 60_000;
const SWEEP_TAKE = 500;
/** A run still PENDING (messages being written) after this long belongs to a start job that died. */
const START_TIMEOUT_MS = 60 * 60_000;

/** Largest positive UTC offset: recipient-time-zone sends are claimed this early so eastern zones get their local time too. */
const MAX_ZONE_LEAD_MS = 14 * 3600_000;

/** When the runner should claim a campaign scheduled at `at`. */
export const claimTime = (at: Date, inRecipientZone: boolean) => (inRecipientZone ? new Date(Math.max(Date.now(), at.getTime() - MAX_ZONE_LEAD_MS)) : at);

type RunnerCampaign = Prisma.CampaignGetPayload<{ include: { audiences: true } }>;
interface SendRow {
    kind: AudienceCandidate['kind'];
    address: string;
    name: string | null;
    contact_id: string | null;
    membership_id: string | null;
    language: string | null;
    timezone?: string | null;
    context: Record<string, unknown>;
}
interface VariantContent {
    id: string;
    subject: string | null;
    preheader: string | null;
    body_html: string | null;
    body_text: string | null;
}
/** Campaign throttling (send_rate_per_hour): message i of a batch is due at from + i * gap. */
interface Pace {
    from: number;
    gap: number;
    index: number;
}
const paceFor = (rate: number | null | undefined): Pace => ({ from: Date.now(), gap: rate ? 3_600_000 / rate : 0, index: 0 });

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
 * Campaign steps of module 11, run as BullMQ jobs (CampaignProcessor on the comm-campaigns queue; messages are sent by
 * CommMessageProcessor on comm-messages). Each step re-reads the campaign and claims it with a status transition, so
 * duplicate or late jobs do nothing and several API instances can run the workers.
 *  - start: re-checks that the member who scheduled still holds communications.campaigns.send, resolves the audience
 *    (suppression + consent + topic), creates the CampaignRun, CampaignRecipients and one CommMessage each, and queues the
 *    messages (paced by send_rate_per_hour). With an A/B test only the test group gets messages (split over the variants);
 *    the rest waits as PENDING recipients. With send_in_recipient_timezone each message gets its own scheduled_at.
 *  - releaseWinner: after the test window (or a manual pick) chooses the winner and sends it to the holdout group.
 *  - finalize: completes a campaign with nothing left to send; a recurring campaign (RRULE) is scheduled for its next run.
 *  - resume: re-paces and re-queues the open messages of a resumed campaign.
 *  - sweep (every minute): recovers stuck sends and re-queues any overdue work Redis may have lost.
 */
@Injectable()
export class CampaignRunnerService {
    private readonly logger = new Logger(CampaignRunnerService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly audit: AuditService,
        private readonly events: EventsService,
        private readonly authorization: AuthorizationService,
        private readonly audience: AudienceService,
        private readonly dispatch: CommDispatchService,
        private readonly variants: CampaignVariantsService,
        private readonly queue: CommQueueService,
    ) { }

    /** When the A/B winner is picked: now after a manual pick, otherwise at the end of the test window. */
    private winnerDecidesAt(c: { ab_winner_selected_at: Date | null; started_at: Date | null; ab_wait_hours: number | null }): Date | null {
        if (c.ab_winner_selected_at) return c.ab_winner_selected_at;
        return c.started_at ? new Date(c.started_at.getTime() + (c.ab_wait_hours ?? 4) * 3600_000) : null;
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
        await this.prisma.campaignRun.updateMany({ where: { campaign_id: campaign.id, status: { in: [CampaignRunStatus.PENDING, CampaignRunStatus.RUNNING] } }, data: { status: CampaignRunStatus.FAILED, completed_at: new Date() } });
        await this.audit.record(ctx, 'communications.campaign.failed', { resource_type: 'campaign', resource_id: campaign.id, branch_id: campaign.branch_id, metadata: { reason } });
        if (ctx) this.events.publish(ctx, { event_key: 'communications.campaign.failed', module: ModuleKey.COMMUNICATION, entity_type: RecordEntityType.CAMPAIGN, entity_id: campaign.id, payload: { name: campaign.name, reason } });
    }

    /** Job "start": claim a due SCHEDULED campaign (next_run_at is the claim time) and start a run. */
    async start(campaignId: string): Promise<string> {
        const campaign = await this.prisma.campaign.findUnique({ where: { id: campaignId }, include: { audiences: true } });
        if (!campaign || campaign.status !== CampaignStatus.SCHEDULED || campaign.archived_at) return 'skipped:not_scheduled';
        // next_run_at is scheduled_at, or up to 14 h earlier when sending in each recipient's time zone. Rescheduled → a newer job exists.
        const claimAt = campaign.next_run_at ?? campaign.scheduled_at;
        if (claimAt && claimAt.getTime() > Date.now() + 1000) return 'skipped:not_due';
        const startedAt = new Date();
        const claimed = await this.prisma.campaign.updateMany({
            where: { id: campaign.id, status: CampaignStatus.SCHEDULED },
            data: { status: CampaignStatus.SENDING, started_at: startedAt, next_run_at: null, ab_winner_selected_at: null },
        });
        if (!claimed.count) return 'skipped:claimed';
        if (campaign.ab_test_enabled) await this.prisma.campaignVariant.updateMany({ where: { campaign_id: campaign.id }, data: { is_winner: false } });
        try {
            await this.startCampaign({ ...campaign, ab_winner_selected_at: null, started_at: startedAt });
        } catch (error) {
            this.logger.error(`campaign ${campaign.id} could not start: ${(error as Error).message}`);
            await this.failCampaign(null, campaign, `Could not start: ${(error as Error).message}`);
            return 'failed';
        }
        await this.queue.enqueueFinalize(campaign.id);
        return 'started';
    }

    /** Local delivery time for a recipient: the campaign's wall-clock time in the recipient's zone (already past → now). */
    private recipientSendAt(campaign: RunnerCampaign, timezone: string | null | undefined): Date | null {
        if (!campaign.send_in_recipient_timezone || !campaign.scheduled_at || !timezone) return null;
        const wall = DateTime.fromJSDate(campaign.scheduled_at, { zone: campaign.schedule_timezone || 'UTC' });
        const local = wall.setZone(timezone, { keepLocalTime: true });
        if (!local.isValid) return null;
        const at = local.toJSDate();
        return at.getTime() > Date.now() ? at : null;
    }

    /**
     * Create the CommMessages (and campaign recipient rows) for recipients with their content (campaign or A/B variant),
     * and queue them chunk by chunk, so a large audience starts sending while the rest is still being written.
     */
    private async createMessages(campaign: RunnerCampaign, run: { id: string }, ctx: OrgContext, rows: { r: SendRow; variant: VariantContent | null; recipientId?: string }[], pace: Pace) {
        const utm = (campaign.utm ?? null) as Record<string, string> | null;
        const now = new Date();
        for (let i = 0; i < rows.length; i += CHUNK) {
            const chunk = rows.slice(i, i + CHUNK);
            const due: MessageDue[] = [];
            const messages: Prisma.CommMessageCreateManyInput[] = [];
            const recipients: Prisma.CampaignRecipientCreateManyInput[] = [];
            const messageRecipients: Prisma.CommMessageRecipientCreateManyInput[] = [];
            const links: Prisma.PrismaPromise<unknown>[] = [];
            for (const { r, variant, recipientId } of chunk) {
                const id = randomUUID();
                const unsubscribe_token = randomToken(18);
                const context = { ...r.context, unsubscribe_url: this.dispatch.unsubscribeUrl(unsubscribe_token), preferences_url: this.dispatch.preferencesUrl(unsubscribe_token) };
                const subject = variant?.subject || campaign.subject;
                const preheader = variant?.preheader || campaign.preheader;
                const html = withUtm(variant?.body_html || campaign.body_html, utm);
                const text = variant?.body_text || campaign.body_text;
                const sendAt = this.recipientSendAt(campaign, r.timezone);
                const pacedAt = pace.gap ? new Date(pace.from + pace.index++ * pace.gap) : null;
                due.push({ id, attempt_count: 0, scheduled_at: sendAt, next_attempt_at: pacedAt });
                messages.push({
                    id,
                    organization_id: campaign.organization_id,
                    branch_id: campaign.branch_id,
                    channel: campaign.channel,
                    kind: CommMessageKind.CAMPAIGN,
                    source: CommMessageSource.CAMPAIGN,
                    status: sendAt ? CommMessageStatus.SCHEDULED : CommMessageStatus.QUEUED,
                    scheduled_at: sendAt,
                    schedule_timezone: sendAt ? r.timezone ?? null : null,
                    template_id: campaign.template_id,
                    template_version_id: campaign.template_version_id,
                    subject: subject ? renderTemplate(subject, context) : null,
                    preheader: preheader ? renderTemplate(preheader, context) : null,
                    body_html: html ? renderTemplate(html, context, 'html') : null,
                    body_text: text ? renderTemplate(text, context) : null,
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
                    next_attempt_at: pacedAt,
                });
                if (recipientId) {
                    links.push(this.prisma.campaignRecipient.update({ where: { id: recipientId }, data: { message_id: id, status: CommRecipientStatus.QUEUED, scheduled_at: sendAt, variant_id: variant?.id ?? null, render_context: r.context as Prisma.InputJsonValue } }));
                } else {
                    recipients.push({
                        campaign_id: campaign.id, run_id: run.id, variant_id: variant?.id ?? null, kind: r.kind, address: r.address, name: r.name, contact_id: r.contact_id, membership_id: r.membership_id,
                        status: CommRecipientStatus.QUEUED, message_id: id, scheduled_at: sendAt, render_context: r.context as Prisma.InputJsonValue,
                    });
                }
                messageRecipients.push({ message_id: id, role: 'TO', kind: r.kind, address: r.address, name: r.name, contact_id: r.contact_id, membership_id: r.membership_id, status: CommRecipientStatus.QUEUED });
            }
            await this.prisma.$transaction([
                this.prisma.commMessage.createMany({ data: messages }),
                this.prisma.commMessageRecipient.createMany({ data: messageRecipients, skipDuplicates: true }),
                ...(recipients.length ? [this.prisma.campaignRecipient.createMany({ data: recipients, skipDuplicates: true })] : []),
                ...links,
            ]);
            await this.queue.enqueueMessages(due);
        }
    }

    private async startCampaign(campaign: RunnerCampaign) {
        const ctx = await this.schedulerContext(campaign);
        if (!ctx || !ctx.can('communications.campaigns.send')) {
            await this.failCampaign(ctx, campaign, 'The member who scheduled this campaign no longer has permission to send campaigns.');
            return;
        }
        const resolved = await this.audience.resolveCampaign(campaign.organization_id, campaign);
        const runNumber = (await this.prisma.campaignRun.count({ where: { campaign_id: campaign.id } })) + 1;
        // PENDING while the messages are written (they start sending chunk by chunk); finalize waits until it is RUNNING.
        const run = await this.prisma.campaignRun.create({
            data: { campaign_id: campaign.id, run_number: runNumber, status: CampaignRunStatus.PENDING, scheduled_for: campaign.scheduled_at ?? new Date(), started_at: new Date(), audience_count: resolved.counts.included },
        });

        // A/B test: shuffle, send the variants to the test group, keep the rest as PENDING recipients for the winner.
        const pace = paceFor(campaign.send_rate_per_hour);
        const variants = campaign.ab_test_enabled ? await this.prisma.campaignVariant.findMany({ where: { campaign_id: campaign.id }, orderBy: { sort_order: 'asc' } }) : [];
        let holdoutCount = 0;
        if (variants.length >= 2) {
            const pool = [...resolved.included];
            for (let i = pool.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [pool[i], pool[j]] = [pool[j], pool[i]];
            }
            const percent = Math.min(100, Math.max(1, campaign.ab_test_percent ?? 100));
            const testSize = percent >= 100 ? pool.length : Math.min(pool.length, Math.max(variants.length, Math.ceil((pool.length * percent) / 100)));
            const test = pool.slice(0, testSize);
            const holdout = pool.slice(testSize);
            const shares = normalizeShares(variants.map((v) => v.share_percent));
            const rows: { r: SendRow; variant: VariantContent }[] = [];
            let offset = 0;
            variants.forEach((v, idx) => {
                const size = idx === variants.length - 1 ? test.length - offset : Math.round((test.length * shares[idx]) / 100);
                for (const r of test.slice(offset, offset + size)) rows.push({ r, variant: v });
                offset += size;
            });
            // Holdout rows first: test messages start sending as soon as they are queued, and finalize must already see
            // the PENDING holdout, or it could complete the campaign before the winner is sent.
            holdoutCount = holdout.length;
            for (let i = 0; i < holdout.length; i += CHUNK) {
                await this.prisma.campaignRecipient.createMany({
                    data: holdout.slice(i, i + CHUNK).map((r) => ({
                        campaign_id: campaign.id, run_id: run.id, kind: r.kind, address: r.address, name: r.name, contact_id: r.contact_id, membership_id: r.membership_id,
                        status: CommRecipientStatus.PENDING,
                        render_context: { ...r.context, __timezone: r.timezone ?? null, __language: r.language ?? null } as Prisma.InputJsonValue,
                    })),
                    skipDuplicates: true,
                });
            }
            await this.createMessages(campaign, run, ctx, rows, pace);
        } else {
            await this.createMessages(campaign, run, ctx, resolved.included.map((r) => ({ r, variant: null })), pace);
        }
        const decideAt = this.winnerDecidesAt(campaign);
        if (holdoutCount && decideAt) await this.queue.enqueueWinnerRelease(campaign.id, decideAt);

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
        await this.prisma.campaignRun.updateMany({ where: { id: run.id, status: CampaignRunStatus.PENDING }, data: { status: CampaignRunStatus.RUNNING } });
        await this.audit.record(ctx, 'communications.campaign.started', {
            resource_type: 'campaign', resource_id: campaign.id, branch_id: campaign.branch_id,
            metadata: { run_id: run.id, run_number: runNumber, audience_count: resolved.counts.included, excluded: resolved.counts.by_reason, ab_variants: variants.length, ab_holdout: holdoutCount },
        });
        this.events.publish(ctx, {
            event_key: 'communications.campaign.started', module: ModuleKey.COMMUNICATION, entity_type: RecordEntityType.CAMPAIGN, entity_id: campaign.id,
            payload: { name: campaign.name, run_id: run.id, run_number: runNumber, audience_count: resolved.counts.included },
            activity: { summary: `Campaign "${campaign.name}" started sending to ${resolved.counts.included} recipient(s)`, entity_label: campaign.name },
        });
    }

    /** Job "release-winner": after the test window (or a manual pick), choose the A/B winner and send it to the holdout group. */
    async releaseWinner(campaignId: string): Promise<string> {
        const c = await this.prisma.campaign.findUnique({ where: { id: campaignId }, include: { audiences: true } });
        // Paused: resume queues this step again.
        if (!c || c.status !== CampaignStatus.SENDING || !c.ab_test_enabled) return 'skipped:not_sending';
        const decideAt = this.winnerDecidesAt(c);
        if (!decideAt || decideAt.getTime() > Date.now() + 1000) return 'skipped:not_due';
        const ctx = await this.schedulerContext(c);
        if (!ctx || !ctx.can('communications.campaigns.send')) {
            await this.failCampaign(ctx, c, 'The member who scheduled this campaign no longer has permission to send campaigns.');
            return 'failed:permission';
        }
        let winner = await this.prisma.campaignVariant.findFirst({ where: { campaign_id: c.id, is_winner: true } });
        if (!winner) {
            const best = await this.variants.bestVariant(c);
            if (!best) return 'skipped:no_variants';
            await this.variants.markWinner(c.id, best.id);
            winner = await this.prisma.campaignVariant.findUnique({ where: { id: best.id } });
            await this.audit.record(ctx, 'communications.campaign.ab_winner_selected', { resource_type: 'campaign', resource_id: c.id, branch_id: c.branch_id, metadata: { variant_id: best.id, label: best.label, rate: best.rate, metric: c.ab_metric, manual: false } });
            this.events.publish(ctx, {
                event_key: 'communications.campaign.ab_winner_selected', module: ModuleKey.COMMUNICATION, entity_type: RecordEntityType.CAMPAIGN, entity_id: c.id,
                payload: { name: c.name, variant_id: best.id, label: best.label, owner_membership_id: c.owner_membership_id },
                activity: { summary: `Variant ${best.label} won the A/B test of "${c.name}"`, entity_label: c.name },
            });
        }
        if (!winner) return 'skipped:no_winner';
        const pending = await this.prisma.campaignRecipient.findMany({ where: { campaign_id: c.id, status: CommRecipientStatus.PENDING, message_id: null }, take: RELEASE_BATCH, orderBy: { id: 'asc' } });
        if (!pending.length) {
            await this.queue.enqueueFinalize(c.id);
            return 'released';
        }
        const runId = pending[0]?.run_id ?? (await this.prisma.campaignRun.findFirst({ where: { campaign_id: c.id }, orderBy: { run_number: 'desc' }, select: { id: true } }))?.id;
        if (!runId) return 'skipped:no_run';
        // Suppression, consent and topic are checked again per message by the dispatcher (they may change during the test).
        const rows = pending.map((p) => {
            const { __timezone, __language, ...context } = (p.render_context ?? {}) as Record<string, unknown>;
            return {
                recipientId: p.id,
                variant: winner,
                r: { kind: p.kind, address: p.address, name: p.name, contact_id: p.contact_id, membership_id: p.membership_id, language: (__language as string | null) ?? null, timezone: (__timezone as string | null) ?? null, context },
            };
        });
        // Throttled campaigns continue pacing after the messages already waiting in the queue.
        const pace = paceFor(c.send_rate_per_hour);
        if (pace.gap) {
            const last = await this.prisma.commMessage.findFirst({ where: { campaign_id: c.id, status: { in: [CommMessageStatus.QUEUED, CommMessageStatus.SCHEDULED] }, next_attempt_at: { not: null } }, orderBy: { next_attempt_at: 'desc' }, select: { next_attempt_at: true } });
            if (last?.next_attempt_at) pace.from = Math.max(pace.from, last.next_attempt_at.getTime() + pace.gap);
        }
        await this.createMessages(c, { id: runId }, ctx, rows, pace);
        // More holdout recipients than one batch: continue right away in a new job.
        if (pending.length === RELEASE_BATCH) await this.queue.enqueueWinnerRelease(c.id, new Date());
        else await this.queue.enqueueFinalize(c.id);
        return 'released';
    }

    /** Job "finalize": complete a SENDING campaign with nothing left to send, or schedule the next run of a recurring one. */
    async finalize(campaignId: string): Promise<string> {
        const c = await this.prisma.campaign.findUnique({
            where: { id: campaignId },
            select: {
                id: true, name: true, status: true, organization_id: true, owner_membership_id: true, branch_id: true, sent_count: true, failed_count: true,
                scheduled_at: true, schedule_timezone: true, recurrence_rule: true, recurrence_ends_at: true, send_in_recipient_timezone: true,
            },
        });
        if (!c || c.status !== CampaignStatus.SENDING) return 'skipped:not_sending';
        // The start job is still writing messages; it queues a finalize when done.
        if (await this.prisma.campaignRun.count({ where: { campaign_id: c.id, status: CampaignRunStatus.PENDING } })) return 'starting';
        const open = await this.prisma.commMessage.count({ where: { campaign_id: c.id, status: { in: [CommMessageStatus.QUEUED, CommMessageStatus.SENDING, CommMessageStatus.SCHEDULED] } } });
        if (open) return 'open';
        // An A/B holdout group is still waiting for the winner.
        if (await this.prisma.campaignRecipient.count({ where: { campaign_id: c.id, status: CommRecipientStatus.PENDING, message_id: null } })) return 'waiting_for_winner';
        const now = new Date();
        const next = await this.nextOccurrence(c);
        if (next) {
            // Recurring campaign: schedule the next run (a new CampaignRun with a freshly resolved audience).
            const next_run_at = claimTime(next, c.send_in_recipient_timezone);
            const rescheduled = await this.prisma.campaign.updateMany({
                where: { id: c.id, status: CampaignStatus.SENDING },
                data: { status: CampaignStatus.SCHEDULED, scheduled_at: next, next_run_at },
            });
            if (!rescheduled.count) return 'skipped:claimed';
            await this.prisma.campaignRun.updateMany({ where: { campaign_id: c.id, status: CampaignRunStatus.RUNNING }, data: { status: CampaignRunStatus.COMPLETED, completed_at: now } });
            await this.queue.enqueueCampaignStart({ id: c.id, next_run_at });
            const ctx = await this.schedulerContext(c);
            await this.audit.record(ctx, 'communications.campaign.run_completed', { resource_type: 'campaign', resource_id: c.id, branch_id: c.branch_id, metadata: { next_run_at: next.toISOString() } });
            if (ctx) this.events.publish(ctx, { event_key: 'communications.campaign.run_completed', module: ModuleKey.COMMUNICATION, entity_type: RecordEntityType.CAMPAIGN, entity_id: c.id, payload: { name: c.name, next_run_at: next.toISOString() } });
            return 'rescheduled';
        }
        const done = await this.prisma.campaign.updateMany({ where: { id: c.id, status: CampaignStatus.SENDING }, data: { status: CampaignStatus.COMPLETED, completed_at: now, next_run_at: null } });
        if (!done.count) return 'skipped:claimed';
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
        return 'completed';
    }

    /**
     * After a campaign is resumed: its message jobs were skipped while it was paused, so give every open message a fresh
     * due time (paced from now when the campaign is throttled, otherwise now) and queue it again, plus the A/B release.
     */
    async resume(campaignId: string) {
        const c = await this.prisma.campaign.findUnique({ where: { id: campaignId }, select: { id: true, status: true, send_rate_per_hour: true, ab_test_enabled: true, ab_winner_selected_at: true, started_at: true, ab_wait_hours: true } });
        if (!c || c.status !== CampaignStatus.SENDING) return;
        const now = new Date();
        const open = [CommMessageStatus.QUEUED, CommMessageStatus.SCHEDULED];
        if (c.send_rate_per_hour) {
            const gapMs = 3_600_000 / c.send_rate_per_hour;
            // Columns are timestamp(3) holding UTC; the ISO literal's zone suffix is ignored by the cast.
            await this.prisma.$executeRaw`
                UPDATE comm_messages m
                SET next_attempt_at = ${now.toISOString()}::timestamp + ((r.rn - 1) * ${gapMs}::float8) * interval '1 millisecond'
                FROM (
                    SELECT id, row_number() OVER (ORDER BY created_at, id) AS rn
                    FROM comm_messages
                    WHERE campaign_id = ${c.id} AND status IN ('QUEUED', 'SCHEDULED') AND deleted_at IS NULL
                ) r
                WHERE m.id = r.id`;
        } else {
            await this.prisma.commMessage.updateMany({ where: { campaign_id: c.id, status: { in: open }, deleted_at: null }, data: { next_attempt_at: now } });
        }
        let cursor: string | undefined;
        for (;;) {
            const page = await this.prisma.commMessage.findMany({
                where: { campaign_id: c.id, status: { in: open }, deleted_at: null },
                select: { id: true, attempt_count: true, scheduled_at: true, next_attempt_at: true },
                orderBy: { id: 'asc' },
                take: 1000,
                ...(cursor && { cursor: { id: cursor }, skip: 1 }),
            });
            if (!page.length) break;
            await this.queue.enqueueMessages(page);
            cursor = page[page.length - 1].id;
        }
        const decideAt = c.ab_test_enabled ? this.winnerDecidesAt(c) : null;
        if (decideAt) await this.queue.enqueueWinnerRelease(c.id, decideAt, true);
        await this.queue.enqueueFinalize(c.id);
    }

    /**
     * Job "sweep" (every minute, one instance): the safety net that keeps the queues and the database in step.
     * Re-queues sends stuck in SENDING (a worker died mid-send) and any overdue message, campaign start, A/B release or
     * completion check whose job is gone (Redis flushed, enqueue failed after the row was written, process crashed).
     */
    async sweep(): Promise<string> {
        const now = Date.now();
        const cutoff = new Date(now - SWEEP_GRACE_MS);

        const stuck = await this.prisma.commMessage.findMany({ where: { status: CommMessageStatus.SENDING, updated_at: { lt: new Date(now - STUCK_MS) } }, select: { id: true }, take: SWEEP_TAKE });
        if (stuck.length) {
            await this.prisma.commMessage.updateMany({ where: { id: { in: stuck.map((m) => m.id) }, status: CommMessageStatus.SENDING }, data: { status: CommMessageStatus.QUEUED, next_attempt_at: new Date(now) } });
        }

        const overdue = await this.prisma.commMessage.findMany({
            where: {
                status: { in: [CommMessageStatus.QUEUED, CommMessageStatus.SCHEDULED] },
                deleted_at: null,
                updated_at: { lte: cutoff },
                AND: [
                    { OR: [{ scheduled_at: null }, { scheduled_at: { lte: cutoff } }] },
                    { OR: [{ next_attempt_at: null }, { next_attempt_at: { lte: cutoff } }] },
                    { OR: [{ campaign_id: null }, { campaign: { status: CampaignStatus.SENDING } }] },
                ],
            },
            select: { id: true, attempt_count: true, scheduled_at: true, next_attempt_at: true },
            orderBy: { created_at: 'asc' },
            take: SWEEP_TAKE,
        });
        const requeued = await this.queue.ensureMessages(overdue);
        if (stuck.length) {
            await this.queue.enqueueMessages(await this.prisma.commMessage.findMany({ where: { id: { in: stuck.map((m) => m.id) }, status: CommMessageStatus.QUEUED }, select: { id: true, attempt_count: true, scheduled_at: true, next_attempt_at: true } }));
        }

        const due = await this.prisma.campaign.findMany({
            where: { status: CampaignStatus.SCHEDULED, archived_at: null, OR: [{ next_run_at: { lte: new Date(now) } }, { next_run_at: null, scheduled_at: { lte: new Date(now) } }] },
            select: { id: true, next_run_at: true },
            take: SWEEP_TAKE,
        });
        for (const c of due) await this.queue.enqueueCampaignStart(c, true);

        // A start that died half-way (process killed while writing messages) leaves its run PENDING: fail it visibly.
        const interrupted = await this.prisma.campaignRun.findMany({
            where: { status: CampaignRunStatus.PENDING, started_at: { lt: new Date(now - START_TIMEOUT_MS) }, campaign: { status: CampaignStatus.SENDING } },
            select: { campaign: { select: { id: true, name: true, branch_id: true } } },
        });
        for (const { campaign } of interrupted) {
            await this.failCampaign(null, campaign, 'Sending was interrupted while the messages were being prepared. Duplicate the campaign to send it again.');
        }

        const sending = await this.prisma.campaign.findMany({
            where: { status: CampaignStatus.SENDING },
            select: { id: true, ab_test_enabled: true, ab_winner_selected_at: true, started_at: true, ab_wait_hours: true },
        });
        for (const c of sending) {
            const decideAt = c.ab_test_enabled ? this.winnerDecidesAt(c) : null;
            if (decideAt && decideAt.getTime() <= now - SWEEP_GRACE_MS && (await this.prisma.campaignRecipient.count({ where: { campaign_id: c.id, status: CommRecipientStatus.PENDING, message_id: null } }))) {
                await this.queue.enqueueWinnerRelease(c.id, decideAt, true);
            }
            await this.queue.enqueueFinalize(c.id);
        }
        if (stuck.length || requeued) this.logger.warn(`sweep: recovered ${stuck.length} stuck send(s), re-queued ${requeued} overdue message(s)`);
        return `stuck=${stuck.length} requeued=${requeued} starts=${due.length} sending=${sending.length}`;
    }

    /** Next start of a recurring campaign after the run that just finished (the series is anchored at the first run). */
    async nextOccurrence(c: { id: string; scheduled_at: Date | null; schedule_timezone: string | null; recurrence_rule: string | null; recurrence_ends_at: Date | null }): Promise<Date | null> {
        if (!c.recurrence_rule || !c.scheduled_at) return null;
        const first = await this.prisma.campaignRun.findFirst({ where: { campaign_id: c.id }, orderBy: { run_number: 'asc' }, select: { scheduled_for: true } });
        const anchor = first?.scheduled_for ?? c.scheduled_at;
        const from = new Date(Math.max(c.scheduled_at.getTime(), Date.now()) + 1000);
        const [next] = expandOccurrences(anchor, anchor, c.recurrence_rule, c.schedule_timezone || 'UTC', from, new Date(from.getTime() + 400 * 24 * 3600_000), [], 1);
        if (!next) return null;
        if (c.recurrence_ends_at && next.start > c.recurrence_ends_at) return null;
        return next.start;
    }
}
