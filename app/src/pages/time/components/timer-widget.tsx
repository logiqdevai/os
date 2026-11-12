import { useEffect, useState } from "react";
import { Pause, Play, Square, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { isTempTimer, useCurrentTimer, useDiscardTimer, usePauseTimer, useResumeTimer, useStartTimer, useStopTimer } from "@/features/time/timers/hooks/use-timer";
import { ProjectSelect, TaskSelect } from "./pickers";

const clock = (s: number) => `${String(Math.floor(s / 3600)).padStart(2, "0")}:${String(Math.floor((s % 3600) / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

/**
 * Running timer (one per member). Stop turns it into a TimeEntry (source TIMER). Every action is optimistic: the clock
 * starts / pauses / stops at once, failures roll back with one global error toast (no success toasts).
 * @perm time.entries.read_own · start/stop time.entries.create_own · @api /time/timers
 */
export function TimerWidget({ canStart }: { canStart: boolean }) {
    const q = useCurrentTimer();
    const start = useStartTimer();
    const stop = useStopTimer();
    const pause = usePauseTimer();
    const resume = useResumeTimer();
    const discard = useDiscardTimer();
    const [projectId, setProjectId] = useState<string | null>(null);
    const [taskId, setTaskId] = useState<string | null>(null);
    const [description, setDescription] = useState("");
    const timer = q.data?.timer ?? null;
    const [elapsed, setElapsed] = useState(0);

    useEffect(() => {
        if (!timer) return;
        const base = timer.elapsed_seconds;
        const at = Date.now();
        setElapsed(base);
        if (timer.is_paused) return;
        const t = setInterval(() => setElapsed(base + Math.floor((Date.now() - at) / 1000)), 1000);
        return () => clearInterval(t);
    }, [timer]);

    // Until the server confirms a just-started timer its id is temporary, so its actions wait a moment.
    const busy = !!timer && isTempTimer(timer);

    if (q.isLoading) return <Skeleton className="h-14 w-full" />;
    if (timer) {
        return (
            <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-3 sm:flex-row sm:items-center">
                <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                        <Badge variant={timer.is_paused ? "warning" : "success"} dot>{timer.is_paused ? "Paused" : "Running"}</Badge>
                        <span className="truncate text-[13px] text-foreground">{timer.description || timer.task?.title || timer.project?.name || "No description"}</span>
                    </div>
                    {timer.project && <div className="mt-0.5 truncate text-xs text-muted-foreground">{timer.project.name}{timer.task ? ` · ${timer.task.title}` : ""}</div>}
                </div>
                <div className="flex items-center gap-2">
                    <span className="font-mono text-xl tabular text-foreground" aria-live="off">{clock(elapsed)}</span>
                    {timer.is_paused
                        ? <Button size="icon" variant="outline" aria-label="Resume" disabled={busy} onClick={() => resume.mutate(timer.id)}><Play /></Button>
                        : <Button size="icon" variant="outline" aria-label="Pause" disabled={busy} onClick={() => pause.mutate({ id: timer.id, elapsed_seconds: elapsed })}><Pause /></Button>}
                    <Button variant="destructive" disabled={busy} onClick={() => stop.mutate(timer.id)}><Square /> Stop</Button>
                    <Button size="icon" variant="ghost" aria-label="Discard timer" disabled={busy} onClick={() => discard.mutate(timer.id)}><Trash2 /></Button>
                </div>
            </div>
        );
    }
    if (!canStart) return null;
    return (
        <div className="flex flex-col gap-2 rounded-lg border border-border bg-card p-3 md:flex-row md:items-center">
            <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What are you working on?" className="md:flex-1" aria-label="Timer description" />
            <ProjectSelect value={projectId} onChange={(v) => { setProjectId(v); setTaskId(null); }} className="md:w-56" />
            <TaskSelect projectId={projectId} value={taskId} onChange={setTaskId} className="md:w-48" />
            <Button onClick={() => { start.mutate({ project_id: projectId, task_id: taskId, description: description || null }); setDescription(""); }}><Play /> Start</Button>
        </div>
    );
}
