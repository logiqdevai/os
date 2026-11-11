import { useState } from "react";
import { Link } from "react-router-dom";
import { Users } from "lucide-react";
import { Page, PageHeader } from "@/components/ui/page";
import { EmptyState, ErrorState, ListSkeleton } from "@/components/ui/states";
import { MemberAvatar } from "@/components/ui/member-avatar";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useProjectWorkload } from "@/features/projects/hooks/use-projects";
import { formatNumber } from "@/lib/format";
import { ProgressBar, ProjectDot } from "../../components/project-badges";

const iso = (d: Date) => d.toISOString().slice(0, 10);

/**
 * /projects/workload — planned allocation per person (05 §51). Capacity and actuals belong to People (10) and Time (18).
 * @perm VIEW projects.portfolio.read or projects.members.manage · @api GET /projects/workload?from=&to=
 */
export default function ProjectWorkloadPage() {
    const today = new Date();
    const [from, setFrom] = useState(iso(today));
    const [to, setTo] = useState(iso(new Date(today.getTime() + 27 * 86_400_000)));
    const workload = useProjectWorkload({ from, to });

    return (
        <Page>
            <PageHeader title="Workload" description="Planned allocation across projects. Over 100% is overbooked." />
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end">
                <div className="space-y-1"><Label htmlFor="wl-from" className="text-xs">From</Label><Input id="wl-from" type="date" className="h-8 sm:w-40" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
                <div className="space-y-1"><Label htmlFor="wl-to" className="text-xs">To</Label><Input id="wl-to" type="date" className="h-8 sm:w-40" value={to} min={from} onChange={(e) => setTo(e.target.value)} /></div>
            </div>
            <div className="rounded-lg border border-border bg-card">
                {workload.isPending ? <ListSkeleton /> : workload.error ? <ErrorState error={workload.error} onRetry={() => workload.refetch()} /> : !workload.data.people.length ? (
                    <EmptyState icon={Users} title="No allocations in this period" description="Add members with an allocation % on a project, or plan allocations." />
                ) : (
                    <ul className="divide-y divide-border-soft">
                        {workload.data.people.map((row) => (
                            <li key={row.membership.id} className="grid gap-3 px-4 py-3 md:grid-cols-[14rem_1fr_9rem] md:items-center">
                                <MemberAvatar person={row.membership.user} showName />
                                <div className="space-y-2">
                                    <div className="flex items-center gap-3">
                                        <ProgressBar value={Math.min(row.total_percent, 100)} tone={row.over_allocated ? "danger" : row.total_percent >= 90 ? "warning" : "default"} />
                                        <span className="w-12 shrink-0 text-right text-xs font-medium tabular">{row.total_percent}%</span>
                                    </div>
                                    <div className="flex flex-wrap gap-1.5">
                                        {row.projects.map((p) => (
                                            <Link key={`${p.project.id}-${p.source}`} to={`/projects/${p.project.id}?tab=members`} className="inline-flex items-center gap-1.5 rounded-xs border border-border bg-secondary px-1.5 py-0.5 text-xs text-muted-foreground hover:text-foreground">
                                                <ProjectDot color={p.project.color} />
                                                {p.project.name}
                                                {p.allocation_percent !== null && <span className="tabular">· {p.allocation_percent}%</span>}
                                                {p.planned_hours ? <span className="tabular">· {formatNumber(p.planned_hours)}h</span> : null}
                                            </Link>
                                        ))}
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 md:justify-end">
                                    {row.over_allocated && <Badge variant="danger">Overbooked</Badge>}
                                    <span className="text-xs text-muted-foreground tabular">{row.open_tasks} open tasks</span>
                                </div>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </Page>
    );
}
