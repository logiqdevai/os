import { Plus } from "lucide-react";
import { Page, PageHeader } from "@/components/ui/page";
import { Button } from "@/components/ui/button";
import { TableToolbar } from "@/components/ui/data-table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Can } from "@/components/access/can";
import { useListParams } from "@/hooks/use-list-params";
import { useTasks } from "@/features/tasks/hooks/use-tasks";
import { TaskDueFilterOptions, TaskGroupByOptions } from "@/config/constants/dropdowns/tasks/task-form.options";
import { TaskList, type TaskGroupBy } from "../../components/task-list";
import { useQuickCreate } from "../../components/quick-create";

/**
 * /tasks — tasks assigned to me (primary or additional assignee).
 * @perm VIEW tasks.tasks.read · create tasks.tasks.create · bulk tasks.bulk.execute
 * @api GET /tasks?mine=true
 * @states loading · empty ("Nothing assigned to you") · error
 */
export default function MyTasksPage() {
    const { params, setPage, search, setSearch, filters, setFilter } = useListParams({ limit: 100 });
    const quick = useQuickCreate();
    const show = filters.show ?? "open";
    const group = (filters.group as TaskGroupBy) ?? "status";
    const query: Record<string, unknown> = { ...params, mine: true, order_by: "priority" };
    delete query.show;
    delete query.group;
    if (show === "open") query.open = true;
    if (show === "done") query.status_category = "DONE";
    const tasks = useTasks(query);

    return (
        <Page>
            <PageHeader
                title="My tasks"
                description="Everything assigned to you. Press C to create a task."
                actions={<Can permission="tasks.tasks.create"><Button onClick={() => quick.open()}><Plus /> New task</Button></Can>}
            />
            <TableToolbar search={search} onSearch={setSearch} placeholder="Search by title or WEB-142…">
                <Select value={show} onValueChange={(v) => setFilter("show", v === "open" ? null : v)}>
                    <SelectTrigger className="h-8 w-32" aria-label="Show"><SelectValue /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="open">Open</SelectItem>
                        <SelectItem value="done">Done</SelectItem>
                        <SelectItem value="all">All</SelectItem>
                    </SelectContent>
                </Select>
                <Select value={filters.due ?? "all"} onValueChange={(v) => setFilter("due", v)}>
                    <SelectTrigger className="h-8 w-36" aria-label="Due"><SelectValue /></SelectTrigger>
                    <SelectContent>{TaskDueFilterOptions.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent>
                </Select>
                <Select value={group} onValueChange={(v) => setFilter("group", v === "status" ? null : v)}>
                    <SelectTrigger className="h-8 w-40" aria-label="Group by"><SelectValue /></SelectTrigger>
                    <SelectContent>{TaskGroupByOptions.filter((o) => o.id !== "assignee").map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent>
                </Select>
            </TableToolbar>
            <TaskList
                query={tasks}
                groupBy={group}
                onPageChange={setPage}
                empty={{
                    title: search || filters.due ? "No tasks match" : show === "done" ? "Nothing completed yet" : "Nothing assigned to you",
                    description: "Tasks assigned to you across every team and project appear here.",
                }}
            />
        </Page>
    );
}
