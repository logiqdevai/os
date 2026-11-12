import { Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
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
import { CampaignVariantsService, normalizeShares } from './campaign-variants.service';

const TICK_MS = 15_000;
const BATCH = 100;
const CONCURRENCY = 5;
const CHUNK = 500;

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
 *     resolves the audience (suppression + consent + topic), creates the CampaignRun, CampaignRecipients and one CommMessage
 *     each. With an A/B test only the test group gets messages (split over the variants); the rest waits as PENDING recipients.
 *     With send_in_recipient_timezone each message gets its own scheduled_at (the campaign's wall-clock time in the recipient zone).
 *  2. Releases A/B winners after the test window and sends the winner to the holdout group.
 *  3. Dispatches due QUEUED / SCHEDULED messages in batches (campaign throttling, paused campaigns skipped, retries with backoff).
 *  4. Completes campaigns with nothing left to send; recurring campaigns (RRULE) are rescheduled for their next run instead.
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
        private readonly variants: CampaignVariantsService,
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
                await this.releaseWinners();
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
        const now = new Date();
        // next_run_at is the claim time: scheduled_at, or up to 14 h earlier when sending in each recipient's time zone.
        const due = await this.prisma.campaign.findMany({
            where: { status: CampaignStatus.SCHEDULED, archived_at: null, OR: [{ next_run_at: { lte: now } }, { next_run_at: null, scheduled_at: { lte: now } }] },
            include: { audiences: true },
            take: 5,
            orderBy: { scheduled_at: 'asc' },
        });
        for (const campaign of due) {
            const claimed = await this.prisma.campaign.updateMany({
                where: { id: campaign.id, status: CampaignStatus.SCHEDULED },
                data: { status: CampaignStatus.SENDING, started_at: new Date(), next_run_at: null, ab_winner_selected_at: null },
            });
            if (!claimed.count) continue;
            if (campaign.ab_test_enabled) await this.prisma.campaignVariant.updateMany({ where: { campaign_id: campaign.id }, data: { is_winner: false } });
            try {
                await this.startCampaign({ ...campaign, ab_winner_selected_at: null, started_at: new Date() });
            } catch (error) {
                this.logger.error(`campaign ${campaign.id} could not start: ${(error as Error).message}`);
                await this.failCampaign(null, campaign, `Could not start: ${(error as Error).message}`);
            }
        }
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

    /** Create the CommMessages (and campaign recipient rows) for recipients with their content (campaign or A/B variant). */
    private async createMessages(campaign: RunnerCampaign, run: { id: string }, ctx: OrgContext, rows: { r: SendRow; variant: VariantContent | null; recipientId?: string }[]) {
        const utm = (campaign.utm ?? null) as Record<string, string> | null;
        const now = new Date();
        for (let i = 0; i < rows.length; i += CHUNK) {
            const chunk = rows.slice(i, i + CHUNK);
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
        const run = await this.prisma.campaignRun.create({
            data: { campaign_id: campaign.id, run_number: runNumber, status: CampaignRunStatus.RUNNING, scheduled_for: campaign.scheduled_at ?? new Date(), started_at: new Date(), audience_count: resolved.counts.included },
        });

        // A/B test: shuffle, send the variants to the test group, keep the rest as PENDING recipients for the winner.
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
            await this.createMessages(campaign, run, ctx, rows);
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
        } else {
            await this.createMessages(campaign, run, ctx, resolved.included.map((r) => ({ r, variant: null })));
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

    /** A/B: after the test window (or a manual pick), choose the winner and send it to the holdout group. */
    private async releaseWinners() {
        const now = Date.now();
        const tests = await this.prisma.campaign.findMany({
            where: { status: CampaignStatus.SENDING, ab_test_enabled: true, recipients: { some: { status: CommRecipientStatus.PENDING, message_id: null } } },
            include: { audiences: true },
            take: 10,
        });
        for (const c of tests) {
            const due = !!c.ab_winner_selected_at || (!!c.started_at && now >= c.started_at.getTime() + (c.ab_wait_hours ?? 4) * 3600_000);
            if (!due) continue;
            const ctx = await this.schedulerContext(c);
            if (!ctx || !ctx.can('communications.campaigns.send')) {
                await this.failCampaign(ctx, c, 'The member who scheduled this campaign no longer has permission to send campaigns.');
                continue;
            }
            let winner = await this.prisma.campaignVariant.findFirst({ where: { campaign_id: c.id, is_winner: true } });
            if (!winner) {
                const best = await this.variants.bestVariant(c);
                if (!best) continue;
                await this.variants.markWinner(c.id, best.id);
                winner = await this.prisma.campaignVariant.findUnique({ where: { id: best.id } });
                await this.audit.record(ctx, 'communications.campaign.ab_winner_selected', { resource_type: 'campaign', resource_id: c.id, branch_id: c.branch_id, metadata: { variant_id: best.id, label: best.label, rate: best.rate, metric: c.ab_metric, manual: false } });
                this.events.publish(ctx, {
                    event_key: 'communications.campaign.ab_winner_selected', module: ModuleKey.COMMUNICATION, entity_type: RecordEntityType.CAMPAIGN, entity_id: c.id,
                    payload: { name: c.name, variant_id: best.id, label: best.label, owner_membership_id: c.owner_membership_id },
                    activity: { summary: `Variant ${best.label} won the A/B test of "${c.name}"`, entity_label: c.name },
                });
            }
            if (!winner) continue;
            const pending = await this.prisma.campaignRecipient.findMany({ where: { campaign_id: c.id, status: CommRecipientStatus.PENDING, message_id: null }, take: 5000 });
            const runId = pending[0]?.run_id ?? (await this.prisma.campaignRun.findFirst({ where: { campaign_id: c.id }, orderBy: { run_number: 'desc' }, select: { id: true } }))?.id;
            if (!runId) continue;
            // Suppression, consent and topic are checked again per message by the dispatcher (they may change during the test).
            const rows = pending.map((p) => {
                const { __timezone, __language, ...context } = (p.render_context ?? {}) as Record<string, unknown>;
                return {
                    recipientId: p.id,
                    variant: winner,
                    r: { kind: p.kind, address: p.address, name: p.name, contact_id: p.contact_id, membership_id: p.membership_id, language: (__language as string | null) ?? null, timezone: (__timezone as string | null) ?? null, context },
                };
            });
            await this.createMessages(c, { id: runId }, ctx, rows);
            this.again = true;
        }
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
        const sending = await this.prisma.campaign.findMany({
            where: { status: CampaignStatus.SENDING },
            select: {
                id: true, name: true, organization_id: true, owner_membership_id: true, branch_id: true, sent_count: true, failed_count: true,
                scheduled_at: true, schedule_timezone: true, recurrence_rule: true, recurrence_ends_at: true, send_in_recipient_timezone: true,
            },
        });
        for (const c of sending) {
            const open = await this.prisma.commMessage.count({ where: { campaign_id: c.id, status: { in: [CommMessageStatus.QUEUED, CommMessageStatus.SENDING, CommMessageStatus.SCHEDULED] } } });
            if (open) continue;
            // An A/B holdout group is still waiting for the winner.
            if (await this.prisma.campaignRecipient.count({ where: { campaign_id: c.id, status: CommRecipientStatus.PENDING, message_id: null } })) continue;
            const now = new Date();
            const next = await this.nextOccurrence(c);
            if (next) {
                // Recurring campaign: schedule the next run (a new CampaignRun with a freshly resolved audience).
                const rescheduled = await this.prisma.campaign.updateMany({
                    where: { id: c.id, status: CampaignStatus.SENDING },
                    data: { status: CampaignStatus.SCHEDULED, scheduled_at: next, next_run_at: claimTime(next, c.send_in_recipient_timezone) },
                });
                if (!rescheduled.count) continue;
                await this.prisma.campaignRun.updateMany({ where: { campaign_id: c.id, status: CampaignRunStatus.RUNNING }, data: { status: CampaignRunStatus.COMPLETED, completed_at: now } });
                const ctx = await this.schedulerContext(c);
                await this.audit.record(ctx, 'communications.campaign.run_completed', { resource_type: 'campaign', resource_id: c.id, branch_id: c.branch_id, metadata: { next_run_at: next.toISOString() } });
                if (ctx) this.events.publish(ctx, { event_key: 'communications.campaign.run_completed', module: ModuleKey.COMMUNICATION, entity_type: RecordEntityType.CAMPAIGN, entity_id: c.id, payload: { name: c.name, next_run_at: next.toISOString() } });
                continue;
            }
            const done = await this.prisma.campaign.updateMany({ where: { id: c.id, status: CampaignStatus.SENDING }, data: { status: CampaignStatus.COMPLETED, completed_at: now, next_run_at: null } });
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
