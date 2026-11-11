import { Link } from "react-router-dom";
import { AlertTriangle, CalendarClock, CheckCircle2, Clock, FolderKanban, OctagonAlert } from "lucide-react";
import { Page, PageHeader, Section } from "@/components/ui/page";
import { StatCard, StatGrid } from "@/components/ui/stat-card";
import { EmptyState, ErrorState, PageSkeleton } from "@/components/ui/states";
import { MemberAvatar } from "@/components/ui/member-avatar";
import { Badge } from "@/components/ui/badge";
import { usePortfolio } from "@/features/projects/hooks/use-projects";
import { formatDate, formatNumber } from "@/lib/format";
import { HealthBadge, ProgressBar, ProjectDot } from "../../components/project-badges";

/**
 * /projects/overview — portfolio KPIs.
 * @perm VIEW projects.projects.read (scoped) · money needs projects.finance.read (API strips it)
 * @api GET /projects/portfolio
 * @states loading · empty ("No projects yet") · error / 403
 */
export default function ProjectsOverviewPage() {
    const portfolio = usePortfolio();
    if (portfolio.isPending) return <PageSkeleton />;
    if (portfolio.error) return <Page><PageHeader title="Portfolio" /><ErrorState error={portfolio.error} onRetry={() => portfolio.refetch()} /></Page>;
    const p = portfolio.data;
    const t = p.totals;
    const listCard = "rounded-lg border border-border bg-card";

    return (
        <Page>
            <PageHeader title="Portfolio" description="Health, milestones and effort across your active projects." />
            {!t.projects ? (
                <div className={listCard}>
                    <EmptyState icon={FolderKanban} title="No projects yet" description="Projects you create or join appear here." action={<Link className="text-[13px] text-primary underline-offset-4 hover:underline" to="/projects/new">Create a project</Link>} />
                </div>
            ) : (
                <div className="space-y-6">
                    <StatGrid>
                        <StatCard label="Active projects" value={t.active} hint={`${t.completed} completed`} icon={FolderKanban} />
                        <StatCard label="On track" value={t.on_track} icon={CheckCircle2} tone="success" hint={t.unknown_health ? `${t.unknown_health} without an update` : undefined} />
                        <StatCard label="At risk / off track" value={t.at_risk + t.critical} icon={AlertTriangle} tone={t.at_risk + t.critical ? "warning" : "default"} hint={t.open_blockers ? `${t.open_blockers} open blockers` : "No open blockers"} />
                        <StatCard label="Overdue" value={t.overdue_milestones + t.overdue_tasks} icon={Clock} tone={t.overdue_milestones + t.overdue_tasks ? "danger" : "default"} hint={`${t.overdue_milestones} milestones · ${t.overdue_tasks} tasks`} />
                    </StatGrid>

                    <div className="grid gap-6 lg:grid-cols-2">
                        <Section title="Needs attention" description="Projects at risk, blocked or off track.">
                            <div className={listCard}>
                                {!p.at_risk.length ? (
                                    <EmptyState compact icon={CheckCircle2} title="Everything is on track" />
                                ) : (
                                    <ul className="divide-y divide-border-soft">
                                        {p.at_risk.map((r) => (
                                            <li key={r.id}>
                                                <Link to={`/projects/${r.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-accent/50">
                                                    <ProjectDot color={r.color} />
                                                    <div className="min-w-0 flex-1">
                                                        <div className="truncate text-[13px] font-medium text-foreground">{r.name}</div>
                                                        <div className="truncate text-xs text-muted-foreground">{r.health_reason || r.company?.name || "Internal"}</div>
                                                    </div>
                                                    <HealthBadge health={r.health} />
                                                    <MemberAvatar person={r.owner?.user} size="xs" emptyLabel="No owner" className="hidden sm:inline-flex" />
                                                </Link>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </div>
                        </Section>

                        <Section title="Milestones" description="Due in the next 14 days, and overdue.">
                            <div className={listCard}>
                                {!p.upcoming_milestones.length && !p.overdue_milestones.length ? (
                                    <EmptyState compact icon={CalendarClock} title="No milestones due soon" />
                                ) : (
                                    <ul className="divide-y divide-border-soft">
                                        {[...p.overdue_milestones.map((m) => ({ ...m, overdue: true })), ...p.upcoming_milestones.map((m) => ({ ...m, overdue: false }))].map((m) => (
                                            <li key={m.id}>
                                                <Link to={`/projects/${m.project.id}?tab=milestones`} className="flex items-center gap-3 px-4 py-3 hover:bg-accent/50">
                                                    <ProjectDot color={m.project.color} />
                                                    <div className="min-w-0 flex-1">
                                                        <div className="truncate text-[13px] font-medium text-foreground">{m.name}</div>
                                                        <div className="truncate text-xs text-muted-foreground">{m.project.name}</div>
                                                    </div>
                                                    {m.overdue ? <Badge variant="danger">Overdue · {formatDate(m.planned_date, "d MMM")}</Badge> : <span className="text-xs tabular text-muted-foreground">{formatDate(m.planned_date, "d MMM")}</span>}
                                                </Link>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </div>
                        </Section>
                    </div>

                    <Section title="Hours vs budget" description={`${formatNumber(t.logged_hours, 1)} of ${formatNumber(t.budget_hours)} budgeted hours logged on active projects.`}>
                        <div className={listCard}>
                            {!p.budget.length ? (
                                <EmptyState compact icon={OctagonAlert} title="No hour budgets set" description="Add budget hours to a project to track burn." />
                            ) : (
                                <ul className="divide-y divide-border-soft">
                                    {p.budget.map((b) => (
                                        <li key={b.project.id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:gap-4">
                                            <Link to={`/projects/${b.project.id}`} className="flex min-w-0 items-center gap-2 sm:w-64">
                                                <ProjectDot color={b.project.color} />
                                                <span className="truncate text-[13px] font-medium text-foreground hover:underline">{b.project.name}</span>
                                            </Link>
                                            <ProgressBar value={b.burn_percent} tone={b.burn_percent > 100 ? "danger" : b.burn_percent > 85 ? "warning" : "default"} className="flex-1" />
                                            <span className="shrink-0 text-xs tabular text-muted-foreground">{formatNumber(b.logged_hours, 1)}h / {formatNumber(b.budget_hours)}h · {b.burn_percent}%</span>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    </Section>
                </div>
            )}
        </Page>
    );
}
