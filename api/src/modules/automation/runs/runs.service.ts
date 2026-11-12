import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { AutomationApprovalDecision, AutomationRunStatus, AutomationStepStatus, ModuleKey, Prisma } from 'generated/prisma';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import { AuditService } from '@/shared/audit/audit.service';
import { EventsService } from '@/shared/events/events.service';
import { OrgContext } from '@/shared/authorization/interfaces/org-context.interface';
import { orderBy, paginate, skipTake } from '@/shared/utils/pagination/pagination.utils';
import { AutomationEngineService } from '../engine/automation-engine.service';
import { RulesService } from '../rules/rules.service';
import { ApprovalQuery, DecideApprovalDto, EventQuery, PublishEventDto, RunQuery } from './dto/run.dto';

const RUNS_READ = 'automation.runs.read';
const PERSON = { select: { id: true, user: { select: { id: true, display_name: true, first_name: true, last_name: true, email: true } } } } as const;
const SECRET_KEYS = /(password|secret|token|api_key|authorization|credential)/i;

/** Mask secret-looking keys in payloads shown in the run / event log (20 §8). */
function mask(value: unknown, depth = 0): unknown {
    if (depth > 8 || value === null || typeof value !== 'object') return value;
    if (Array.isArray(value)) return value.map((v) => mask(v, depth + 1));
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, SECRET_KEYS.test(k) ? '••••••' : mask(v, depth + 1)]));
}

/** 20 §6, §8 — run history, retries, cancellation, approvals and the event bus log. */
@Injectable()
export class RunsService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly audit: AuditService,
        private readonly events: EventsService,
        private readonly engine: AutomationEngineService,
        private readonly rules: RulesService,
    ) { }

    private runWhere(ctx: OrgContext): Prisma.AutomationRunWhereInput {
        return { organization_id: ctx.organization_id, rule: this.rules.scopeWhere(ctx, RUNS_READ) };
    }

    async findAll(ctx: OrgContext, query: RunQuery) {
        const where: Prisma.AutomationRunWhereInput = {
            ...this.runWhere(ctx),
            ...(query.status?.length && { status: { in: query.status } }),
            ...(query.mode && { mode: query.mode }),
            ...(query.rule_id && { rule_id: query.rule_id }),
            ...(query.trigger_key && { trigger_key: query.trigger_key }),
            ...(query.entity_id && { entity_id: query.entity_id }),
            ...((query.from || query.to) && { created_at: { ...(query.from && { gte: query.from }), ...(query.to && { lte: query.to }) } }),
            ...(query.search && { OR: [{ rule: { name: { contains: query.search, mode: 'insensitive' } } }, { trigger_key: { contains: query.search, mode: 'insensitive' } }, { error_message: { contains: query.search, mode: 'insensitive' } }] }),
        };
        const [items, total] = await Promise.all([
            this.prisma.automationRun.findMany({
                where,
                ...skipTake(query),
                orderBy: orderBy(query, ['created_at', 'duration_ms', 'status'], 'created_at'),
                select: {
                    id: true, rule_id: true, rule_version: true, mode: true, status: true, trigger_kind: true, trigger_key: true, entity_type: true, entity_kind: true, entity_id: true,
                    attempt: true, max_attempts: true, duration_ms: true, error_code: true, error_message: true, queued_at: true, started_at: true, finished_at: true, created_at: true,
                    actor_type: true, performed_destructive_action: true, trigger_depth: true, next_retry_at: true, wait_until: true,
                    rule: { select: { id: true, name: true } },
                    _count: { select: { steps: true } },
                },
            }),
            this.prisma.automationRun.count({ where }),
        ]);
        return paginate(items, total, query);
    }

    async findOne(ctx: OrgContext, id: string) {
        const run = await this.prisma.automationRun.findFirst({
            where: { id, ...this.runWhere(ctx) },
            include: {
                rule: { select: { id: true, name: true, trigger_kind: true, owner_membership_id: true } },
                steps: { orderBy: { step_index: 'asc' }, include: { approval: { include: { requested_from_member: PERSON, approver: PERSON } }, webhook_deliveries: { select: { id: true, status: true, response_status_code: true, duration_ms: true, created_at: true } } } },
                actor_membership: PERSON,
                run_as: { select: { id: true, name: true } },
                parent_run: { select: { id: true, rule: { select: { name: true } } } },
                child_runs: { select: { id: true, status: true, rule: { select: { name: true } } }, take: 20 },
            },
        });
        if (!run) throw new NotFoundException({ message: 'Run not found', code: 'run_not_found' });
        return { ...run, input: mask(run.input), output: mask(run.output), steps: run.steps.map((s) => ({ ...s, input: mask(s.input), output: mask(s.output) })) };
    }

    async retry(ctx: OrgContext, id: string, fromStep?: number) {
        const run = await this.findOne(ctx, id);
        const retryable: AutomationRunStatus[] = [AutomationRunStatus.FAILED, AutomationRunStatus.DEAD_LETTERED, AutomationRunStatus.CANCELLED, AutomationRunStatus.RETRY_SCHEDULED];
        if (!retryable.includes(run.status)) throw new ConflictException({ message: `A ${run.status.toLowerCase()} run cannot be retried`, code: 'run_not_retryable' });
        const failedIndex = run.steps.find((s) => s.status === AutomationStepStatus.FAILED || s.status === AutomationStepStatus.CANCELLED)?.step_index;
        const start = fromStep ?? failedIndex ?? run.current_step_index ?? null;
        await this.prisma.$transaction([
            this.prisma.automationRunStep.updateMany({ where: { run_id: id, ...(start !== null ? { step_index: { gte: start } } : {}), status: { not: AutomationStepStatus.SUCCEEDED } }, data: { status: AutomationStepStatus.PENDING, error_code: null, error_message: null } }),
            this.prisma.automationRun.update({
                where: { id },
                data: { status: AutomationRunStatus.PENDING, current_step_index: start, attempt: 1, max_attempts: Math.max(run.max_attempts, 1), finished_at: null, error_code: null, error_message: null, error: Prisma.DbNull, dead_lettered_at: null, dead_letter_reason: null, cancelled_at: null },
            }),
        ]);
        await this.audit.record(ctx, 'automation.run.retried', { resource_type: 'automation_run', resource_id: id, metadata: { from_step: start } });
        setImmediate(() => void this.engine.execute(id));
        return { id, status: AutomationRunStatus.PENDING };
    }

    async cancel(ctx: OrgContext, id: string) {
        const run = await this.findOne(ctx, id);
        const open: AutomationRunStatus[] = [AutomationRunStatus.PENDING, AutomationRunStatus.WAITING, AutomationRunStatus.AWAITING_APPROVAL, AutomationRunStatus.RETRY_SCHEDULED];
        if (!open.includes(run.status)) throw new ConflictException({ message: `A ${run.status.toLowerCase()} run cannot be cancelled`, code: 'run_not_cancellable' });
        const now = new Date();
        await this.prisma.$transaction([
            this.prisma.automationRun.update({ where: { id }, data: { status: AutomationRunStatus.CANCELLED, cancelled_at: now, cancelled_by_membership_id: ctx.membership_id, finished_at: now } }),
            this.prisma.automationRunStep.updateMany({ where: { run_id: id, status: { in: [AutomationStepStatus.PENDING, AutomationStepStatus.WAITING, AutomationStepStatus.AWAITING_APPROVAL, AutomationStepStatus.RUNNING] } }, data: { status: AutomationStepStatus.CANCELLED } }),
            this.prisma.automationApproval.updateMany({ where: { run_id: id, decision: AutomationApprovalDecision.PENDING }, data: { decision: AutomationApprovalDecision.CANCELLED, decided_at: now } }),
        ]);
        await this.audit.record(ctx, 'automation.run.cancelled', { resource_type: 'automation_run', resource_id: id });
        return { id, status: AutomationRunStatus.CANCELLED };
    }

    // ---------------------------------------------------------------------------------------------
    // Approvals (20 §4, §6) — the decision is a human act: only the requested approver may decide.
    // ---------------------------------------------------------------------------------------------

    async approvals(ctx: OrgContext, query: ApprovalQuery) {
        const mineOnly = query.mine || !ctx.can(RUNS_READ);
        const where: Prisma.AutomationApprovalWhereInput = {
            organization_id: ctx.organization_id,
            ...(query.decision && { decision: query.decision }),
            ...(mineOnly ? { OR: this.mineWhere(ctx) } : { run: { rule: this.rules.scopeWhere(ctx, RUNS_READ) } }),
        };
        const [items, total] = await Promise.all([
            this.prisma.automationApproval.findMany({
                where,
                ...skipTake(query),
                orderBy: { requested_at: 'desc' },
                include: {
                    requested_from_member: PERSON,
                    approver: PERSON,
                    run: { select: { id: true, status: true, rule: { select: { id: true, name: true } } } },
                    step: { select: { step_key: true, action_key: true, input: true } },
                },
            }),
            this.prisma.automationApproval.count({ where }),
        ]);
        return paginate(items.map((a) => ({ ...a, eligible_membership_ids: eligibleApprovers(a), can_decide: a.decision === AutomationApprovalDecision.PENDING && !!ctx.membership_id && eligibleApprovers(a).includes(ctx.membership_id) })), total, query);
    }

    /** Requests the caller may decide: primary approver, any approver of the policy, or the escalation target. */
    private mineWhere(ctx: OrgContext): Prisma.AutomationApprovalWhereInput[] {
        const me = ctx.membership_id ?? '__none__';
        return [
            { requested_from_membership_id: me },
            { escalated_to_membership_id: me },
            { requested_from: { path: ['membership_ids'], array_contains: [me] } },
        ];
    }

    async decide(ctx: OrgContext, id: string, dto: DecideApprovalDto) {
        const approval = await this.prisma.automationApproval.findFirst({ where: { id, organization_id: ctx.organization_id } });
        if (!approval) throw new NotFoundException({ message: 'Approval not found', code: 'approval_not_found' });
        if (!ctx.membership_id || !eligibleApprovers(approval).includes(ctx.membership_id)) throw new ForbiddenException({ message: 'Only a requested approver can decide', code: 'not_the_approver' });
        if (ctx.channel === 'mcp' || ctx.service_account_id) throw new ForbiddenException({ message: 'Approvals are decided by a person, not an agent', code: 'human_decision_required' });
        const res = await this.prisma.automationApproval.updateMany({
            where: { id, decision: AutomationApprovalDecision.PENDING },
            data: { decision: dto.decision, approver_membership_id: ctx.membership_id, comment: dto.comment ?? null, decided_at: new Date() },
        });
        if (!res.count) throw new ConflictException({ message: 'This approval was already decided', code: 'approval_decided' });
        await this.audit.record(ctx, dto.decision === 'APPROVED' ? 'automation.approval.approved' : 'automation.approval.rejected', { resource_type: 'automation_approval', resource_id: id, metadata: { run_id: approval.run_id, comment: dto.comment ?? null } });
        this.events.publish(ctx, { event_key: `automation.approval.${dto.decision.toLowerCase()}`, module: ModuleKey.AUTOMATION, entity_kind: 'automation_approval', entity_id: id, payload: { run_id: approval.run_id } });
        setImmediate(() => void this.engine.execute(approval.run_id));
        return this.prisma.automationApproval.findUnique({ where: { id } });
    }

    // ---------------------------------------------------------------------------------------------
    // Event bus log (20 §2) — part of automation.runs.read
    // ---------------------------------------------------------------------------------------------

    async eventLog(ctx: OrgContext, query: EventQuery) {
        const where: Prisma.PlatformEventWhereInput = {
            organization_id: ctx.organization_id,
            ...(query.event_key && { event_key: query.event_key.endsWith('*') ? { startsWith: query.event_key.slice(0, -1) } : query.event_key }),
            ...(query.module && { module: query.module }),
            ...(query.source && { source: query.source }),
            ...(query.entity_id && { entity_id: query.entity_id }),
            ...(query.state === 'matched' && { rules_matched_count: { gt: 0 } }),
            ...(query.state === 'unmatched' && { rules_processed_at: { not: null }, rules_matched_count: 0 }),
            ...(query.state === 'failed' && { OR: [{ dead_lettered_at: { not: null } }, { processing_error: { not: null } }] }),
            ...(query.state === 'pending' && { rules_processed_at: null }),
            ...((query.from || query.to) && { occurred_at: { ...(query.from && { gte: query.from }), ...(query.to && { lte: query.to }) } }),
            ...(query.search && { event_key: { contains: query.search, mode: 'insensitive' } }),
        };
        const [items, total] = await Promise.all([
            this.prisma.platformEvent.findMany({
                where,
                ...skipTake(query),
                orderBy: { occurred_at: query.order_direction ?? 'desc' },
                select: {
                    id: true, event_key: true, module: true, source: true, entity_type: true, entity_kind: true, entity_id: true, actor_type: true, trigger_depth: true,
                    occurred_at: true, rules_processed_at: true, rules_matched_count: true, webhooks_processed_at: true, processing_attempts: true, processing_error: true, dead_lettered_at: true, causation_run_id: true,
                    actor_membership: PERSON,
                },
            }),
            this.prisma.platformEvent.count({ where }),
        ]);
        return paginate(items, total, query);
    }

    async event(ctx: OrgContext, id: string) {
        const event = await this.prisma.platformEvent.findFirst({
            where: { id, organization_id: ctx.organization_id },
            include: {
                actor_membership: PERSON,
                actor_service_account: { select: { id: true, name: true } },
                triggered_runs: { select: { id: true, status: true, mode: true, created_at: true, rule: { select: { id: true, name: true } } }, orderBy: { created_at: 'desc' }, take: 50 },
                webhook_deliveries: { select: { id: true, status: true, response_status_code: true, created_at: true, webhook: { select: { id: true, name: true } } }, take: 50 },
                causation_run: { select: { id: true, rule: { select: { name: true } } } },
            },
        });
        if (!event) throw new NotFoundException({ message: 'Event not found', code: 'event_not_found' });
        return { ...event, payload: mask(event.payload), changes: mask(event.changes) };
    }

    async reprocess(ctx: OrgContext, id: string) {
        const event = await this.prisma.platformEvent.findFirst({ where: { id, organization_id: ctx.organization_id } });
        if (!event) throw new NotFoundException({ message: 'Event not found', code: 'event_not_found' });
        await this.prisma.platformEvent.update({ where: { id }, data: { dead_lettered_at: null, processing_error: null, processing_attempts: 0, rules_processed_at: null } });
        const started = await this.engine.processEvent(id);
        await this.audit.record(ctx, 'automation.event.reprocessed', { resource_type: 'platform_event', resource_id: id, metadata: { runs_started: started } });
        return { id, runs_started: started };
    }

    /** 20 §12 — "publish event" API: external systems and agents can put `custom.*` events on the bus. */
    async publishCustom(ctx: OrgContext, dto: PublishEventDto) {
        this.events.publish(ctx, { event_key: dto.event_key, module: ModuleKey.AUTOMATION, entity_kind: 'custom', entity_id: dto.entity_id ?? null, payload: dto.payload ?? {} });
        await this.audit.record(ctx, 'automation.event.published', { resource_type: 'platform_event', metadata: { event_key: dto.event_key } });
        return { accepted: true, event_key: dto.event_key };
    }

    /** Dead-letter queue: runs and deliveries that exhausted retries, events that could not be processed. */
    async deadLetter(ctx: OrgContext) {
        const [runs, deliveries, events, jobRuns] = await Promise.all([
            this.prisma.automationRun.findMany({ where: { ...this.runWhere(ctx), status: AutomationRunStatus.DEAD_LETTERED }, orderBy: { dead_lettered_at: 'desc' }, take: 50, select: { id: true, dead_lettered_at: true, dead_letter_reason: true, error_code: true, rule: { select: { id: true, name: true } } } }),
            ctx.can('automation.webhooks.read')
                ? this.prisma.webhookDelivery.findMany({ where: { organization_id: ctx.organization_id, status: 'DEAD_LETTERED' }, orderBy: { dead_lettered_at: 'desc' }, take: 50, select: { id: true, event_key: true, dead_lettered_at: true, response_status_code: true, error_message: true, webhook: { select: { id: true, name: true } } } })
                : [],
            this.prisma.platformEvent.findMany({ where: { organization_id: ctx.organization_id, dead_lettered_at: { not: null } }, orderBy: { dead_lettered_at: 'desc' }, take: 50, select: { id: true, event_key: true, dead_lettered_at: true, processing_error: true, processing_attempts: true } }),
            ctx.can('automation.jobs.read')
                ? this.prisma.scheduledJobRun.findMany({ where: { organization_id: ctx.organization_id, status: { in: ['FAILED', 'TIMED_OUT'] }, next_retry_at: null }, orderBy: { created_at: 'desc' }, take: 50, select: { id: true, status: true, error_code: true, error_message: true, created_at: true, job: { select: { id: true, name: true } } } })
                : [],
        ]);
        return { runs, deliveries, events, job_runs: jobRuns };
    }
}

/** Members who may decide an approval (first decision wins). */
function eligibleApprovers(a: { requested_from_membership_id: string | null; escalated_to_membership_id: string | null; requested_from: Prisma.JsonValue }): string[] {
    const listed = ((a.requested_from as { membership_ids?: unknown } | null)?.membership_ids ?? []) as unknown[];
    return [...new Set([a.requested_from_membership_id, a.escalated_to_membership_id, ...listed.filter((x): x is string => typeof x === 'string')].filter((x): x is string => !!x))];
}
