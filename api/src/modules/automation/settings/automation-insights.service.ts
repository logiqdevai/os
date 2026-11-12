import { Injectable } from '@nestjs/common';
import { AutomationApprovalDecision, AutomationRunMode, AutomationRunStatus, ModuleKey, Prisma } from 'generated/prisma';
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

    /**
     * Pickers of the workflow builder and approval policies: branches, teams, roles (names only) and projects
     * (only with projects.projects.read, narrowed to the caller's project scope).
     */
    async scopeOptions(ctx: OrgContext, search?: string) {
        const q = search?.trim();
        const name = q ? { name: { contains: q, mode: 'insensitive' as const } } : {};
        const projectScope = ctx.scopeOf('projects.projects.read');
        let projectWhere: Prisma.ProjectWhereInput | null = null;
        if (ctx.can('projects.projects.read')) {
            projectWhere = { organization_id: ctx.organization_id, archived_at: null, ...name };
            if (projectScope && !projectScope.organization) {
                const or: Prisma.ProjectWhereInput[] = [
                    ...(projectScope.project_ids.length ? [{ id: { in: projectScope.project_ids } }] : []),
                    ...(projectScope.team_ids.length ? [{ team_id: { in: projectScope.team_ids } }] : []),
                    ...(projectScope.branch_ids.length ? [{ branch_id: { in: projectScope.branch_ids } }] : []),
                    ...(ctx.membership_id ? [{ owner_membership_id: ctx.membership_id }] : []),
                ];
                projectWhere = or.length ? { ...projectWhere, OR: or } : null;
            }
        }
        const [branches, teams, roles, projects] = await Promise.all([
            this.prisma.branch.findMany({ where: { organization_id: ctx.organization_id, archived_at: null }, select: { id: true, name: true }, orderBy: { name: 'asc' }, take: 200 }),
            this.prisma.team.findMany({ where: { organization_id: ctx.organization_id, archived_at: null, ...name }, select: { id: true, name: true }, orderBy: { name: 'asc' }, take: 200 }),
            this.prisma.role.findMany({ where: { OR: [{ organization_id: ctx.organization_id }, { organization_id: null }] }, select: { id: true, name: true, organization_id: true }, orderBy: { name: 'asc' }, take: 200 }),
            projectWhere ? this.prisma.project.findMany({ where: projectWhere, select: { id: true, name: true, code: true }, orderBy: { name: 'asc' }, take: 50 }) : [],
        ]);
        return { branches, teams, roles: roles.map((r) => ({ id: r.id, name: r.name, is_template: r.organization_id === null })), projects };
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

    /**
     * 20 §12 — AI agents & MCP overview: tool-call statistics (only with organizations.mcp_calls.read) and the service
     * accounts workflows run as. Read-only; management stays in Admin → Service accounts / MCP calls.
     */
    async agentsOverview(ctx: OrgContext, days: number) {
        const since = new Date(Date.now() - days * DAY);
        const settings = await this.prisma.automationSettings.findUnique({ where: { organization_id: ctx.organization_id }, select: { default_service_account_id: true } });
        const scopedRules = await this.prisma.automationRule.findMany({
            where: { organization_id: ctx.organization_id, archived_at: null, run_as_service_account_id: { not: null }, AND: [this.rules.scopeWhere(ctx)] },
            select: { id: true, name: true, enabled: true, status: true, run_as_service_account_id: true },
            orderBy: { name: 'asc' },
            take: 1000,
        });
        const saIds = [...new Set([...scopedRules.map((r) => r.run_as_service_account_id as string), ...(settings?.default_service_account_id ? [settings.default_service_account_id] : [])])];
        const [accounts, runRows] = await Promise.all([
            saIds.length ? this.prisma.serviceAccount.findMany({ where: { id: { in: saIds }, organization_id: ctx.organization_id }, select: { id: true, name: true, purpose: true, status: true, expires_at: true, owner: { select: { id: true, user: { select: { display_name: true, first_name: true, last_name: true, email: true } } } } } }) : [],
            saIds.length ? this.prisma.automationRun.findMany({ where: { organization_id: ctx.organization_id, run_as_service_account_id: { in: saIds }, created_at: { gte: since }, mode: AutomationRunMode.LIVE }, select: { run_as_service_account_id: true, status: true }, take: 50_000 }) : [],
        ]);
        const now = new Date();
        const service_accounts = accounts.map((a) => {
            const runs = runRows.filter((r) => r.run_as_service_account_id === a.id);
            const total = runs.length;
            const failed = runs.filter((r) => r.status === AutomationRunStatus.FAILED || r.status === AutomationRunStatus.DEAD_LETTERED).length;
            return {
                ...a,
                is_default: a.id === settings?.default_service_account_id,
                expired: !!a.expires_at && a.expires_at < now,
                rule_count: scopedRules.filter((r) => r.run_as_service_account_id === a.id).length,
                rules: scopedRules.filter((r) => r.run_as_service_account_id === a.id).slice(0, 10),
                runs: total,
                failed_runs: failed,
            };
        });

        let mcp: Record<string, unknown> | null = null;
        if (ctx.can('organizations.mcp_calls.read')) {
            const where = { organization_id: ctx.organization_id, created_at: { gte: since } };
            // One row query aggregated here (cheaper to type-check and run than five groupBy calls on a small table).
            const [rows, awaiting] = await Promise.all([
                this.prisma.mcpToolCall.findMany({
                    where,
                    select: { id: true, tool_name: true, status: true, error_code: true, client_name: true, created_at: true, service_account_id: true, api_key_id: true, automation_run_id: true, duration_ms: true },
                    orderBy: { created_at: 'desc' },
                    take: 20_000,
                }),
                this.prisma.mcpToolCall.count({ where: { organization_id: ctx.organization_id, status: 'AWAITING_CONFIRMATION' } }),
            ]);
            const tally = <K extends string>(keyOf: (r: (typeof rows)[number]) => K | null) => {
                const m = new Map<K, number>();
                for (const r of rows) {
                    const k = keyOf(r);
                    if (k !== null) m.set(k, (m.get(k) ?? 0) + 1);
                }
                return [...m.entries()].sort((a, b) => b[1] - a[1]);
            };
            const byStatus = tally((r) => r.status);
            const byTool = tally((r) => r.tool_name).slice(0, 10);
            const byAccount = tally((r) => r.service_account_id).slice(0, 10);
            const byKey = tally((r) => r.api_key_id).slice(0, 10);
            const byClient = tally((r) => r.client_name).slice(0, 10);
            const durations = new Map<string, { sum: number; n: number }>();
            for (const r of rows) {
                if (r.duration_ms === null) continue;
                const d = durations.get(r.tool_name) ?? { sum: 0, n: 0 };
                d.sum += r.duration_ms;
                d.n++;
                durations.set(r.tool_name, d);
            }
            const [saNames, keyNames] = await Promise.all([
                byAccount.length ? this.prisma.serviceAccount.findMany({ where: { id: { in: byAccount.map(([id]) => id) }, organization_id: ctx.organization_id }, select: { id: true, name: true } }) : [],
                byKey.length ? this.prisma.apiKey.findMany({ where: { id: { in: byKey.map(([id]) => id) }, organization_id: ctx.organization_id }, select: { id: true, name: true, key_prefix: true } }) : [],
            ]);
            const byDay = new Map<string, { date: string; succeeded: number; failed: number }>();
            for (let i = days - 1; i >= 0; i--) {
                const d = new Date(Date.now() - i * DAY).toISOString().slice(0, 10);
                byDay.set(d, { date: d, succeeded: 0, failed: 0 });
            }
            for (const r of rows) {
                const row = byDay.get(r.created_at.toISOString().slice(0, 10));
                if (!row) continue;
                if (r.status === 'FAILED' || r.status === 'DENIED') row.failed++;
                else row.succeeded++;
            }
            mcp = {
                total: rows.length,
                by_status: Object.fromEntries(byStatus),
                awaiting_confirmation: awaiting,
                from_automation: rows.filter((r) => r.automation_run_id).length,
                top_tools: byTool.map(([tool, count]) => {
                    const d = durations.get(tool);
                    return { tool_name: tool, count, avg_duration_ms: d?.n ? Math.round(d.sum / d.n) : null };
                }),
                by_service_account: byAccount.map(([id, count]) => ({ id, name: saNames.find((n) => n.id === id)?.name ?? 'Removed account', count })),
                by_api_key: byKey.map(([id, count]) => {
                    const k = keyNames.find((n) => n.id === id);
                    return { id, name: k?.name ?? 'Removed key', key_prefix: k?.key_prefix ?? null, count };
                }),
                by_client: byClient.map(([client_name, count]) => ({ client_name, count })),
                by_day: [...byDay.values()],
                recent_issues: rows.filter((r) => r.status === 'FAILED' || r.status === 'DENIED').slice(0, 8).map(({ duration_ms: _d, automation_run_id: _a, ...r }) => r),
            };
        }
        return {
            days,
            service_accounts,
            default_service_account_id: settings?.default_service_account_id ?? null,
            mcp,
            can: { mcp_calls: ctx.can('organizations.mcp_calls.read'), service_accounts: ctx.can('organizations.service_accounts.manage') },
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
