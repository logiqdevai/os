import { useEffect, useMemo, useState } from "react";
import { CalendarClock, Download, MoreHorizontal, Pencil, Play, Plus, Trash2 } from "lucide-react";
import { Page, PageHeader } from "@/components/ui/page";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import ConfirmationDialog from "@/components/ui/confirmation-dialog";
import { usePermissions } from "@/hooks/use-permission";
import { useCreateSchedule, useDeleteSchedule, useDownloadExport, useRunSchedule, useScheduleReports, useSchedules, useUpdateSchedule } from "@/features/time/schedules/hooks/use-schedules";
import { useTimeMembers } from "@/features/time/settings/hooks/use-time-settings";
import type { ReportScheduleDto, TimeReportFrequency, TimeReportSchedule } from "@/features/time/schedules/interfaces/schedules.interfaces";
import { IsoWeekdayOptions, ReportFrequencyFormOptions, TimeScopeOptions } from "@/config/constants/dropdowns/time/time-form.options";
import { getDropdownOptionLabel } from "@/lib/dropdown-option-label.utils";
import { formatDateTime, personName } from "@/lib/format";
import { toast } from "@/hooks/use-toast";
import { useAutosave } from "@/hooks/use-autosave";
import { SaveStatus } from "@/components/ui/save-status";
import { ProjectSelect } from "../../components/pickers";

/**
 * /time/schedules — e-mailed time reports on a schedule. A schedule runs as its creator with their scope at send time;
 * members get an in-app notification and an e-mail, external addresses an e-mail (via the org's e-mail provider).
 * @perm time.reports.read + time.entries.export (scope all: time.entries.read_all) · @api /time/report-schedules · GET /time/exports/:id/download
 */
export default function SchedulesPage() {
    const q = useSchedules();
    const reports = useScheduleReports();
    const run = useRunSchedule();
    const remove = useDeleteSchedule();
    const update = useUpdateSchedule();
    const download = useDownloadExport();
    const [editing, setEditing] = useState<TimeReportSchedule | "new" | null>(null);
    const [deleting, setDeleting] = useState<TimeReportSchedule | null>(null);
    const when = (s: TimeReportSchedule) => `${getDropdownOptionLabel(ReportFrequencyFormOptions, s.frequency).split(" (")[0]}${s.frequency === "WEEKLY" ? ` · ${getDropdownOptionLabel(IsoWeekdayOptions, String(s.day_of_week))}` : s.frequency === "MONTHLY" ? ` · day ${s.day_of_month}` : ""} · ${s.time_of_day}`;

    const columns: DataTableColumn<TimeReportSchedule>[] = [
        { key: "name", header: "Report", cell: (s) => <div className="min-w-0"><div className="truncate font-medium text-foreground">{s.name}</div><div className="truncate text-xs text-muted-foreground">{reports.data?.find((r) => r.key === s.report_key)?.label ?? s.report_key} · {when(s)}</div></div> },
        { key: "recipients", header: "Recipients", cell: (s) => <span className="text-[13px] tabular">{s.recipient_membership_ids.length + s.recipient_emails.length}</span>, hideBelow: "md" },
        { key: "next", header: "Next run", cell: (s) => <span className="tabular">{s.is_active && s.next_run_at ? formatDateTime(s.next_run_at) : "—"}</span>, hideBelow: "sm" },
        { key: "last", header: "Last run", cell: (s) => <div><span className="tabular">{s.last_run_at ? formatDateTime(s.last_run_at) : "Never"}</span>{s.last_error && <div className="line-clamp-1 text-xs text-danger">{s.last_error}</div>}</div>, hideBelow: "lg" },
        { key: "status", header: "Status", cell: (s) => <Switch checked={s.is_active} aria-label={s.is_active ? "Pause" : "Resume"} onCheckedChange={(v) => update.mutate({ id: s.id, is_active: v })} /> },
        {
            key: "actions", header: <span className="sr-only">Actions</span>, className: "w-12",
            cell: (s) => (
                <DropdownMenu>
                    <DropdownMenuTrigger asChild><Button size="icon" variant="ghost" aria-label={`Actions for ${s.name}`}><MoreHorizontal /></Button></DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        <DropdownMenuItem onSelect={() => setEditing(s)}><Pencil /> Edit</DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => run.mutate(s.id, {
                            // Success shows in the "Last run" column; only a delivery problem is worth a toast.
                            onSuccess: (r) => { if (r.error) toast({ variant: "destructive", title: "The report was not delivered", description: r.error }); },
                        })}><Play /> Send now</DropdownMenuItem>
                        {s.exports[0] && <DropdownMenuItem onSelect={() => download.mutate(s.exports[0].id)}><Download /> Download last CSV</DropdownMenuItem>}
                        <DropdownMenuItem className="text-danger focus:text-danger" onSelect={() => setDeleting(s)}><Trash2 /> Delete</DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            ),
        },
    ];
    return (
        <Page>
            <PageHeader title="Scheduled reports" description="Time reports sent by e-mail on a schedule." actions={<Button onClick={() => setEditing("new")}><Plus /> New schedule</Button>} />
            <DataTable columns={columns} data={q.data} rowKey={(s) => s.id} loading={q.isFetching} error={q.error} onRetry={() => q.refetch()} onRowClick={setEditing}
                empty={{ icon: CalendarClock, title: "No scheduled reports", description: "Send hours by project, customer or person to your team or clients every day, week or month." }} />
            <ScheduleDialog value={editing} reports={reports.data ?? []} onClose={() => setEditing(null)} />
            <ConfirmationDialog isOpen={!!deleting} onClose={() => setDeleting(null)} title={`Delete ${deleting?.name ?? "schedule"}?`} description="Past exports stay in the export history." confirmText="Delete" variant="destructive"
                onConfirm={() => { if (deleting) remove.mutate(deleting.id); setDeleting(null); }} />
        </Page>
    );
}

const tz = () => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"; } catch { return "UTC"; } };
const EMPTY = (): ReportScheduleDto => ({ name: "", report_key: "hours_by_project", filters: { scope: "team" }, frequency: "WEEKLY", day_of_week: 1, day_of_month: 1, time_of_day: "08:00", timezone: tz(), recipient_membership_ids: [], recipient_emails: [], is_active: true });

/** New schedule (explicit "Create schedule") or edit one (autosaves valid changes; "Done" closes). */
function ScheduleDialog({ value, reports, onClose }: { value: TimeReportSchedule | "new" | null; reports: { key: string; label: string }[]; onClose: () => void }) {
    const p = usePermissions();
    const members = useTimeMembers("all", !!value);
    const create = useCreateSchedule();
    const update = useUpdateSchedule({ inline: true });
    const [dirty, setDirty] = useState(false);
    const [f, setF] = useState<ReportScheduleDto>(EMPTY);
    const [emails, setEmails] = useState("");
    const [search, setSearch] = useState("");
    useEffect(() => {
        if (!value) return;
        if (value === "new") { setF(EMPTY()); setEmails(""); return; }
        setF({ name: value.name, report_key: value.report_key, filters: value.filters ?? {}, frequency: value.frequency, day_of_week: value.day_of_week ?? 1, day_of_month: value.day_of_month ?? 1, time_of_day: value.time_of_day, timezone: value.timezone, recipient_membership_ids: value.recipient_membership_ids, recipient_emails: value.recipient_emails, is_active: value.is_active });
        setEmails(value.recipient_emails.join(", "));
    }, [value]);
    useEffect(() => setDirty(false), [value]);
    const set = <K extends keyof ReportScheduleDto>(k: K, v: ReportScheduleDto[K]) => { setDirty(true); setF((prev) => ({ ...prev, [k]: v })); };
    const list = useMemo(() => (members.data ?? []).filter((m) => !search || personName(m.user).toLowerCase().includes(search.toLowerCase())).slice(0, 40), [members.data, search]);
    const parsedEmails = emails.split(/[\s,;]+/).map((e) => e.trim()).filter(Boolean);
    const badEmail = parsedEmails.find((e) => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e));
    const scopes = TimeScopeOptions.filter((o) => o.id !== "all" || p.can("time.entries.read_all"));
    const pending = create.isPending;
    const valid = !!(f.name.trim() && !badEmail && (f.recipient_membership_ids.length || parsedEmails.length) && /^\d{2}:\d{2}$/.test(f.time_of_day));
    const dto: ReportScheduleDto = { ...f, name: f.name.trim(), recipient_emails: parsedEmails, ...(f.frequency !== "WEEKLY" && { day_of_week: undefined }), ...(f.frequency !== "MONTHLY" && { day_of_month: undefined }) };
    const existing = value && value !== "new" ? value : null;
    const autosave = useAutosave({ value: dto, enabled: !!existing && dirty && valid, save: (v) => update.mutateAsync({ id: existing!.id, ...v }) });
    const close = () => { if (existing && dirty && valid) autosave.flush(); onClose(); };
    const submit = () => {
        if (existing) return close();
        create.mutate(dto, { onSuccess: onClose });
    };
    return (
        <Dialog open={!!value} onOpenChange={(o) => !o && !pending && close()}>
            <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
                <DialogHeader><DialogTitle>{value === "new" ? "New scheduled report" : "Edit scheduled report"}</DialogTitle><DialogDescription>Runs as you: it contains only time you can see when it is sent.</DialogDescription>{existing && <SaveStatus state={autosave} />}</DialogHeader>
                <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="sc-name">Name</Label><Input id="sc-name" value={f.name} onChange={(e) => set("name", e.target.value)} placeholder="Weekly hours by project" /></div>
                    <div className="space-y-1.5"><Label>Report</Label>
                        <Select value={f.report_key} onValueChange={(v) => set("report_key", v)}><SelectTrigger aria-label="Report"><SelectValue /></SelectTrigger><SelectContent>{reports.map((r) => <SelectItem key={r.key} value={r.key}>{r.label}</SelectItem>)}</SelectContent></Select>
                    </div>
                    <div className="space-y-1.5"><Label>Whose time</Label>
                        <Select value={f.filters.scope ?? "team"} onValueChange={(v) => set("filters", { ...f.filters, scope: v as "mine" | "team" | "all" })}><SelectTrigger aria-label="Scope"><SelectValue /></SelectTrigger><SelectContent>{scopes.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent></Select>
                    </div>
                    <div className="space-y-1.5 sm:col-span-2"><Label>Project (optional)</Label><ProjectSelect value={f.filters.project_id ?? null} onChange={(v) => set("filters", { ...f.filters, project_id: v ?? undefined })} /></div>
                    <div className="space-y-1.5"><Label>Frequency</Label>
                        <Select value={f.frequency} onValueChange={(v) => set("frequency", v as TimeReportFrequency)}><SelectTrigger aria-label="Frequency"><SelectValue /></SelectTrigger><SelectContent>{ReportFrequencyFormOptions.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent></Select>
                    </div>
                    {f.frequency === "WEEKLY" && (
                        <div className="space-y-1.5"><Label>Day</Label>
                            <Select value={String(f.day_of_week ?? 1)} onValueChange={(v) => set("day_of_week", Number(v))}><SelectTrigger aria-label="Weekday"><SelectValue /></SelectTrigger><SelectContent>{IsoWeekdayOptions.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent></Select>
                        </div>
                    )}
                    {f.frequency === "MONTHLY" && <div className="space-y-1.5"><Label htmlFor="sc-dom">Day of month</Label><Input id="sc-dom" type="number" min={1} max={28} value={f.day_of_month ?? 1} onChange={(e) => set("day_of_month", Math.min(28, Math.max(1, Number(e.target.value) || 1)))} /></div>}
                    <div className="space-y-1.5"><Label htmlFor="sc-time">Time</Label><Input id="sc-time" type="time" value={f.time_of_day} onChange={(e) => set("time_of_day", e.target.value)} /></div>
                    <div className="space-y-1.5"><Label htmlFor="sc-tz">Time zone</Label><Input id="sc-tz" value={f.timezone} onChange={(e) => set("timezone", e.target.value)} /></div>
                    <div className="space-y-1.5 sm:col-span-2">
                        <Label htmlFor="sc-search">Team members ({f.recipient_membership_ids.length})</Label>
                        <Input id="sc-search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search people" />
                        <ul className="max-h-40 overflow-y-auto rounded-md border border-border">
                            {list.map((m) => (
                                <li key={m.id}>
                                    <label className="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-[13px] text-foreground hover:bg-accent">
                                        <Checkbox checked={f.recipient_membership_ids.includes(m.id)} onCheckedChange={(on) => set("recipient_membership_ids", on ? [...f.recipient_membership_ids, m.id] : f.recipient_membership_ids.filter((x) => x !== m.id))} />
                                        <span className="truncate">{personName(m.user)}</span><span className="truncate text-xs text-muted-foreground">{m.user.email}</span>
                                    </label>
                                </li>
                            ))}
                            {!list.length && <li className="px-3 py-2 text-xs text-muted-foreground">{members.isLoading ? "Loading…" : "No matches"}</li>}
                        </ul>
                    </div>
                    <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="sc-emails">Other e-mail addresses</Label><Input id="sc-emails" value={emails} onChange={(e) => { setDirty(true); setEmails(e.target.value); }} placeholder="client@example.com, pm@example.com" />{badEmail && <p className="text-xs text-danger">Not an e-mail address: {badEmail}</p>}</div>
                    <label className="flex items-center gap-2 text-[13px] text-foreground sm:col-span-2"><Switch checked={f.is_active} onCheckedChange={(v) => set("is_active", v)} /> Active</label>
                </div>
                <DialogFooter>
                    {existing ? (
                        <Button onClick={close}>Done</Button>
                    ) : (
                        <>
                            <Button variant="ghost" onClick={onClose}>Cancel</Button>
                            <Button disabled={!valid} loading={pending} onClick={submit}>Create schedule</Button>
                        </>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
