import { useQuery } from "@tanstack/react-query";
import { useOptimisticMutation } from "@/lib/query/optimistic";
import { TIME_KEY } from "@/features/time/settings/hooks/use-time-settings";
import type { RunningTimer, StartTimerDto } from "../interfaces/timers.interfaces";
import * as service from "../services/timers.services";

const KEY = [...TIME_KEY, "timer"] as const;
type TimerData = { timer: RunningTimer | null };

export const useCurrentTimer = (enabled = true) => useQuery({ queryKey: KEY, queryFn: service.getCurrentTimer, enabled, refetchOnWindowFocus: true });

/** A timer shown optimistically before the server answered (its actions wait for the real id). */
export const isTempTimer = (t: RunningTimer) => t.id.startsWith("temp-");

/**
 * Timer actions are optimistic (Linear-style): the widget starts, pauses, resumes, stops or disappears the moment the
 * button is pressed; a refusal rolls back and is toasted once globally. Start/stop also refresh the whole Time area
 * (the stopped timer becomes an entry in the week).
 */
export const useStartTimer = () =>
    useOptimisticMutation<RunningTimer, StartTimerDto & { optimistic?: Partial<RunningTimer> }>({
        roots: [KEY],
        alsoInvalidate: [TIME_KEY],
        meta: { errorTitle: "Could not start the timer" },
        mutationFn: ({ optimistic: _o, ...dto }) => service.startTimer(dto),
        apply: (qc, { optimistic, ...dto }) =>
            qc.setQueryData<TimerData>(KEY, {
                timer: {
                    id: `temp-${Date.now()}`, membership_id: "", project_id: dto.project_id ?? null, task_id: dto.task_id ?? null, activity_type_id: dto.activity_type_id ?? null,
                    description: dto.description ?? null, is_billable: dto.is_billable ?? null, started_at: new Date().toISOString(), paused_at: null, paused_minutes: 0,
                    elapsed_seconds: 0, is_paused: false, project: null, task: null, activity_type: null, ...optimistic,
                },
            }),
    });
export const useUpdateTimer = () =>
    useOptimisticMutation({
        roots: [KEY],
        meta: { errorTitle: "Could not update the timer" },
        mutationFn: service.updateTimer,
        apply: (qc, { id: _id, ...dto }: Parameters<typeof service.updateTimer>[0]) => qc.setQueryData<TimerData>(KEY, (d) => (d?.timer ? { timer: { ...d.timer, ...dto } } : d)),
    });
const clear = () => ({ timer: null });
export const useStopTimer = () =>
    useOptimisticMutation({ roots: [KEY], alsoInvalidate: [TIME_KEY], meta: { errorTitle: "Could not stop the timer" }, mutationFn: service.stopTimer, apply: (qc) => qc.setQueryData<TimerData>(KEY, clear) });
/** Pause freezes the clock at `elapsed_seconds` (what the widget shows now). */
export const usePauseTimer = () =>
    useOptimisticMutation({
        roots: [KEY],
        meta: { errorTitle: "Could not pause the timer" },
        mutationFn: ({ id }: { id: string; elapsed_seconds: number }) => service.pauseTimer(id),
        apply: (qc, { elapsed_seconds }) => qc.setQueryData<TimerData>(KEY, (d) => (d?.timer ? { timer: { ...d.timer, is_paused: true, paused_at: new Date().toISOString(), elapsed_seconds } } : d)),
    });
export const useResumeTimer = () =>
    useOptimisticMutation({
        roots: [KEY],
        meta: { errorTitle: "Could not resume the timer" },
        mutationFn: service.resumeTimer,
        apply: (qc) => qc.setQueryData<TimerData>(KEY, (d) => (d?.timer ? { timer: { ...d.timer, is_paused: false, paused_at: null } } : d)),
    });
export const useDiscardTimer = () =>
    useOptimisticMutation({ roots: [KEY], meta: { errorTitle: "Could not discard the timer" }, mutationFn: service.discardTimer, apply: (qc) => qc.setQueryData<TimerData>(KEY, clear) });
