import { useMemo, useState, type ReactNode } from "react";
import { Archive, CircleDot, ListTodo, UserRound, X } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { MemberAvatar } from "@/components/ui/member-avatar";
import { EntityPicker } from "@/components/ui/entity-picker";
import { EmptyState, ErrorState, ListSkeleton } from "@/components/ui/states";
import { Pagination } from "@/components/ui/pagination";
import ConfirmationDialog from "@/components/ui/confirmation-dialog";
import { usePermissions } from "@/hooks/use-permission";
import { toast } from "@/hooks/use-toast";
import { useBulkTasks, useTaskPeople } from "@/features/tasks/hooks/use-tasks";
import type { Paginated, Task, TaskPriority } from "@/features/tasks/interfaces/tasks.interfaces";
import { TaskPriorityFormOptions, TaskStatusCategoryFormOptions } from "@/config/constants/dropdowns/tasks/task-form.options";
import { getDropdownOptionLabel } from "@/lib/dropdown-option-label.utils";
import { formatDate, personName } from "@/lib/format";
import { cn } from "@/lib/utils";
import { LabelChip, PriorityGlyph, PriorityIcon, StatusIcon } from "./task-badges";
import { TaskSheet } from "./task-sheet";

export type TaskGroupBy = "status" | "priority" | "project" | "assignee" | "none";

interface TaskListProps {
    query: { data?: Paginated<Task>; isPending: boolean; isFetching: boolean; error: unknown; refetch: () => unknown };
    groupBy?: TaskGroupBy;
    onPageChange?: (page: number) => void;
    empty: { title: string; description?: string; action?: ReactNode };
    /** Hide the project column (inside a project). */
    hideProject?: boolean;
}

const CATEGORY_ORDER = ["IN_PROGRESS", "IN_REVIEW", "BLOCKED", "TODO", "BACKLOG", "DONE", "CANCELLED"];
const PRIORITY_ORDER: TaskPriority[] = ["URGENT", "HIGH", "MEDIUM", "LOW", "NONE"];

/**
 * Linear-style task rows (div grid, not a table): grouping, multi-select with a bulk bar, side peek on click.
 * Rows collapse to two-line cards below `sm`.
 * @perm bulk tasks.bulk.execute
 */
export function TaskList({ query, groupBy = "status", onPageChange, empty, hideProject }: TaskListProps) {
    const p = usePermissions();
    const canBulk = p.can("tasks.bulk.execute");
    const [selected, setSelected] = useState<string[]>([]);
    const [peek, setPeek] = useState<string | null>(null);
    const tasks = query.data?.data ?? [];

    const groups = useMemo(() => {
        if (groupBy === "none") return [{ key: "all", label: "", sort: 0, icon: null as ReactNode, tasks }];
        const map = new Map<string, { key: string; label: string; sort: number; icon?: ReactNode; tasks: Task[] }>();
        for (const t of tasks) {
            let key = "none";
            let label = "";
            let sort = 99;
            let icon: ReactNode = null;
            if (groupBy === "status") {
                key = t.status?.category ?? "TODO";
                label = getDropdownOptionLabel(TaskStatusCategoryFormOptions, key);
                sort = CATEGORY_ORDER.indexOf(key);
                icon = <StatusIcon category={t.status?.category} />;
            } else if (groupBy === "priority") {
                key = t.priority;
                label = getDropdownOptionLabel(TaskPriorityFormOptions, t.priority);
                sort = PRIORITY_ORDER.indexOf(t.priority);
                icon = <PriorityGlyph priority={t.priority} />;
            } else if (groupBy === "project") {
                key = t.project?.id ?? "none";
                label = t.project?.name ?? "No project";
                sort = t.project ? 0 : 1;
            } else if (groupBy === "assignee") {
                key = t.assignee?.id ?? "none";
                label = t.assignee ? personName(t.assignee.user) : "Unassigned";
                sort = t.assignee ? 0 : 1;
                icon = <MemberAvatar person={t.assignee?.user} size="xs" />;
            }
            if (!map.has(key)) map.set(key, { key, label, sort, icon, tasks: [] });
            map.get(key)!.tasks.push(t);
        }
        return [...map.values()].sort((a, b) => a.sort - b.sort || a.label.localeCompare(b.label));
    }, [tasks, groupBy]);

    if (query.isPending) return <div className="rounded-lg border border-border bg-card"><ListSkeleton rows={8} /></div>;
    if (query.error) return <div className="rounded-lg border border-border bg-card"><ErrorState error={query.error} onRetry={() => query.refetch()} /></div>;
    if (!tasks.length) return <div className="rounded-lg border border-border bg-card"><EmptyState icon={ListTodo} title={empty.title} description={empty.description} action={empty.action} /></div>;

    const toggle = (id: string) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
    const today = new Date().toISOString().slice(0, 10);
    const pg = query.data?.pagination;

    return (
        <div className="space-y-3">
            <div className={cn("overflow-hidden rounded-lg border border-border bg-card", query.isFetching && "opacity-80")}>
                {groups.map((g) => (
                    <div key={g.key}>
                        {groupBy !== "none" && (
                            <div className="flex items-center gap-2 border-b border-border-soft bg-secondary/60 px-3 py-1.5 text-xs font-medium text-foreground">
                                {canBulk && (
                                    <Checkbox
                                        aria-label={`Select all in ${g.label}`}
                                        checked={g.tasks.every((t) => selected.includes(t.id))}
                                        onCheckedChange={(v) => setSelected((s) => (v ? [...new Set([...s, ...g.tasks.map((t) => t.id)])] : s.filter((id) => !g.tasks.some((t) => t.id === id))))}
                                    />
                                )}
                                {g.icon}
                                {g.label}
                                <span className="font-normal text-muted-foreground tabular">{g.tasks.length}</span>
                            </div>
                        )}
                        <ul>
                            {g.tasks.map((t) => {
                                const overdue = !!t.due_date && t.due_date.slice(0, 10) < today && t.status?.category !== "DONE" && t.status?.category !== "CANCELLED";
                                return (
                                    <li
                                        key={t.id}
                                        className={cn("group flex cursor-pointer flex-wrap items-center gap-x-2 gap-y-1 border-b border-border-soft px-3 py-2 last:border-b-0 hover:bg-accent/50 sm:flex-nowrap", selected.includes(t.id) && "bg-info-soft/40")}
                                        onClick={(e) => { if ((e.target as HTMLElement).closest("button,[role=checkbox],a")) return; setPeek(t.identifier); }}
                                        onKeyDown={(e) => { if (e.key === "Enter") setPeek(t.identifier); }}
                                        tabIndex={0}
                                    >
                                        {canBulk && <Checkbox aria-label={`Select ${t.identifier}`} checked={selected.includes(t.id)} onCheckedChange={() => toggle(t.id)} className={cn(!selected.length && "sm:opacity-0 sm:group-hover:opacity-100")} />}
                                        <PriorityIcon priority={t.priority} />
                                        <span className="w-[4.5rem] shrink-0 font-mono text-xs text-muted-foreground">{t.identifier}</span>
                                        <StatusIcon category={t.status?.category} color={t.status?.color} />
                                        <span className={cn("min-w-0 flex-1 basis-40 truncate text-[13px] text-foreground", t.status?.category === "DONE" && "text-muted-foreground")}>{t.title}</span>
                                        <span className="ml-auto hidden items-center gap-1 md:flex">{t.labels.slice(0, 2).map((l) => <LabelChip key={l.id} label={l} />)}</span>
                                        {!hideProject && t.project && <span className="hidden max-w-36 truncate text-xs text-muted-foreground lg:inline">{t.project.name}</span>}
                                        {t.due_date && <span className={cn("shrink-0 text-xs tabular", overdue ? "text-danger" : "text-muted-foreground")}>{formatDate(t.due_date, "d MMM")}</span>}
                                        {t._count.subtasks > 0 && <span className="hidden text-xs text-muted-foreground sm:inline">{t._count.subtasks} sub</span>}
                                        <MemberAvatar person={t.assignee?.user} size="xs" />
                                    </li>
                                );
                            })}
                        </ul>
                    </div>
                ))}
            </div>
            {pg && pg.total_pages > 1 && onPageChange && (
                <div className="flex flex-col items-center justify-between gap-2 sm:flex-row">
                    <span className="text-xs text-muted-foreground tabular">{pg.total} tasks</span>
                    <Pagination currentPage={pg.page} totalPages={pg.total_pages} onPageChange={onPageChange} />
                </div>
            )}
            {canBulk && selected.length > 0 && <BulkBar ids={selected} onDone={() => setSelected([])} />}
            <TaskSheet taskKey={peek} onClose={() => setPeek(null)} />
        </div>
    );
}

/** Sticky bulk action bar. @api POST /tasks/bulk */
function BulkBar({ ids, onDone }: { ids: string[]; onDone: () => void }) {
    const bulk = useBulkTasks();
    const [search, setSearch] = useState("");
    const people = useTaskPeople(search);
    const [archiving, setArchiving] = useState(false);
    const run = (body: { patch?: Record<string, unknown>; action?: string }) =>
        bulk.mutate({ task_ids: ids, ...body }, {
            onSuccess: (r) => {
                toast({ title: `${r.updated} tasks updated`, description: r.failed.length ? `${r.failed.length} could not be changed (permission or workflow).` : undefined });
                setArchiving(false);
                onDone();
            },
        });
    return (
        <div className="sticky bottom-4 z-20 mx-auto flex w-fit max-w-full flex-wrap items-center gap-2 rounded-lg border border-border bg-popover p-2 shadow-pop">
            <span className="px-2 text-[13px] font-medium">{ids.length} selected</span>
            <EntityPicker
                items={TaskPriorityFormOptions.map((o) => ({ id: o.id, label: o.label, icon: <PriorityGlyph priority={o.id} /> }))}
                value={null}
                onChange={(v) => v && run({ patch: { priority: v } })}
                trigger={<Button variant="outline" size="sm"><CircleDot /> Priority</Button>}
                ariaLabel="Set priority"
            />
            <EntityPicker
                items={(people.data ?? []).map((m) => ({ id: m.id, label: personName(m.user), icon: <MemberAvatar person={m.user} size="xs" /> }))}
                value={null}
                onSearch={setSearch}
                noneLabel="Unassign"
                onChange={(v) => run({ patch: { assignee_membership_id: v } })}
                trigger={<Button variant="outline" size="sm"><UserRound /> Assign</Button>}
                ariaLabel="Assign"
            />
            <Button variant="outline" size="sm" onClick={() => setArchiving(true)}><Archive /> Archive</Button>
            <Button variant="ghost" size="icon-sm" aria-label="Clear selection" onClick={onDone}><X /></Button>
            <ConfirmationDialog
                isOpen={archiving}
                onClose={() => setArchiving(false)}
                title={`Archive ${ids.length} tasks?`}
                description="Archived tasks are hidden from lists and boards. You can restore them later."
                confirmText="Archive"
                variant="destructive"
                isLoading={bulk.isPending}
                onConfirm={() => run({ action: "archive" })}
            />
        </div>
    );
}
