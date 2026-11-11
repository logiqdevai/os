import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { addDays, format, parseISO } from "date-fns";
import { ChevronLeft, ChevronRight, Lock, Plus, Save, Send } from "lucide-react";
import { Page, PageHeader } from "@/components/ui/page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ErrorState, ListSkeleton } from "@/components/ui/states";
import { usePermissions } from "@/hooks/use-permission";
import { useWeek, useSubmitTimesheet } from "@/features/time/timesheets/hooks/use-timesheets";
import { useSaveWeekGrid } from "@/features/time/entries/hooks/use-time-entries";
import type { TimeEntry } from "@/features/time/entries/interfaces/time-entries.interfaces";
import { TimesheetStatusFormOptions, TimesheetStatusTone } from "@/config/constants/dropdowns/time/time-form.options";
import { getDropdownOptionLabel } from "@/lib/dropdown-option-label.utils";
import { formatMinutes } from "@/lib/format";
import { toast } from "@/hooks/use-toast";
import { getApiErrorMessage } from "@/lib/api-error";
import { cn } from "@/lib/utils";
import { TimerWidget } from "../../components/timer-widget";
import { EntryFormDialog } from "../../components/entry-form-dialog";
import { ActivitySelect, ProjectSelect, TaskSelect, parseDuration, toClock } from "../../components/pickers";

interface GridRow {
    key: string;
    project_id: string | null;
    task_id: string | null;
    activity_type_id: string | null;
    is_billable: boolean;
    label: string;
    sublabel: string | null;
    /** date → entries */
    cells: Record<string, TimeEntry[]>;
}

const LOCKED: TimeEntry["status"][] = ["SUBMITTED", "APPROVED", "INVOICED", "LOCKED"];
const rowKey = (r: { project_id: string | null; task_id: string | null; activity_type_id: string | null; is_billable: boolean }) => `${r.project_id ?? "-"}|${r.task_id ?? "-"}|${r.activity_type_id ?? "-"}|${r.is_billable ? 1 : 0}`;

/**
 * /time — my week: grid of project/task/activity rows × 7 days with inline hours, timer, submit for approval.
 * Below md the grid collapses to a day list. @perm time.entries.read_own · edit update_own/create_own · submit time.timesheets.submit_own
 * @api GET /time/timesheets/current · PUT /time/entries/bulk · POST /time/timesheets/submit
 */
export default function MyWeekPage() {
    const p = usePermissions();
    const [sp, setSp] = useSearchParams();
    const week = useWeek({ period_start: sp.get("start") ?? undefined });
    const save = useSaveWeekGrid();
    const submit = useSubmitTimesheet();
    const [edits, setEdits] = useState<Record<string, Record<string, string>>>({});
    const [extraRows, setExtraRows] = useState<GridRow[]>([]);
    const [adding, setAdding] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [entryDialog, setEntryDialog] = useState<{ entry?: TimeEntry; date?: string } | null>(null);
    const d = week.data;

    useEffect(() => { setEdits({}); setExtraRows([]); }, [d?.period_start]);

    const days = useMemo(() => (d ? Array.from({ length: 7 }, (_, i) => format(addDays(parseISO(d.period_start), i), "yyyy-MM-dd")) : []), [d?.period_start]); // eslint-disable-line react-hooks/exhaustive-deps
    const rows = useMemo<GridRow[]>(() => {
        const map = new Map<string, GridRow>();
        for (const e of d?.entries ?? []) {
            const k = rowKey(e);
            if (!map.has(k)) map.set(k, { key: k, project_id: e.project_id, task_id: e.task_id, activity_type_id: e.activity_type_id, is_billable: e.is_billable, label: e.project?.name ?? "Internal", sublabel: [e.task?.title, e.activity_type?.name].filter(Boolean).join(" · ") || null, cells: {} });
            const row = map.get(k)!;
            const day = e.date.slice(0, 10);
            (row.cells[day] ??= []).push(e);
        }
        for (const r of extraRows) if (!map.has(r.key)) map.set(r.key, r);
        return [...map.values()];
    }, [d?.entries, extraRows]);

    const status = d?.timesheet?.status ?? "OPEN";
    const weekLocked = ["SUBMITTED", "APPROVED", "LOCKED"].includes(status);
    const canEdit = p.can("time.entries.update_own") && p.can("time.entries.create_own") && !weekLocked;
    const cellMinutes = (r: GridRow, day: string) => {
        const edit = edits[r.key]?.[day];
        if (edit !== undefined) return parseDuration(edit) ?? 0;
        return (r.cells[day] ?? []).reduce((s, e) => s + e.duration_minutes, 0);
    };
    const dayTotal = (day: string) => rows.reduce((s, r) => s + cellMinutes(r, day), 0);
    const weekTotal = days.reduce((s, day) => s + dayTotal(day), 0);
    const dirty = Object.keys(edits).length > 0;
    const invalid = Object.values(edits).some((r) => Object.values(r).some((v) => parseDuration(v) === null));
    const maxPerDay = d?.rules.max_hours_per_day ? Number(d.rules.max_hours_per_day) * 60 : null;

    const go = (n: number) => d && setSp((prev) => { const next = new URLSearchParams(prev); next.set("start", format(addDays(parseISO(d.period_start), n * 7), "yyyy-MM-dd")); return next; });
    const saveGrid = () => {
        if (!d) return;
        const payload = rows.filter((r) => edits[r.key]).map((r) => ({
            project_id: r.project_id, task_id: r.task_id, activity_type_id: r.activity_type_id, is_billable: r.is_billable,
            days: Object.fromEntries(Object.keys(edits[r.key]).map((day) => [day, cellMinutes(r, day)])),
        }));
        save.mutate({ period_start: d.period_start, rows: payload }, {
            onSuccess: (res) => {
                setEdits({});
                setExtraRows([]);
                const problems = res.errors.length + res.skipped.length;
                toast({ variant: problems ? "destructive" : "default", title: problems ? "Saved with problems" : "Week saved", description: problems ? [...res.errors.map((e) => `${e.date}: ${e.message}`), ...res.skipped.map((s) => `${s.date}: ${s.reason.replace(/_/g, " ")}`)].join(" · ") : `${res.created} added · ${res.updated} changed · ${res.deleted} removed` });
            },
            onError: (e) => toast({ variant: "destructive", title: "Could not save", description: getApiErrorMessage(e) }),
        });
    };

    return (
        <Page>
            <PageHeader
                title="My timesheet"
                meta={d && <Badge variant={TimesheetStatusTone[status]}>{getDropdownOptionLabel(TimesheetStatusFormOptions, status)}</Badge>}
                description={d ? `${format(parseISO(d.period_start), "d MMM")} – ${format(parseISO(d.period_end), "d MMM yyyy")} · ${formatMinutes(weekTotal)} of ${formatMinutes(d.expected_minutes)} expected` : undefined}
                actions={
                    <>
                        <div className="flex items-center gap-1">
                            <Button variant="outline" size="icon" aria-label="Previous week" onClick={() => go(-1)}><ChevronLeft /></Button>
                            <Button variant="outline" onClick={() => setSp(new URLSearchParams())}>This week</Button>
                            <Button variant="outline" size="icon" aria-label="Next week" onClick={() => go(1)}><ChevronRight /></Button>
                        </div>
                        {p.can("time.entries.create_own") && <Button variant="outline" onClick={() => setEntryDialog({})}><Plus /> Log time</Button>}
                        {dirty && <Button loading={save.isPending} disabled={invalid} onClick={saveGrid}><Save /> Save</Button>}
                        {!dirty && p.can("time.timesheets.submit_own") && ["OPEN", "REJECTED"].includes(status) && d?.rules.require_approval && (
                            <Button disabled={!weekTotal} onClick={() => setSubmitting(true)}><Send /> Submit week</Button>
                        )}
                    </>
                }
            />
            <div className="space-y-4">
                <TimerWidget canStart={p.can("time.entries.create_own")} />
                {d?.timesheet?.status === "REJECTED" && d.timesheet.rejection_comment && (
                    <div className="rounded-lg border border-danger/40 bg-danger-soft p-3 text-[13px] text-danger">Returned: {d.timesheet.rejection_comment}</div>
                )}
                {week.isLoading ? <ListSkeleton /> : week.error ? <ErrorState error={week.error} onRetry={() => week.refetch()} /> : d && (
                    <>
                        {/* Desktop grid */}
                        <div className="hidden overflow-hidden rounded-lg border border-border bg-card md:block">
                            <div className="overflow-x-auto">
                                <table className="w-full text-[13px]">
                                    <thead>
                                        <tr className="border-b border-border text-xs text-muted-foreground">
                                            <th className="px-3 py-2 text-left font-medium">Project · task · activity</th>
                                            {days.map((day) => (
                                                <th key={day} className={cn("w-20 px-1 py-2 text-center font-medium", day === format(new Date(), "yyyy-MM-dd") && "text-foreground")}>
                                                    <div>{format(parseISO(day), "EEE")}</div><div className="tabular">{format(parseISO(day), "d")}</div>
                                                </th>
                                            ))}
                                            <th className="w-20 px-3 py-2 text-right font-medium">Total</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {!rows.length && (
                                            <tr><td colSpan={9} className="px-3 py-10 text-center text-muted-foreground">Nothing logged this week. Start the timer, log time or add a row.</td></tr>
                                        )}
                                        {rows.map((r) => {
                                            const total = days.reduce((s, day) => s + cellMinutes(r, day), 0);
                                            return (
                                                <tr key={r.key} className="border-b border-border">
                                                    <td className="max-w-64 px-3 py-1.5">
                                                        <div className="flex items-center gap-1.5"><span className="truncate font-medium text-foreground">{r.label}</span>{!r.is_billable && <Badge variant="secondary">Non-billable</Badge>}</div>
                                                        {r.sublabel && <div className="truncate text-xs text-muted-foreground">{r.sublabel}</div>}
                                                    </td>
                                                    {days.map((day) => {
                                                        const entries = r.cells[day] ?? [];
                                                        const locked = entries.some((e) => e.is_locked || LOCKED.includes(e.status));
                                                        const multi = entries.length > 1;
                                                        const readOnly = !canEdit || locked || multi || (!d.rules.allow_future_entries && day > format(new Date(), "yyyy-MM-dd"));
                                                        const edit = edits[r.key]?.[day];
                                                        const bad = edit !== undefined && parseDuration(edit) === null;
                                                        return (
                                                            <td key={day} className="px-1 py-1.5 text-center">
                                                                {readOnly ? (
                                                                    <button type="button" className={cn("inline-flex h-8 w-full items-center justify-center gap-1 rounded-md tabular", entries.length ? "text-foreground hover:bg-secondary" : "text-ash")} disabled={!entries.length} onClick={() => entries[0] && setEntryDialog({ entry: entries[0] })} title={multi ? `${entries.length} entries` : locked ? "Locked" : undefined}>
                                                                        {toClock(cellMinutes(r, day)) || "–"}{locked && <Lock className="size-3 text-muted-foreground" />}
                                                                    </button>
                                                                ) : (
                                                                    <Input
                                                                        value={edit ?? toClock(cellMinutes(r, day))}
                                                                        onChange={(ev) => setEdits((prev) => ({ ...prev, [r.key]: { ...prev[r.key], [day]: ev.target.value } }))}
                                                                        className={cn("h-8 px-1 text-center tabular", bad && "border-danger")}
                                                                        aria-label={`${r.label} ${day}`}
                                                                        placeholder="–"
                                                                    />
                                                                )}
                                                            </td>
                                                        );
                                                    })}
                                                    <td className="px-3 py-1.5 text-right tabular font-medium text-foreground">{formatMinutes(total)}</td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                    <tfoot>
                                        <tr className="bg-secondary/50 text-xs">
                                            <td className="px-3 py-2">
                                                {canEdit && <Button size="sm" variant="ghost" onClick={() => setAdding(true)}><Plus /> Add row</Button>}
                                            </td>
                                            {days.map((day) => {
                                                const t = dayTotal(day);
                                                return <td key={day} className={cn("px-1 py-2 text-center tabular font-medium", maxPerDay && t > maxPerDay ? "text-danger" : "text-foreground")}>{t ? formatMinutes(t) : ""}</td>;
                                            })}
                                            <td className="px-3 py-2 text-right tabular font-semibold text-foreground">{formatMinutes(weekTotal)}</td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>
                        </div>
                        {/* Mobile day list */}
                        <div className="space-y-3 md:hidden">
                            {days.map((day) => {
                                const entries = (d.entries ?? []).filter((e) => e.date.slice(0, 10) === day);
                                return (
                                    <div key={day} className="rounded-lg border border-border bg-card">
                                        <div className="flex items-center justify-between border-b border-border px-3 py-2">
                                            <span className="text-[13px] font-medium text-foreground">{format(parseISO(day), "EEEE d MMM")}</span>
                                            <span className="flex items-center gap-2 text-xs tabular text-muted-foreground">{formatMinutes(dayTotal(day))}
                                                {canEdit && <Button size="icon-sm" variant="ghost" aria-label={`Log time on ${day}`} onClick={() => setEntryDialog({ date: day })}><Plus /></Button>}
                                            </span>
                                        </div>
                                        {entries.length ? (
                                            <ul className="divide-y divide-border">
                                                {entries.map((e) => (
                                                    <li key={e.id}>
                                                        <button type="button" className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left" onClick={() => setEntryDialog({ entry: e })}>
                                                            <span className="min-w-0"><span className="block truncate text-[13px] text-foreground">{e.project?.name ?? "Internal"}</span><span className="block truncate text-xs text-muted-foreground">{e.description ?? e.task?.title ?? e.activity_type?.name ?? ""}</span></span>
                                                            <span className="flex shrink-0 items-center gap-1 tabular text-[13px] text-foreground">{formatMinutes(e.duration_minutes)}{(e.is_locked || LOCKED.includes(e.status)) && <Lock className="size-3 text-muted-foreground" />}</span>
                                                        </button>
                                                    </li>
                                                ))}
                                            </ul>
                                        ) : <p className="px-3 py-3 text-xs text-ash">Nothing logged</p>}
                                    </div>
                                );
                            })}
                        </div>
                    </>
                )}
            </div>
            <AddRowDialog open={adding} onOpenChange={setAdding} onAdd={(r) => setExtraRows((prev) => [...prev, r])} />
            <SubmitDialog open={submitting} onOpenChange={setSubmitting} total={weekTotal} loading={submit.isPending} onSubmit={(comment) => d && submit.mutate({ period_start: d.period_start, comment }, {
                onSuccess: () => { toast({ title: "Week submitted for approval" }); setSubmitting(false); },
                onError: (e) => toast({ variant: "destructive", title: "Could not submit", description: getApiErrorMessage(e) }),
            })} />
            <EntryFormDialog open={!!entryDialog} onOpenChange={(o) => !o && setEntryDialog(null)} entry={entryDialog?.entry} defaultDate={entryDialog?.date} />
        </Page>
    );
}

function AddRowDialog({ open, onOpenChange, onAdd }: { open: boolean; onOpenChange: (o: boolean) => void; onAdd: (r: GridRow) => void }) {
    const [projectId, setProjectId] = useState<string | null>(null);
    const [taskId, setTaskId] = useState<string | null>(null);
    const [activityId, setActivityId] = useState<string | null>(null);
    const [billable, setBillable] = useState(true);
    useEffect(() => { if (open) { setProjectId(null); setTaskId(null); setActivityId(null); setBillable(true); } }, [open]);
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader><DialogTitle>Add a row</DialogTitle><DialogDescription>Then type hours into the day cells and save.</DialogDescription></DialogHeader>
                <div className="space-y-4">
                    <div className="space-y-1.5"><Label>Project</Label><ProjectSelect value={projectId} onChange={(v) => { setProjectId(v); setTaskId(null); }} /></div>
                    <div className="space-y-1.5"><Label>Task</Label><TaskSelect projectId={projectId} value={taskId} onChange={setTaskId} /></div>
                    <div className="space-y-1.5"><Label>Activity</Label><ActivitySelect value={activityId} onChange={setActivityId} /></div>
                    <div className="flex items-center justify-between rounded-md border border-border p-3"><Label htmlFor="row-bill" className="m-0">Billable</Label><Switch id="row-bill" checked={billable} onCheckedChange={setBillable} /></div>
                </div>
                <DialogFooter>
                    <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
                    <Button onClick={() => {
                        const r = { project_id: projectId, task_id: taskId, activity_type_id: activityId, is_billable: billable };
                        onAdd({ ...r, key: rowKey(r), label: projectId ? "New row" : "Internal", sublabel: null, cells: {} });
                        onOpenChange(false);
                    }}>Add row</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

function SubmitDialog({ open, onOpenChange, total, loading, onSubmit }: { open: boolean; onOpenChange: (o: boolean) => void; total: number; loading: boolean; onSubmit: (comment?: string) => void }) {
    const [comment, setComment] = useState("");
    return (
        <Dialog open={open} onOpenChange={(o) => !loading && onOpenChange(o)}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader><DialogTitle>Submit this week?</DialogTitle><DialogDescription>{formatMinutes(total)} goes to your approver. Entries can't be edited while submitted.</DialogDescription></DialogHeader>
                <div className="space-y-1.5"><Label htmlFor="sub-comment">Comment (optional)</Label><Textarea id="sub-comment" rows={2} value={comment} onChange={(e) => setComment(e.target.value)} /></div>
                <DialogFooter>
                    <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
                    <Button loading={loading} onClick={() => onSubmit(comment || undefined)}><Send /> Submit</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

