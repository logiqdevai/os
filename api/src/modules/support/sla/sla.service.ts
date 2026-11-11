import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ModuleKey, Prisma, SlaMetric, SupportChannelType, TicketPriority, TicketStatusCategory, TicketType } from 'generated/prisma';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import { AuthorizationService } from '@/shared/authorization/authorization.service';
import { EventsService } from '@/shared/events/events.service';
import { AuditService } from '@/shared/audit/audit.service';
import { addBusinessMinutes, BusinessHours, parseBusinessHours } from './business-hours.utils';

type Tx = Prisma.TransactionClient;

type PolicyWithTargets = Prisma.SlaPolicyGetPayload<{ include: { targets: true } }>;

interface PolicyMatchInput {
    sla_policy_id?: string | null;
    category_id?: string | null;
    inbox_id?: string | null;
    priority: TicketPriority;
    channel_type?: SupportChannelType | null;
    company_id?: string | null;
    type?: TicketType | null;
}

const targetFor = (policy: PolicyWithTargets, priority: TicketPriority, metric: SlaMetric) => {
    const t = policy.targets.find((x) => x.priority === priority);
    if (!t) return null;
    return metric === 'FIRST_RESPONSE' ? t.first_response_minutes : metric === 'NEXT_RESPONSE' ? t.next_response_minutes : t.resolution_minutes;
};

/**
 * SLA timers (13 §2, §7). One TicketSlaTimer per metric; the ticket keeps denormalized due dates and the
 * `sla_at_risk` / `sla_breached` flags. Timers pause while the ticket is in a status with `pauses_sla`.
 * A cron sweep marks timers at risk / breached and publishes `support.ticket.sla_at_risk|sla_breached` for 20.
 */
@Injectable()
export class SlaService {
    private readonly logger = new Logger(SlaService.name);
    private sweeping = false;

    constructor(
        private readonly prisma: PrismaService,
        private readonly events: EventsService,
        private readonly audit: AuditService,
        private readonly authorization: AuthorizationService,
    ) { }

    // ---------------------------------------------------------------------------------------------
    // Policy resolution
    // ---------------------------------------------------------------------------------------------

    /** Explicit policy → category default → inbox default → settings default → first matching policy by sort order. */
    async resolvePolicy(tx: Tx, organizationId: string, input: PolicyMatchInput): Promise<PolicyWithTargets | null> {
        const include = { targets: true } as const;
        const byId = async (id?: string | null) => (id ? tx.slaPolicy.findFirst({ where: { id, organization_id: organizationId, archived_at: null }, include }) : null);

        const explicit = await byId(input.sla_policy_id);
        if (explicit) return explicit;
        if (input.category_id) {
            const cat = await tx.ticketCategory.findFirst({ where: { id: input.category_id, organization_id: organizationId }, select: { default_sla_policy_id: true } });
            const p = await byId(cat?.default_sla_policy_id);
            if (p) return p;
        }
        if (input.inbox_id) {
            const inbox = await tx.supportInbox.findFirst({ where: { id: input.inbox_id, organization_id: organizationId }, select: { default_sla_policy_id: true } });
            const p = await byId(inbox?.default_sla_policy_id);
            if (p) return p;
        }
        const policies = await tx.slaPolicy.findMany({ where: { organization_id: organizationId, archived_at: null }, include, orderBy: [{ sort_order: 'asc' }, { created_at: 'asc' }] });
        const matching = policies.filter((p) => !p.is_default && this.matches(p.conditions, input));
        if (matching.length) return matching[0];
        const settings = await tx.supportSettings.findUnique({ where: { organization_id: organizationId }, select: { default_sla_policy_id: true } });
        return policies.find((p) => p.id === settings?.default_sla_policy_id) ?? policies.find((p) => p.is_default) ?? null;
    }

    private matches(conditions: Prisma.JsonValue, input: PolicyMatchInput) {
        if (!conditions || typeof conditions !== 'object' || Array.isArray(conditions)) return false;
        const c = conditions as Record<string, unknown>;
        const check = (list: unknown, value?: string | null) => !Array.isArray(list) || !list.length || (!!value && list.includes(value));
        const hasAny = ['categories', 'channel_types', 'company_ids', 'ticket_types', 'priorities'].some((k) => Array.isArray(c[k]) && (c[k] as unknown[]).length);
        if (!hasAny) return false;
        return (
            check(c.categories, input.category_id) &&
            check(c.channel_types, input.channel_type) &&
            check(c.company_ids, input.company_id) &&
            check(c.ticket_types, input.type) &&
            check(c.priorities, input.priority)
        );
    }

    private async businessHours(tx: Tx, organizationId: string, policy: { use_business_hours: boolean }): Promise<BusinessHours | null> {
        if (!policy.use_business_hours) return null;
        const org = await tx.organization.findUnique({ where: { id: organizationId }, select: { business_hours: true, working_days: true, default_timezone: true } });
        return parseBusinessHours(org?.business_hours, org?.working_days, org?.default_timezone ?? 'UTC');
    }

    private due(start: Date, minutes: number, bh: BusinessHours | null) {
        return bh ? addBusinessMinutes(start, minutes, bh) : new Date(start.getTime() + minutes * 60_000);
    }

    // ---------------------------------------------------------------------------------------------
    // Timer lifecycle
    // ---------------------------------------------------------------------------------------------

    /** Called on ticket create (or when the policy changes): (re)creates FIRST_RESPONSE + RESOLUTION timers. */
    async applyPolicy(tx: Tx, ticketId: string, policy: PolicyWithTargets | null, opts: { paused?: boolean; firstRespondedAt?: Date | null } = {}) {
        await tx.ticketSlaTimer.updateMany({ where: { ticket_id: ticketId, completed_at: null, status: { in: ['RUNNING', 'PAUSED'] } }, data: { status: 'CANCELLED', completed_at: new Date() } });
        const ticket = await tx.ticket.findUniqueOrThrow({ where: { id: ticketId }, select: { organization_id: true, priority: true, created_at: true } });
        if (!policy) {
            await tx.ticket.update({ where: { id: ticketId }, data: { sla_policy_id: null, first_response_due_at: null, next_response_due_at: null, resolution_due_at: null, sla_at_risk: false, sla_breached: false } });
            return;
        }
        const bh = await this.businessHours(tx, ticket.organization_id, policy);
        const now = new Date();
        const metrics: SlaMetric[] = opts.firstRespondedAt ? ['RESOLUTION'] : ['FIRST_RESPONSE', 'RESOLUTION'];
        for (const metric of metrics) {
            const minutes = targetFor(policy, ticket.priority, metric);
            if (!minutes) continue;
            const start = metric === 'RESOLUTION' ? ticket.created_at : now;
            await tx.ticketSlaTimer.create({
                data: {
                    ticket_id: ticketId,
                    policy_id: policy.id,
                    metric,
                    target_minutes: minutes,
                    started_at: start,
                    due_at: this.due(start, minutes, bh),
                    status: opts.paused ? 'PAUSED' : 'RUNNING',
                    paused_at: opts.paused ? now : null,
                },
            });
        }
        await tx.ticket.update({ where: { id: ticketId }, data: { sla_policy_id: policy.id } });
        await this.refreshTicket(tx, ticketId);
    }

    /** Priority changed: recompute targets of running/paused timers from their original start. */
    async onPriorityChange(tx: Tx, ticketId: string) {
        const ticket = await tx.ticket.findUniqueOrThrow({ where: { id: ticketId }, select: { organization_id: true, priority: true, sla_policy_id: true } });
        if (!ticket.sla_policy_id) return;
        const policy = await tx.slaPolicy.findUnique({ where: { id: ticket.sla_policy_id }, include: { targets: true } });
        if (!policy) return;
        const bh = await this.businessHours(tx, ticket.organization_id, policy);
        const timers = await tx.ticketSlaTimer.findMany({ where: { ticket_id: ticketId, status: { in: ['RUNNING', 'PAUSED'] } } });
        for (const t of timers) {
            const minutes = targetFor(policy, ticket.priority, t.metric);
            if (!minutes) {
                await tx.ticketSlaTimer.update({ where: { id: t.id }, data: { status: 'CANCELLED', completed_at: new Date() } });
                continue;
            }
            const due = new Date(this.due(t.started_at, minutes, bh).getTime() + t.paused_seconds_total * 1000);
            await tx.ticketSlaTimer.update({ where: { id: t.id }, data: { target_minutes: minutes, due_at: due, at_risk_at: null, at_risk_notified_at: null } });
        }
        await this.refreshTicket(tx, ticketId);
    }

    /** First public agent reply → FIRST_RESPONSE met; any agent reply → NEXT_RESPONSE met. */
    async onAgentReply(tx: Tx, ticketId: string, at = new Date()) {
        const timers = await tx.ticketSlaTimer.findMany({ where: { ticket_id: ticketId, metric: { in: ['FIRST_RESPONSE', 'NEXT_RESPONSE'] }, completed_at: null, status: { in: ['RUNNING', 'PAUSED', 'BREACHED'] } } });
        for (const t of timers) await this.complete(tx, t.id, t.started_at, at);
        await this.refreshTicket(tx, ticketId);
    }

    /** Customer replied after an agent reply → start a NEXT_RESPONSE timer. */
    async onCustomerReply(tx: Tx, ticketId: string, at = new Date()) {
        const ticket = await tx.ticket.findUniqueOrThrow({ where: { id: ticketId }, select: { organization_id: true, priority: true, sla_policy_id: true, first_responded_at: true } });
        if (!ticket.sla_policy_id || !ticket.first_responded_at) return;
        const running = await tx.ticketSlaTimer.count({ where: { ticket_id: ticketId, metric: 'NEXT_RESPONSE', status: { in: ['RUNNING', 'PAUSED'] } } });
        if (running) return;
        const policy = await tx.slaPolicy.findUnique({ where: { id: ticket.sla_policy_id }, include: { targets: true } });
        const minutes = policy ? targetFor(policy, ticket.priority, 'NEXT_RESPONSE') : null;
        if (!policy || !minutes) return;
        const bh = await this.businessHours(tx, ticket.organization_id, policy);
        await tx.ticketSlaTimer.create({ data: { ticket_id: ticketId, policy_id: policy.id, metric: 'NEXT_RESPONSE', target_minutes: minutes, started_at: at, due_at: this.due(at, minutes, bh) } });
        await this.refreshTicket(tx, ticketId);
    }

    /** Status transition: pause/resume on `pauses_sla`, complete RESOLUTION on resolve/close, restart it on reopen. */
    async onStatusChange(tx: Tx, ticketId: string, to: { category: TicketStatusCategory; pauses_sla: boolean }, wasClosed: boolean) {
        const now = new Date();
        const closing = to.category === 'RESOLVED' || to.category === 'CLOSED';
        const timers = await tx.ticketSlaTimer.findMany({ where: { ticket_id: ticketId, completed_at: null, status: { in: ['RUNNING', 'PAUSED', 'BREACHED'] } } });

        if (closing) {
            for (const t of timers) {
                if (t.metric === 'RESOLUTION') await this.complete(tx, t.id, t.started_at, now);
                else await tx.ticketSlaTimer.update({ where: { id: t.id }, data: { status: 'CANCELLED', completed_at: now } });
            }
        } else if (wasClosed) {
            // Reopened: restart the resolution clock from now with the same target.
            const last = await tx.ticketSlaTimer.findFirst({ where: { ticket_id: ticketId, metric: 'RESOLUTION' }, orderBy: { created_at: 'desc' } });
            if (last) {
                const ticket = await tx.ticket.findUniqueOrThrow({ where: { id: ticketId }, select: { organization_id: true } });
                const policy = last.policy_id ? await tx.slaPolicy.findUnique({ where: { id: last.policy_id }, select: { use_business_hours: true } }) : null;
                const bh = policy ? await this.businessHours(tx, ticket.organization_id, policy) : null;
                await tx.ticketSlaTimer.create({
                    data: { ticket_id: ticketId, policy_id: last.policy_id, metric: 'RESOLUTION', target_minutes: last.target_minutes, started_at: now, due_at: this.due(now, last.target_minutes, bh), status: to.pauses_sla ? 'PAUSED' : 'RUNNING', paused_at: to.pauses_sla ? now : null },
                });
            }
        } else {
            for (const t of timers) {
                if (t.status === 'BREACHED') continue;
                if (to.pauses_sla && t.status === 'RUNNING') {
                    await tx.ticketSlaTimer.update({ where: { id: t.id }, data: { status: 'PAUSED', paused_at: now } });
                } else if (!to.pauses_sla && t.status === 'PAUSED' && t.paused_at) {
                    const pausedSeconds = Math.round((now.getTime() - t.paused_at.getTime()) / 1000);
                    await tx.ticketSlaTimer.update({
                        where: { id: t.id },
                        data: { status: 'RUNNING', paused_at: null, paused_seconds_total: { increment: pausedSeconds }, due_at: new Date(t.due_at.getTime() + pausedSeconds * 1000) },
                    });
                }
            }
        }
        await this.refreshTicket(tx, ticketId);
    }

    private async complete(tx: Tx, timerId: string, startedAt: Date, at: Date) {
        const t = await tx.ticketSlaTimer.findUniqueOrThrow({ where: { id: timerId } });
        const elapsed = Math.max(0, Math.round((at.getTime() - startedAt.getTime()) / 60_000 - t.paused_seconds_total / 60));
        const breached = t.status === 'BREACHED' || !!t.breached_at || (t.status === 'RUNNING' && at > t.due_at);
        await tx.ticketSlaTimer.update({
            where: { id: timerId },
            data: { status: breached ? 'BREACHED' : 'MET', completed_at: at, elapsed_minutes: elapsed, breached_at: breached ? t.breached_at ?? at : null },
        });
    }

    /** Denormalize due dates and flags on the ticket from its timers. */
    async refreshTicket(tx: Tx, ticketId: string) {
        const timers = await tx.ticketSlaTimer.findMany({ where: { ticket_id: ticketId, status: { not: 'CANCELLED' } }, orderBy: { created_at: 'desc' } });
        const open = (m: SlaMetric) => timers.find((t) => t.metric === m && (t.status === 'RUNNING' || t.status === 'PAUSED'));
        const data: Prisma.TicketUpdateInput = {
            first_response_due_at: open('FIRST_RESPONSE')?.due_at ?? null,
            next_response_due_at: open('NEXT_RESPONSE')?.due_at ?? null,
            resolution_due_at: open('RESOLUTION')?.due_at ?? null,
            sla_breached: timers.some((t) => t.status === 'BREACHED'),
            sla_at_risk: timers.some((t) => (t.status === 'RUNNING' || t.status === 'PAUSED') && !!t.at_risk_at),
        };
        await tx.ticket.update({ where: { id: ticketId }, data });
    }

    // ---------------------------------------------------------------------------------------------
    // Sweep (every minute): at risk / breached, snoozed conversations wake up, auto-close resolved tickets
    // ---------------------------------------------------------------------------------------------

    @Cron(CronExpression.EVERY_MINUTE)
    async sweep() {
        if (this.sweeping) return;
        this.sweeping = true;
        try {
            await this.markBreaches();
            await this.markAtRisk();
            await this.wakeSnoozed();
            await this.autoClose();
        } catch (error) {
            this.logger.warn(`SLA sweep failed: ${(error as Error).message}`);
        } finally {
            this.sweeping = false;
        }
    }

    private async systemContext(organizationId: string) {
        return this.authorization.contextFor({ organization_id: organizationId, channel: 'automation' });
    }

    private async markBreaches() {
        const now = new Date();
        const due = await this.prisma.ticketSlaTimer.findMany({
            where: { status: 'RUNNING', due_at: { lt: now } },
            take: 200,
            include: { ticket: { select: { id: true, organization_id: true, reference: true, subject: true, assignee_membership_id: true, company_id: true, project_id: true, branch_id: true } } },
        });
        for (const t of due) {
            await this.prisma.$transaction(async (tx) => {
                await tx.ticketSlaTimer.update({ where: { id: t.id }, data: { status: 'BREACHED', breached_at: now } });
                await this.refreshTicket(tx, t.ticket_id);
            });
            const ctx = await this.systemContext(t.ticket.organization_id);
            await this.audit.record(ctx, 'ticket.sla_breached', { resource_type: 'ticket', resource_id: t.ticket_id, branch_id: t.ticket.branch_id, metadata: { metric: t.metric, due_at: t.due_at } });
            this.events.publish(ctx, {
                event_key: 'support.ticket.sla_breached',
                module: ModuleKey.SUPPORT,
                entity_type: 'TICKET',
                entity_id: t.ticket_id,
                payload: { reference: t.ticket.reference, subject: t.ticket.subject, metric: t.metric, due_at: t.due_at, assignee_membership_id: t.ticket.assignee_membership_id },
                activity: { summary: `SLA breached (${t.metric.toLowerCase().replace('_', ' ')}) on ${t.ticket.reference}`, entity_label: t.ticket.reference, company_id: t.ticket.company_id, project_id: t.ticket.project_id },
                dedupe_key: `sla_breached:${t.id}`,
            });
        }
    }

    private async markAtRisk() {
        const now = new Date();
        const running = await this.prisma.ticketSlaTimer.findMany({
            where: { status: 'RUNNING', at_risk_at: null, due_at: { gt: now } },
            take: 500,
            include: { policy: { select: { at_risk_threshold_percent: true } }, ticket: { select: { organization_id: true, reference: true, subject: true, assignee_membership_id: true } } },
        });
        for (const t of running) {
            const pct = Number(t.policy?.at_risk_threshold_percent ?? 80) / 100;
            const total = t.due_at.getTime() - t.started_at.getTime();
            if (total <= 0 || (now.getTime() - t.started_at.getTime()) / total < pct) continue;
            await this.prisma.$transaction(async (tx) => {
                await tx.ticketSlaTimer.update({ where: { id: t.id }, data: { at_risk_at: now, at_risk_notified_at: now } });
                await this.refreshTicket(tx, t.ticket_id);
            });
            const ctx = await this.systemContext(t.ticket.organization_id);
            this.events.publish(ctx, {
                event_key: 'support.ticket.sla_at_risk',
                module: ModuleKey.SUPPORT,
                entity_type: 'TICKET',
                entity_id: t.ticket_id,
                payload: { reference: t.ticket.reference, subject: t.ticket.subject, metric: t.metric, due_at: t.due_at, assignee_membership_id: t.ticket.assignee_membership_id },
                dedupe_key: `sla_at_risk:${t.id}`,
            });
        }
    }

    private async wakeSnoozed() {
        const now = new Date();
        const rows = await this.prisma.supportConversation.findMany({ where: { status: 'SNOOZED', snoozed_until: { lte: now } }, select: { id: true, organization_id: true }, take: 200 });
        if (!rows.length) return;
        await this.prisma.supportConversation.updateMany({ where: { id: { in: rows.map((r) => r.id) } }, data: { status: 'OPEN', snoozed_until: null } });
        for (const r of rows) {
            const ctx = await this.systemContext(r.organization_id);
            this.events.publish(ctx, { event_key: 'support.conversation.unsnoozed', module: ModuleKey.SUPPORT, entity_type: 'SUPPORT_CONVERSATION', entity_id: r.id });
        }
    }

    private async autoClose() {
        const settings = await this.prisma.supportSettings.findMany({ where: { auto_close_after_days: { not: null } }, select: { organization_id: true, auto_close_after_days: true } });
        for (const s of settings) {
            const cutoff = new Date(Date.now() - (s.auto_close_after_days ?? 0) * 86400_000);
            const closed = await this.prisma.ticketStatus.findFirst({ where: { organization_id: s.organization_id, category: 'CLOSED', archived_at: null }, orderBy: { sort_order: 'asc' } });
            if (!closed) continue;
            const tickets = await this.prisma.ticket.findMany({
                where: { organization_id: s.organization_id, status: { category: 'RESOLVED' }, resolved_at: { lt: cutoff }, closed_at: null, archived_at: null },
                select: { id: true, status_id: true, reference: true },
                take: 100,
            });
            if (!tickets.length) continue;
            const ctx = await this.systemContext(s.organization_id);
            for (const t of tickets) {
                await this.prisma.$transaction(async (tx) => {
                    await tx.ticket.update({ where: { id: t.id }, data: { status_id: closed.id, closed_at: new Date() } });
                    await tx.ticketStatusHistory.create({ data: { ticket_id: t.id, from_status_id: t.status_id, to_status_id: closed.id, from_category: 'RESOLVED', to_category: 'CLOSED', changed_via: 'auto_close' } });
                });
                await this.audit.record(ctx, 'ticket.auto_closed', { resource_type: 'ticket', resource_id: t.id });
                this.events.publish(ctx, { event_key: 'support.ticket.closed', module: ModuleKey.SUPPORT, entity_type: 'TICKET', entity_id: t.id, payload: { reference: t.reference, via: 'auto_close' } });
            }
        }
    }
}
