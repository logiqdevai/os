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
 * `onSave` receives `YYYY-MM-DD` values; for single-date items start === end. The change is optimistic: the dialog
 * closes at once and a refused save rolls back with one global error toast.
 */
export function DatesDialog({ target, onOpenChange, onSave }: { target: DatesDialogTarget | null; onOpenChange: (open: boolean) => void; onSave: (start: string, end: string) => Promise<unknown> }) {
    const [start, setStart] = useState("");
    const [end, setEnd] = useState("");
    useEffect(() => {
        if (target) {
            setStart((target.start ?? target.end ?? "").slice(0, 10));
            setEnd((target.end ?? target.start ?? "").slice(0, 10));
        }
    }, [target]);
    const invalid = target ? (target.single ? !start : !start || !end || end < start) : true;
    const save = () => {
        if (!target || invalid) return;
        void onSave(start, target.single ? start : end).catch(() => undefined);
        onOpenChange(false);
    };
    return (
        <Dialog open={!!target} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-sm">
                <DialogHeader>
                    <DialogTitle>Change dates</DialogTitle>
                    <DialogDescription className="line-clamp-2">{target?.label}</DialogDescription>
                </DialogHeader>
                <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); save(); }}>
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
                        <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
                        <Button type="submit" disabled={invalid}>Set dates</Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
