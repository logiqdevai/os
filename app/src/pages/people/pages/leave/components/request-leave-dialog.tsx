import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CalendarCheck } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useCreateLeave, useLeavePreview, useLeaveTypes } from "@/features/people/leave/hooks/use-leave";
import type { LeaveDayPart, LeaveRequestDto } from "@/features/people/leave/interfaces/leave.interfaces";
import { LeaveDayPartFormOptions } from "@/config/constants/dropdowns/people/leave-form.options";
import { formatNumber } from "@/lib/format";
import { toast } from "@/hooks/use-toast";
import { getApiErrorMessage } from "@/lib/api-error";

interface Props {
    open: boolean;
    onOpenChange: (o: boolean) => void;
    /** On behalf of another employee (employees.leave.manage_balances). */
    employeeId?: string;
}

const today = () => new Date().toISOString().slice(0, 10);

/**
 * Request leave — previews working days (schedule − holidays), balance after and team conflicts before submitting.
 * @perm employees.leave.request_own (own) · @api POST /people/leave-requests/preview · POST /people/leave-requests
 */
export function RequestLeaveDialog({ open, onOpenChange, employeeId }: Props) {
    const types = useLeaveTypes(open);
    const create = useCreateLeave();
    const [typeId, setTypeId] = useState("");
    const [start, setStart] = useState(today());
    const [end, setEnd] = useState(today());
    const [startPart, setStartPart] = useState<LeaveDayPart>("FULL_DAY");
    const [endPart, setEndPart] = useState<LeaveDayPart>("FULL_DAY");
    const [reason, setReason] = useState("");
    const [debounced, setDebounced] = useState<LeaveRequestDto | null>(null);

    useEffect(() => {
        if (!open) return;
        setStart(today()); setEnd(today()); setStartPart("FULL_DAY"); setEndPart("FULL_DAY"); setReason(""); setTypeId("");
    }, [open]);
    useEffect(() => { if (open && !typeId && types.data?.length) setTypeId(types.data[0].id); }, [open, typeId, types.data]);

    const type = types.data?.find((t) => t.id === typeId);
    const sameDay = start === end;
    const dto = useMemo<LeaveRequestDto | null>(() => (typeId && start && end && end >= start ? {
        employee_id: employeeId, leave_type_id: typeId, start_date: start, end_date: end, start_day_part: startPart, end_day_part: sameDay ? startPart : endPart, reason: reason || undefined,
    } : null), [employeeId, typeId, start, end, startPart, endPart, sameDay, reason]);
    useEffect(() => {
        const t = setTimeout(() => setDebounced(dto ? { ...dto, reason: undefined } : null), 300);
        return () => clearTimeout(t);
    }, [dto]);
    const preview = useLeavePreview(open ? debounced : null);

    const submit = (submitNow: boolean) => dto && create.mutate({ ...dto, submit: submitNow }, {
        onSuccess: (r) => { toast({ title: submitNow ? (r.status === "APPROVED" ? "Leave booked" : "Leave requested") : "Draft saved", description: `${formatNumber(r.total_days, 1)} day(s) of ${r.leave_type.name}` }); onOpenChange(false); },
        onError: (e) => toast({ variant: "destructive", title: "Could not request leave", description: getApiErrorMessage(e) }),
    });

    return (
        <Dialog open={open} onOpenChange={(o) => !create.isPending && onOpenChange(o)}>
            <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle>Request leave</DialogTitle>
                    <DialogDescription>Working days are counted from your schedule; public and company holidays are skipped.</DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5 sm:col-span-2">
                        <Label>Leave type</Label>
                        <Select value={typeId} onValueChange={setTypeId}>
                            <SelectTrigger aria-label="Leave type"><SelectValue placeholder={types.isLoading ? "Loading…" : "Pick a type"} /></SelectTrigger>
                            <SelectContent>{types.data?.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}{t.is_paid ? "" : " (unpaid)"}</SelectItem>)}</SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-1.5"><Label htmlFor="lv-start">From</Label><Input id="lv-start" type="date" value={start} onChange={(e) => { setStart(e.target.value); if (e.target.value > end) setEnd(e.target.value); }} /></div>
                    <div className="space-y-1.5"><Label htmlFor="lv-end">To</Label><Input id="lv-end" type="date" min={start} value={end} onChange={(e) => setEnd(e.target.value)} /></div>
                    {type?.allows_half_day && (
                        <>
                            <div className="space-y-1.5">
                                <Label>{sameDay ? "Day part" : "First day"}</Label>
                                <Select value={startPart} onValueChange={(v) => setStartPart(v as LeaveDayPart)}>
                                    <SelectTrigger aria-label="First day part"><SelectValue /></SelectTrigger>
                                    <SelectContent>{LeaveDayPartFormOptions.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent>
                                </Select>
                            </div>
                            {!sameDay && (
                                <div className="space-y-1.5">
                                    <Label>Last day</Label>
                                    <Select value={endPart} onValueChange={(v) => setEndPart(v as LeaveDayPart)}>
                                        <SelectTrigger aria-label="Last day part"><SelectValue /></SelectTrigger>
                                        <SelectContent>{LeaveDayPartFormOptions.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent>
                                    </Select>
                                </div>
                            )}
                        </>
                    )}
                    <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="lv-reason">Note for your approver</Label><Textarea id="lv-reason" rows={2} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={2000} /></div>
                </div>

                <div className="rounded-md border border-border bg-secondary/40 p-3 text-[13px]" aria-live="polite">
                    {!dto ? <span className="text-muted-foreground">Pick a type and dates.</span> : preview.isFetching && !preview.data ? <Skeleton className="h-10 w-full" /> : preview.error ? (
                        <span className="flex items-start gap-2 text-danger"><AlertTriangle className="mt-0.5 size-4 shrink-0" />{getApiErrorMessage(preview.error)}</span>
                    ) : preview.data ? (
                        <div className="space-y-1.5">
                            <div className="flex items-center gap-2 text-foreground"><CalendarCheck className="size-4 text-info" /><b className="tabular">{formatNumber(preview.data.total_days, 1)}</b> working day(s){preview.data.holidays.length ? <span className="text-muted-foreground"> · {preview.data.holidays.length} holiday(s) skipped</span> : null}</div>
                            {preview.data.balance && <div className="text-muted-foreground tabular">Balance {formatNumber(preview.data.balance.available, 1)} → <span className={preview.data.balance.after < 0 ? "text-danger" : "text-foreground"}>{formatNumber(preview.data.balance.after, 1)}</span> days</div>}
                            {!!preview.data.conflicts.length && <div className="text-warning">Also away: {preview.data.conflicts.map((c) => c.name).join(", ")}</div>}
                            {preview.data.warnings.map((w) => <div key={w} className="flex items-start gap-1.5 text-warning"><AlertTriangle className="mt-0.5 size-3.5 shrink-0" />{w}</div>)}
                        </div>
                    ) : null}
                </div>

                <DialogFooter>
                    <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={create.isPending}>Cancel</Button>
                    <Button variant="outline" disabled={!dto || create.isPending} onClick={() => submit(false)}>Save draft</Button>
                    <Button disabled={!dto || !!preview.error} loading={create.isPending} onClick={() => submit(true)}>Submit request</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
