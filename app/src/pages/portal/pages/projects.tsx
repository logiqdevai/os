import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ChevronLeft, FolderKanban } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MemberAvatar } from "@/components/ui/member-avatar";
import { Pagination } from "@/components/ui/pagination";
import { EmptyState, ErrorState, ListSkeleton, PageSkeleton } from "@/components/ui/states";
import { formatDate } from "@/lib/format";
import { getDropdownOptionLabel } from "@/lib/dropdown-option-label.utils";
import { ProjectHealthOptions, ProjectHealthTone } from "@/config/constants/dropdowns/portal/portal.options";
import { usePortalProject, usePortalProjects } from "@/features/portal/hooks/use-portal";
import { DeliverableStatusBadge, PortalCard, PortalHeader, ProgressBar } from "../components/portal-ui";
import { ReviewDialog } from "../components/review-dialog";
import { PORTAL_PATHS } from "../portal-paths";
import type { PortalDeliverable } from "@/features/portal/interfaces/portal.interfaces";

/** Customer projects — /portal/projects (mockup 07-portal `cp-projects`). @perm portal.projects.read */
export function PortalProjectsPage() {
    const [search, setSearch] = useState("");
    const [page, setPage] = useState(1);
    const projects = usePortalProjects({ search: search || undefined, page, limit: 12 });
    return (
        <>
            <PortalHeader title="Projects" description="Progress, milestones and deliverables of your projects." />
            <Input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Search projects…" className="mb-4 h-9 sm:max-w-xs" aria-label="Search projects" />
            {projects.isLoading ? <ListSkeleton /> : projects.error ? <ErrorState error={projects.error} onRetry={() => projects.refetch()} /> : !projects.data?.data.length ? (
                <EmptyState icon={FolderKanban} title={search ? "No projects match" : "No projects yet"} description="Projects appear here once the team shares them with you." />
            ) : (
                <>
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        {projects.data.data.map((p) => (
                            <Link key={p.id} to={PORTAL_PATHS.project(p.id)} className="rounded-xl border border-border bg-card p-4 transition-colors hover:bg-secondary/50">
                                <div className="flex items-start gap-2"><span className="min-w-0 flex-1 font-medium text-foreground">{p.name}</span><Badge variant={ProjectHealthTone[p.health] ?? "neutral"}>{getDropdownOptionLabel(ProjectHealthOptions, p.health)}</Badge></div>
                                {p.description && <p className="mt-1 line-clamp-2 text-[13px] text-muted-foreground">{p.description}</p>}
                                <div className="mt-4 flex justify-between text-xs text-muted-foreground"><span>{p.status?.name ?? "In progress"}</span><span className="tabular">{p.progress_percent}%</span></div>
                                <div className="mt-1.5"><ProgressBar value={p.progress_percent} /></div>
                                <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
                                    {(p.customer_deadline || p.target_completion) && <span>Due {formatDate(p.customer_deadline ?? p.target_completion)}</span>}
                                    {!!p.approvals_waiting && <Badge variant="warning">{p.approvals_waiting} to approve</Badge>}
                                </div>
                            </Link>
                        ))}
                    </div>
                    {projects.data.pagination.total_pages > 1 && <div className="mt-4"><Pagination currentPage={page} totalPages={projects.data.pagination.total_pages} onPageChange={setPage} /></div>}
                </>
            )}
        </>
    );
}

/** Customer project page — /portal/projects/:id (mockup 07-portal `cp-project`). @perm portal.projects.read · approve portal.deliverables.approve */
export function PortalProjectPage() {
    const { id } = useParams();
    const project = usePortalProject(id);
    const [reviewing, setReviewing] = useState<PortalDeliverable | null>(null);
    if (project.isLoading) return <PageSkeleton />;
    if (project.error || !project.data) return <ErrorState error={project.error} onRetry={() => project.refetch()} />;
    const p = project.data;
    const awaiting = (d: PortalDeliverable) => d.status === "READY_FOR_REVIEW" || d.status === "SUBMITTED";
    return (
        <>
            <Link to={PORTAL_PATHS.projects} className="mb-2 inline-flex items-center gap-1 text-[13px] text-muted-foreground hover:text-foreground"><ChevronLeft className="size-3.5" /> Projects</Link>
            <PortalHeader title={p.name} description={p.description ?? undefined} />
            <div className="mb-5 grid gap-3 sm:grid-cols-3">
                <PortalCard><div className="text-xs text-muted-foreground">Progress</div><div className="mt-1 text-2xl font-medium tabular">{p.progress_percent}%</div><div className="mt-2"><ProgressBar value={p.progress_percent} /></div></PortalCard>
                <PortalCard><div className="text-xs text-muted-foreground">Status</div><div className="mt-1 flex items-center gap-2 text-[15px] font-medium">{p.status?.name ?? "In progress"}<Badge variant={ProjectHealthTone[p.health] ?? "neutral"}>{getDropdownOptionLabel(ProjectHealthOptions, p.health)}</Badge></div></PortalCard>
                <PortalCard><div className="text-xs text-muted-foreground">Target date</div><div className="mt-1 text-[15px] font-medium">{formatDate(p.customer_deadline ?? p.target_completion)}</div></PortalCard>
            </div>
            <Tabs defaultValue="overview">
                <TabsList className="max-w-full overflow-x-auto">
                    <TabsTrigger value="overview">Overview</TabsTrigger>
                    <TabsTrigger value="deliverables">Deliverables</TabsTrigger>
                    <TabsTrigger value="updates">Updates</TabsTrigger>
                    <TabsTrigger value="tasks">Tasks</TabsTrigger>
                </TabsList>
                <TabsContent value="overview" className="mt-4 grid gap-5 lg:grid-cols-[minmax(0,1fr)_280px]">
                    <PortalCard title="Milestones">
                        {p.milestones.length ? (
                            <ol className="space-y-3 border-l border-border pl-4">
                                {p.milestones.map((m) => (
                                    <li key={m.id} className="text-[13px]">
                                        <div className="flex items-center gap-2"><span className="font-medium">{m.name}</span>{m.completed_at ? <Badge variant="success">Done</Badge> : <span className="text-xs text-muted-foreground">{formatDate(m.planned_date)}</span>}</div>
                                        {m.description && <div className="text-xs text-muted-foreground">{m.description}</div>}
                                    </li>
                                ))}
                            </ol>
                        ) : <p className="text-[13px] text-muted-foreground">No milestones shared.</p>}
                    </PortalCard>
                    <PortalCard title="Your team">
                        {p.members.length ? <ul className="space-y-2">{p.members.map((m) => <li key={m.membership.id} className="flex items-center justify-between gap-2 text-[13px]"><MemberAvatar person={m.membership.user} showName size="sm" /><span className="text-xs text-muted-foreground">{m.role_label}</span></li>)}</ul> : <p className="text-[13px] text-muted-foreground">Team not listed.</p>}
                    </PortalCard>
                </TabsContent>
                <TabsContent value="deliverables" className="mt-4">
                    <PortalCard>
                        {p.deliverables.length ? (
                            <ul className="divide-y divide-border-soft">
                                {p.deliverables.map((d) => (
                                    <li key={d.id} className="flex flex-wrap items-center gap-2 py-3">
                                        <div className="min-w-0 flex-1"><div className="text-[13px] font-medium">{d.name}</div>{d.description && <div className="text-xs text-muted-foreground">{d.description}</div>}{d.reviews[0]?.comment && <div className="mt-1 text-xs text-muted-foreground">Last feedback: “{d.reviews[0].comment}”</div>}</div>
                                        <DeliverableStatusBadge status={d.status} />
                                        {p.can_approve && awaiting(d) && <Button size="sm" onClick={() => setReviewing(d)}>Review</Button>}
                                    </li>
                                ))}
                            </ul>
                        ) : <p className="text-[13px] text-muted-foreground">No deliverables shared yet.</p>}
                    </PortalCard>
                </TabsContent>
                <TabsContent value="updates" className="mt-4 space-y-4">
                    {p.status_updates.length ? p.status_updates.map((u) => (
                        <PortalCard key={u.id} title={formatDate(u.published_at)}>
                            <div className="space-y-2 whitespace-pre-wrap text-[13px]">
                                <p className="text-foreground">{u.summary}</p>
                                {u.completed_work && <p><span className="font-medium">Done: </span>{u.completed_work}</p>}
                                {u.upcoming_work && <p><span className="font-medium">Next: </span>{u.upcoming_work}</p>}
                                {u.required_actions && <p className="rounded-md bg-warning-soft p-2"><span className="font-medium">Needed from you: </span>{u.required_actions}</p>}
                            </div>
                        </PortalCard>
                    )) : <EmptyState compact title="No updates yet" description="The team posts progress updates here." />}
                </TabsContent>
                <TabsContent value="tasks" className="mt-4">
                    <PortalCard>
                        {p.tasks.length ? (
                            <ul className="divide-y divide-border-soft">
                                {p.tasks.map((t) => <li key={t.id} className="flex items-center gap-2 py-2 text-[13px]"><span className="min-w-0 flex-1 truncate">{t.title}</span>{t.status && <Badge variant={t.completed_at ? "success" : "neutral"}>{t.status.name}</Badge>}</li>)}
                            </ul>
                        ) : <p className="text-[13px] text-muted-foreground">No tasks shared.</p>}
                    </PortalCard>
                </TabsContent>
            </Tabs>
            <ReviewDialog deliverable={reviewing} onClose={() => setReviewing(null)} />
        </>
    );
}
