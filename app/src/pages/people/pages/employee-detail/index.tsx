import { useState, type ReactNode } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { Archive, BadgeCheck, CalendarPlus, CheckCircle2, LogOut, MoreHorizontal, Plus, Trash2, UserCheck } from "lucide-react";
import { Page, PageHeader, KeyValueList } from "@/components/ui/page";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { EmptyState, ErrorState, ListSkeleton, PageSkeleton } from "@/components/ui/states";
import { Progress } from "@/components/ui/progress";
import ConfirmationDialog from "@/components/ui/confirmation-dialog";
import { usePermissions } from "@/hooks/use-permission";
import {
    useArchiveEmployee, useCompensation, useCompleteOffboarding, useCompleteOnboarding, useEmployee, useMyEmployee, useRemoveEmergencyContact, useRemoveHrNote, useUpdateEquipment,
} from "@/features/people/employees/hooks/use-employees";
import { useLeaveBalances, useLeaveRequests } from "@/features/people/leave/hooks/use-leave";
import { useAttendanceRecords } from "@/features/people/attendance/hooks/use-attendance";
import { useEmployeeSkills, useVerifyEmployeeSkill } from "@/features/people/skills/hooks/use-skills";
import { useGoals, useReviews } from "@/features/people/performance/hooks/use-performance";
import type { EmployeeDetail } from "@/features/people/employees/interfaces/employees.interfaces";
import {
    DocumentCategoryFormOptions, DocumentStatusFormOptions, DocumentStatusTone, EmploymentTypeFormOptions, EquipmentConditionFormOptions, EquipmentTypeFormOptions,
    HrNoteCategoryFormOptions, HrNoteVisibilityFormOptions, PayTypeFormOptions, SeniorityFormOptions, TerminationKindFormOptions, WeekdayOptions, WorkLocationFormOptions,
} from "@/config/constants/dropdowns/people/employee-form.options";
import { LeaveStatusFormOptions, LeaveStatusTone } from "@/config/constants/dropdowns/people/leave-form.options";
import { GoalStatusFormOptions, GoalStatusTone, ReviewStatusFormOptions, ReviewStatusTone, SkillProficiencyFormOptions } from "@/config/constants/dropdowns/people/performance-form.options";
import { getDropdownOptionLabel } from "@/lib/dropdown-option-label.utils";
import { formatDate, formatDateTime, formatMinutes, formatMoney, formatNumber, personName } from "@/lib/format";
import { toast } from "@/hooks/use-toast";
import { getApiErrorMessage } from "@/lib/api-error";
import { AvailabilityBadge, EmploymentStatusBadge, Panel, PersonCell, RestrictedCard } from "../../components/person";
import { PeoplePaths } from "../../paths";
import { AvailabilityDialog, CompensationDialog, DocumentDialog, EmergencyContactDialog, EquipmentDialog, HrNoteDialog, OffboardingDialog } from "./components/profile-dialogs";
import { RequestLeaveDialog } from "../leave/components/request-leave-dialog";
import { ChecklistsTab } from "./components/checklists-tab";

type DialogKey = "availability" | "offboarding" | "compensation" | "equipment" | "document" | "note" | "contact" | "leave" | null;

/**
 * /people/employees/:id (and /people/me) — employee profile. Tabs the caller may not open are hidden; restricted fields
 * show a Restricted card (01 §60). @api GET /people/employees/:id (restricted_fields) and per-tab endpoints.
 */
export default function EmployeeDetailPage({ self = false }: { self?: boolean }) {
    const { employeeId } = useParams();
    const byId = useEmployee(self ? undefined : employeeId);
    const mine = useMyEmployee(self);
    const query = self ? mine : byId;
    if (query.isLoading) return <PageSkeleton />;
    if (query.error || !query.data) {
        return (
            <Page>
                <PageHeader title={self ? "My profile" : "Employee"} back={{ to: PeoplePaths.root, label: "Employees" }} />
                {self ? <EmptyState title="You don't have an employee record yet" description="Ask HR to create your record so you can request leave and track attendance." /> : <ErrorState error={query.error} onRetry={() => query.refetch()} />}
            </Page>
        );
    }
    return <Profile employee={query.data} />;
}

function Profile({ employee: e }: { employee: EmployeeDetail }) {
    const p = usePermissions();
    const [sp, setSp] = useSearchParams();
    const [dialog, setDialog] = useState<DialogKey>(null);
    const [confirm, setConfirm] = useState<"archive" | "onboarded" | "offboarded" | null>(null);
    const archive = useArchiveEmployee();
    const onboard = useCompleteOnboarding();
    const offboard = useCompleteOffboarding();
    const own = e.is_me;

    const tabs: { id: string; label: string; show: boolean }[] = [
        { id: "overview", label: "Overview", show: true },
        { id: "job", label: "Job", show: true },
        { id: "leave", label: "Leave", show: own || p.can("employees.leave.read_all") },
        { id: "attendance", label: "Attendance", show: own || p.can("employees.attendance.read_all") },
        { id: "skills", label: "Skills", show: own || p.can("employees.skills.read") },
        { id: "performance", label: "Performance", show: own || p.can("employees.performance.read_all") },
        { id: "compensation", label: "Compensation", show: p.can("employees.compensation.read") },
        { id: "documents", label: "Documents", show: own || p.can("employees.documents.read") },
        { id: "equipment", label: "Equipment", show: own || p.can("employees.equipment.read") },
        { id: "notes", label: "HR notes", show: p.can("employees.hr_notes.read") },
        { id: "onboarding", label: "Onboarding", show: own || p.can("employees.employees.read") },
    ].filter((t) => t.show);
    const tab = tabs.some((t) => t.id === sp.get("tab")) ? (sp.get("tab") as string) : "overview";
    const done = (title: string) => ({ onSuccess: () => { toast({ title }); setConfirm(null); }, onError: (err: unknown) => toast({ variant: "destructive", title: "Action failed", description: getApiErrorMessage(err) }) });
    const canAvailability = own ? p.canAny("employees.profile.update_own", "employees.availability.manage") : p.can("employees.availability.manage");

    return (
        <Page width="wide">
            <PageHeader
                back={{ to: PeoplePaths.root, label: "Employees" }}
                title={<PersonCell name={e.name} photoUrl={e.photo_url} subtitle={[e.job_title, e.employee_number].filter(Boolean).join(" · ")} size="lg" />}
                documentTitle={e.name}
                meta={<span className="flex flex-wrap gap-1.5"><EmploymentStatusBadge status={e.employment_status} /><AvailabilityBadge status={e.availability_status} /></span>}
                actions={
                    <>
                        {canAvailability && <Button variant="outline" onClick={() => setDialog("availability")}>Set availability</Button>}
                        {own && p.can("employees.leave.request_own") && <Button onClick={() => setDialog("leave")}><CalendarPlus /> Request leave</Button>}
                        {!own && (p.canAny("employees.employees.update", "employees.employees.archive", "employees.employees.offboard")) && (
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild><Button variant="outline" size="icon" aria-label="More actions"><MoreHorizontal /></Button></DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                    {e.employment_status === "ONBOARDING" && p.can("employees.employees.update") && <DropdownMenuItem onSelect={() => setConfirm("onboarded")}><UserCheck /> Complete onboarding</DropdownMenuItem>}
                                    {p.can("employees.employees.offboard") && !["OFFBOARDING", "TERMINATED"].includes(e.employment_status) && <DropdownMenuItem onSelect={() => setDialog("offboarding")}><LogOut /> Start offboarding</DropdownMenuItem>}
                                    {p.can("employees.employees.offboard") && e.employment_status === "OFFBOARDING" && <DropdownMenuItem onSelect={() => setConfirm("offboarded")}><CheckCircle2 /> Complete offboarding</DropdownMenuItem>}
                                    {p.can("employees.employees.archive") && !e.archived_at && <DropdownMenuItem className="text-danger focus:text-danger" onSelect={() => setConfirm("archive")}><Archive /> Archive</DropdownMenuItem>}
                                </DropdownMenuContent>
                            </DropdownMenu>
                        )}
                    </>
                }
            />
            <Tabs value={tab} onValueChange={(v) => setSp((prev) => { const n = new URLSearchParams(prev); n.set("tab", v); return n; }, { replace: true })}>
                <div className="-mx-4 overflow-x-auto px-4 md:mx-0 md:px-0">
                    <TabsList className="w-max">{tabs.map((t) => <TabsTrigger key={t.id} value={t.id}>{t.label}</TabsTrigger>)}</TabsList>
                </div>
                <TabsContent value="overview" className="mt-4"><OverviewTab e={e} onAddContact={() => setDialog("contact")} /></TabsContent>
                <TabsContent value="job" className="mt-4"><JobTab e={e} /></TabsContent>
                {tab === "leave" && <TabsContent value="leave" className="mt-4"><LeaveTab e={e} /></TabsContent>}
                {tab === "attendance" && <TabsContent value="attendance" className="mt-4"><AttendanceTab e={e} /></TabsContent>}
                {tab === "skills" && <TabsContent value="skills" className="mt-4"><SkillsTab e={e} /></TabsContent>}
                {tab === "performance" && <TabsContent value="performance" className="mt-4"><PerformanceTab e={e} /></TabsContent>}
                {tab === "compensation" && <TabsContent value="compensation" className="mt-4"><CompensationTab e={e} onAdd={() => setDialog("compensation")} /></TabsContent>}
                <TabsContent value="documents" className="mt-4"><DocumentsTab e={e} onAdd={() => setDialog("document")} /></TabsContent>
                <TabsContent value="equipment" className="mt-4"><EquipmentTab e={e} onAdd={() => setDialog("equipment")} /></TabsContent>
                <TabsContent value="notes" className="mt-4"><NotesTab e={e} onAdd={() => setDialog("note")} /></TabsContent>
                {tab === "onboarding" && <TabsContent value="onboarding" className="mt-4"><ChecklistsTab e={e} /></TabsContent>}
            </Tabs>

            <AvailabilityDialog open={dialog === "availability"} onOpenChange={(o) => setDialog(o ? "availability" : null)} employee={e} />
            <OffboardingDialog open={dialog === "offboarding"} onOpenChange={(o) => setDialog(o ? "offboarding" : null)} employee={e} />
            <CompensationDialog open={dialog === "compensation"} onOpenChange={(o) => setDialog(o ? "compensation" : null)} employee={e} />
            <EquipmentDialog open={dialog === "equipment"} onOpenChange={(o) => setDialog(o ? "equipment" : null)} employee={e} />
            <DocumentDialog open={dialog === "document"} onOpenChange={(o) => setDialog(o ? "document" : null)} employee={e} />
            <HrNoteDialog open={dialog === "note"} onOpenChange={(o) => setDialog(o ? "note" : null)} employee={e} />
            <EmergencyContactDialog open={dialog === "contact"} onOpenChange={(o) => setDialog(o ? "contact" : null)} employee={e} />
            <RequestLeaveDialog open={dialog === "leave"} onOpenChange={(o) => setDialog(o ? "leave" : null)} />
            <ConfirmationDialog
                isOpen={!!confirm}
                onClose={() => setConfirm(null)}
                title={confirm === "archive" ? `Archive ${e.name}?` : confirm === "onboarded" ? "Complete onboarding?" : "Complete offboarding?"}
                description={confirm === "archive" ? "Archived employees are hidden from lists and pickers." : confirm === "onboarded" ? "The status changes to Active." : "Closes the position and compensation, cancels future leave and hides the person from the directory."}
                confirmText={confirm === "archive" ? "Archive" : "Complete"}
                variant={confirm === "onboarded" ? "default" : "destructive"}
                isLoading={archive.isPending || onboard.isPending || offboard.isPending}
                onConfirm={() => {
                    if (confirm === "archive") archive.mutate(e.id, done("Employee archived"));
                    if (confirm === "onboarded") onboard.mutate(e.id, done("Onboarding completed"));
                    if (confirm === "offboarded") offboard.mutate(e.id, done("Offboarding completed"));
                }}
            />
        </Page>
    );
}

function Grid({ children }: { children: ReactNode }) {
    return <div className="grid gap-4 lg:grid-cols-2">{children}</div>;
}

function OverviewTab({ e, onAddContact }: { e: EmployeeDetail; onAddContact: () => void }) {
    const p = usePermissions();
    const remove = useRemoveEmergencyContact();
    const personalRestricted = e.restricted_fields.includes("date_of_birth");
    return (
        <Grid>
            <Panel title="Work contact">
                <KeyValueList items={[
                    { label: "Work email", value: e.work_email ?? e.membership.user.email },
                    { label: "Work phone", value: e.work_phone },
                    { label: "Location", value: getDropdownOptionLabel(WorkLocationFormOptions, e.work_location) },
                    { label: "Timezone", value: e.timezone },
                    { label: "Branch", value: e.primary_branch?.name },
                    { label: "Availability note", value: e.availability_note },
                ]} />
                {e.bio && <p className="mt-4 whitespace-pre-line text-[13px] text-muted-foreground">{e.bio}</p>}
            </Panel>
            {personalRestricted ? <RestrictedCard title="Personal data" permission="employees.personal_data.read" /> : (
                <Panel title="Personal">
                    <KeyValueList items={[
                        { label: "Legal name", value: [e.legal_first_name, e.legal_last_name].filter(Boolean).join(" ") || null },
                        { label: "Date of birth", value: e.date_of_birth ? formatDate(e.date_of_birth) : null },
                        { label: "Nationality", value: e.nationality },
                        { label: "Personal email", value: e.personal_email },
                        { label: "Personal phone", value: e.personal_phone },
                        { label: "Gender", value: e.gender },
                    ]} />
                </Panel>
            )}
            {e.restricted_fields.includes("emergency_contacts") ? <RestrictedCard title="Emergency contacts" permission="employees.personal_data.read" /> : (
                <Panel title="Emergency contacts" actions={(e.is_me ? p.can("employees.profile.update_own") : p.can("employees.personal_data.manage")) && <Button size="sm" variant="ghost" onClick={onAddContact}><Plus /> Add</Button>}>
                    {!e.emergency_contacts?.length ? <p className="text-[13px] text-muted-foreground">No emergency contacts.</p> : (
                        <ul className="divide-y divide-border">
                            {e.emergency_contacts.map((c) => (
                                <li key={c.id} className="flex items-center justify-between gap-2 py-2 first:pt-0 last:pb-0">
                                    <div className="min-w-0">
                                        <div className="truncate text-[13px] text-foreground">{c.name} {c.is_primary && <Badge variant="info" className="ml-1">Primary</Badge>}</div>
                                        <div className="truncate text-xs text-muted-foreground">{[c.relationship, c.phone].filter(Boolean).join(" · ")}</div>
                                    </div>
                                    {(e.is_me ? p.can("employees.profile.update_own") : p.can("employees.personal_data.manage")) && (
                                        <Button size="icon-sm" variant="ghost" aria-label={`Remove ${c.name}`} onClick={() => remove.mutate({ id: e.id, contactId: c.id }, { onError: (err) => toast({ variant: "destructive", title: "Could not remove", description: getApiErrorMessage(err) }) })}><Trash2 /></Button>
                                    )}
                                </li>
                            ))}
                        </ul>
                    )}
                </Panel>
            )}
            <Panel title="Expertise">
                <div className="space-y-3 text-[13px]">
                    <TagList label="Areas of expertise" items={e.areas_of_expertise} />
                    <TagList label="Tech stack" items={e.technical_stack} />
                    <TagList label="Languages" items={e.languages.map((l) => `${l.language} (${l.proficiency.toLowerCase()})`)} />
                </div>
            </Panel>
        </Grid>
    );
}

function TagList({ label, items }: { label: string; items: string[] }) {
    return (
        <div>
            <div className="mb-1 text-xs text-muted-foreground">{label}</div>
            {items.length ? <div className="flex flex-wrap gap-1">{items.map((t) => <span key={t} className="rounded-xs border border-border px-1.5 text-xs text-foreground">{t}</span>)}</div> : <span className="text-muted-foreground">—</span>}
        </div>
    );
}

function JobTab({ e }: { e: EmployeeDetail }) {
    const schedule = e.work_schedules[0];
    return (
        <div className="space-y-4">
            <Grid>
                <Panel title="Employment">
                    <KeyValueList items={[
                        { label: "Employee ID", value: e.employee_number },
                        { label: "Job title", value: e.job_title },
                        { label: "Seniority", value: e.seniority_level ? getDropdownOptionLabel(SeniorityFormOptions, e.seniority_level) : null },
                        { label: "Type", value: getDropdownOptionLabel(EmploymentTypeFormOptions, e.employment_type) },
                        { label: "Department", value: e.department?.name },
                        { label: "Manager", value: e.manager ? <Link className="text-info hover:underline" to={PeoplePaths.employee(e.manager.id)}>{e.manager.name}</Link> : null },
                        { label: "Hire date", value: formatDate(e.hire_date) },
                        { label: "Probation ends", value: e.probation_end_date ? formatDate(e.probation_end_date) : null },
                        { label: "Contract ends", value: e.contract_end_date ? formatDate(e.contract_end_date) : null },
                        { label: "Notice period", value: e.notice_period_days ? `${e.notice_period_days} days` : null },
                        ...(e.termination_date ? [{ label: "Last day", value: formatDate(e.termination_date) }, { label: "Termination", value: getDropdownOptionLabel(TerminationKindFormOptions, e.termination_kind) }] : []),
                    ]} />
                </Panel>
                <Panel title={`Working hours${schedule ? ` · ${formatNumber(schedule.weekly_hours, 1)}h / week` : ""}`}>
                    {!schedule ? <p className="text-[13px] text-muted-foreground">No schedule — {formatNumber(e.weekly_capacity_hours ?? 40, 1)}h/week spread Monday–Friday is used for leave and capacity.</p> : (
                        <ul className="space-y-1.5 text-[13px]">
                            {WeekdayOptions.map((d) => {
                                const day = schedule.days.find((x) => String(x.weekday) === d.id);
                                return (
                                    <li key={d.id} className="flex justify-between gap-2">
                                        <span className="text-muted-foreground">{d.label}</span>
                                        <span className="tabular text-foreground">{day ? `${day.starts_at ?? ""}${day.ends_at ? `–${day.ends_at}` : ""} ${formatNumber(day.hours, 1)}h` : "Off"}</span>
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                </Panel>
            </Grid>
            {!!e.direct_reports.length && (
                <Panel title={`Direct reports (${e.direct_reports.length})`}>
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{e.direct_reports.map((r) => <PersonCell key={r.id} name={r.name} photoUrl={r.photo_url} subtitle={r.job_title} to={PeoplePaths.employee(r.id)} />)}</div>
                </Panel>
            )}
            <Panel title="Position history">
                {!e.positions.length ? <p className="text-[13px] text-muted-foreground">No history.</p> : (
                    <ol className="space-y-3">
                        {e.positions.map((pos) => (
                            <li key={pos.id} className="flex flex-col gap-0.5 border-l-2 border-border pl-3 sm:flex-row sm:items-baseline sm:justify-between">
                                <div className="text-[13px] text-foreground">{pos.job_title}{pos.department ? ` · ${pos.department.name}` : ""}</div>
                                <div className="text-xs text-muted-foreground tabular">{formatDate(pos.effective_from)} – {pos.effective_to ? formatDate(pos.effective_to) : "now"} · {pos.reason.toLowerCase().replace(/_/g, " ")}</div>
                            </li>
                        ))}
                    </ol>
                )}
            </Panel>
        </div>
    );
}

function LeaveTab({ e }: { e: EmployeeDetail }) {
    const balances = useLeaveBalances({ employee_id: e.id, limit: 1 });
    const requests = useLeaveRequests({ employee_id: e.id, limit: 20 });
    return (
        <div className="space-y-4">
            <Panel title="Balances this period">
                {balances.isLoading ? <ListSkeleton rows={2} /> : balances.error ? <ErrorState error={balances.error} /> : (
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                        {balances.data?.data[0]?.balances.map((b) => (
                            <div key={b.id} className="rounded-md border border-border p-3">
                                <div className="text-xs text-muted-foreground">{b.leave_type.name}</div>
                                <div className="mt-1 text-xl font-medium tabular text-foreground">{formatNumber(b.available_days, 1)} <span className="text-xs font-normal text-muted-foreground">days left</span></div>
                                <div className="mt-1 text-xs text-muted-foreground tabular">{formatNumber(b.used_days, 1)} used · {formatNumber(b.pending_days, 1)} pending</div>
                            </div>
                        )) ?? null}
                    </div>
                )}
            </Panel>
            <Panel title="Requests">
                {requests.isLoading ? <ListSkeleton rows={3} /> : requests.error ? <ErrorState error={requests.error} /> : !requests.data?.data.length ? <p className="text-[13px] text-muted-foreground">No leave requests.</p> : (
                    <ul className="divide-y divide-border">
                        {requests.data.data.map((r) => (
                            <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-2 first:pt-0 last:pb-0">
                                <div className="min-w-0 text-[13px]"><span className="text-foreground">{r.leave_type.name}</span> <span className="text-muted-foreground tabular">· {formatDate(r.start_date)} – {formatDate(r.end_date)} · {formatNumber(r.total_days, 1)}d</span></div>
                                <Badge variant={LeaveStatusTone[r.status]}>{getDropdownOptionLabel(LeaveStatusFormOptions, r.status)}</Badge>
                            </li>
                        ))}
                    </ul>
                )}
            </Panel>
        </div>
    );
}

function AttendanceTab({ e }: { e: EmployeeDetail }) {
    const records = useAttendanceRecords({ employee_id: e.id, limit: 14 });
    if (records.isLoading) return <ListSkeleton />;
    if (records.error) return <ErrorState error={records.error} onRetry={() => records.refetch()} />;
    if (!records.data?.data.length) return <EmptyState compact title="No attendance in the last two weeks" />;
    return (
        <Panel title="Last 14 days">
            <ul className="divide-y divide-border">
                {records.data.data.map((r) => (
                    <li key={r.id} className="grid grid-cols-2 gap-1 py-2 text-[13px] first:pt-0 last:pb-0 sm:grid-cols-4">
                        <span className="text-foreground">{formatDate(r.date, "EEE d MMM")}</span>
                        <span className="text-muted-foreground tabular">{r.first_clock_in_at ? formatDateTime(r.first_clock_in_at).split(", ")[1] : "—"} – {r.last_clock_out_at ? formatDateTime(r.last_clock_out_at).split(", ")[1] : "…"}</span>
                        <span className="tabular text-foreground">{formatMinutes(r.worked_minutes)} worked</span>
                        <span className="text-xs text-muted-foreground">{r.late_minutes ? `${r.late_minutes}m late` : ""}{r.overtime_minutes ? ` · ${formatMinutes(r.overtime_minutes)} overtime` : ""}</span>
                    </li>
                ))}
            </ul>
        </Panel>
    );
}

function SkillsTab({ e }: { e: EmployeeDetail }) {
    const p = usePermissions();
    const q = useEmployeeSkills(e.id);
    const verify = useVerifyEmployeeSkill();
    if (q.isLoading) return <ListSkeleton />;
    if (q.error) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
    return (
        <Grid>
            <Panel title="Skills" actions={<Button size="sm" variant="ghost" asChild><Link to={PeoplePaths.skills}>Skills catalogue</Link></Button>}>
                {!q.data?.skills.length ? <p className="text-[13px] text-muted-foreground">No skills recorded.</p> : (
                    <ul className="space-y-2">
                        {q.data.skills.map((s) => (
                            <li key={s.id} className="flex items-center justify-between gap-2 text-[13px]">
                                <span className="min-w-0 truncate text-foreground">{s.skill.name} {s.is_primary && <Badge variant="info" className="ml-1">Primary</Badge>}</span>
                                <span className="flex items-center gap-2">
                                    <Badge variant="neutral">{getDropdownOptionLabel(SkillProficiencyFormOptions, s.proficiency)}</Badge>
                                    {s.verified_at ? <BadgeCheck className="size-4 text-success" aria-label="Verified" /> : p.can("employees.skills.manage") && !e.is_me && (
                                        <Button size="sm" variant="ghost" onClick={() => verify.mutate(s.id, { onSuccess: () => toast({ title: "Skill verified" }), onError: (err) => toast({ variant: "destructive", title: "Could not verify", description: getApiErrorMessage(err) }) })}>Verify</Button>
                                    )}
                                </span>
                            </li>
                        ))}
                    </ul>
                )}
            </Panel>
            <Panel title="Certifications">
                {!q.data?.certifications.length ? <p className="text-[13px] text-muted-foreground">No certifications.</p> : (
                    <ul className="space-y-2 text-[13px]">
                        {q.data.certifications.map((c) => (
                            <li key={c.id} className="flex justify-between gap-2"><span className="truncate text-foreground">{c.name}{c.issuer ? ` · ${c.issuer}` : ""}</span><span className="shrink-0 text-xs text-muted-foreground">{c.expires_on ? `expires ${formatDate(c.expires_on)}` : ""}</span></li>
                        ))}
                    </ul>
                )}
            </Panel>
        </Grid>
    );
}

function PerformanceTab({ e }: { e: EmployeeDetail }) {
    const reviews = useReviews({ employee_id: e.id, limit: 10 });
    const goals = useGoals({ employee_id: e.id, limit: 20 });
    return (
        <Grid>
            <Panel title="Reviews">
                {reviews.isLoading ? <ListSkeleton rows={2} /> : reviews.error ? <ErrorState error={reviews.error} /> : !reviews.data?.data.length ? <p className="text-[13px] text-muted-foreground">No reviews yet.</p> : (
                    <ul className="divide-y divide-border">
                        {reviews.data.data.map((r) => (
                            <li key={r.id} className="py-2 first:pt-0 last:pb-0">
                                <Link to={PeoplePaths.review(r.id)} className="flex items-center justify-between gap-2 text-[13px] hover:underline">
                                    <span className="truncate text-foreground">{r.title ?? r.cycle?.name ?? "Review"}</span>
                                    <Badge variant={ReviewStatusTone[r.status]}>{getDropdownOptionLabel(ReviewStatusFormOptions, r.status)}</Badge>
                                </Link>
                            </li>
                        ))}
                    </ul>
                )}
            </Panel>
            <Panel title="Goals">
                {goals.isLoading ? <ListSkeleton rows={2} /> : goals.error ? <ErrorState error={goals.error} /> : !goals.data?.data.length ? <p className="text-[13px] text-muted-foreground">No goals yet.</p> : (
                    <ul className="space-y-3">
                        {goals.data.data.map((g) => (
                            <li key={g.id} className="space-y-1">
                                <div className="flex items-center justify-between gap-2 text-[13px]"><span className="truncate text-foreground">{g.title}</span><Badge variant={GoalStatusTone[g.status]}>{getDropdownOptionLabel(GoalStatusFormOptions, g.status)}</Badge></div>
                                <Progress value={Number(g.progress_percent)} className="h-1.5" />
                            </li>
                        ))}
                    </ul>
                )}
            </Panel>
        </Grid>
    );
}

function CompensationTab({ e, onAdd }: { e: EmployeeDetail; onAdd: () => void }) {
    const p = usePermissions();
    const q = useCompensation(e.id);
    if (q.isLoading) return <ListSkeleton />;
    if (q.error) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
    return (
        <Panel title="Compensation history" actions={p.can("employees.compensation.manage") && <Button size="sm" onClick={onAdd}><Plus /> New record</Button>}>
            {!q.data?.length ? <p className="text-[13px] text-muted-foreground">No compensation recorded.</p> : (
                <ul className="divide-y divide-border">
                    {q.data.map((c) => (
                        <li key={c.id} className="grid gap-1 py-3 text-[13px] first:pt-0 last:pb-0 sm:grid-cols-4">
                            <span className="text-muted-foreground tabular">{formatDate(c.effective_from)} – {c.effective_to ? formatDate(c.effective_to) : "now"}</span>
                            <span className="text-foreground">{formatMoney(c.base_amount, c.currency)} <span className="text-xs text-muted-foreground">{getDropdownOptionLabel(PayTypeFormOptions, c.pay_type).toLowerCase()}</span></span>
                            <span className="text-muted-foreground">Total cost {formatMoney(c.total_cost_monthly, c.currency)}/mo</span>
                            <span className="text-muted-foreground">Cost rate {formatMoney(c.cost_rate_hourly, c.currency)}/h</span>
                        </li>
                    ))}
                </ul>
            )}
        </Panel>
    );
}

function DocumentsTab({ e, onAdd }: { e: EmployeeDetail; onAdd: () => void }) {
    const p = usePermissions();
    if (e.restricted_fields.includes("documents")) return <RestrictedCard title="Documents" permission="employees.documents.read" />;
    return (
        <Panel title="HR documents" actions={p.can("employees.documents.manage") && <Button size="sm" onClick={onAdd}><Plus /> Request document</Button>}>
            {!e.documents?.length ? <p className="text-[13px] text-muted-foreground">No documents.</p> : (
                <ul className="divide-y divide-border">
                    {e.documents.map((d) => (
                        <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 py-2 first:pt-0 last:pb-0">
                            <div className="min-w-0"><div className="truncate text-[13px] text-foreground">{d.title}</div><div className="text-xs text-muted-foreground">{getDropdownOptionLabel(DocumentCategoryFormOptions, d.category)}{d.due_date ? ` · due ${formatDate(d.due_date)}` : ""}{d.expires_on ? ` · expires ${formatDate(d.expires_on)}` : ""}</div></div>
                            <Badge variant={DocumentStatusTone[d.status]}>{getDropdownOptionLabel(DocumentStatusFormOptions, d.status)}</Badge>
                        </li>
                    ))}
                </ul>
            )}
        </Panel>
    );
}

function EquipmentTab({ e, onAdd }: { e: EmployeeDetail; onAdd: () => void }) {
    const p = usePermissions();
    const update = useUpdateEquipment();
    if (e.restricted_fields.includes("equipment")) return <RestrictedCard title="Equipment" permission="employees.equipment.read" />;
    const canManage = p.can("employees.equipment.manage");
    return (
        <Panel title="Equipment" actions={canManage && <Button size="sm" onClick={onAdd}><Plus /> Assign</Button>}>
            {!e.equipment?.length ? <p className="text-[13px] text-muted-foreground">No equipment assigned.</p> : (
                <ul className="divide-y divide-border">
                    {e.equipment.map((it) => (
                        <li key={it.id} className="flex flex-wrap items-center justify-between gap-2 py-2 first:pt-0 last:pb-0">
                            <div className="min-w-0"><div className="truncate text-[13px] text-foreground">{it.name}</div><div className="text-xs text-muted-foreground">{getDropdownOptionLabel(EquipmentTypeFormOptions, it.asset_type)}{it.serial_number ? ` · ${it.serial_number}` : ""} · {getDropdownOptionLabel(EquipmentConditionFormOptions, it.condition)} · since {formatDate(it.assigned_on)}</div></div>
                            {it.returned_on ? <Badge variant="neutral">Returned {formatDate(it.returned_on)}</Badge> : canManage ? (
                                <Button size="sm" variant="outline" loading={update.isPending} onClick={() => update.mutate({ id: e.id, itemId: it.id, returned_on: new Date().toISOString().slice(0, 10) }, { onSuccess: () => toast({ title: "Marked as returned" }), onError: (err) => toast({ variant: "destructive", title: "Could not update", description: getApiErrorMessage(err) }) })}>Mark returned</Button>
                            ) : <Badge variant="info">In use</Badge>}
                        </li>
                    ))}
                </ul>
            )}
        </Panel>
    );
}

function NotesTab({ e, onAdd }: { e: EmployeeDetail; onAdd: () => void }) {
    const p = usePermissions();
    const remove = useRemoveHrNote();
    return (
        <Panel title="HR notes" actions={p.can("employees.hr_notes.manage") && <Button size="sm" onClick={onAdd}><Plus /> Add note</Button>}>
            {!e.hr_notes?.length ? <p className="text-[13px] text-muted-foreground">No notes.</p> : (
                <ul className="space-y-3">
                    {e.hr_notes.map((n) => (
                        <li key={n.id} className="rounded-md border border-border p-3">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                                <div className="flex flex-wrap items-center gap-1.5">
                                    <Badge variant={n.category === "WARNING" ? "danger" : "neutral"}>{getDropdownOptionLabel(HrNoteCategoryFormOptions, n.category)}</Badge>
                                    <Badge variant="secondary">{getDropdownOptionLabel(HrNoteVisibilityFormOptions, n.visibility)}</Badge>
                                    {n.title && <span className="text-[13px] font-medium text-foreground">{n.title}</span>}
                                </div>
                                {p.can("employees.hr_notes.manage") && <Button size="icon-sm" variant="ghost" aria-label="Delete note" onClick={() => remove.mutate({ id: e.id, noteId: n.id })}><Trash2 /></Button>}
                            </div>
                            <p className="mt-2 whitespace-pre-line text-[13px] text-foreground">{n.body}</p>
                            <div className="mt-2 text-xs text-muted-foreground">{n.author ? personName(n.author.user) : "Unknown"} · {formatDateTime(n.created_at)}</div>
                        </li>
                    ))}
                </ul>
            )}
        </Panel>
    );
}
