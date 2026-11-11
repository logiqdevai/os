import { Link } from "react-router-dom";
import { Cake, CalendarClock, Clock, Gift, Layers, Plane, Star, UserMinus, UserPlus, Users } from "lucide-react";
import { Page, PageHeader } from "@/components/ui/page";
import { StatCard, StatGrid } from "@/components/ui/stat-card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { ErrorState, PageSkeleton } from "@/components/ui/states";
import { usePeopleOverview } from "@/features/people/overview/hooks/use-overview";
import { EmploymentTypeFormOptions } from "@/config/constants/dropdowns/people/employee-form.options";
import { getDropdownOptionLabel } from "@/lib/dropdown-option-label.utils";
import { formatDate, formatMinutes, formatNumber } from "@/lib/format";
import { Panel, PersonCell, RestrictedCard } from "../../components/person";
import { PeoplePaths } from "../../paths";

/**
 * /people/dashboard — headcount, who is out, attendance, capacity, review progress. Blocks the caller may not read come
 * back null and render as Restricted. @api GET /people/reports/overview
 */
export default function PeopleDashboardPage() {
    const q = usePeopleOverview();
    if (q.isLoading) return <PageSkeleton />;
    if (q.error || !q.data) return <Page><PageHeader title="People" /><ErrorState error={q.error} onRetry={() => q.refetch()} /></Page>;
    const { headcount, leave, attendance, capacity, performance, celebrations } = q.data;
    const maxDept = Math.max(1, ...(headcount?.by_department.map((d) => d.count) ?? [1]));

    return (
        <Page>
            <PageHeader title="People" description="Your workforce at a glance." />
            <div className="space-y-4">
                <StatGrid>
                    {headcount ? <StatCard label="Active employees" value={headcount.active} icon={Users} hint={`${headcount.onboarding} onboarding · ${headcount.offboarding} offboarding`} /> : <RestrictedCard title="Headcount" permission="employees.employees.read" />}
                    {leave ? <StatCard label="Out today" value={leave.out_today.length} icon={Plane} tone="info" hint={`${leave.upcoming_14d} leave starts in 14 days`} /> : <RestrictedCard title="Leave" permission="employees.leave.read_all" />}
                    {leave && <StatCard label="Pending leave requests" value={leave.pending_requests} icon={CalendarClock} tone={leave.pending_requests ? "warning" : "default"} hint={<Link to={`${PeoplePaths.leave}?tab=approve`} className="hover:underline">Review requests</Link>} />}
                    {attendance ? <StatCard label="Clocked in now" value={attendance.clocked_in_now} icon={Clock} tone="success" hint={attendance.late_today ? `${attendance.late_today} late today` : "Nobody late today"} /> : <RestrictedCard title="Attendance" permission="employees.attendance.read_all" />}
                </StatGrid>
                <div className="grid gap-4 lg:grid-cols-3">
                    {headcount && (
                        <Panel title="Structure" className="lg:col-span-2">
                            <div className="grid gap-6 sm:grid-cols-2">
                                <div className="space-y-2">
                                    <div className="text-xs text-muted-foreground">By department</div>
                                    {headcount.by_department.length ? headcount.by_department.slice(0, 8).map((d) => (
                                        <div key={d.department?.id ?? "none"} className="space-y-1">
                                            <div className="flex justify-between text-[13px]"><span className="truncate text-foreground">{d.department?.name ?? "No department"}</span><span className="tabular text-muted-foreground">{d.count}</span></div>
                                            <Progress value={(d.count / maxDept) * 100} className="h-1.5" />
                                        </div>
                                    )) : <p className="text-[13px] text-muted-foreground">No employees yet.</p>}
                                </div>
                                <div className="space-y-3">
                                    <div className="text-xs text-muted-foreground">By employment type</div>
                                    <ul className="space-y-1.5 text-[13px]">
                                        {headcount.by_type.map((t) => <li key={t.type} className="flex justify-between"><span className="text-foreground">{getDropdownOptionLabel(EmploymentTypeFormOptions, t.type)}</span><span className="tabular text-muted-foreground">{t.count}</span></li>)}
                                    </ul>
                                    <div className="flex gap-4 pt-2 text-[13px]">
                                        <span className="flex items-center gap-1.5 text-success"><UserPlus className="size-4" />{headcount.hires_90d} hired</span>
                                        <span className="flex items-center gap-1.5 text-muted-foreground"><UserMinus className="size-4" />{headcount.leavers_90d} left</span>
                                        <span className="text-xs text-muted-foreground">last 90 days</span>
                                    </div>
                                </div>
                            </div>
                        </Panel>
                    )}
                    {leave && (
                        <Panel title="Out today" actions={<Link to={PeoplePaths.leaveCalendar} className="text-xs text-info hover:underline">Calendar</Link>}>
                            {leave.out_today.length ? (
                                <ul className="space-y-2.5">{leave.out_today.map((o) => <li key={o.request_id}><PersonCell name={o.name} photoUrl={o.photo_url} subtitle={`${o.leave_type.name} · until ${formatDate(o.until, "d MMM")}`} to={PeoplePaths.employee(o.employee_id)} /></li>)}</ul>
                            ) : <p className="text-[13px] text-muted-foreground">Everyone is in.</p>}
                        </Panel>
                    )}
                    {capacity ? (
                        <Panel title="Capacity this week" actions={<Link to={PeoplePaths.capacity} className="text-xs text-info hover:underline">Details</Link>}>
                            {!capacity.computed ? <p className="text-[13px] text-muted-foreground">Open Capacity to compute this week.</p> : (
                                <div className="space-y-3 text-[13px]">
                                    <div className="flex items-center gap-2"><Layers className="size-4 text-info" /><span className="text-2xl font-medium tabular text-foreground">{capacity.allocation_percent !== null ? `${formatNumber(capacity.allocation_percent)}%` : "—"}</span><span className="text-muted-foreground">allocated</span></div>
                                    <div className="text-muted-foreground tabular">{formatNumber(capacity.planned_hours)}h planned of {formatNumber(capacity.available_hours)}h available · {formatNumber(capacity.logged_hours)}h logged</div>
                                    <div className="flex gap-2"><Badge variant="danger">{capacity.overloaded} overloaded</Badge><Badge variant="info">{capacity.underutilized} underutilized</Badge></div>
                                </div>
                            )}
                        </Panel>
                    ) : <RestrictedCard title="Capacity" permission="employees.capacity.read" />}
                    {performance ? (
                        <Panel title="Review cycle" actions={<Link to={PeoplePaths.performance} className="text-xs text-info hover:underline">Open</Link>}>
                            {!performance.active_cycle ? <p className="text-[13px] text-muted-foreground">No active review cycle.</p> : (
                                <div className="space-y-2 text-[13px]">
                                    <div className="flex items-center gap-2 text-foreground"><Star className="size-4 text-warning" />{performance.active_cycle.name}</div>
                                    <Progress value={performance.active_cycle.total ? (performance.active_cycle.completed / performance.active_cycle.total) * 100 : 0} className="h-1.5" />
                                    <div className="text-xs text-muted-foreground tabular">{performance.active_cycle.completed} of {performance.active_cycle.total} completed{performance.active_cycle.due_date ? ` · due ${formatDate(performance.active_cycle.due_date)}` : ""}</div>
                                </div>
                            )}
                        </Panel>
                    ) : <RestrictedCard title="Performance" permission="employees.performance.read_all" />}
                    {attendance && (
                        <Panel title="Attendance · last 7 days">
                            <div className="space-y-1.5 text-[13px]">
                                <div className="flex justify-between"><span className="text-muted-foreground">Worked</span><span className="tabular text-foreground">{formatMinutes(attendance.worked_minutes_7d)}</span></div>
                                <div className="flex justify-between"><span className="text-muted-foreground">Overtime</span><span className="tabular text-foreground">{formatMinutes(attendance.overtime_minutes_7d)}</span></div>
                                <div className="flex justify-between"><span className="text-muted-foreground">Day records</span><span className="tabular text-foreground">{attendance.records_7d}</span></div>
                            </div>
                        </Panel>
                    )}
                    {celebrations && (
                        <Panel title="Celebrations · next 30 days">
                            {celebrations.length ? (
                                <ul className="space-y-2.5">
                                    {celebrations.map((c) => (
                                        <li key={`${c.employee_id}${c.kind}`} className="flex items-center justify-between gap-2">
                                            <PersonCell name={c.name} photoUrl={c.photo_url} subtitle={c.kind === "ANNIVERSARY" ? `${c.years} year${c.years === 1 ? "" : "s"} at the company` : "Birthday"} />
                                            <span className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground">{c.kind === "BIRTHDAY" ? <Cake className="size-3.5" /> : <Gift className="size-3.5" />}{formatDate(c.date, "d MMM")}</span>
                                        </li>
                                    ))}
                                </ul>
                            ) : <p className="text-[13px] text-muted-foreground">Nothing coming up.</p>}
                        </Panel>
                    )}
                </div>
            </div>
        </Page>
    );
}
