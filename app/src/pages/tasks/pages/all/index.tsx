import { Columns3, List, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { usePageMetadata } from "@/hooks/use-page-metadata";
import { Page } from "@/components/ui/page";
import { Button } from "@/components/ui/button";
import { TableToolbar } from "@/components/ui/data-table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Can } from "@/components/access/can";
import { useListParams } from "@/hooks/use-list-params";
import { useTasks, useWorkflows } from "@/features/tasks/hooks/use-tasks";
import { TaskList } from "../../components/task-list";
import { TaskBoard, NO_TEAM } from "../../components/task-board";
import { ProjectPicker } from "../../components/task-pickers";
import { useQuickCreate } from "../../components/quick-create";
import { TaskDisplayMenu, TaskFilterChips, TaskFilterMenu, useTaskViewState } from "../../components/task-view-controls";
import { SavedViewsMenu } from "@/pages/crm/components/saved-views-menu";

/**
 * /tasks/all — the one Tasks page (Linear-style): list or board layout, filters, grouping, ordering and visible properties.
 * Everything lives in the URL (shareable): `layout`, `group`, `order`, `dir`, `hide`, `closed` and the filters. Saved views
 * (SavedView entity TASK) store that URL query and are also listed in the Tasks context panel.
 * @perm VIEW tasks.tasks.read · bulk tasks.bulk.execute · move (board) tasks.tasks.update · share views platform.saved_views.manage_shared
 * @api GET /tasks · GET /tasks/board · POST /tasks/:id/move · GET/POST/PATCH/DELETE /saved-views?entity_type=TASK
 * @states loading · empty-filtered (with clear filters) · error
 */
export default function AllTasksPage() {
    usePageMetadata({ title: "Tasks" });
    const { params, setPage, search, setSearch } = useListParams({ limit: 100 });
    const view = useTaskViewState();
    const workflows = useWorkflows();
    const quick = useQuickCreate();
    const board = view.layout === "board";
    const teams = (workflows.data ?? []).filter((w) => w.team).map((w) => w.team!);
    const boardTeam = view.filterQuery.team_id ?? teams[0]?.id ?? NO_TEAM;
    const projectName = view.sp.get("project_name") ?? undefined;

    // Filters + search go to the API; the closed-task default is a display setting.
    const base: Record<string, unknown> = { ...view.filterQuery };
    if (params.search) base.search = params.search;
    if (!view.showClosed && !view.filterQuery.status_category) base.open = true;
    const listQuery = { ...base, page: params.page, limit: params.limit, order_by: view.order, order_direction: view.dir };
    const tasks = useTasks(listQuery, !board);
    const filtered = view.activeFilters.length > 0 || !!search;

    return (
        <Page className={cn("max-w-none p-0 md:p-0", board && "flex h-full flex-col")}>
            <header className="flex h-12 items-center gap-3 border-b border-border px-4 md:px-6">
                <h1 className="text-[13px] font-medium text-foreground">Tasks</h1>
                <div className="flex items-center gap-0.5" role="tablist" aria-label="Layout">
                    {([["list", "List", List], ["board", "Board", Columns3]] as const).map(([id, name, Icon]) => (
                        <button
                            key={id}
                            type="button"
                            role="tab"
                            aria-selected={view.layout === id}
                            onClick={() => view.setParam("layout", id === "list" ? null : id)}
                            className={cn("flex h-7 items-center gap-1.5 rounded-md px-2 text-[13px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground", view.layout === id && "bg-accent font-medium text-foreground")}
                        >
                            <Icon className="size-3.5" /> {name}
                        </button>
                    ))}
                </div>
                <div className="ml-auto">
                    <Can permission="tasks.tasks.create"><Button size="sm" onClick={() => quick.open({ team_id: view.filterQuery.team_id, project_id: view.filterQuery.project_id })}><Plus /> New task</Button></Can>
                </div>
            </header>
            <TableToolbar className="mb-0 border-b border-border px-4 py-1.5 md:px-6" search={search} onSearch={setSearch} placeholder="Search by title or WEB-142…">
                <SavedViewsMenu entityType="TASK" onSearch={setSearch} allLabel="All tasks" layout={view.layout} />
                <TaskFilterMenu view={view} />
                <div className="w-full sm:w-40">
                    <ProjectPicker value={view.filterQuery.project_id ?? null} currentName={projectName} onChange={(v) => { view.setParam("project_id", v); view.setParam("project_name", null); }} />
                </div>
                {board && (
                    <Select value={boardTeam} onValueChange={(v) => view.setParam("team_id", v)}>
                        <SelectTrigger className="h-8 w-40" aria-label="Board team"><SelectValue placeholder="Team" /></SelectTrigger>
                        <SelectContent>
                            {teams.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}{t.task_key ? ` · ${t.task_key}` : ""}</SelectItem>)}
                            <SelectItem value={NO_TEAM}>No team</SelectItem>
                        </SelectContent>
                    </Select>
                )}
                <TaskDisplayMenu view={view} />
            </TableToolbar>
            <TaskFilterChips view={view} projectName={projectName} />
            {board ? (
                <TaskBoard
                    team={boardTeam}
                    query={{ ...base, team_id: undefined, open: undefined }}
                    projectId={view.filterQuery.project_id}
                    hidden={view.hidden}
                />
            ) : (
                <TaskList
                    query={tasks}
                    groupBy={view.group}
                    hidden={view.hidden}
                    onPageChange={setPage}
                    empty={{
                        title: filtered ? "No tasks match these filters" : "No open tasks",
                        action: view.activeFilters.length ? <Button size="sm" variant="outline" onClick={view.clearFilters}>Clear filters</Button> : undefined,
                    }}
                />
            )}
        </Page>
    );
}
