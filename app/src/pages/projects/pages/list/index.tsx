import { Link } from "react-router-dom";
import { FolderKanban, LayoutGrid, List, Plus, Star } from "lucide-react";
import { Page, PageHeader } from "@/components/ui/page";
import { DataTable, TableToolbar, type DataTableColumn } from "@/components/ui/data-table";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EmptyState, ErrorState, ListSkeleton } from "@/components/ui/states";
import { Pagination } from "@/components/ui/pagination";
import { MemberAvatar } from "@/components/ui/member-avatar";
import { Can } from "@/components/access/can";
import { useListParams } from "@/hooks/use-list-params";
import { usePermission } from "@/hooks/use-permission";
import { useProjects, useSetProjectFavorite } from "@/features/projects/hooks/use-projects";
import type { ProjectListItem } from "@/features/projects/interfaces/projects.interfaces";
import { ProjectHealthFilterOptions, ProjectStageFilterOptions } from "@/config/constants/dropdowns/projects/project-form.options";
import { formatDate, formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";
import { HealthBadge, ProgressBar, ProjectDot, ProjectStatusBadge } from "../../components/project-badges";

/**
 * /projects — all projects in the caller's scope, list or grid, with filters and favorites.
 * @perm VIEW projects.projects.read · create projects.projects.create · budget column projects.finance.read
 * @api GET /projects · POST/DELETE /projects/:id/favorite
 * @states loading · empty · empty-filtered · error / 403
 */
export default function ProjectsListPage() {
    const { params, setPage, search, setSearch, filters, setFilter } = useListParams({ limit: 24 });
    const stage = filters.stage ?? "active";
    const view = filters.view === "grid" ? "grid" : "list";
    const query: Record<string, unknown> = { ...params, order_by: "updated_at" };
    delete query.stage;
    delete query.view;
    if (stage === "active") query.include_closed = false;
    else if (stage !== "all") query.status_category = stage;
    const projects = useProjects(query);
    const favorite = useSetProjectFavorite();
    const canFinance = usePermission("projects.finance.read");
    const filtered = !!search || !!filters.health || !!filters.favorites || stage !== "active";

    const star = (p: ProjectListItem) => (
        <button
            type="button"
            aria-label={p.is_favorite ? `Unstar ${p.name}` : `Star ${p.name}`}
            className={cn("grid size-7 place-items-center rounded-md text-ash transition-colors hover:bg-border-soft hover:text-foreground", p.is_favorite && "text-warning")}
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); favorite.mutate({ id: p.id, favorite: !p.is_favorite }); }}
        >
            <Star className={cn("size-4", p.is_favorite && "fill-current")} />
        </button>
    );

    const progress = (p: ProjectListItem) => {
        const pct = p.task_counts.total ? Math.round((p.task_counts.done / p.task_counts.total) * 100) : p.progress_percent;
        return (
            <div className="flex min-w-24 items-center gap-2">
                <ProgressBar value={pct} />
                <span className="w-9 text-right text-xs tabular text-muted-foreground">{pct}%</span>
            </div>
        );
    };

    const columns: DataTableColumn<ProjectListItem>[] = [
        { key: "star", header: <span className="sr-only">Favorite</span>, className: "w-8 pr-0", cell: star },
        {
            key: "name",
            header: "Project",
            cell: (p) => (
                <div className="flex min-w-0 items-center gap-2">
                    <ProjectDot color={p.color} />
                    <div className="min-w-0">
                        <div className="truncate font-medium text-foreground">{p.name}</div>
                        <div className="truncate text-xs text-muted-foreground">{[p.code, p.company?.name ?? "Internal"].filter(Boolean).join(" · ")}</div>
                    </div>
                </div>
            ),
        },
        { key: "status", header: "Status", cell: (p) => <ProjectStatusBadge status={p.status} />, hideBelow: "sm" },
        { key: "health", header: "Health", cell: (p) => <HealthBadge health={p.health} />, hideBelow: "md" },
        { key: "progress", header: "Progress", cell: progress, hideBelow: "lg" },
        {
            key: "milestone",
            header: "Next milestone",
            hideBelow: "xl",
            cell: (p) => p.next_milestone ? (
                <div className="min-w-0">
                    <div className="truncate">{p.next_milestone.name}</div>
                    <div className={cn("text-xs", p.next_milestone.overdue ? "text-danger" : "text-muted-foreground")}>{formatDate(p.next_milestone.planned_date)}</div>
                </div>
            ) : <span className="text-ash">—</span>,
        },
        ...(canFinance ? [{ key: "budget", header: "Budget", hideBelow: "xl" as const, className: "text-right tabular", headerClassName: "text-right", cell: (p: ProjectListItem) => formatMoney(p.budget_amount, p.currency ?? "EUR", { compact: true }) }] : []),
        { key: "due", header: "Target", cell: (p) => formatDate(p.target_completion), hideBelow: "lg" },
        { key: "owner", header: "Owner", cell: (p) => <MemberAvatar person={p.owner?.user} emptyLabel="No owner" />, className: "w-12" },
    ];

    return (
        <Page>
            <PageHeader
                title="Projects"
                description="Every delivery project in your scope."
                actions={
                    <Can permission="projects.projects.create">
                        <Button asChild>
                            <Link to="/projects/new"><Plus /> New project</Link>
                        </Button>
                    </Can>
                }
            />
            <TableToolbar search={search} onSearch={setSearch} placeholder="Search projects, codes, customers…">
                <Select value={stage} onValueChange={(v) => setFilter("stage", v === "active" ? null : v)}>
                    <SelectTrigger className="h-8 w-36" aria-label="Filter by stage"><SelectValue /></SelectTrigger>
                    <SelectContent>{ProjectStageFilterOptions.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent>
                </Select>
                <Select value={filters.health ?? "all"} onValueChange={(v) => setFilter("health", v)}>
                    <SelectTrigger className="h-8 w-36" aria-label="Filter by health"><SelectValue /></SelectTrigger>
                    <SelectContent>{ProjectHealthFilterOptions.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent>
                </Select>
                <Button variant={filters.favorites ? "secondary" : "ghost"} size="sm" aria-pressed={!!filters.favorites} onClick={() => setFilter("favorites", filters.favorites ? null : "true")}>
                    <Star className={cn(filters.favorites && "fill-current text-warning")} /> Starred
                </Button>
                <div className="flex rounded-md border border-border p-0.5" role="group" aria-label="View">
                    <Button variant={view === "list" ? "secondary" : "ghost"} size="icon-sm" className="size-6" aria-label="List view" aria-pressed={view === "list"} onClick={() => setFilter("view", null)}><List /></Button>
                    <Button variant={view === "grid" ? "secondary" : "ghost"} size="icon-sm" className="size-6" aria-label="Grid view" aria-pressed={view === "grid"} onClick={() => setFilter("view", "grid")}><LayoutGrid /></Button>
                </div>
            </TableToolbar>

            {view === "list" ? (
                <DataTable
                    columns={columns}
                    data={projects.data?.data}
                    rowKey={(p) => p.id}
                    loading={projects.isFetching}
                    error={projects.error}
                    onRetry={() => projects.refetch()}
                    pagination={projects.data?.pagination}
                    onPageChange={setPage}
                    rowHref={(p) => `/projects/${p.id}`}
                    empty={{
                        icon: FolderKanban,
                        title: filtered ? "No projects match these filters" : "No projects yet",
                        description: filtered ? "Try another stage or clear the search." : "Create your first project, or start from a template.",
                    }}
                />
            ) : projects.isPending ? (
                <ListSkeleton rows={6} />
            ) : projects.error ? (
                <ErrorState error={projects.error} onRetry={() => projects.refetch()} />
            ) : !projects.data?.data.length ? (
                <div className="rounded-lg border border-border bg-card">
                    <EmptyState icon={FolderKanban} title={filtered ? "No projects match these filters" : "No projects yet"} />
                </div>
            ) : (
                <>
                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                        {projects.data.data.map((p) => (
                            <Link key={p.id} to={`/projects/${p.id}`} className="group flex flex-col gap-3 rounded-lg border border-border bg-card p-4 transition-colors hover:border-border-strong">
                                <div className="flex items-start justify-between gap-2">
                                    <div className="flex min-w-0 items-center gap-2">
                                        <ProjectDot color={p.color} className="size-2.5" />
                                        <div className="min-w-0">
                                            <div className="truncate font-medium text-foreground">{p.name}</div>
                                            <div className="truncate text-xs text-muted-foreground">{p.company?.name ?? "Internal"}</div>
                                        </div>
                                    </div>
                                    {star(p)}
                                </div>
                                <div className="flex flex-wrap gap-1.5">
                                    <ProjectStatusBadge status={p.status} />
                                    <HealthBadge health={p.health} />
                                </div>
                                {progress(p)}
                                <div className="flex items-center justify-between text-xs text-muted-foreground">
                                    <span>{p.task_counts.done}/{p.task_counts.total} tasks · due {formatDate(p.target_completion)}</span>
                                    <MemberAvatar person={p.owner?.user} size="xs" emptyLabel="No owner" />
                                </div>
                            </Link>
                        ))}
                    </div>
                    {projects.data.pagination.total_pages > 1 && (
                        <div className="mt-4 flex justify-center">
                            <Pagination currentPage={projects.data.pagination.page} totalPages={projects.data.pagination.total_pages} onPageChange={setPage} />
                        </div>
                    )}
                </>
            )}
        </Page>
    );
}
