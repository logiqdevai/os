import { useEffect, useState } from "react";
import { Coffee, LogIn, LogOut, Timer } from "lucide-react";
import { Page, PageHeader } from "@/components/ui/page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatCard, StatGrid } from "@/components/ui/stat-card";
import { Progress } from "@/components/ui/progress";
import { EmptyState, ErrorState, ListSkeleton } from "@/components/ui/states";
import { usePermissions } from "@/hooks/use-permission";
import { useAttendanceBoard, useClockIn, useClockOut, useEndBreak, useMyAttendance, useStartBreak } from "@/features/people/attendance/hooks/use-attendance";
import type { MyAttendance } from "@/features/people/attendance/interfaces/attendance.interfaces";
import type { WorkLocation } from "@/features/people/employees/interfaces/employees.interfaces";
import { AttendanceStateOptions, AttendanceStateTone } from "@/config/constants/dropdowns/people/leave-form.options";
import { WorkLocationFormOptions } from "@/config/constants/dropdowns/people/employee-form.options";
import { getDropdownOptionLabel } from "@/lib/dropdown-option-label.utils";
import { formatDate, formatMinutes } from "@/lib/format";
import { toast } from "@/hooks/use-toast";
import { getApiErrorMessage } from "@/lib/api-error";
import { cn } from "@/lib/utils";
import { Panel, PersonCell } from "../../components/person";
import { PeoplePaths } from "../../paths";

const time = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—");

/**
 * /people/attendance — my clock card (record_own) and who is in today (read_all, scoped). Presence only; work effort is Time.
 * @api GET /people/attendance/me · POST clock-in|clock-out|break/start|break/end · GET /people/attendance/board
 */
export default function AttendancePage() {
    const p = usePermissions();
    const canOwn = p.canAny("employees.attendance.read_own", "employees.attendance.record_own");
    const canAll = p.can("employees.attendance.read_all");
    return (
        <Page>
            <PageHeader title="Attendance" description="Clock in and out, and see who is working today." />
            <div className="space-y-6">
                {canOwn && <ClockCard canRecord={p.can("employees.attendance.record_own")} />}
                {canAll && <TeamBoard />}
            </div>
        </Page>
    );
}

function useElapsed(since: string | null | undefined) {
    const [now, setNow] = useState(Date.now());
    useEffect(() => {
        if (!since) return;
        const t = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(t);
    }, [since]);
    if (!since) return null;
    const s = Math.max(0, Math.floor((now - new Date(since).getTime()) / 1000));
    return `${String(Math.floor(s / 3600)).padStart(2, "0")}:${String(Math.floor((s % 3600) / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

function ClockCard({ canRecord }: { canRecord: boolean }) {
    const q = useMyAttendance();
    const clockIn = useClockIn();
    const clockOut = useClockOut();
    const startBreak = useStartBreak();
    const endBreak = useEndBreak();
    const [location, setLocation] = useState<WorkLocation>("OFFICE");
    const elapsed = useElapsed(q.data?.open_break?.started_at ?? q.data?.open_session?.clock_in_at);
    const opts = (title: string) => ({ onSuccess: () => toast({ title }), onError: (e: unknown) => toast({ variant: "destructive", title: "Could not update", description: getApiErrorMessage(e) }) });
    const busy = clockIn.isPending || clockOut.isPending || startBreak.isPending || endBreak.isPending;

    if (q.isLoading) return <ListSkeleton rows={3} />;
    if (q.error) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
    const d = q.data as MyAttendance;
    const onBreak = !!d.open_break;
    const clockedIn = !!d.open_session;

    return (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
            <Panel title="My clock card">
                <div className="flex flex-col items-center gap-3 py-2 text-center">
                    <Badge variant={onBreak ? "warning" : clockedIn ? "success" : "neutral"} dot>{onBreak ? "On break" : clockedIn ? "Clocked in" : "Not clocked in"}</Badge>
                    <div className="font-mono text-4xl tabular text-foreground" aria-live="polite">{elapsed ?? "00:00:00"}</div>
                    <div className="text-xs text-muted-foreground">
                        {clockedIn ? `Since ${time(d.open_session?.clock_in_at)} · ${getDropdownOptionLabel(WorkLocationFormOptions, d.open_session!.work_location)}` : d.today ? `Today ${formatMinutes(d.today.worked_minutes)} worked` : "Nothing recorded today"}
                    </div>
                    {canRecord && (
                        <div className="flex w-full flex-col gap-2 sm:flex-row sm:justify-center">
                            {!clockedIn ? (
                                <>
                                    <Select value={location} onValueChange={(v) => setLocation(v as WorkLocation)}>
                                        <SelectTrigger className="sm:w-40" aria-label="Work location"><SelectValue /></SelectTrigger>
                                        <SelectContent>{WorkLocationFormOptions.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent>
                                    </Select>
                                    <Button loading={clockIn.isPending} disabled={busy} onClick={() => clockIn.mutate({ work_location: location }, opts("Clocked in"))}><LogIn /> Clock in</Button>
                                </>
                            ) : (
                                <>
                                    {onBreak
                                        ? <Button variant="outline" loading={endBreak.isPending} disabled={busy} onClick={() => endBreak.mutate(undefined, opts("Break ended"))}><Coffee /> End break</Button>
                                        : <Button variant="outline" loading={startBreak.isPending} disabled={busy} onClick={() => startBreak.mutate(undefined, opts("Break started"))}><Coffee /> Start break</Button>}
                                    <Button variant="destructive" loading={clockOut.isPending} disabled={busy} onClick={() => clockOut.mutate({}, opts("Clocked out"))}><LogOut /> Clock out</Button>
                                </>
                            )}
                        </div>
                    )}
                </div>
            </Panel>
            <Panel title="This week">
                <ul className="divide-y divide-border">
                    {d.week.map((day) => {
                        const r = day.record;
                        const pct = day.scheduled_hours ? Math.min(100, ((r?.worked_minutes ?? 0) / 60 / day.scheduled_hours) * 100) : 0;
                        return (
                            <li key={day.date} className="grid grid-cols-[4.5rem_1fr_auto] items-center gap-3 py-2 text-[13px] first:pt-0 last:pb-0">
                                <span className="text-muted-foreground">{formatDate(day.date, "EEE d")}</span>
                                <div className="min-w-0">
                                    {day.holiday ? <span className="text-xs text-muted-foreground">{day.holiday}</span> : (
                                        <Progress value={pct} className="h-1.5" />
                                    )}
                                    {r && <div className="mt-1 truncate text-xs text-muted-foreground tabular">{time(r.first_clock_in_at)} – {r.last_clock_out_at ? time(r.last_clock_out_at) : "…"}{r.late_minutes ? ` · ${r.late_minutes}m late` : ""}</div>}
                                </div>
                                <span className="tabular text-foreground">{r ? formatMinutes(r.worked_minutes) : day.scheduled_hours ? <span className="text-ash">0h / {day.scheduled_hours}h</span> : <span className="text-ash">Off</span>}</span>
                            </li>
                        );
                    })}
                </ul>
            </Panel>
        </div>
    );
}

function TeamBoard() {
    const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
    const q = useAttendanceBoard({ date });
    return (
        <section className="space-y-3">
            <div className="flex flex-wrap items-end justify-between gap-2">
                <h2 className="text-[15px] font-medium text-foreground">Who is in</h2>
                <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-8 w-full sm:w-44" aria-label="Day" />
            </div>
            {q.isLoading ? <ListSkeleton /> : q.error ? <ErrorState error={q.error} onRetry={() => q.refetch()} /> : !q.data?.rows.length ? (
                <EmptyState icon={Timer} title="No employees in your scope" />
            ) : (
                <>
                    <StatGrid>
                        <StatCard label="Clocked in" value={q.data.summary.clocked_in} tone="success" />
                        <StatCard label="Clocked out" value={q.data.summary.clocked_out} />
                        <StatCard label="On leave" value={q.data.summary.on_leave} tone="info" />
                        <StatCard label="Late" value={q.data.summary.late} tone={q.data.summary.late ? "warning" : "default"} />
                    </StatGrid>
                    <div className="overflow-hidden rounded-lg border border-border bg-card">
                        <ul className="divide-y divide-border">
                            {q.data.rows.map((r) => (
                                <li key={r.employee.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5">
                                    <PersonCell name={r.employee.name} photoUrl={r.employee.photo_url} subtitle={r.employee.job_title ?? r.employee.department?.name} to={PeoplePaths.employee(r.employee.id, "attendance")} className="min-w-0 flex-1" />
                                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                                        {r.record && <span className="tabular">{time(r.record.first_clock_in_at)}{r.record.last_clock_out_at && r.state === "CLOCKED_OUT" ? ` – ${time(r.record.last_clock_out_at)}` : ""} · {formatMinutes(r.record.worked_minutes)}</span>}
                                        {r.leave && <span>{r.leave}</span>}
                                        {!!r.record?.late_minutes && <Badge variant="warning">{r.record.late_minutes}m late</Badge>}
                                        <Badge variant={AttendanceStateTone[r.state]} className={cn(r.state === "CLOCKED_IN" && "font-semibold")}>{getDropdownOptionLabel(AttendanceStateOptions, r.state)}</Badge>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    </div>
                </>
            )}
        </section>
    );
}
