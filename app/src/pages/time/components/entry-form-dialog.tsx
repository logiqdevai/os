import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { useCreateTimeEntry, useUpdateTimeEntry } from "@/features/time/entries/hooks/use-time-entries";
import type { TimeEntry } from "@/features/time/entries/interfaces/time-entries.interfaces";
import { useTimeSettings } from "@/features/time/settings/hooks/use-time-settings";
import { useAutosave } from "@/hooks/use-autosave";
import { SaveStatus } from "@/components/ui/save-status";
import { ActivitySelect, ProjectSelect, TaskSelect, parseDuration, toClock } from "./pickers";

interface Props {
    open: boolean;
    onOpenChange: (o: boolean) => void;
    entry?: TimeEntry | null;
    defaultDate?: string;
    /** Prefill for a new entry (e.g. from a task). */
    defaults?: { project_id?: string | null; task_id?: string | null };
}

/**
 * New / edit time entry. Duration accepts 1:30, 1.5 or 90m; start+end compute the duration. Logging keeps its explicit
 * "Log time" button; editing autosaves every valid change (no Save button, "Done" closes; the row updates at once).
 * @perm time.entries.create_own / update_own · @api POST /time/entries · PATCH /time/entries/:id
 */
export function EntryFormDialog({ open, onOpenChange, entry, defaultDate, defaults }: Props) {
    const settings = useTimeSettings(open);
    const create = useCreateTimeEntry();
    const update = useUpdateTimeEntry({ inline: true });
    /** Set by the person's own edits; loading an entry into the form is not a change. */
    const [dirty, setDirty] = useState(false);
    const touch = <T,>(set: (v: T) => void) => (v: T) => { setDirty(true); set(v); };
    const [date, setDate] = useState("");
    const [duration, setDuration] = useState("");
    const [start, setStart] = useState("");
    const [end, setEnd] = useState("");
    const [projectId, setProjectId] = useState<string | null>(null);
    const [taskId, setTaskId] = useState<string | null>(null);
    const [activityId, setActivityId] = useState<string | null>(null);
    const [description, setDescription] = useState("");
    const [billable, setBillable] = useState(true);
    const [reason, setReason] = useState("");

    useEffect(() => {
        if (!open) return;
        setDate(entry?.date.slice(0, 10) ?? defaultDate ?? new Date().toISOString().slice(0, 10));
        setDuration(entry ? toClock(entry.duration_minutes) : "");
        setStart(entry?.start_at ? entry.start_at.slice(11, 16) : "");
        setEnd(entry?.end_at ? entry.end_at.slice(11, 16) : "");
        setProjectId(entry?.project_id ?? defaults?.project_id ?? null);
        setTaskId(entry?.task_id ?? defaults?.task_id ?? null);
        setActivityId(entry?.activity_type_id ?? null);
        setDescription(entry?.description ?? "");
        setBillable(entry?.is_billable ?? settings.data?.default_billable ?? true);
        setReason("");
        setDirty(false);
    }, [open, entry, defaultDate, defaults?.project_id, defaults?.task_id, settings.data?.default_billable]);

    const computed = start && end ? (() => {
        const [sh, sm] = start.split(":").map(Number);
        const [eh, em] = end.split(":").map(Number);
        const d = eh * 60 + em - (sh * 60 + sm);
        return d > 0 ? d : null;
    })() : null;
    const minutes = computed ?? parseDuration(duration);
    const overridden = billable !== (settings.data?.default_billable ?? true);
    const needsReason = !!settings.data?.require_billable_override_reason && overridden && !entry;
    const pending = create.isPending;
    const valid = !!date && minutes !== null && minutes > 0 && (!needsReason || reason.trim().length >= 3) && (!settings.data?.require_description || description.trim()) && (!settings.data?.require_project || projectId);

    const toIso = (t: string) => new Date(`${date}T${t}:00`).toISOString();
    const dto = {
        date, duration_minutes: minutes ?? 0, project_id: projectId, task_id: taskId, activity_type_id: activityId, description: description || null, is_billable: billable,
        ...(start && end && computed ? { start_at: toIso(start), end_at: toIso(end) } : {}),
        ...(reason ? { billable_override_reason: reason } : {}),
    };
    const autosave = useAutosave({ value: dto, enabled: open && !!entry && !entry.is_locked && !!dirty && !!valid, save: (v) => update.mutateAsync({ id: entry!.id, ...v }) });
    const close = () => { if (entry && dirty && valid) autosave.flush(); onOpenChange(false); };
    const save = () => {
        if (entry) return close();
        if (!valid || minutes === null) return;
        create.mutate(dto, { onSuccess: () => onOpenChange(false) });
    };

    return (
        <Dialog open={open} onOpenChange={(o) => (o ? onOpenChange(o) : !pending && close())}>
            <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle>{entry ? "Edit time entry" : "Log time"}</DialogTitle>
                    <DialogDescription>{entry?.is_locked ? "This entry is locked." : "Duration accepts 1:30, 1.5 or 90m."}</DialogDescription>
                    {entry && <SaveStatus state={autosave} />}
                </DialogHeader>
                <div className="grid gap-4 sm:grid-cols-3">
                    <div className="space-y-1.5"><Label htmlFor="te-date">Date</Label><Input id="te-date" type="date" value={date} onChange={(e) => touch(setDate)(e.target.value)} /></div>
                    <div className="space-y-1.5"><Label htmlFor="te-start">Start</Label><Input id="te-start" type="time" value={start} onChange={(e) => touch(setStart)(e.target.value)} /></div>
                    <div className="space-y-1.5"><Label htmlFor="te-end">End</Label><Input id="te-end" type="time" value={end} onChange={(e) => touch(setEnd)(e.target.value)} /></div>
                    <div className="space-y-1.5 sm:col-span-3">
                        <Label htmlFor="te-dur">Duration</Label>
                        <Input id="te-dur" value={computed ? toClock(computed) : duration} disabled={!!computed} onChange={(e) => touch(setDuration)(e.target.value)} placeholder="1:30" aria-invalid={minutes === null} />
                        {minutes === null && <p className="text-xs text-danger">Enter a duration like 1:30 or 1.5.</p>}
                    </div>
                    <div className="space-y-1.5 sm:col-span-3"><Label>Project</Label><ProjectSelect value={projectId} onChange={(v) => { setDirty(true); setProjectId(v); setTaskId(null); }} /></div>
                    <div className="space-y-1.5 sm:col-span-2"><Label>Task</Label><TaskSelect projectId={projectId} value={taskId} onChange={touch(setTaskId)} /></div>
                    <div className="space-y-1.5"><Label>Activity</Label><ActivitySelect value={activityId} onChange={touch(setActivityId)} /></div>
                    <div className="space-y-1.5 sm:col-span-3"><Label htmlFor="te-desc">Description</Label><Textarea id="te-desc" rows={2} value={description} onChange={(e) => touch(setDescription)(e.target.value)} placeholder="What did you work on?" /></div>
                    <div className="flex items-center justify-between gap-3 rounded-md border border-border p-3 sm:col-span-3">
                        <Label htmlFor="te-bill" className="m-0">Billable</Label>
                        <Switch id="te-bill" checked={billable} onCheckedChange={touch(setBillable)} />
                    </div>
                    {needsReason && <div className="space-y-1.5 sm:col-span-3"><Label htmlFor="te-reason">Why is this {billable ? "billable" : "not billable"}?</Label><Input id="te-reason" value={reason} onChange={(e) => touch(setReason)(e.target.value)} /></div>}
                </div>
                <DialogFooter>
                    {entry ? (
                        <Button onClick={close}>Done</Button>
                    ) : (
                        <>
                            <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={pending}>Cancel</Button>
                            <Button disabled={!valid} loading={pending} onClick={save}>Log time</Button>
                        </>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
