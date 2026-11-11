import { useNavigate } from "react-router-dom";
import { CheckSquare, Hourglass } from "lucide-react";
import { Page, PageHeader } from "@/components/ui/page";
import { DataTable, TableToolbar, type DataTableColumn } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { NoAccessState } from "@/components/ui/states";
import { useListParams } from "@/hooks/use-list-params";
import { usePermissions } from "@/hooks/use-permission";
import { useMyWorkTasks } from "@/features/home/hooks/use-home";
import { useNotificationAction, useNotifications, useOpenNotification } from "@/features/notifications/hooks/use-notifications";
import type { Task } from "@/features/tasks/interfaces/tasks.interfaces";
import type { NotificationItem } from "@/features/notifications/interfaces/notifications.interfaces";
import { TaskDueFilterOptions, TaskPriorityFormOptions } from "@/config/constants/dropdowns/tasks/task-form.options";
import { ModuleLabelOptions } from "@/config/constants/dropdowns/notifications/notification.options";
import { getDropdownOptionLabel } from "@/lib/dropdown-option-label.utils";
import { formatDate, formatRelative } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * /home/my-work?tab=tasks|waiting — everything waiting on me, across modules.
 * @perm tasks tab: tasks.tasks.read · waiting tab: own inbox (no key; the action itself is checked by the owning module)
 * @api GET /tasks?mine&open&due= · GET /notifications?state=action
 */
export default function MyWorkPage() {
    const navigate = useNavigate();
    const p = usePermissions();
    const showTasks = p.can("tasks.tasks.read") && p.moduleEnabled("TASKS");
    const { params, setPage, search, setSearch, filters, setFilter } = useListParams();
    const tab = filters.tab === "waiting" || !showTasks ? "waiting" : "tasks";
    const { tab: _tab, ...taskParams } = params;
    const tasks = useMyWorkTasks(taskParams, showTasks && tab === "tasks");
    const waiting = useNotifications({ state: "action", page: params.page, limit: 25, ...(search ? { search } : {}) }, tab === "waiting");
    const open = useOpenNotification();
    const act = useNotificationAction();

    const taskColumns: DataTableColumn<Task>[] = [
        { key: "task", header: "Task", cell: (t) => <div className="min-w-0"><div className="truncate font-medium text-foreground">{t.title}</div><div className="text-xs text-muted-foreground tabular">{t.identifier}{t.project ? ` · ${t.project.name}` : ""}</div></div> },
        { key: "status", header: "Status", cell: (t) => t.status?.name ?? "—", hideBelow: "sm" },
        { key: "priority", header: "Priority", cell: (t) => <Badge variant={t.priority === "URGENT" ? "danger" : t.priority === "HIGH" ? "warning" : "neutral"}>{getDropdownOptionLabel(TaskPriorityFormOptions, t.priority)}</Badge>, hideBelow: "md" },
        { key: "due", header: "Due", cell: (t) => <span className={cn("tabular", t.due_date && new Date(t.due_date) < new Date() && "text-danger")}>{t.due_date ? formatDate(t.due_date, "d MMM") : "—"}</span> },
    ];

    const waitingColumns: DataTableColumn<NotificationItem>[] = [
        { key: "title", header: "Item", cell: (n) => <div className="min-w-0"><div className="truncate font-medium text-foreground">{n.title}</div>{n.body && <div className="truncate text-xs text-muted-foreground">{n.body}</div>}</div> },
        { key: "from", header: "From", cell: (n) => getDropdownOptionLabel(ModuleLabelOptions, n.module), hideBelow: "sm" },
        { key: "when", header: "Received", cell: (n) => formatRelative(n.created_at), hideBelow: "md" },
        {
            key: "act",
            header: <span className="sr-only">Actions</span>,
            cell: (n) => (Array.isArray(n.actions) && n.actions.length ? (
                <div className="flex justify-end gap-2">
                    {n.actions.map((a) => <button key={a.key} type="button" className="rounded-md border border-border bg-secondary px-2 py-1 text-xs text-foreground hover:bg-accent" onClick={() => act.mutate({ id: n.id, action: a.key })}>{a.label}</button>)}
                </div>
            ) : null),
        },
    ];

    if (!p.loaded) return null;

    return (
        <Page>
            <PageHeader title="My work" description="Everything waiting on you, across modules." />
            <div className="mb-3">
                <Tabs value={tab} onValueChange={(v) => setFilter("tab", v === "tasks" ? null : v)}>
                    <TabsList>
                        {showTasks && <TabsTrigger value="tasks"><CheckSquare className="mr-1.5 size-4" /> My tasks</TabsTrigger>}
                        <TabsTrigger value="waiting"><Hourglass className="mr-1.5 size-4" /> Waiting on me</TabsTrigger>
                    </TabsList>
                </Tabs>
            </div>
            <TableToolbar search={search} onSearch={setSearch} placeholder="Search my work…">
                {tab === "tasks" && (
                    <Select value={filters.due ?? "all"} onValueChange={(v) => setFilter("due", v)}>
                        <SelectTrigger className="h-8 w-full sm:w-40" aria-label="Filter by due date"><SelectValue /></SelectTrigger>
                        <SelectContent>{TaskDueFilterOptions.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent>
                    </Select>
                )}
            </TableToolbar>
            {tab === "tasks" ? (
                showTasks ? (
                    <DataTable
                        columns={taskColumns}
                        data={tasks.data?.data}
                        rowKey={(t) => t.id}
                        loading={tasks.isFetching}
                        error={tasks.error}
                        onRetry={() => tasks.refetch()}
                        pagination={tasks.data?.pagination}
                        onPageChange={setPage}
                        rowHref={(t) => `/tasks/${t.identifier}`}
                        empty={{ icon: CheckSquare, title: "Nothing waiting for you", description: "Open tasks assigned to you appear here." }}
                    />
                ) : <NoAccessState />
            ) : (
                <DataTable
                    columns={waitingColumns}
                    data={waiting.data?.data}
                    rowKey={(n) => n.id}
                    loading={waiting.isFetching}
                    error={waiting.error}
                    onRetry={() => waiting.refetch()}
                    pagination={waiting.data?.pagination}
                    onPageChange={setPage}
                    onRowClick={(n) => open.mutate(n.id, { onSuccess: (r) => navigate(r.action_url?.startsWith("/") ? r.action_url : `/notifications/${n.id}`) })}
                    empty={{ icon: Hourglass, title: "Nothing is waiting on you", description: "Approvals and acknowledgements show up here." }}
                />
            )}
        </Page>
    );
}
