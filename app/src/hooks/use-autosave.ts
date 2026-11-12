import { useCallback, useEffect, useRef, useState } from "react";
import type { FieldValues, UseFormReturn } from "react-hook-form";
import { getApiErrorMessage } from "@/lib/api-error";

export type AutosaveStatus = "idle" | "pending" | "saving" | "saved" | "error";

export interface AutosaveState {
    status: AutosaveStatus;
    /** Message of the last failed save (shown by <SaveStatus />). */
    error: string | null;
    /** Save the latest value now (e.g. on blur or before navigating). */
    flush: () => void;
    /** Retry the last failed save. */
    retry: () => void;
}

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/**
 * Linear-style autosave: every change is saved after `delay` ms of quiet, one request at a time; edits made while a
 * save is running are saved right after it. Nothing to click, no success toast — show <SaveStatus state={…} /> instead.
 * Pending edits are flushed on unmount and the browser warns before closing the tab while a save is outstanding.
 *
 *   const save = useUpdateThing();
 *   const autosave = useAutosave({ value: draft, save: (v) => save.mutateAsync({ id, ...v }) });
 */
export function useAutosave<T>({ value, save, delay = 700, enabled = true }: { value: T; save: (value: T) => Promise<unknown>; delay?: number; enabled?: boolean }): AutosaveState {
    const [status, setStatus] = useState<AutosaveStatus>("idle");
    const [error, setError] = useState<string | null>(null);
    const saved = useRef<T>(value); // last value the server has (or the initial value)
    const latest = useRef<T>(value);
    const running = useRef(false);
    const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const saveRef = useRef(save);
    saveRef.current = save;
    const failed = useRef(false);
    latest.current = value;

    const run = useCallback(async () => {
        if (timer.current) { clearTimeout(timer.current); timer.current = null; }
        if (running.current || same(latest.current, saved.current)) return;
        running.current = true;
        const sending = latest.current;
        setStatus("saving");
        try {
            await saveRef.current(sending);
            saved.current = sending;
            setError(null);
            failed.current = false;
            running.current = false;
            if (!same(latest.current, saved.current)) { setStatus("pending"); void run(); }
            else setStatus("saved");
        } catch (e) {
            running.current = false;
            failed.current = true;
            setError(getApiErrorMessage(e));
            setStatus("error");
        }
    }, []);

    useEffect(() => {
        // While disabled (data still loading, form untouched, invalid…) the current value is the baseline, so turning
        // autosave on never re-saves what the server already has.
        if (!enabled) { if (!running.current && !failed.current) saved.current = value; return; } // a failed save keeps its Retry
        if (same(value, saved.current)) return;
        setStatus((s) => (s === "saving" ? s : "pending"));
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(() => void run(), delay);
        return () => { if (timer.current) clearTimeout(timer.current); };
    }, [value, enabled, delay, run]);

    // Flush on unmount so closing a panel never loses the last keystrokes.
    useEffect(() => () => { if (!same(latest.current, saved.current) && !running.current) void saveRef.current(latest.current).catch(() => undefined); }, []);

    useEffect(() => {
        const warn = (e: BeforeUnloadEvent) => {
            if (!same(latest.current, saved.current)) { e.preventDefault(); e.returnValue = ""; }
        };
        window.addEventListener("beforeunload", warn);
        return () => window.removeEventListener("beforeunload", warn);
    }, []);

    return { status, error, flush: () => void run(), retry: () => void run() };
}

/**
 * Autosave for a react-hook-form settings form: valid changes are saved automatically (invalid fields keep their
 * inline errors and are not sent). `toPayload` maps form values to the API body.
 */
export function useFormAutosave<F extends FieldValues>(form: UseFormReturn<F>, save: (values: F) => Promise<unknown>, { delay = 800, enabled = true }: { delay?: number; enabled?: boolean } = {}) {
    const values = form.watch();
    const [valid, setValid] = useState(true);
    useEffect(() => {
        if (!enabled || !form.formState.isDirty) return;
        void form.trigger().then(setValid);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [JSON.stringify(values), enabled]);
    return useAutosave({ value: values, enabled: enabled && valid && form.formState.isDirty, delay, save: (v) => save(v as F) });
}
