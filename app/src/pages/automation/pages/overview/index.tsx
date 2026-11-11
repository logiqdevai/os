import { Link } from "react-router-dom";
import { Activity, AlertTriangle, CheckCircle2, Clock, Globe, LayoutTemplate, ListChecks, Plus, Zap } from "lucide-react";
import { Page, PageHeader, Section } from "@/components/ui/page";
import { StatCard, StatGrid } from "@/components/ui/stat-card";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState, PageSkeleton } from "@/components/ui/states";
import { Can } from "@/components/access/can";
import { usePermission } from "@/hooks/use-permission";
import { formatRelative } from "@/lib/format";
import { useAutomationOverview, useRuleTemplates } from "@/features/automation/hooks/use-automation";
import { StatusBadge, formatDuration } from "../../components/automation-ui";

/**
 * /automation — overview (20 §2, §6, §8)
 * @perm VIEW automation.rules.read · run numbers automation.runs.read · deliveries automation.webhooks.read · jobs automation.jobs.read
 * @api GET /automation/overview · GET /automation/templates
 */
export default function AutomationOverviewPage() {
    const overview = useAutomationOverview();
    const templates = useRuleTemplates();
    const canCreate = usePermission("automation.rules.create");

    if (overview.isPending) return <PageSkeleton />;
    if (overview.error) return <Page><ErrorState error={overview.error} onRetry={() => overview.refetch()} /></Page>;
    const o = overview.data;

    return (
        <Page>
            <PageHeader
                title="Automation"
                description="Workflows react to events across the OS, run on schedules and call webhooks — always with the permissions of their owner or service account."
                actions={
                    <Can permission="automation.rules.create">
                        <Button asChild><Link to="/automation/workflows/new"><Plus /> New workflow</Link></Button>
                    </Can>
                }
            />

            <StatGrid className="mb-6">
                <StatCard label="Workflows enabled" value={`${o.rules.enabled} / ${o.rules.total}`} hint={o.rules.drafts ? `${o.rules.drafts} draft${o.rules.drafts === 1 ? "" : "s"}` : "No drafts"} icon={Zap} />
                {o.runs && <StatCard label="Runs (24 h)" value={o.runs.last_24h} hint={o.runs.failed_24h ? `${o.runs.failed_24h} failed` : "No failures"} tone={o.runs.failed_24h ? "danger" : "success"} icon={Activity} />}
                {o.runs && <StatCard label="Success rate (7 d)" value={o.runs.success_rate_7d === null ? "—" : `${o.runs.success_rate_7d}%`} hint={`Avg ${formatDuration(o.runs.avg_duration_ms_7d)}`} icon={CheckCircle2} tone="success" />}
                <StatCard label="Waiting for you" value={o.pending_approvals_mine} hint="Approvals requested from you" icon={Clock} tone={o.pending_approvals_mine ? "warning" : "default"} />
            </StatGrid>

            {(!!o.dead_lettered_deliveries_7d || !!o.failing_jobs) && (
                <div className="mb-6 flex flex-col gap-2 rounded-lg border border-warning/40 bg-warning-soft p-3 text-[13px] text-foreground sm:flex-row sm:items-center">
                    <AlertTriangle className="size-4 shrink-0 text-warning" />
                    <span className="flex-1">
                        {o.dead_lettered_deliveries_7d ? `${o.dead_lettered_deliveries_7d} webhook deliveries were dead-lettered this week. ` : ""}
                        {o.failing_jobs ? `${o.failing_jobs} scheduled job(s) are failing.` : ""}
                    </span>
                    <div className="flex gap-2">
                        {!!o.dead_lettered_deliveries_7d && <Button size="sm" variant="outline" asChild><Link to="/automation/webhooks?tab=deliveries&status=DEAD_LETTERED">Deliveries</Link></Button>}
                        {!!o.failing_jobs && <Button size="sm" variant="outline" asChild><Link to="/automation/jobs">Jobs</Link></Button>}
                    </div>
                </div>
            )}

            <div className="grid gap-6 lg:grid-cols-2">
                {o.runs && (
                    <Section title="Recent runs" actions={<Button variant="ghost" size="sm" asChild><Link to="/automation/runs">All runs</Link></Button>}>
                        <div className="overflow-hidden rounded-lg border border-border bg-card">
                            {o.recent_runs.length ? (
                                <ul className="divide-y divide-border">
                                    {o.recent_runs.map((r) => (
                                        <li key={r.id}>
                                            <Link to={`/automation/runs/${r.id}`} className="flex items-center gap-3 px-3 py-2.5 transition-colors hover:bg-secondary">
                                                <div className="min-w-0 flex-1">
                                                    <div className="truncate text-[13px] font-medium text-foreground">{r.rule.name}</div>
                                                    <div className="truncate font-mono text-xs text-muted-foreground">{r.trigger_key}</div>
                                                </div>
                                                <div className="hidden text-right text-xs text-muted-foreground sm:block">
                                                    <div>{formatRelative(r.created_at)}</div>
                                                    <div>{formatDuration(r.duration_ms)}</div>
                                                </div>
                                                <StatusBadge status={r.status} />
                                            </Link>
                                        </li>
                                    ))}
                                </ul>
                            ) : (
                                <EmptyState compact icon={Activity} title="No runs yet" description="Runs appear here as soon as an enabled workflow is triggered." />
                            )}
                        </div>
                    </Section>
                )}

                <Section title="Needs attention" description="Workflows with the most failures">
                    <div className="overflow-hidden rounded-lg border border-border bg-card">
                        {o.top_failing_rules.length ? (
                            <ul className="divide-y divide-border">
                                {o.top_failing_rules.map((r) => (
                                    <li key={r.id}>
                                        <Link to={`/automation/workflows/${r.id}`} className="flex items-center gap-3 px-3 py-2.5 transition-colors hover:bg-secondary">
                                            <div className="min-w-0 flex-1">
                                                <div className="truncate text-[13px] font-medium text-foreground">{r.name}</div>
                                                <div className="text-xs text-muted-foreground">{r.failure_count} failures of {r.run_count} runs</div>
                                            </div>
                                            <StatusBadge status={r.last_run_status} />
                                        </Link>
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <EmptyState compact icon={CheckCircle2} title="Nothing is failing" description="Failed and dead-lettered workflows show up here." />
                        )}
                    </div>
                </Section>
            </div>

            <Section title="Start from a template" className="mt-6" description="Recipes you can adapt in the builder.">
                {templates.isPending ? null : templates.data?.length ? (
                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                        {templates.data.slice(0, 6).map((t) => (
                            <div key={t.key} className="flex flex-col rounded-lg border border-border bg-card p-4">
                                <div className="mb-1 flex items-center gap-2">
                                    <LayoutTemplate className="size-4 text-muted-foreground" />
                                    <span className="truncate text-[13px] font-medium text-foreground">{t.name}</span>
                                </div>
                                <p className="mb-3 flex-1 text-xs text-muted-foreground">{t.description}</p>
                                <div className="flex items-center justify-between gap-2">
                                    <span className="truncate font-mono text-xs text-muted-foreground">{t.definition.trigger_key}</span>
                                    {canCreate && (
                                        <Button size="sm" variant="outline" asChild>
                                            <Link to={`/automation/workflows/new?template=${encodeURIComponent(t.id ?? t.key)}`}>Use</Link>
                                        </Button>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <EmptyState compact icon={ListChecks} title="No templates" />
                )}
            </Section>

            <div className="mt-6 grid gap-3 sm:grid-cols-3">
                <QuickLink to="/automation/events" icon={Activity} title="Event log" text="Every event modules publish, and what it started." permission="automation.runs.read" />
                <QuickLink to="/automation/webhooks" icon={Globe} title="Webhooks" text="Signed outbound and inbound webhooks." permission="automation.webhooks.read" />
                <QuickLink to="/automation/jobs" icon={Clock} title="Scheduled jobs" text="Recurring jobs hosted by the engine." permission="automation.jobs.read" />
            </div>
        </Page>
    );
}

function QuickLink({ to, icon: Icon, title, text, permission }: { to: string; icon: typeof Zap; title: string; text: string; permission: string }) {
    return (
        <Can permission={permission}>
            <Link to={to} className="rounded-lg border border-border bg-card p-4 transition-colors hover:bg-secondary">
                <div className="flex items-center gap-2 text-[13px] font-medium text-foreground"><Icon className="size-4 text-muted-foreground" /> {title}</div>
                <p className="mt-1 text-xs text-muted-foreground">{text}</p>
            </Link>
        </Can>
    );
}
