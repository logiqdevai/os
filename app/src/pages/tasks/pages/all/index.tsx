import { Plus, X } from "lucide-react";
import { Page, PageHeader } from "@/components/ui/page";
import { Button } from "@/components/ui/button";
import { TableToolbar } from "@/components/ui/data-table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Can } from "@/components/access/can";
import { useListParams } from "@/hooks/use-list-params";
import { useTasks, useWorkflows } from "@/features/tasks/hooks/use-tasks";
import { TaskDueFilterOptions, TaskGroupByOptions, TaskPriorityFilterOptions, TaskStatusCategoryFilterOptions } from "@/config/constants/dropdowns/tasks/task-form.options";
import { TaskList, type TaskGroupBy } from "../../components/task-list";
import { ProjectPicker } from "../../components/task-pickers";
import { useQuickCreate } from "../../components/quick-create";
import { SavedViewsMenu } from "@/pages/crm/components/saved-views-menu";

/**
 * /tasks/all?sv=<savedViewId>&… — every task in the caller's scope with filters and grouping. Filters and grouping live in the
 * URL (shareable); saved views (SavedView entity TASK) store that URL query and are listed in the Tasks context panel.
 * @perm VIEW tasks.tasks.read · bulk tasks.bulk.execute · share views platform.saved_views.manage_shared
 * @api GET /tasks?status_category=&priority=&project_id=&team_id=&assignee=&due=&search= · GET/POST/PATCH/DELETE /saved-views?entity_type=TASK
 * @states loading · empty-filtered (with clear filters) · error
 */
export default function AllTasksPage() {
    const { params, setPage, search, setSearch, filters, setFilter } = useListParams({ limit: 100 });
    const workflows = useWorkflows();
    const quick = useQuickCreate();
    const group = (filters.group as TaskGroupBy) ?? "status";
    const query: Record<string, unknown> = { ...params, order_by: "priority" };
    delete query.group;
    delete query.project_name;
    delete query.sv;
    if (!filters.status_category) query.open = true;
    else if (filters.status_category === "all") delete query.status_category;
    const tasks = useTasks(query);
    const active = ["status_category", "priority", "project_id", "team_id", "assignee", "due"].filter((k) => filters[k]);
    const clear = () => active.forEach((k) => setFilter(k, null));

    return (
        <Page>
            <PageHeader
                title="All tasks"
                description="Tasks across teams and projects you can see."
                actions={<Can permission="tasks.tasks.create"><Button onClick={() => quick.open({ team_id: filters.team_id, project_id: filters.project_id })}><Plus /> New task</Button></Can>}
            />
            <TableToolbar search={search} onSearch={setSearch} placeholder="Search by title or WEB-142…">
                <SavedViewsMenu entityType="TASK" onSearch={setSearch} />
                <Select value={filters.status_category ?? "open"} onValueChange={(v) => setFilter("status_category", v === "open" ? null : v)}>
                    <SelectTrigger className="h-8 w-32" aria-label="Status"><SelectValue /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="open">Open</SelectItem>
                        {TaskStatusCategoryFilterOptions.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}
                    </SelectContent>
                </Select>
                <Select value={filters.priority ?? "all"} onValueChange={(v) => setFilter("priority", v)}>
                    <SelectTrigger className="h-8 w-32" aria-label="Priority"><SelectValue /></SelectTrigger>
                    <SelectContent>{TaskPriorityFilterOptions.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent>
                </Select>
                <Select value={filters.team_id ?? "all"} onValueChange={(v) => setFilter("team_id", v)}>
                    <SelectTrigger className="h-8 w-32" aria-label="Team"><SelectValue /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All teams</SelectItem>
                        {(workflows.data ?? []).filter((w) => w.team).map((w) => <SelectItem key={w.team!.id} value={w.team!.id}>{w.team!.name}</SelectItem>)}
                    </SelectContent>
                </Select>
                <Select value={filters.assignee ?? "all"} onValueChange={(v) => setFilter("assignee", v)}>
                    <SelectTrigger className="h-8 w-32" aria-label="Assignee"><SelectValue /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">Anyone</SelectItem>
                        <SelectItem value="me">Assigned to me</SelectItem>
                        <SelectItem value="none">Unassigned</SelectItem>
                    </SelectContent>
                </Select>
                <Select value={filters.due ?? "all"} onValueChange={(v) => setFilter("due", v)}>
                    <SelectTrigger className="h-8 w-36" aria-label="Due"><SelectValue /></SelectTrigger>
                    <SelectContent>{TaskDueFilterOptions.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent>
                </Select>
                <div className="w-full sm:w-44">
                    <ProjectPicker value={filters.project_id ?? null} currentName={filters.project_name} onChange={(v) => setFilter("project_id", v)} />
                </div>
                <Select value={group} onValueChange={(v) => setFilter("group", v === "status" ? null : v)}>
                    <SelectTrigger className="h-8 w-40" aria-label="Group by"><SelectValue /></SelectTrigger>
                    <SelectContent>{TaskGroupByOptions.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent>
                </Select>
                {active.length > 0 && <Button variant="ghost" size="sm" onClick={clear}><X /> Clear</Button>}
            </TableToolbar>
            <TaskList
                query={tasks}
                groupBy={group}
                onPageChange={setPage}
                empty={{
                    title: active.length || search ? "No tasks match these filters" : "No open tasks",
                    action: active.length ? <Button size="sm" variant="outline" onClick={clear}>Clear filters</Button> : undefined,
                }}
            />
        </Page>
    );
}
