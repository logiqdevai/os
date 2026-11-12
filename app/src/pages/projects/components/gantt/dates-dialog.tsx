import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export interface DatesDialogTarget {
    id: string;
    label: string;
    /** Milestones have one date. */
    single: boolean;
    start: string | null;
    end: string | null;
}

/**
 * Keyboard / touch alternative to dragging on the Gantt: pick the dates in a form.
 * `onSave` receives `YYYY-MM-DD` values; for single-date items start === end.
 */
export function DatesDialog({ target, onOpenChange, onSave }: { target: DatesDialogTarget | null; onOpenChange: (open: boolean) => void; onSave: (start: string, end: string) => Promise<unknown> }) {
    const [start, setStart] = useState("");
    const [end, setEnd] = useState("");
    const [saving, setSaving] = useState(false);
    useEffect(() => {
        if (target) {
            setStart((target.start ?? target.end ?? "").slice(0, 10));
            setEnd((target.end ?? target.start ?? "").slice(0, 10));
        }
    }, [target]);
    const invalid = target ? (target.single ? !start : !start || !end || end < start) : true;
    const save = async () => {
        if (!target || invalid) return;
        setSaving(true);
        try {
            await onSave(start, target.single ? start : end);
            onOpenChange(false);
        } catch {
            /* the mutation toasts the error; keep the dialog open */
        } finally {
            setSaving(false);
        }
    };
    return (
        <Dialog open={!!target} onOpenChange={(o) => !saving && onOpenChange(o)}>
            <DialogContent className="sm:max-w-sm">
                <DialogHeader>
                    <DialogTitle>Change dates</DialogTitle>
                    <DialogDescription className="line-clamp-2">{target?.label}</DialogDescription>
                </DialogHeader>
                <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); void save(); }}>
                    {target?.single ? (
                        <div className="space-y-1.5">
                            <Label htmlFor="gantt-date">Date</Label>
                            <Input id="gantt-date" type="date" value={start} onChange={(e) => setStart(e.target.value)} autoFocus />
                        </div>
                    ) : (
                        <div className="grid gap-4 sm:grid-cols-2">
                            <div className="space-y-1.5">
                                <Label htmlFor="gantt-start">Start</Label>
                                <Input id="gantt-start" type="date" value={start} onChange={(e) => setStart(e.target.value)} autoFocus />
                            </div>
                            <div className="space-y-1.5">
                                <Label htmlFor="gantt-end">End</Label>
                                <Input id="gantt-end" type="date" value={end} min={start || undefined} onChange={(e) => setEnd(e.target.value)} />
                            </div>
                        </div>
                    )}
                    {!target?.single && start && end && end < start && <p className="text-xs text-danger">The end date must be on or after the start date.</p>}
                    <DialogFooter>
                        <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
                        <Button type="submit" loading={saving} disabled={invalid}>Save dates</Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
