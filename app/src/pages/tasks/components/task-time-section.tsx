import { useState } from "react";
import { Pause, Play, Plus, Square, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { usePermissions } from "@/hooks/use-permission";
import { isTempTimer, useCurrentTimer, useDiscardTimer, usePauseTimer, useResumeTimer, useStartTimer, useStopTimer } from "@/features/time/timers/hooks/use-timer";
import { useTimeEntries } from "@/features/time/entries/hooks/use-time-entries";
import type { TaskDetail } from "@/features/tasks/interfaces/tasks.interfaces";
import { clock, useElapsedSeconds } from "@/pages/time/components/timer-widget";
import { EntryFormDialog } from "@/pages/time/components/entry-form-dialog";
import { formatDate, formatMinutes } from "@/lib/format";

/**
 * Time tracking on a task: start / pause / stop the member's running timer for this task and list the time logged on it.
 * Reuses the Time module's timer + entry hooks (one running timer per member, stop creates a TimeEntry with source TIMER).
 * @perm time.entries.read_own (section) · start/log time.entries.create_own
 * @api /time/timers · GET /time/entries?task_id=
 */
export function TaskTimeSection({ task: t }: { task: TaskDetail }) {
    const p = usePermissions();
    const canRead = p.can("time.entries.read_own");
    const canStart = p.can("time.entries.create_own") && !t.archived_at;
    const q = useCurrentTimer(canRead);
    const entries = useTimeEntries({ task_id: t.id, scope: "mine", limit: 10 }, canRead);
    const start = useStartTimer();
    const stop = useStopTimer();
    const pause = usePauseTimer();
    const resume = useResumeTimer();
    const discard = useDiscardTimer();
    const [logging, setLogging] = useState(false);
    const timer = q.data?.timer ?? null;
    const mine = !!timer && timer.task_id === t.id;
    const elapsed = useElapsedSeconds(mine ? timer : null);
    if (!canRead) return null;
    const busy = !!timer && isTempTimer(timer);
    const startHere = (stopCurrent: boolean) =>
        start.mutate({ project_id: t.project_id, task_id: t.id, stop_current: stopCurrent || undefined, optimistic: { task: { id: t.id, number: t.number, title: t.title, team: t.team }, project: t.project ? { id: t.project.id, name: t.project.name, code: null, color: t.project.color } : null } });

    return (
        <section aria-label="Time tracking">
            <div className="mb-2 flex items-center justify-between gap-2">
                <h2 className="text-[13px] font-medium text-foreground">Time</h2>
                {canStart && <Button variant="ghost" size="sm" onClick={() => setLogging(true)}><Plus /> Log time</Button>}
            </div>
            <div className="rounded-lg border border-border bg-card p-3">
                {q.isLoading ? <Skeleton className="h-9 w-full" /> : mine && timer ? (
                    <div className="flex flex-wrap items-center gap-2">
                        <Badge variant={timer.is_paused ? "warning" : "success"} dot>{timer.is_paused ? "Paused" : "Running"}</Badge>
                        <span className="font-mono text-xl tabular text-foreground" aria-live="off">{clock(elapsed)}</span>
                        <div className="ml-auto flex items-center gap-2">
                            {timer.is_paused
                                ? <Button size="icon" variant="outline" aria-label="Resume" disabled={busy} onClick={() => resume.mutate(timer.id)}><Play /></Button>
                                : <Button size="icon" variant="outline" aria-label="Pause" disabled={busy} onClick={() => pause.mutate({ id: timer.id, elapsed_seconds: elapsed })}><Pause /></Button>}
                            <Button variant="destructive" disabled={busy} onClick={() => stop.mutate(timer.id)}><Square /> Stop</Button>
                            <Button size="icon" variant="ghost" aria-label="Discard timer" disabled={busy} onClick={() => discard.mutate(timer.id)}><Trash2 /></Button>
                        </div>
                    </div>
                ) : (
                    <div className="flex flex-wrap items-center gap-2">
                        {timer ? (
                            <span className="min-w-0 flex-1 truncate text-[13px] text-muted-foreground">Timer running on {timer.task?.title ?? timer.project?.name ?? "another item"}</span>
                        ) : (
                            <span className="flex-1 text-[13px] text-muted-foreground">No timer running</span>
                        )}
                        {canStart && (
                            <Button size="sm" disabled={busy} onClick={() => startHere(!!timer)}>
                                <Play /> {timer ? "Switch to this task" : "Start timer"}
                            </Button>
                        )}
                    </div>
                )}
                <div className="mt-3 border-t border-border-soft pt-2">
                    {entries.isPending ? <Skeleton className="h-8 w-full" /> : !entries.data?.data.length ? (
                        <p className="text-[13px] text-muted-foreground">No time logged yet</p>
                    ) : (
                        <>
                            <ul className="divide-y divide-border-soft">
                                {entries.data.data.map((e) => (
                                    <li key={e.id} className="flex items-center gap-2 py-1.5 text-[13px]">
                                        <span className="w-16 shrink-0 text-xs text-muted-foreground tabular">{formatDate(e.date, "d MMM")}</span>
                                        <span className="min-w-0 flex-1 truncate text-foreground">{e.description ?? e.activity_type?.name ?? "Time entry"}</span>
                                        {e.source === "TIMER" && <Badge variant="secondary">Timer</Badge>}
                                        <span className="shrink-0 font-medium tabular text-foreground">{formatMinutes(e.duration_minutes)}</span>
                                    </li>
                                ))}
                            </ul>
                            <div className="mt-1 flex justify-between border-t border-border-soft pt-2 text-xs text-muted-foreground">
                                <span>Total (you)</span>
                                <span className="font-medium tabular text-foreground">{formatMinutes(entries.data.totals.duration_minutes)}</span>
                            </div>
                        </>
                    )}
                </div>
            </div>
            <EntryFormDialog open={logging} onOpenChange={setLogging} defaults={{ project_id: t.project_id, task_id: t.id }} />
        </section>
    );
}
