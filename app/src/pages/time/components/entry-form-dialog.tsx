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
import { toast } from "@/hooks/use-toast";
import { getApiErrorMessage } from "@/lib/api-error";
import { ActivitySelect, ProjectSelect, TaskSelect, parseDuration, toClock } from "./pickers";

interface Props {
    open: boolean;
    onOpenChange: (o: boolean) => void;
    entry?: TimeEntry | null;
    defaultDate?: string;
}

/**
 * New / edit time entry. Duration accepts 1:30, 1.5 or 90m; start+end compute the duration.
 * @perm time.entries.create_own / update_own · @api POST /time/entries · PATCH /time/entries/:id
 */
export function EntryFormDialog({ open, onOpenChange, entry, defaultDate }: Props) {
    const settings = useTimeSettings(open);
    const create = useCreateTimeEntry();
    const update = useUpdateTimeEntry();
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
        setProjectId(entry?.project_id ?? null);
        setTaskId(entry?.task_id ?? null);
        setActivityId(entry?.activity_type_id ?? null);
        setDescription(entry?.description ?? "");
        setBillable(entry?.is_billable ?? settings.data?.default_billable ?? true);
        setReason("");
    }, [open, entry, defaultDate, settings.data?.default_billable]);

    const computed = start && end ? (() => {
        const [sh, sm] = start.split(":").map(Number);
        const [eh, em] = end.split(":").map(Number);
        const d = eh * 60 + em - (sh * 60 + sm);
        return d > 0 ? d : null;
    })() : null;
    const minutes = computed ?? parseDuration(duration);
    const overridden = billable !== (settings.data?.default_billable ?? true);
    const needsReason = !!settings.data?.require_billable_override_reason && overridden && !entry;
    const pending = create.isPending || update.isPending;
    const valid = !!date && minutes !== null && minutes > 0 && (!needsReason || reason.trim().length >= 3) && (!settings.data?.require_description || description.trim()) && (!settings.data?.require_project || projectId);

    const save = () => {
        if (!valid || minutes === null) return;
        const toIso = (t: string) => new Date(`${date}T${t}:00`).toISOString();
        const dto = {
            date, duration_minutes: minutes, project_id: projectId, task_id: taskId, activity_type_id: activityId, description: description || null, is_billable: billable,
            ...(start && end && computed ? { start_at: toIso(start), end_at: toIso(end) } : {}),
            ...(reason ? { billable_override_reason: reason } : {}),
        };
        const opts = {
            onSuccess: () => { toast({ title: entry ? "Entry updated" : "Time logged" }); onOpenChange(false); },
            onError: (e: unknown) => toast({ variant: "destructive" as const, title: "Could not save time", description: getApiErrorMessage(e) }),
        };
        if (entry) update.mutate({ id: entry.id, ...dto }, opts);
        else create.mutate(dto, opts);
    };

    return (
        <Dialog open={open} onOpenChange={(o) => !pending && onOpenChange(o)}>
            <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle>{entry ? "Edit time entry" : "Log time"}</DialogTitle>
                    <DialogDescription>{entry?.is_locked ? "This entry is locked." : "Duration accepts 1:30, 1.5 or 90m."}</DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 sm:grid-cols-3">
                    <div className="space-y-1.5"><Label htmlFor="te-date">Date</Label><Input id="te-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
                    <div className="space-y-1.5"><Label htmlFor="te-start">Start</Label><Input id="te-start" type="time" value={start} onChange={(e) => setStart(e.target.value)} /></div>
                    <div className="space-y-1.5"><Label htmlFor="te-end">End</Label><Input id="te-end" type="time" value={end} onChange={(e) => setEnd(e.target.value)} /></div>
                    <div className="space-y-1.5 sm:col-span-3">
                        <Label htmlFor="te-dur">Duration</Label>
                        <Input id="te-dur" value={computed ? toClock(computed) : duration} disabled={!!computed} onChange={(e) => setDuration(e.target.value)} placeholder="1:30" aria-invalid={minutes === null} />
                        {minutes === null && <p className="text-xs text-danger">Enter a duration like 1:30 or 1.5.</p>}
                    </div>
                    <div className="space-y-1.5 sm:col-span-3"><Label>Project</Label><ProjectSelect value={projectId} onChange={(v) => { setProjectId(v); setTaskId(null); }} /></div>
                    <div className="space-y-1.5 sm:col-span-2"><Label>Task</Label><TaskSelect projectId={projectId} value={taskId} onChange={setTaskId} /></div>
                    <div className="space-y-1.5"><Label>Activity</Label><ActivitySelect value={activityId} onChange={setActivityId} /></div>
                    <div className="space-y-1.5 sm:col-span-3"><Label htmlFor="te-desc">Description</Label><Textarea id="te-desc" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What did you work on?" /></div>
                    <div className="flex items-center justify-between gap-3 rounded-md border border-border p-3 sm:col-span-3">
                        <Label htmlFor="te-bill" className="m-0">Billable</Label>
                        <Switch id="te-bill" checked={billable} onCheckedChange={setBillable} />
                    </div>
                    {needsReason && <div className="space-y-1.5 sm:col-span-3"><Label htmlFor="te-reason">Why is this {billable ? "billable" : "not billable"}?</Label><Input id="te-reason" value={reason} onChange={(e) => setReason(e.target.value)} /></div>}
                </div>
                <DialogFooter>
                    <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={pending}>Cancel</Button>
                    <Button disabled={!valid || entry?.is_locked} loading={pending} onClick={save}>{entry ? "Save" : "Log time"}</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
