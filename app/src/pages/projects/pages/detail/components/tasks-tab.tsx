import { useState } from "react";
import { Link } from "react-router-dom";
import { ListTodo, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DataTable, TableToolbar, type DataTableColumn } from "@/components/ui/data-table";
import { MemberAvatar } from "@/components/ui/member-avatar";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Can } from "@/components/access/can";
import { NoAccessState } from "@/components/ui/states";
import { usePermission } from "@/hooks/use-permission";
import { useTasks } from "@/features/tasks/hooks/use-tasks";
import type { Task } from "@/features/tasks/interfaces/tasks.interfaces";
import type { ProjectDetail } from "@/features/projects/interfaces/projects.interfaces";
import { TaskStatusCategoryFilterOptions, TaskPriorityFormOptions } from "@/config/constants/dropdowns/tasks/task-form.options";
import { getDropdownOptionLabel } from "@/lib/dropdown-option-label.utils";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { toneVariant } from "../../../components/project-badges";
import { TaskCreateForm } from "../../../../tasks/components/task-create-form";

/** Tasks of the project (06 owns tasks; this tab reads them with tasks.tasks.read). */
export function ProjectTasksTab({ project }: { project: ProjectDetail }) {
    const canRead = usePermission("tasks.tasks.read");
    const [page, setPage] = useState(1);
    const [search, setSearch] = useState("");
    const [creating, setCreating] = useState(false);
    const [category, setCategory] = useState("open");
    const params: Record<string, unknown> = { project_id: project.id, page, limit: 25, order_by: "priority", search: search || undefined };
    if (category === "open") params.open = true;
    else if (category !== "all") params.status_category = category;
    const tasks = useTasks(params, canRead);
    if (!canRead) return <NoAccessState description="Viewing tasks needs the tasks.tasks.read permission." />;
    const today = new Date().toISOString().slice(0, 10);

    const columns: DataTableColumn<Task>[] = [
        { key: "id", header: "ID", className: "w-20 whitespace-nowrap font-mono text-xs text-muted-foreground", cell: (t) => t.identifier },
        { key: "title", header: "Title", cell: (t) => <Link to={`/tasks/${t.identifier}`} className="line-clamp-1 font-medium text-foreground hover:underline">{t.title}</Link> },
        { key: "status", header: "Status", hideBelow: "sm", cell: (t) => t.status ? <Badge variant={toneVariant(t.status.color)}>{t.status.name}</Badge> : null },
        { key: "priority", header: "Priority", hideBelow: "md", cell: (t) => <span className="text-xs text-muted-foreground">{getDropdownOptionLabel(TaskPriorityFormOptions, t.priority)}</span> },
        { key: "milestone", header: "Milestone", hideBelow: "lg", cell: (t) => <span className="truncate text-xs">{t.milestone?.name ?? "—"}</span> },
        { key: "due", header: "Due", hideBelow: "md", cell: (t) => <span className={cn("text-xs", t.due_date && t.due_date.slice(0, 10) < today && t.status?.category !== "DONE" && "text-danger")}>{formatDate(t.due_date, "d MMM")}</span> },
        { key: "assignee", header: <span className="sr-only">Assignee</span>, className: "w-10", cell: (t) => <MemberAvatar person={t.assignee?.user} size="xs" /> },
    ];

    return (
        <div>
            <TableToolbar search={search} onSearch={(v) => { setSearch(v); setPage(1); }} placeholder="Search tasks…">
                <Select value={category} onValueChange={(v) => { setCategory(v); setPage(1); }}>
                    <SelectTrigger className="h-8 w-36" aria-label="Filter by status"><SelectValue /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="open">Open</SelectItem>
                        {TaskStatusCategoryFilterOptions.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}
                    </SelectContent>
                </Select>
                <Button variant="ghost" size="sm" asChild><Link to={`/tasks/all?layout=board&project_id=${project.id}&project_name=${encodeURIComponent(project.name)}${project.team_id ? `&team_id=${project.team_id}` : ""}`}>Board</Link></Button>
                <Can permission="tasks.tasks.create">
                    <Button size="sm" onClick={() => setCreating(true)}><Plus /> New task</Button>
                </Can>
            </TableToolbar>
            <DataTable
                columns={columns}
                data={tasks.data?.data}
                rowKey={(t) => t.id}
                loading={tasks.isFetching}
                error={tasks.error}
                onRetry={() => tasks.refetch()}
                pagination={tasks.data?.pagination}
                onPageChange={setPage}
                rowHref={(t) => `/tasks/${t.identifier}`}
                empty={{ icon: ListTodo, title: search || category !== "open" ? "No tasks match" : "No open tasks", description: "Tasks created for this project appear here." }}
            />
            <Dialog open={creating} onOpenChange={setCreating}>
                <DialogContent className="sm:max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>New task</DialogTitle>
                        <DialogDescription className="sr-only">Create a task in {project.name}. Press Ctrl+Enter to save.</DialogDescription>
                    </DialogHeader>
                    {creating && (
                        <TaskCreateForm
                            defaults={{ project_id: project.id, project_name: project.name, team_id: project.team_id }}
                            allowCreateMore
                            onCancel={() => setCreating(false)}
                            onCreated={() => setCreating(false)}
                        />
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}
