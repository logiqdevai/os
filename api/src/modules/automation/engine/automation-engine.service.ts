import { HttpException, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { randomUUID } from 'crypto';
import {
    AutomationActionKind,
    AutomationApprovalDecision,
    AutomationRule,
    AutomationRunMode,
    AutomationRunStatus,
    AutomationStepStatus,
    AutomationTriggerKind,
    ModuleKey,
    PlatformEvent,
    Prisma,
    RecordEntityType,
    WebhookDeliveryStatus,
} from 'generated/prisma';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import { McpRegistry } from '@/core/mcp/mcp.registry';
import { AuditService } from '@/shared/audit/audit.service';
import { AuthorizationService } from '@/shared/authorization/authorization.service';
import { OrgContext } from '@/shared/authorization/interfaces/org-context.interface';
import { EventsService, PublishedEvent } from '@/shared/events/events.service';
import { NotificationsService } from '@/modules/notifications/notifications.service';
import { ACTION_BY_KEY, ActionCatalogEntry } from '../catalog/action-catalog';
import { JobHandlerContext, JobHandlerRegistry } from '../jobs/job-handler.registry';
import { AutomationSettingsService } from '../settings/automation-settings.service';
import { WebhookDeliveryService } from '../webhooks/webhook-delivery.service';
import { automationRunStorage, backoffSeconds, evaluateConditions, resolveTemplates } from './engine.utils';
import { ConditionGroup, RuleDefinition, RuleStep, RunScope } from './rule-definition.types';

type Settings = Awaited<ReturnType<AutomationSettingsService['forOrganization']>>;

/** Event snapshot stored on the run (`AutomationRun.input.event`) and exposed to templates as `event`. */
export type EventSnapshot = RunScope['event'];

interface StartRunOptions {
    mode: AutomationRunMode;
    event: EventSnapshot;
    depth?: number;
    parent_run_id?: string | null;
    idempotency_key?: string;
    actor_membership_id?: string | null;
    scheduled_job_run_id?: string | null;
    /** TEST / DRY_RUN of an unpublished draft. */
    definition?: RuleDefinition;
}

type StepOutcome =
    | { kind: 'succeeded'; output: unknown }
    | { kind: 'stop'; output: unknown }
    | { kind: 'waiting'; until: Date }
    | { kind: 'awaiting_approval' }
    | { kind: 'failed'; code: string; message: string; retryable: boolean };

class ActionError extends Error {
    constructor(readonly code: string, message: string, readonly retryable = false) {
        super(message);
    }
}

const RESUMABLE: AutomationRunStatus[] = [AutomationRunStatus.PENDING, AutomationRunStatus.RETRY_SCHEDULED, AutomationRunStatus.WAITING, AutomationRunStatus.AWAITING_APPROVAL];
const LOCK_SECONDS = 600;

export const eventSnapshot = (e: Pick<PlatformEvent, 'id' | 'event_key' | 'entity_type' | 'entity_kind' | 'entity_id' | 'payload' | 'changes' | 'actor_membership_id' | 'occurred_at'>): EventSnapshot => ({
    id: e.id,
    event_key: e.event_key,
    entity_type: e.entity_type ?? e.entity_kind ?? null,
    entity_id: e.entity_id ?? null,
    payload: (e.payload as Record<string, unknown>) ?? {},
    changes: (e.changes as Record<string, unknown>) ?? null,
    actor_membership_id: e.actor_membership_id ?? null,
    occurred_at: e.occurred_at.toISOString(),
});

/**
 * 20 §2, §6 — the rule engine. Consumes the event bus, matches PUBLISHED + enabled rules, and executes runs:
 * conditions → ordered steps (module actions through their MCP tools under the run-as principal built with
 * `AuthorizationService.contextFor`, never with elevated rights) → retries with backoff → dead letter.
 * Loop protection uses `trigger_depth` (AsyncLocalStorage links events published by a run back to it);
 * idempotency keys, per-rule / per-organization rate limits and per-record serialization guard execution.
 */
@Injectable()
export class AutomationEngineService implements OnModuleInit, OnModuleDestroy {
    private readonly logger = new Logger(AutomationEngineService.name);
    private readonly listener = (event: PublishedEvent) => void this.onBusEvent(event);

    constructor(
        private readonly prisma: PrismaService,
        private readonly events: EventsService,
        private readonly authorization: AuthorizationService,
        private readonly audit: AuditService,
        private readonly settings: AutomationSettingsService,
        private readonly mcp: McpRegistry,
        private readonly deliveries: WebhookDeliveryService,
        private readonly jobHandlers: JobHandlerRegistry,
        private readonly moduleRef: ModuleRef,
    ) { }

    onModuleInit() {
        this.events.bus.on('event', this.listener);
        this.jobHandlers.register({
            key: 'automation.rule.schedule',
            module: ModuleKey.AUTOMATION,
            name: 'Run a scheduled workflow',
            description: 'Starts the workflow linked to this job (SCHEDULE trigger).',
            run: (ctx) => this.runScheduledRule(ctx),
        });
        this.jobHandlers.register({
            key: 'automation.event.publish',
            module: ModuleKey.AUTOMATION,
            name: 'Publish a schedule event',
            description: 'Publishes `schedule.<name>` on the event bus so workflows, notifications and webhooks can react.',
            user_creatable: true,
            run: (ctx) => this.publishScheduleEvent(ctx),
        });
    }

    onModuleDestroy() {
        this.events.bus.off('event', this.listener);
    }

    // ---------------------------------------------------------------------------------------------
    // Event bus consumer
    // ---------------------------------------------------------------------------------------------

    private async onBusEvent(event: PublishedEvent) {
        try {
            const cause = automationRunStorage.getStore();
            if (cause) {
                await this.prisma.platformEvent.update({ where: { id: event.id }, data: { causation_run_id: cause.run_id, trigger_depth: cause.trigger_depth + 1 } });
            }
            await this.processEvent(event.id);
        } catch (error) {
            this.logger.warn(`rule matching failed for ${event.event_key}: ${(error as Error).message}`);
            await this.prisma.platformEvent.update({ where: { id: event.id }, data: { processing_attempts: { increment: 1 }, processing_error: (error as Error).message.slice(0, 500), next_processing_at: new Date(Date.now() + 60_000) } }).catch(() => undefined);
        }
    }

    /** Match rules for one stored event and start their runs. Idempotent: a rule never runs twice for one event. */
    async processEvent(eventId: string) {
        const event = await this.prisma.platformEvent.findUnique({ where: { id: eventId } });
        if (!event?.organization_id) return 0;
        const rules = await this.prisma.automationRule.findMany({
            where: {
                organization_id: event.organization_id,
                trigger_key: event.event_key,
                trigger_kind: { in: [AutomationTriggerKind.EVENT, AutomationTriggerKind.INBOUND_WEBHOOK] },
                status: 'PUBLISHED',
                enabled: true,
                archived_at: null,
            },
        });
        let started = 0;
        for (const rule of rules) {
            const run = await this.startRun(rule, {
                mode: AutomationRunMode.LIVE,
                event: eventSnapshot(event),
                depth: event.trigger_depth,
                parent_run_id: event.causation_run_id,
                idempotency_key: `event:${event.id}`,
            });
            if (run) started++;
        }
        await this.prisma.platformEvent.update({
            where: { id: event.id },
            data: { rules_processed_at: new Date(), rules_matched_count: started, processing_error: null, next_processing_at: null },
        });
        return started;
    }

    // ---------------------------------------------------------------------------------------------
    // Starting runs
    // ---------------------------------------------------------------------------------------------

    /** Create a run (or return null when out of scope); execution continues in the background. */
    async startRun(rule: AutomationRule, opts: StartRunOptions) {
        const settings = await this.settings.forOrganization(rule.organization_id);
        if (opts.mode === AutomationRunMode.LIVE && !this.inRuleScope(rule, opts.event)) return null;

        const depth = opts.depth ?? 0;
        const maxDepth = rule.max_trigger_depth ?? settings.max_trigger_depth;
        let skip: { code: string; message: string } | null = null;
        if (depth > maxDepth) {
            skip = { code: 'loop_depth_exceeded', message: `Loop protection: trigger depth ${depth} is above the limit of ${maxDepth}` };
        } else if (opts.mode === AutomationRunMode.LIVE) {
            const hourAgo = new Date(Date.now() - 3600_000);
            const [ruleCount, orgCount] = await Promise.all([
                this.prisma.automationRun.count({ where: { rule_id: rule.id, created_at: { gte: hourAgo }, mode: AutomationRunMode.LIVE, status: { not: AutomationRunStatus.SKIPPED } } }),
                this.prisma.automationRun.count({ where: { organization_id: rule.organization_id, created_at: { gte: hourAgo }, mode: AutomationRunMode.LIVE, status: { not: AutomationRunStatus.SKIPPED } } }),
            ]);
            const ruleLimit = rule.rate_limit_per_hour ?? settings.default_rule_rate_limit_per_hour;
            if (ruleCount >= ruleLimit) skip = { code: 'rate_limited', message: `Rule rate limit of ${ruleLimit} runs per hour reached` };
            else if (orgCount >= settings.org_rate_limit_per_hour) skip = { code: 'rate_limited', message: `Organization rate limit of ${settings.org_rate_limit_per_hour} runs per hour reached` };
        }

        const versionRow = opts.mode === AutomationRunMode.LIVE && rule.current_version > 0
            ? await this.prisma.automationRuleVersion.findUnique({ where: { rule_id_version: { rule_id: rule.id, version: rule.current_version } }, select: { id: true } })
            : null;
        const maxAttempts = opts.mode === AutomationRunMode.LIVE ? (rule.max_retries ?? settings.default_max_retries) + 1 : 1;
        const isTest = opts.mode !== AutomationRunMode.LIVE;
        const now = new Date();
        try {
            const run = await this.prisma.automationRun.create({
                data: {
                    organization_id: rule.organization_id,
                    rule_id: rule.id,
                    rule_version_id: versionRow?.id ?? null,
                    rule_version: rule.current_version,
                    mode: opts.mode,
                    status: skip ? AutomationRunStatus.SKIPPED : AutomationRunStatus.PENDING,
                    trigger_kind: rule.trigger_kind,
                    trigger_key: opts.event.event_key,
                    event_id: opts.event.id,
                    scheduled_job_run_id: opts.scheduled_job_run_id ?? null,
                    idempotency_key: isTest ? `${opts.mode.toLowerCase()}:${randomUUID()}` : opts.idempotency_key ?? `manual:${randomUUID()}`,
                    entity_type: toEntityType(opts.event.entity_type),
                    entity_kind: toEntityType(opts.event.entity_type) ? null : opts.event.entity_type,
                    entity_id: opts.event.entity_id,
                    input: { event: opts.event, ...(opts.definition ? { definition: opts.definition } : {}) } as unknown as Prisma.InputJsonValue,
                    actor_type: opts.actor_membership_id ? 'USER' : 'SYSTEM',
                    actor_membership_id: opts.actor_membership_id ?? null,
                    run_as_service_account_id: rule.run_as_service_account_id ?? settings.default_service_account_id ?? null,
                    parent_run_id: opts.parent_run_id ?? null,
                    trigger_depth: depth,
                    max_attempts: maxAttempts,
                    ...(skip ? { error_code: skip.code, error_message: skip.message, finished_at: now, started_at: now, duration_ms: 0 } : {}),
                },
            });
            if (!skip) setImmediate(() => void this.execute(run.id));
            return run;
        } catch (error) {
            if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') return null; // same idempotency key: already handled
            throw error;
        }
    }

    /** 20 §5 — branch / team / project scope: the event must carry the matching id. */
    private inRuleScope(rule: AutomationRule, event: EventSnapshot) {
        const p = event.payload ?? {};
        switch (rule.scope_type) {
            case 'BRANCH': return !!rule.branch_id && p.branch_id === rule.branch_id;
            case 'TEAM': return !!rule.team_id && (p.team_id === rule.team_id || (Array.isArray(p.team_ids) && p.team_ids.includes(rule.team_id)));
            case 'PROJECT': return !!rule.project_id && (p.project_id === rule.project_id || (event.entity_type === 'PROJECT' && event.entity_id === rule.project_id));
            case 'PROJECT_TYPE': return !!rule.project_type_id && p.project_type_id === rule.project_type_id;
            default: return true;
        }
    }

    private async runScheduledRule(job: JobHandlerContext) {
        const ruleId = (job.payload.rule_id as string) ?? job.job.rule_id;
        const rule = ruleId ? await this.prisma.automationRule.findUnique({ where: { id: ruleId } }) : null;
        if (!rule || rule.status !== 'PUBLISHED' || !rule.enabled) return { skipped: true, reason: 'workflow is not published and enabled' };
        const run = await this.startRun(rule, {
            mode: AutomationRunMode.LIVE,
            event: { id: null, event_key: 'schedule.cron', entity_type: null, entity_id: null, payload: { scheduled_for: job.scheduled_for.toISOString(), job_id: job.job.id }, changes: null, actor_membership_id: null, occurred_at: new Date().toISOString() },
            idempotency_key: `schedule:${job.job.id}:${job.scheduled_for.toISOString()}:${job.run_id}`,
            scheduled_job_run_id: job.run_id,
        });
        return { run_id: run?.id ?? null };
    }

    private async publishScheduleEvent(job: JobHandlerContext) {
        if (!job.job.organization_id) throw new Error('Organization job required');
        const key = String(job.payload.event_key ?? `schedule.${job.job.key}`);
        if (!/^(schedule|custom)\.[a-z0-9_.-]+$/.test(key)) throw Object.assign(new Error('event_key must start with schedule. or custom.'), { code: 'invalid_event_key' });
        const ctx = await this.systemContext(job.job.organization_id);
        this.events.publish(ctx, { event_key: key, module: ModuleKey.AUTOMATION, entity_kind: 'scheduled_job', entity_id: job.job.id, payload: { ...((job.payload.payload as Record<string, unknown>) ?? {}), scheduled_for: job.scheduled_for.toISOString() } });
        return { published: key };
    }

    async systemContext(organizationId: string): Promise<OrgContext> {
        const ctx = await this.authorization.contextFor({ organization_id: organizationId, channel: 'automation' });
        ctx.actor_type = 'SYSTEM';
        return ctx;
    }

    // ---------------------------------------------------------------------------------------------
    // Executing runs
    // ---------------------------------------------------------------------------------------------

    /** Execute (or resume) a run. Claims it atomically so two workers never execute the same run. */
    async execute(runId: string) {
        const claimed = await this.prisma.automationRun.updateMany({ where: { id: runId, status: { in: RESUMABLE } }, data: { status: AutomationRunStatus.RUNNING, next_retry_at: null, wait_until: null } });
        if (!claimed.count) return;
        const run = await this.prisma.automationRun.findUnique({ where: { id: runId }, include: { rule: true, steps: { include: { approval: true } } } });
        if (!run) return;
        if (!run.started_at) await this.prisma.automationRun.update({ where: { id: run.id }, data: { started_at: new Date() } });
        const startedAt = run.started_at ?? new Date();

        try {
            await automationRunStorage.run({ run_id: run.id, rule_id: run.rule_id, trigger_depth: run.trigger_depth }, async () => {
                const settings = await this.settings.forOrganization(run.organization_id);
                const input = (run.input as unknown as { event: EventSnapshot; definition?: RuleDefinition }) ?? { event: null };
                const definition = input.definition ?? (await this.definitionFor(run.rule, run.rule_version_id));
                const ctx = await this.principalContext(run.rule, settings);
                if (!ctx) return this.finish(run.id, AutomationRunStatus.FAILED, { code: 'no_principal', message: 'The workflow has no active owner or service account to run as' }, startedAt);

                if (run.rule.serialize_per_record && run.entity_id && run.mode === AutomationRunMode.LIVE) {
                    const locked = await this.acquireLock(run);
                    if (!locked) {
                        await this.prisma.automationRun.update({ where: { id: run.id }, data: { status: AutomationRunStatus.RETRY_SCHEDULED, next_retry_at: new Date(Date.now() + 15_000) } });
                        return;
                    }
                }

                const scope: RunScope = {
                    event: input.event,
                    rule: { id: run.rule.id, name: run.rule.name, version: run.rule_version },
                    run: { id: run.id, mode: run.mode },
                    steps: { ...(((run.output as Record<string, { output: unknown }>) ?? {})) },
                    now: new Date().toISOString(),
                };

                if (run.current_step_index === null) {
                    if (run.mode === AutomationRunMode.LIVE && run.attempt === 1) this.publishRunEvent(ctx, run.id, run.rule, 'automation.rule_run_started', {});
                    const cond = evaluateConditions(definition.conditions as ConditionGroup, scope as unknown as Record<string, unknown>);
                    await this.prisma.automationRun.update({ where: { id: run.id }, data: { conditions_result: cond.results as unknown as Prisma.InputJsonValue, conditions_passed: cond.passed, current_step_index: 0 } });
                    if (!cond.passed) return this.finish(run.id, AutomationRunStatus.SKIPPED, { code: 'conditions_not_met', message: 'Conditions did not match' }, startedAt, scope.steps);
                }

                const steps = definition.actions ?? [];
                for (let i = run.current_step_index ?? 0; i < steps.length; i++) {
                    const step = steps[i];
                    await this.prisma.automationRun.update({ where: { id: run.id }, data: { current_step_index: i } });
                    const outcome = await this.runStep(run, i, step, scope, ctx, settings);

                    if (outcome.kind === 'succeeded' || outcome.kind === 'stop') {
                        scope.steps[step.key] = { output: outcome.output };
                        await this.prisma.automationRun.update({ where: { id: run.id }, data: { output: scope.steps as unknown as Prisma.InputJsonValue } });
                        if (outcome.kind === 'stop') {
                            await this.skipRemaining(run.id, steps, i + 1, 'A "continue only if" step did not match');
                            break;
                        }
                        continue;
                    }
                    if (outcome.kind === 'waiting') {
                        await this.releaseLock(run.id);
                        await this.prisma.automationRun.update({ where: { id: run.id }, data: { status: AutomationRunStatus.WAITING, wait_until: outcome.until } });
                        return;
                    }
                    if (outcome.kind === 'awaiting_approval') {
                        await this.releaseLock(run.id);
                        await this.prisma.automationRun.update({ where: { id: run.id }, data: { status: AutomationRunStatus.AWAITING_APPROVAL } });
                        return;
                    }
                    // failed
                    if (step.on_error === 'continue') {
                        scope.steps[step.key] = { output: { error: outcome.message } };
                        continue;
                    }
                    if (outcome.retryable && run.attempt < run.max_attempts) {
                        await this.releaseLock(run.id);
                        const base = run.rule.retry_backoff_seconds ?? settings.default_retry_backoff_seconds;
                        await this.prisma.automationRun.update({
                            where: { id: run.id },
                            data: { status: AutomationRunStatus.RETRY_SCHEDULED, attempt: { increment: 1 }, next_retry_at: new Date(Date.now() + backoffSeconds(base, run.attempt) * 1000), error_code: outcome.code, error_message: outcome.message },
                        });
                        return;
                    }
                    const status = outcome.retryable && run.max_attempts > 1 ? AutomationRunStatus.DEAD_LETTERED : AutomationRunStatus.FAILED;
                    return this.finish(run.id, status, { code: outcome.code, message: outcome.message, step_key: step.key }, startedAt, scope.steps, ctx, settings);
                }
                return this.finish(run.id, AutomationRunStatus.SUCCEEDED, null, startedAt, scope.steps, ctx, settings);
            });
        } catch (error) {
            this.logger.error(`run ${run.id} crashed: ${(error as Error).message}`);
            await this.finish(run.id, AutomationRunStatus.FAILED, { code: 'engine_error', message: (error as Error).message }, startedAt);
        }
    }

    private async definitionFor(rule: AutomationRule, versionId: string | null): Promise<RuleDefinition> {
        if (versionId) {
            const v = await this.prisma.automationRuleVersion.findUnique({ where: { id: versionId } });
            if (v) return { trigger_kind: v.trigger_kind, trigger_key: v.trigger_key, trigger_config: v.trigger_config as RuleDefinition['trigger_config'], conditions: v.conditions as ConditionGroup, actions: v.actions as unknown as RuleStep[] };
        }
        return { trigger_kind: rule.trigger_kind, trigger_key: rule.trigger_key, trigger_config: rule.trigger_config as RuleDefinition['trigger_config'], conditions: rule.conditions as ConditionGroup, actions: rule.actions as unknown as RuleStep[] };
    }

    /** 20 §4, §14 — run-as service account (rule → organization default) or the rule owner. Null when none is active. */
    async principalContext(rule: AutomationRule, settings: Settings): Promise<OrgContext | null> {
        const saId = rule.run_as_service_account_id ?? settings.default_service_account_id;
        if (saId) {
            const sa = await this.prisma.serviceAccount.findFirst({ where: { id: saId, organization_id: rule.organization_id } });
            if (sa && sa.status === 'ACTIVE' && (!sa.expires_at || sa.expires_at > new Date())) {
                return this.authorization.contextFor({ organization_id: rule.organization_id, service_account_id: sa.id, channel: 'automation' });
            }
            if (rule.run_as_service_account_id) return null;
        }
        if (!rule.owner_membership_id) return null;
        const m = await this.prisma.membership.findFirst({ where: { id: rule.owner_membership_id, organization_id: rule.organization_id, status: 'ACTIVE' } });
        if (!m) return null;
        return this.authorization.contextFor({ organization_id: rule.organization_id, membership_id: m.id, channel: 'automation' });
    }

    private async runStep(
        run: { id: string; organization_id: string; mode: AutomationRunMode; attempt: number; max_attempts: number; rule: AutomationRule; steps: { step_index: number; status: AutomationStepStatus; output: Prisma.JsonValue; wait_until: Date | null; approval: { id: string; decision: AutomationApprovalDecision; approver_membership_id: string | null; comment: string | null } | null }[] },
        index: number,
        step: RuleStep,
        scope: RunScope,
        ctx: OrgContext,
        settings: Settings,
    ): Promise<StepOutcome> {
        const existing = run.steps.find((s) => s.step_index === index);
        if (existing?.status === AutomationStepStatus.SUCCEEDED) return { kind: 'succeeded', output: existing.output };

        const def = ACTION_BY_KEY.get(step.action_key);
        const toolName = def?.executor.type === 'mcp' ? def.executor.tool : step.action_key === 'mcp.tool' ? String(step.inputs?.tool ?? '') : null;
        const tool = toolName ? this.mcp.get(toolName) : undefined;
        const destructive = !!def?.is_destructive || !!def?.is_customer_facing || !!tool?.sensitive;
        const inputs = resolveTemplates(step.inputs ?? {}, scope) as Record<string, unknown>;
        const started = new Date();

        const row = await this.prisma.automationRunStep.upsert({
            where: { run_id_step_index: { run_id: run.id, step_index: index } },
            create: {
                run_id: run.id, step_index: index, step_key: step.key, action_key: step.action_key, kind: def?.kind ?? AutomationActionKind.CUSTOM,
                status: AutomationStepStatus.RUNNING, input: inputs as Prisma.InputJsonValue, idempotency_key: `${run.id}:${index}`,
                attempt: run.attempt, max_attempts: run.max_attempts, started_at: started, is_destructive: destructive,
            },
            update: { status: AutomationStepStatus.RUNNING, input: inputs as Prisma.InputJsonValue, attempt: run.attempt, error_code: null, error_message: null, started_at: started },
        });

        const done = async (status: AutomationStepStatus, data: Prisma.AutomationRunStepUpdateInput) => {
            const finished = new Date();
            await this.prisma.automationRunStep.update({ where: { id: row.id }, data: { status, finished_at: finished, duration_ms: finished.getTime() - started.getTime(), ...data } });
        };

        try {
            if (!def) throw new ActionError('unknown_action', `Unknown action "${step.action_key}"`);

            // Dry run: resolve inputs, execute nothing (condition gates are still evaluated).
            if (run.mode === AutomationRunMode.DRY_RUN && def.key !== 'engine.condition') {
                const output = { dry_run: true, would_run: def.key, tool: toolName ?? undefined };
                await done(AutomationStepStatus.SUCCEEDED, { output: output as Prisma.InputJsonValue });
                return { kind: 'succeeded', output };
            }

            if (destructive && def.kind !== AutomationActionKind.APPROVAL) {
                if (!settings.destructive_actions_enabled || !run.rule.allow_destructive_actions) {
                    throw new ActionError('destructive_not_allowed', 'This step is destructive or customer-facing; destructive actions are not enabled for the organization or this workflow');
                }
                if (run.rule.require_approval_for_destructive && settings.destructive_requires_approval) {
                    const gate = await this.approvalGate(run, row.id, existing?.approval ?? null, run.rule.owner_membership_id, `${def.name}: ${JSON.stringify(inputs).slice(0, 300)}`, 48, ctx);
                    if (gate) {
                        if (gate.kind === 'awaiting_approval') await done(AutomationStepStatus.AWAITING_APPROVAL, {});
                        return gate;
                    }
                }
            }
            if (def.required_permission && !ctx.can(def.required_permission)) {
                throw new ActionError('permission_denied', `The run-as principal does not hold ${def.required_permission}`);
            }

            const outcome = await this.executeAction(def, step, inputs, scope, ctx, run, row.id, existing ?? null);
            if (outcome.kind === 'waiting') {
                await done(AutomationStepStatus.WAITING, { wait_until: outcome.until });
                return outcome;
            }
            if (outcome.kind === 'awaiting_approval') {
                await done(AutomationStepStatus.AWAITING_APPROVAL, {});
                return outcome;
            }
            if (outcome.kind === 'stop') {
                await done(AutomationStepStatus.SUCCEEDED, { output: outcome.output as Prisma.InputJsonValue, branch_taken: 'stop' });
                return outcome;
            }
            if (outcome.kind === 'succeeded') {
                await done(AutomationStepStatus.SUCCEEDED, { output: (outcome.output ?? null) as Prisma.InputJsonValue, ...(def.kind === AutomationActionKind.BRANCH ? { branch_taken: 'continue' } : {}) });
                if (destructive) {
                    await this.prisma.automationRun.update({ where: { id: run.id }, data: { performed_destructive_action: true } });
                    await this.audit.record(ctx, 'automation.run.destructive_action', { resource_type: 'automation_run', resource_id: run.id, metadata: { rule_id: run.rule.id, step_key: step.key, action_key: def.key, tool: toolName } });
                }
            }
            return outcome;
        } catch (e) {
            const err = e instanceof ActionError ? e : this.toActionError(e);
            await done(AutomationStepStatus.FAILED, { error_code: err.code, error_message: err.message.slice(0, 1000) });
            return { kind: 'failed', code: err.code, message: err.message, retryable: err.retryable && def?.retryable !== false };
        }
    }

    private toActionError(e: unknown) {
        if (e instanceof HttpException) {
            const status = e.getStatus();
            const body = e.getResponse() as { message?: string | string[]; code?: string } | string;
            const message = typeof body === 'string' ? body : Array.isArray(body.message) ? body.message.join('; ') : body.message ?? e.message;
            const code = typeof body === 'object' && body.code ? body.code : status === 403 ? 'permission_denied' : status === 404 ? 'not_found' : `http_${status}`;
            return new ActionError(code, message, status >= 500 || status === 429);
        }
        return new ActionError('action_error', (e as Error)?.message ?? 'Action failed', true);
    }

    private async executeAction(
        def: ActionCatalogEntry,
        step: RuleStep,
        inputs: Record<string, unknown>,
        scope: RunScope,
        ctx: OrgContext,
        run: { id: string; organization_id: string; mode: AutomationRunMode; rule: AutomationRule },
        stepId: string,
        existing: { wait_until: Date | null; approval: { id: string; decision: AutomationApprovalDecision; approver_membership_id: string | null; comment: string | null } | null } | null,
    ): Promise<StepOutcome> {
        if (def.executor.type === 'mcp') {
            const args = def.executor.map ? def.executor.map(inputs) : inputs;
            return { kind: 'succeeded', output: await this.callTool(ctx, def.executor.tool, args) };
        }
        switch (def.key) {
            case 'engine.condition': {
                const cond = evaluateConditions((step.inputs?.conditions as ConditionGroup) ?? null, scope as unknown as Record<string, unknown>);
                return cond.passed ? { kind: 'succeeded', output: { passed: true, results: cond.results } } : { kind: 'stop', output: { passed: false, results: cond.results } };
            }
            case 'engine.wait': {
                if (existing?.wait_until) {
                    if (existing.wait_until <= new Date()) return { kind: 'succeeded', output: { resumed_at: new Date().toISOString() } };
                    return { kind: 'waiting', until: existing.wait_until };
                }
                const minutes = Number(inputs.minutes);
                if (!Number.isFinite(minutes) || minutes <= 0) throw new ActionError('invalid_input', 'Wait needs a positive number of minutes');
                if (run.mode === AutomationRunMode.TEST) return { kind: 'succeeded', output: { skipped_in_test: true, minutes } };
                return { kind: 'waiting', until: new Date(Date.now() + Math.min(minutes, 60 * 24 * 90) * 60_000) };
            }
            case 'engine.approval': {
                if (run.mode === AutomationRunMode.TEST) return { kind: 'succeeded', output: { skipped_in_test: true } };
                const gate = await this.approvalGate(run, stepId, existing?.approval ?? null, (inputs.approver_membership_id as string) || null, String(inputs.message ?? 'Approval requested'), Number(inputs.expires_after_hours) || null, ctx);
                return gate ?? { kind: 'succeeded', output: { approved_by: existing?.approval?.approver_membership_id, comment: existing?.approval?.comment } };
            }
            case 'notifications.notify': {
                const ids = Array.isArray(inputs.recipient_membership_ids) ? (inputs.recipient_membership_ids as string[]).filter(Boolean) : [];
                if (!ids.length) throw new ActionError('invalid_input', 'Choose at least one recipient');
                if (!inputs.title) throw new ActionError('invalid_input', 'A title is required');
                const recipients = await this.prisma.membership.findMany({ where: { id: { in: ids }, organization_id: run.organization_id, status: 'ACTIVE' }, select: { id: true } });
                const service = this.notifications();
                if (!service) throw new ActionError('action_unavailable', 'Notifications are not available');
                const result = await service.notify(ctx, {
                    recipient_membership_ids: recipients.map((r) => r.id),
                    event_key: 'automation.notification',
                    module: ModuleKey.AUTOMATION,
                    title: String(inputs.title),
                    body: inputs.body ? String(inputs.body) : null,
                    link: inputs.link ? String(inputs.link) : null,
                    audience_reason: 'recipient',
                    data: { rule_id: run.rule.id, run_id: run.id },
                });
                return { kind: 'succeeded', output: { recipients: recipients.length, result: summarize(result) } };
            }
            case 'webhook.call': {
                const hook = await this.prisma.outboundWebhook.findFirst({ where: { id: String(inputs.webhook_id ?? ''), organization_id: run.organization_id } });
                if (!hook) throw new ActionError('not_found', 'Webhook endpoint not found');
                if (hook.status !== 'ACTIVE') throw new ActionError('webhook_inactive', `Endpoint is ${hook.status.toLowerCase()}`);
                const payload = inputs.payload && typeof inputs.payload === 'object'
                    ? inputs.payload
                    : WebhookDeliveryService.envelope({ id: scope.event.id, event_key: scope.event.event_key, organization_id: run.organization_id, occurred_at: scope.event.occurred_at, entity_type: scope.event.entity_type, entity_id: scope.event.entity_id, payload: scope.event.payload, changes: scope.event.changes });
                const delivery = await this.deliveries.deliverNow({ organization_id: run.organization_id, webhook_id: hook.id, event_key: scope.event.event_key || 'automation.webhook_call', payload, run_step_id: stepId, event_id: scope.event.id });
                if (!delivery || delivery.status !== WebhookDeliveryStatus.SUCCEEDED) throw new ActionError('webhook_failed', delivery?.error_message ?? 'Delivery failed', true);
                return { kind: 'succeeded', output: { delivery_id: delivery.id, status_code: delivery.response_status_code } };
            }
            case 'mcp.tool': {
                const name = String(inputs.tool ?? '');
                const args = typeof inputs.arguments === 'string' ? safeJson(inputs.arguments) : (inputs.arguments as Record<string, unknown>) ?? {};
                return { kind: 'succeeded', output: await this.callTool(ctx, name, args) };
            }
            default:
                throw new ActionError('unknown_action', `No executor for ${def.key}`);
        }
    }

    /** Module action through its MCP tool: same zod validation, permission key and service method as REST. */
    private async callTool(ctx: OrgContext, name: string, args: Record<string, unknown>) {
        const tool = this.mcp.get(name);
        if (!tool) throw new ActionError('action_unavailable', `The "${name}" action is not available yet`);
        if (!ctx.effective.modules.includes(tool.module)) throw new ActionError('module_disabled', `The ${tool.module} module is not enabled`);
        if (!ctx.can(tool.permission)) throw new ActionError('permission_denied', `The run-as principal does not hold ${tool.permission}`);
        // Form inputs leave unset optional fields as empty strings: drop them so module schemas see "not provided".
        const clean = Object.fromEntries(Object.entries(args ?? {}).filter(([, v]) => v !== '' && v !== undefined));
        const parsed = tool.input.safeParse(clean);
        if (!parsed.success) throw new ActionError('invalid_input', parsed.error.issues.map((i) => `${i.path.join('.') || 'input'}: ${i.message}`).join('; '));
        return summarize(await tool.handler(ctx, parsed.data));
    }

    /** Returns null when approved (continue), otherwise the outcome to return. Creates the request on first visit. */
    private async approvalGate(
        run: { id: string; organization_id: string; rule: AutomationRule },
        stepId: string,
        approval: { id: string; decision: AutomationApprovalDecision } | null,
        approverId: string | null,
        message: string,
        expiresHours: number | null,
        ctx: OrgContext,
    ): Promise<StepOutcome | null> {
        if (approval) {
            if (approval.decision === AutomationApprovalDecision.APPROVED) return null;
            if (approval.decision === AutomationApprovalDecision.PENDING) return { kind: 'awaiting_approval' };
            throw new ActionError(`approval_${approval.decision.toLowerCase()}`, `Approval ${approval.decision.toLowerCase()}`);
        }
        if (!approverId) throw new ActionError('approval_unavailable', 'No approver: set an approver or a workflow owner');
        const approver = await this.prisma.membership.findFirst({ where: { id: approverId, organization_id: run.organization_id, status: 'ACTIVE' }, select: { id: true } });
        if (!approver) throw new ActionError('approval_unavailable', 'The approver is not an active member');
        const created = await this.prisma.automationApproval.create({
            data: {
                organization_id: run.organization_id,
                run_id: run.id,
                step_id: stepId,
                requested_from_membership_id: approver.id,
                context: { message, rule_id: run.rule.id, rule_name: run.rule.name } as Prisma.InputJsonValue,
                expires_at: expiresHours ? new Date(Date.now() + expiresHours * 3600_000) : null,
            },
        });
        await this.audit.record(ctx, 'automation.approval.requested', { resource_type: 'automation_approval', resource_id: created.id, metadata: { run_id: run.id, approver_membership_id: approver.id } });
        void this.notify(ctx, [approver.id], 'automation.approval.requested', `Approval needed: ${run.rule.name}`, message, `/automation/approvals`);
        return { kind: 'awaiting_approval' };
    }

    private async skipRemaining(runId: string, steps: RuleStep[], from: number, reason: string) {
        for (let i = from; i < steps.length; i++) {
            const def = ACTION_BY_KEY.get(steps[i].action_key);
            await this.prisma.automationRunStep.upsert({
                where: { run_id_step_index: { run_id: runId, step_index: i } },
                create: { run_id: runId, step_index: i, step_key: steps[i].key, action_key: steps[i].action_key, kind: def?.kind ?? AutomationActionKind.CUSTOM, status: AutomationStepStatus.SKIPPED, skipped_reason: reason },
                update: { status: AutomationStepStatus.SKIPPED, skipped_reason: reason },
            });
        }
    }

    private async finish(
        runId: string,
        status: AutomationRunStatus,
        error: { code: string; message: string; step_key?: string } | null,
        startedAt: Date,
        outputs?: Record<string, unknown>,
        ctx?: OrgContext,
        settings?: Settings,
    ) {
        const now = new Date();
        const run = await this.prisma.automationRun.update({
            where: { id: runId },
            data: {
                status,
                finished_at: now,
                duration_ms: now.getTime() - startedAt.getTime(),
                ...(outputs ? { output: outputs as Prisma.InputJsonValue } : {}),
                error_code: error?.code ?? null,
                error_message: error?.message ?? null,
                error: (error ?? undefined) as Prisma.InputJsonValue | undefined,
                ...(status === AutomationRunStatus.DEAD_LETTERED ? { dead_lettered_at: now, dead_letter_reason: error?.message ?? null } : {}),
            },
            include: { rule: true },
        });
        await this.releaseLock(runId);
        if (run.mode !== AutomationRunMode.LIVE) return;
        const failed = status === AutomationRunStatus.FAILED || status === AutomationRunStatus.DEAD_LETTERED;
        await this.prisma.automationRule.update({
            where: { id: run.rule_id },
            data: { last_run_at: now, last_run_status: status, run_count: { increment: 1 }, ...(failed ? { failure_count: { increment: 1 } } : {}) },
        });
        const publishCtx = ctx ?? (await this.systemContext(run.organization_id));
        if (status === AutomationRunStatus.SUCCEEDED) this.publishRunEvent(publishCtx, run.id, run.rule, 'automation.rule_run_completed', {});
        if (failed) {
            this.publishRunEvent(publishCtx, run.id, run.rule, 'automation.rule_run_failed', { error_code: error?.code, error_message: error?.message, status });
            const s = settings ?? (await this.settings.forOrganization(run.organization_id));
            if (s.dead_letter_alerts_enabled && status === AutomationRunStatus.DEAD_LETTERED) {
                const ids = new Set(s.dead_letter_alert_membership_ids);
                if (s.dead_letter_alert_notify_rule_owner && run.rule.owner_membership_id) ids.add(run.rule.owner_membership_id);
                void this.notify(publishCtx, [...ids], 'automation.rule_run_failed', `Workflow failed: ${run.rule.name}`, error?.message ?? 'The run was dead-lettered after its retries.', `/automation/runs/${run.id}`);
            }
        }
    }

    private publishRunEvent(ctx: OrgContext, runId: string, rule: AutomationRule, key: string, extra: Record<string, unknown>) {
        this.events.publish(ctx, {
            event_key: key,
            module: ModuleKey.AUTOMATION,
            entity_type: RecordEntityType.AUTOMATION_RUN,
            entity_id: runId,
            payload: { rule_id: rule.id, rule_name: rule.name, ...extra },
        });
    }

    private notifications(): NotificationsService | null {
        try {
            return this.moduleRef.get(NotificationsService, { strict: false });
        } catch {
            return null;
        }
    }

    private async notify(ctx: OrgContext, ids: string[], eventKey: string, title: string, body: string, link: string) {
        if (!ids.length) return;
        try {
            await this.notifications()?.notify(ctx, { recipient_membership_ids: ids, event_key: eventKey, module: ModuleKey.AUTOMATION, title, body, link, requires_action: eventKey.includes('approval') });
        } catch (error) {
            this.logger.warn(`notification ${eventKey} not sent: ${(error as Error).message}`);
        }
    }

    // ---------------------------------------------------------------------------------------------
    // Serialization locks (20 §6)
    // ---------------------------------------------------------------------------------------------

    private async acquireLock(run: { id: string; organization_id: string; rule_id: string; entity_id: string | null; entity_type: RecordEntityType | null; entity_kind: string | null }) {
        const lockKey = `${run.rule_id}:${run.entity_id}`;
        const data = { organization_id: run.organization_id, rule_id: run.rule_id, run_id: run.id, entity_id: run.entity_id as string, entity_type: run.entity_type, entity_kind: run.entity_kind, lock_key: lockKey, expires_at: new Date(Date.now() + LOCK_SECONDS * 1000) };
        try {
            await this.prisma.automationRunLock.create({ data });
            return true;
        } catch {
            const existing = await this.prisma.automationRunLock.findUnique({ where: { organization_id_lock_key: { organization_id: run.organization_id, lock_key: lockKey } } });
            if (existing && (existing.run_id === run.id || existing.expires_at < new Date())) {
                await this.prisma.automationRunLock.update({ where: { id: existing.id }, data: { run_id: run.id, expires_at: data.expires_at, acquired_at: new Date() } });
                return true;
            }
            return false;
        }
    }

    private releaseLock(runId: string) {
        return this.prisma.automationRunLock.deleteMany({ where: { run_id: runId } }).catch(() => undefined);
    }

    // ---------------------------------------------------------------------------------------------
    // Worker hooks
    // ---------------------------------------------------------------------------------------------

    /** Resume runs whose wait or retry time has passed, expire approvals, and pick up events the bus missed. */
    async tick() {
        const now = new Date();
        const due = await this.prisma.automationRun.findMany({
            where: { OR: [{ status: AutomationRunStatus.WAITING, wait_until: { lte: now } }, { status: AutomationRunStatus.RETRY_SCHEDULED, next_retry_at: { lte: now } }] },
            select: { id: true },
            take: 25,
            orderBy: { updated_at: 'asc' },
        });
        for (const r of due) await this.execute(r.id);

        const expired = await this.prisma.automationApproval.findMany({ where: { decision: AutomationApprovalDecision.PENDING, expires_at: { lte: now } }, select: { id: true, run_id: true }, take: 25 });
        for (const a of expired) {
            const res = await this.prisma.automationApproval.updateMany({ where: { id: a.id, decision: AutomationApprovalDecision.PENDING }, data: { decision: AutomationApprovalDecision.EXPIRED, decided_at: now } });
            if (res.count) await this.execute(a.run_id);
        }

        // At-least-once: events stored but never matched (crash between write and emit, or a failed attempt).
        const missed = await this.prisma.platformEvent.findMany({
            where: {
                rules_processed_at: null,
                dead_lettered_at: null,
                organization_id: { not: null },
                occurred_at: { gte: new Date(now.getTime() - 6 * 3600_000), lte: new Date(now.getTime() - 120_000) },
                OR: [{ next_processing_at: null }, { next_processing_at: { lte: now } }],
            },
            select: { id: true, processing_attempts: true },
            take: 50,
            orderBy: { occurred_at: 'asc' },
        });
        for (const e of missed) {
            try {
                await this.processEvent(e.id);
            } catch (error) {
                const attempts = e.processing_attempts + 1;
                await this.prisma.platformEvent.update({
                    where: { id: e.id },
                    data: { processing_attempts: attempts, processing_error: (error as Error).message.slice(0, 500), ...(attempts >= 5 ? { dead_lettered_at: now } : { next_processing_at: new Date(now.getTime() + backoffSeconds(60, attempts) * 1000) }) },
                });
            }
        }
        return { resumed: due.length, expired: expired.length, events: missed.length };
    }
}

function toEntityType(value: string | null | undefined): RecordEntityType | null {
    return value && (Object.values(RecordEntityType) as string[]).includes(value) ? (value as RecordEntityType) : null;
}

function safeJson(text: string): Record<string, unknown> {
    try {
        return JSON.parse(text);
    } catch {
        throw new ActionError('invalid_input', 'Arguments must be valid JSON');
    }
}

/** Keep step outputs small: ids and top-level scalars of the result. */
function summarize(result: unknown): unknown {
    if (!result || typeof result !== 'object') return result ?? null;
    const json = JSON.stringify(result);
    if (json.length <= 4000) return JSON.parse(json);
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(result as Record<string, unknown>)) if (v === null || typeof v !== 'object') out[k] = v;
    return { ...out, truncated: true };
}
