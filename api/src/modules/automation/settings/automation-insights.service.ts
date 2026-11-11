import { Injectable } from '@nestjs/common';
import { AutomationApprovalDecision, AutomationRunMode, AutomationRunStatus, ModuleKey } from 'generated/prisma';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import { McpRegistry } from '@/core/mcp/mcp.registry';
import { OrgContext } from '@/shared/authorization/interfaces/org-context.interface';
import { ACTION_CATALOG } from '../catalog/action-catalog';
import { TRIGGER_CATALOG } from '../catalog/trigger-catalog';
import { RulesService } from '../rules/rules.service';

const DAY = 86_400_000;

/** Catalogs (20 §3, §4), overview dashboard and usage aggregates (20 §8, §12). */
@Injectable()
export class AutomationInsightsService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly mcp: McpRegistry,
        private readonly rules: RulesService,
    ) { }

    /** Catalog triggers plus event keys seen on this organization's bus in the last 30 days ("discovered"). */
    async triggers(ctx: OrgContext, query: { module?: ModuleKey; search?: string }) {
        const seen = await this.prisma.platformEvent.groupBy({
            by: ['event_key', 'module'],
            where: { organization_id: ctx.organization_id, occurred_at: { gte: new Date(Date.now() - 30 * DAY) } },
            _count: { _all: true },
            _max: { occurred_at: true },
        });
        const seenMap = new Map(seen.map((s) => [s.event_key, s]));
        const catalog = TRIGGER_CATALOG.map((t) => ({
            ...t,
            source: 'catalog' as const,
            can_use: !t.required_permission || ctx.can(t.required_permission),
            module_enabled: ctx.effective.modules.includes(t.module),
            seen_30d: seenMap.get(t.key)?._count._all ?? 0,
            last_seen_at: seenMap.get(t.key)?._max.occurred_at ?? null,
        }));
        const known = new Set(TRIGGER_CATALOG.map((t) => t.key));
        const discovered = seen
            .filter((s) => !known.has(s.event_key) && !s.event_key.startsWith('inbound_webhook.'))
            .map((s) => ({
                key: s.event_key,
                module: s.module,
                name: s.event_key,
                description: 'Published by a module on the event bus (not described in the catalog yet).',
                kind: 'EVENT' as const,
                source: 'discovered' as const,
                can_use: true,
                module_enabled: ctx.effective.modules.includes(s.module),
                seen_30d: s._count._all,
                last_seen_at: s._max.occurred_at,
            }));
        const q = query.search?.toLowerCase();
        return [...catalog, ...discovered].filter((t) => (!query.module || t.module === query.module) && (!q || `${t.key} ${t.name}`.toLowerCase().includes(q)));
    }

    actions(ctx: OrgContext) {
        return ACTION_CATALOG.map(({ executor, ...a }) => {
            const tool = executor.type === 'mcp' ? this.mcp.get(executor.tool) : undefined;
            const required = [a.required_permission, tool?.permission].filter(Boolean) as string[];
            return {
                ...a,
                executor: executor.type,
                tool: executor.type === 'mcp' ? executor.tool : null,
                available: executor.type === 'builtin' || !!tool,
                is_destructive: !!a.is_destructive || !!tool?.sensitive,
                required_permissions: [...new Set(required)],
                can_use: required.every((p) => ctx.can(p)),
                module_enabled: ctx.effective.modules.includes(a.module),
            };
        });
    }

    /** MCP tools the "Run any tool" action can call (only those the caller holds). */
    tools(ctx: OrgContext) {
        return this.mcp.listFor(ctx).map((t) => ({ name: t.name, description: t.description, permission: t.permission, module: t.module, sensitive: !!t.sensitive, input_schema: this.mcp.jsonSchema(t) }));
    }

    async overview(ctx: OrgContext) {
        const since24 = new Date(Date.now() - DAY);
        const since7 = new Date(Date.now() - 7 * DAY);
        const ruleScope = this.rules.scopeWhere(ctx);
        const canRuns = ctx.can('automation.runs.read');
        const runWhere = { organization_id: ctx.organization_id, mode: AutomationRunMode.LIVE, rule: this.rules.scopeWhere(ctx, 'automation.runs.read') };
        const [ruleStats, runs24, runs7, pendingApprovals, deadDeliveries, failingJobs, topFailing, recent] = await Promise.all([
            this.prisma.automationRule.groupBy({ by: ['status', 'enabled'], where: { organization_id: ctx.organization_id, AND: [ruleScope] }, _count: { _all: true } }),
            canRuns ? this.prisma.automationRun.groupBy({ by: ['status'], where: { ...runWhere, created_at: { gte: since24 } }, _count: { _all: true } }) : [],
            canRuns ? this.prisma.automationRun.groupBy({ by: ['status'], where: { ...runWhere, created_at: { gte: since7 } }, _count: { _all: true }, _avg: { duration_ms: true } }) : [],
            this.prisma.automationApproval.count({ where: { organization_id: ctx.organization_id, decision: AutomationApprovalDecision.PENDING, requested_from_membership_id: ctx.membership_id ?? '__none__' } }),
            ctx.can('automation.webhooks.read') ? this.prisma.webhookDelivery.count({ where: { organization_id: ctx.organization_id, status: 'DEAD_LETTERED', created_at: { gte: since7 } } }) : null,
            ctx.can('automation.jobs.read') ? this.prisma.scheduledJob.count({ where: { organization_id: ctx.organization_id, consecutive_failures: { gt: 0 } } }) : null,
            this.prisma.automationRule.findMany({ where: { organization_id: ctx.organization_id, AND: [ruleScope], failure_count: { gt: 0 }, status: { not: 'ARCHIVED' } }, orderBy: { failure_count: 'desc' }, take: 5, select: { id: true, name: true, failure_count: true, run_count: true, last_run_status: true, last_run_at: true } }),
            canRuns ? this.prisma.automationRun.findMany({ where: { organization_id: ctx.organization_id, rule: this.rules.scopeWhere(ctx, 'automation.runs.read') }, orderBy: { created_at: 'desc' }, take: 8, select: { id: true, status: true, mode: true, trigger_key: true, created_at: true, duration_ms: true, rule: { select: { id: true, name: true } } } }) : [],
        ]);
        const count = (rows: { status: string; _count: { _all: number } }[], ...statuses: string[]) => rows.filter((r) => !statuses.length || statuses.includes(r.status)).reduce((n, r) => n + r._count._all, 0);
        const finished7 = count(runs7, AutomationRunStatus.SUCCEEDED, AutomationRunStatus.FAILED, AutomationRunStatus.DEAD_LETTERED);
        const durations = runs7.filter((r) => r._avg.duration_ms !== null);
        return {
            rules: {
                total: ruleStats.filter((r) => r.status !== 'ARCHIVED').reduce((n, r) => n + r._count._all, 0),
                enabled: ruleStats.filter((r) => r.status === 'PUBLISHED' && r.enabled).reduce((n, r) => n + r._count._all, 0),
                drafts: ruleStats.filter((r) => r.status === 'DRAFT').reduce((n, r) => n + r._count._all, 0),
            },
            runs: canRuns
                ? {
                    last_24h: count(runs24),
                    failed_24h: count(runs24, AutomationRunStatus.FAILED, AutomationRunStatus.DEAD_LETTERED),
                    waiting: count(runs24, AutomationRunStatus.WAITING, AutomationRunStatus.AWAITING_APPROVAL, AutomationRunStatus.RETRY_SCHEDULED),
                    success_rate_7d: finished7 ? Math.round((count(runs7, AutomationRunStatus.SUCCEEDED) / finished7) * 1000) / 10 : null,
                    avg_duration_ms_7d: durations.length ? Math.round(durations.reduce((n, r) => n + (r._avg.duration_ms ?? 0) * r._count._all, 0) / durations.reduce((n, r) => n + r._count._all, 0)) : null,
                    by_status_7d: Object.fromEntries(runs7.map((r) => [r.status, r._count._all])),
                }
                : null,
            pending_approvals_mine: pendingApprovals,
            dead_lettered_deliveries_7d: deadDeliveries,
            failing_jobs: failingJobs,
            top_failing_rules: topFailing,
            recent_runs: recent,
        };
    }

    async usage(ctx: OrgContext, days: number) {
        const since = new Date(Date.now() - days * DAY);
        const [runs, events, deliveries, jobRuns, steps] = await Promise.all([
            this.prisma.automationRun.findMany({ where: { organization_id: ctx.organization_id, created_at: { gte: since } }, select: { created_at: true, status: true, mode: true }, take: 50_000 }),
            this.prisma.platformEvent.groupBy({ by: ['event_key'], where: { organization_id: ctx.organization_id, occurred_at: { gte: since } }, _count: { _all: true }, orderBy: { _count: { event_key: 'desc' } }, take: 10 }),
            this.prisma.webhookDelivery.groupBy({ by: ['status'], where: { organization_id: ctx.organization_id, created_at: { gte: since } }, _count: { _all: true } }),
            this.prisma.scheduledJobRun.count({ where: { organization_id: ctx.organization_id, created_at: { gte: since } } }),
            this.prisma.automationRunStep.count({ where: { run: { organization_id: ctx.organization_id }, created_at: { gte: since } } }),
        ]);
        const byDay = new Map<string, { date: string; succeeded: number; failed: number; other: number }>();
        for (let i = days - 1; i >= 0; i--) {
            const d = new Date(Date.now() - i * DAY).toISOString().slice(0, 10);
            byDay.set(d, { date: d, succeeded: 0, failed: 0, other: 0 });
        }
        for (const r of runs) {
            const row = byDay.get(r.created_at.toISOString().slice(0, 10));
            if (!row) continue;
            if (r.status === AutomationRunStatus.SUCCEEDED) row.succeeded++;
            else if (r.status === AutomationRunStatus.FAILED || r.status === AutomationRunStatus.DEAD_LETTERED) row.failed++;
            else row.other++;
        }
        return {
            days,
            runs_total: runs.length,
            steps_total: steps,
            runs_by_day: [...byDay.values()],
            top_events: events.map((e) => ({ event_key: e.event_key, count: e._count._all })),
            deliveries_by_status: Object.fromEntries(deliveries.map((d) => [d.status, d._count._all])),
            job_runs_total: jobRuns,
        };
    }
}
