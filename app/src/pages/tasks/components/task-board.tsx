import { useState, type DragEvent } from "react";
import { MoreHorizontal, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MemberAvatar } from "@/components/ui/member-avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/states";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { usePermission } from "@/hooks/use-permission";
import { useBoard, useMoveTask } from "@/features/tasks/hooks/use-tasks";
import type { Task, TaskStatus } from "@/features/tasks/interfaces/tasks.interfaces";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { LabelChip, PriorityIcon, StatusIcon } from "./task-badges";
import { TaskSheet } from "./task-sheet";
import { useQuickCreate } from "./quick-create";

export const NO_TEAM = "none";

/**
 * Board layout of the Tasks page: one column per status of the team workflow; drag cards between statuses (or use "Move to" on touch).
 * Receives the page's filters. @perm VIEW tasks.tasks.read · move tasks.tasks.update (only to statuses allowed by the workflow)
 * @api GET /tasks/board · POST /tasks/:id/move
 */
export function TaskBoard({ team, query, projectId, hidden }: { team: string; query: Record<string, unknown>; projectId?: string; hidden: Set<string> }) {
    const board = useBoard({ ...query, team_id: team, archived: false });
    const move = useMoveTask();
    const canMove = usePermission("tasks.tasks.update");
    const quick = useQuickCreate();
    const [dragging, setDragging] = useState<string | null>(null);
    const [over, setOver] = useState<{ status: string; index: number } | null>(null);
    const [peek, setPeek] = useState<string | null>(null);
    const show = (key: string) => !hidden.has(key);

    const columns = (board.data?.statuses ?? []).map((s) => ({ status: s, tasks: (board.data?.tasks ?? []).filter((t) => t.status_id === s.id) }));

    const drop = (status: TaskStatus, index: number) => {
        const taskId = dragging;
        setDragging(null);
        setOver(null);
        if (!taskId) return;
        const col = columns.find((c) => c.status.id === status.id)?.tasks.filter((t) => t.id !== taskId) ?? [];
        const task = board.data?.tasks.find((t) => t.id === taskId);
        if (task?.status_id === status.id) {
            const current = columns.find((c) => c.status.id === status.id)?.tasks ?? [];
            const from = current.findIndex((t) => t.id === taskId);
            if (from === index || from === index - 1) return;
            // `index` counts the dragged card itself; `col` no longer contains it.
            if (from < index) index -= 1;
        }
        const before = col[index] ?? null;
        const after = index > 0 ? col[index - 1] : null;
        move.mutate({ id: taskId, status_id: status.id, after_task_id: after?.id ?? null, before_task_id: before?.id ?? null });
    };

    const moveTo = (t: Task, status: TaskStatus) => {
        const col = columns.find((c) => c.status.id === status.id)?.tasks ?? [];
        move.mutate({ id: t.id, status_id: status.id, after_task_id: col[col.length - 1]?.id ?? null, before_task_id: null });
    };

    if (board.error) return <ErrorState error={board.error} onRetry={() => board.refetch()} />;
    return (
        <>
            <div className="-mx-4 flex min-h-[28rem] flex-1 gap-3 overflow-x-auto px-4 pb-4 md:-mx-6 md:px-6" aria-label="Board columns">
                {board.isPending
                    ? Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-96 w-72 shrink-0" />)
                    : columns.map(({ status, tasks }) => (
                        <section
                            key={status.id}
                            aria-label={status.name}
                            className={cn("flex w-72 shrink-0 flex-col rounded-lg border border-border bg-secondary/50", over?.status === status.id && "border-border-strong bg-accent/60")}
                            onDragOver={(e) => { if (!dragging) return; e.preventDefault(); if (!tasks.length) setOver({ status: status.id, index: 0 }); }}
                            onDrop={(e) => { e.preventDefault(); drop(status, over?.status === status.id ? over.index : tasks.length); }}
                        >
                            <header className="flex items-center gap-2 px-3 py-2">
                                <StatusIcon category={status.category} color={status.color} />
                                <span className="text-[13px] font-medium text-foreground">{status.name}</span>
                                <span className="text-xs text-muted-foreground tabular">{tasks.length}</span>
                                <Button variant="ghost" size="icon-sm" className="ml-auto size-6" aria-label={`New task in ${status.name}`} onClick={() => quick.open({ team_id: team === NO_TEAM ? null : team, status_id: status.id, project_id: projectId })}>
                                    <Plus className="size-3.5" />
                                </Button>
                            </header>
                            <ol className="flex min-h-24 flex-1 flex-col gap-2 overflow-y-auto px-2 pb-2">
                                {tasks.map((t, i) => (
                                    <li
                                        key={t.id}
                                        draggable={canMove}
                                        onDragStart={(e: DragEvent) => { e.dataTransfer.effectAllowed = "move"; setDragging(t.id); }}
                                        onDragEnd={() => { setDragging(null); setOver(null); }}
                                        onDragOver={(e) => {
                                            if (!dragging) return;
                                            e.preventDefault();
                                            const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                                            setOver({ status: status.id, index: e.clientY < rect.top + rect.height / 2 ? i : i + 1 });
                                        }}
                                        className={cn(
                                            "group relative cursor-pointer rounded-md border border-border bg-card p-2.5 shadow-sm transition-colors hover:border-border-strong",
                                            dragging === t.id && "opacity-40",
                                            over?.status === status.id && over.index === i && dragging && dragging !== t.id && "before:absolute before:-top-1.5 before:left-0 before:right-0 before:h-0.5 before:rounded before:bg-primary",
                                        )}
                                        onClick={(e) => {
                                            // Ignore clicks from portalled menus (React bubbles them through the tree) and from buttons.
                                            if (!e.currentTarget.contains(e.target as Node) || (e.target as HTMLElement).closest("button")) return;
                                            setPeek(t.identifier);
                                        }}
                                    >
                                        <div className="mb-1 flex items-center gap-2">
                                            {show("id") && <span className="font-mono text-[11px] text-muted-foreground">{t.identifier}</span>}
                                            <span className="ml-auto" />
                                            {canMove && (
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild><Button variant="ghost" size="icon-sm" className="size-6 sm:opacity-0 sm:group-hover:opacity-100" aria-label={`Move ${t.identifier}`}><MoreHorizontal className="size-3.5" /></Button></DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end">
                                                        <DropdownMenuLabel>Move to</DropdownMenuLabel>
                                                        {(board.data?.statuses ?? []).filter((s) => s.id !== t.status_id).map((s) => (
                                                            <DropdownMenuItem key={s.id} onSelect={() => moveTo(t, s)}><StatusIcon category={s.category} color={s.color} /> {s.name}</DropdownMenuItem>
                                                        ))}
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            )}
                                            {show("assignee") && <MemberAvatar person={t.assignee?.user} size="xs" />}
                                        </div>
                                        <p className="line-clamp-3 text-[13px] text-foreground">{t.title}</p>
                                        <div className="mt-2 flex flex-wrap items-center gap-1.5">
                                            {show("priority") && <PriorityIcon priority={t.priority} />}
                                            {show("labels") && t.labels.slice(0, 2).map((l) => <LabelChip key={l.id} label={l} />)}
                                            {show("project") && t.project && <span className="max-w-28 truncate text-[11px] text-muted-foreground">{t.project.name}</span>}
                                            {show("subtasks") && t._count.subtasks > 0 && <span className="text-[11px] text-muted-foreground">{t._count.subtasks} sub</span>}
                                            {show("due") && t.due_date && <span className="ml-auto text-[11px] text-muted-foreground tabular">{formatDate(t.due_date, "d MMM")}</span>}
                                        </div>
                                    </li>
                                ))}
                                {!tasks.length && <li className="grid flex-1 place-items-center rounded-md border border-dashed border-border py-6 text-xs text-muted-foreground">No tasks</li>}
                            </ol>
                        </section>
                    ))}
            </div>
            <TaskSheet taskKey={peek} onClose={() => setPeek(null)} />
        </>
    );
}
