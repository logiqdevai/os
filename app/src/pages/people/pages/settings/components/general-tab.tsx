import { useState, type ReactNode } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useUpdateHrSettings } from "@/features/people/overview/hooks/use-overview";
import { useAutosave } from "@/hooks/use-autosave";
import { SaveStatus } from "@/components/ui/save-status";
import type { AttendanceSource, HrSettings, LeaveApproverStrategy, UpdateHrSettingsDto } from "@/features/people/overview/interfaces/overview.interfaces";
import { AttendanceSourceFormOptions, LeaveApproverStrategyFormOptions } from "@/config/constants/dropdowns/people/leave-form.options";
import { ProfileFieldFormOptions, WeekdayOptions } from "@/config/constants/dropdowns/people/employee-form.options";
import { getDropdownOptionLabel } from "@/lib/dropdown-option-label.utils";
import { Panel } from "../../../components/person";

export type GeneralSection = "general" | "attendance" | "capacity" | "selfservice";

interface Form {
    default_weekly_hours: string;
    schedule: { weekday: number; on: boolean; start: string; end: string; break_minutes: string }[];
    leave_approver_strategy: LeaveApproverStrategy;
    leave_conflict_threshold_percent: string;
    notify_birthdays: boolean;
    notify_anniversaries: boolean;
    attendance_required: boolean;
    allowed_clock_sources: AttendanceSource[];
    late_tolerance_minutes: string;
    overtime_threshold_minutes: string;
    overtime_requires_approval: boolean;
    prefill_time_entries_from_attendance: boolean;
    target_utilization_percent: string;
    overload_threshold_percent: string;
    underutilized_threshold_percent: string;
    self_service_editable_fields: string[];
    profile_changes_require_approval: boolean;
    directory_visible_fields: string[];
}

/** Monday-first display order; values are the schema weekday (0 = Sunday … 6 = Saturday). */
const WEEK = [1, 2, 3, 4, 5, 6, 0];

function toForm(s: HrSettings): Form {
    const days = new Map((s.default_schedule ?? []).map((d) => [d.weekday, d]));
    return {
        default_weekly_hours: String(Number(s.default_weekly_hours)),
        schedule: WEEK.map((w) => {
            const d = days.get(w);
            return { weekday: w, on: s.default_schedule?.length ? !!d : w >= 1 && w <= 5, start: d?.start ?? "09:00", end: d?.end ?? "17:30", break_minutes: String(d?.break_minutes ?? 30) };
        }),
        leave_approver_strategy: s.leave_approver_strategy,
        leave_conflict_threshold_percent: s.leave_conflict_threshold_percent === null ? "" : String(Number(s.leave_conflict_threshold_percent)),
        notify_birthdays: s.notify_birthdays,
        notify_anniversaries: s.notify_anniversaries,
        attendance_required: s.attendance_required,
        allowed_clock_sources: s.allowed_clock_sources,
        late_tolerance_minutes: String(s.late_tolerance_minutes),
        overtime_threshold_minutes: String(s.overtime_threshold_minutes),
        overtime_requires_approval: s.overtime_requires_approval,
        prefill_time_entries_from_attendance: s.prefill_time_entries_from_attendance,
        target_utilization_percent: String(Number(s.target_utilization_percent)),
        overload_threshold_percent: String(Number(s.overload_threshold_percent)),
        underutilized_threshold_percent: String(Number(s.underutilized_threshold_percent)),
        // An empty list means "every allowed field" on the API.
        self_service_editable_fields: s.self_service_editable_fields.length ? s.self_service_editable_fields : s.options.self_service_fields,
        profile_changes_require_approval: s.profile_changes_require_approval,
        directory_visible_fields: s.directory_visible_fields.length ? s.directory_visible_fields : s.options.directory_fields,
    };
}

const minutes = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
const dayHours = (d: Form["schedule"][number]) => (d.on && d.start && d.end ? Math.max(0, minutes(d.end) - minutes(d.start) - (Number(d.break_minutes) || 0)) / 60 : 0);

/** One settings section (General / Attendance / Capacity / Self-service) of EmployeeHrSettings. @perm employees.settings.manage */
export function GeneralTab({ settings, section }: { settings: HrSettings; section: GeneralSection }) {
    const update = useUpdateHrSettings();
    // The form is loaded once; afterwards it is the source of truth (a refresh after an autosave never overwrites typing).
    const [f, setF] = useState<Form>(() => toForm(settings));
    const set = <K extends keyof Form>(k: K, v: Form[K]) => setF((prev) => ({ ...prev, [k]: v }));
    const weekly = f.schedule.reduce((s, d) => s + dayHours(d), 0);
    const toggle = (list: string[], v: string, on: boolean) => (on ? [...new Set([...list, v])] : list.filter((x) => x !== v));

    const toDto = (f: Form) => {
        const dto: UpdateHrSettingsDto = {};
        if (section === "general") {
            dto.default_schedule = f.schedule.filter((d) => d.on).map((d) => ({ weekday: d.weekday, start: d.start, end: d.end, break_minutes: Number(d.break_minutes) || 0 }));
            if (!dto.default_schedule.length) dto.default_weekly_hours = Number(f.default_weekly_hours);
            dto.leave_approver_strategy = f.leave_approver_strategy;
            if (f.leave_conflict_threshold_percent !== "") dto.leave_conflict_threshold_percent = Number(f.leave_conflict_threshold_percent);
            dto.notify_birthdays = f.notify_birthdays;
            dto.notify_anniversaries = f.notify_anniversaries;
        }
        if (section === "attendance") {
            Object.assign(dto, {
                attendance_required: f.attendance_required, allowed_clock_sources: f.allowed_clock_sources, late_tolerance_minutes: Number(f.late_tolerance_minutes) || 0,
                overtime_threshold_minutes: Number(f.overtime_threshold_minutes) || 0, overtime_requires_approval: f.overtime_requires_approval,
                prefill_time_entries_from_attendance: f.prefill_time_entries_from_attendance,
            });
        }
        if (section === "capacity") {
            Object.assign(dto, { target_utilization_percent: Number(f.target_utilization_percent), overload_threshold_percent: Number(f.overload_threshold_percent), underutilized_threshold_percent: Number(f.underutilized_threshold_percent) });
        }
        if (section === "selfservice") {
            Object.assign(dto, { self_service_editable_fields: f.self_service_editable_fields, profile_changes_require_approval: f.profile_changes_require_approval, directory_visible_fields: f.directory_visible_fields });
        }
        return dto;
    };

    /** Autosave (no Save button): each change is saved after a short pause; a refusal shows in <SaveStatus /> with Retry. */
    const autosave = useAutosave({ value: f, save: (v) => update.mutateAsync(toDto(v)) });
    const footer = (
        <div className="flex min-h-5 justify-end">
            <SaveStatus state={autosave} />
        </div>
    );

    if (section === "general") {
        return (
            <div className="space-y-4">
                <div className="grid items-start gap-4 lg:grid-cols-2">
                    <Panel title="Default work schedule">
                        <p className="mb-3 text-xs text-muted-foreground">Used for employees without their own schedule: leave days, capacity and holidays.</p>
                        <div className="space-y-2">
                            {f.schedule.map((d, i) => (
                                <div key={d.weekday} className="grid grid-cols-[auto_1fr] items-center gap-2 sm:grid-cols-[7rem_1fr]">
                                    <label className="flex items-center gap-2 text-[13px] text-foreground">
                                        <Switch checked={d.on} onCheckedChange={(on) => set("schedule", f.schedule.map((x, j) => (j === i ? { ...x, on } : x)))} aria-label={`Works on ${getDropdownOptionLabel(WeekdayOptions, String(d.weekday))}`} />
                                        <span className="w-9">{getDropdownOptionLabel(WeekdayOptions, String(d.weekday)).slice(0, 3)}</span>
                                    </label>
                                    {d.on ? (
                                        <div className="flex flex-wrap items-center gap-1.5">
                                            <Input type="time" value={d.start} onChange={(e) => set("schedule", f.schedule.map((x, j) => (j === i ? { ...x, start: e.target.value } : x)))} className="h-8 w-[6.5rem]" aria-label="Start" />
                                            <span className="text-muted-foreground">–</span>
                                            <Input type="time" value={d.end} onChange={(e) => set("schedule", f.schedule.map((x, j) => (j === i ? { ...x, end: e.target.value } : x)))} className="h-8 w-[6.5rem]" aria-label="End" />
                                            <Input type="number" min={0} max={480} value={d.break_minutes} onChange={(e) => set("schedule", f.schedule.map((x, j) => (j === i ? { ...x, break_minutes: e.target.value } : x)))} className="h-8 w-16" aria-label="Break minutes" />
                                            <span className="text-xs text-muted-foreground">min break · <span className="tabular">{dayHours(d).toFixed(1)}</span> h</span>
                                        </div>
                                    ) : <span className="text-xs text-muted-foreground">Day off</span>}
                                </div>
                            ))}
                        </div>
                        <div className="mt-3 text-xs text-muted-foreground">Weekly total <span className="tabular text-foreground">{weekly.toFixed(1)} h</span></div>
                        {!f.schedule.some((d) => d.on) && (
                            <Field label="Default weekly hours" htmlFor="hr-weekly"><Input id="hr-weekly" type="number" min={1} max={80} value={f.default_weekly_hours} onChange={(e) => set("default_weekly_hours", e.target.value)} className="w-28" /></Field>
                        )}
                    </Panel>
                    <Panel title="Leave approval and notifications">
                        <div className="space-y-4">
                            <Field label="Approver">
                                <Select value={f.leave_approver_strategy} onValueChange={(v) => set("leave_approver_strategy", v as LeaveApproverStrategy)}>
                                    <SelectTrigger aria-label="Approver"><SelectValue /></SelectTrigger>
                                    <SelectContent>{LeaveApproverStrategyFormOptions.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent>
                                </Select>
                            </Field>
                            <Field label="Team conflict warning (% of team out)" htmlFor="hr-conflict" hint="Leave requests warn when more of a team is away. Empty = no check.">
                                <Input id="hr-conflict" type="number" min={0} max={100} value={f.leave_conflict_threshold_percent} onChange={(e) => set("leave_conflict_threshold_percent", e.target.value)} className="w-28" />
                            </Field>
                            <Toggle label="Birthday notifications" checked={f.notify_birthdays} onChange={(v) => set("notify_birthdays", v)} />
                            <Toggle label="Work anniversary notifications" checked={f.notify_anniversaries} onChange={(v) => set("notify_anniversaries", v)} />
                        </div>
                    </Panel>
                </div>
                {footer}
            </div>
        );
    }

    if (section === "attendance") {
        return (
            <div className="space-y-4">
                <div className="grid items-start gap-4 lg:grid-cols-2">
                    <Panel title="Clocking">
                        <div className="space-y-4">
                            <Toggle label="Attendance required" hint="Employees clock in and out every working day." checked={f.attendance_required} onChange={(v) => set("attendance_required", v)} />
                            <Field label="Allowed clock sources">
                                <div className="flex flex-wrap gap-x-4 gap-y-2">
                                    {AttendanceSourceFormOptions.map((o) => (
                                        <label key={o.id} className="flex items-center gap-2 text-[13px] text-foreground">
                                            <Checkbox checked={f.allowed_clock_sources.includes(o.id)} onCheckedChange={(on) => set("allowed_clock_sources", toggle(f.allowed_clock_sources, o.id, !!on) as AttendanceSource[])} />{o.label}
                                        </label>
                                    ))}
                                </div>
                            </Field>
                            <Field label="Late tolerance (minutes)" htmlFor="hr-late"><Input id="hr-late" type="number" min={0} max={240} value={f.late_tolerance_minutes} onChange={(e) => set("late_tolerance_minutes", e.target.value)} className="w-28" /></Field>
                        </div>
                    </Panel>
                    <Panel title="Overtime and time tracking">
                        <div className="space-y-4">
                            <Field label="Overtime after (minutes beyond the scheduled day)" htmlFor="hr-ot"><Input id="hr-ot" type="number" min={0} max={600} value={f.overtime_threshold_minutes} onChange={(e) => set("overtime_threshold_minutes", e.target.value)} className="w-28" /></Field>
                            <Toggle label="Overtime requires approval" checked={f.overtime_requires_approval} onChange={(v) => set("overtime_requires_approval", v)} />
                            <Toggle label="Pre-fill time entries from attendance" hint="Time Tracking suggests the daily total; it never replaces entries." checked={f.prefill_time_entries_from_attendance} onChange={(v) => set("prefill_time_entries_from_attendance", v)} />
                        </div>
                    </Panel>
                </div>
                {footer}
            </div>
        );
    }

    if (section === "capacity") {
        return (
            <div className="space-y-4">
                <Panel title="Utilization thresholds">
                    <p className="mb-3 text-xs text-muted-foreground">Drive the capacity status (underutilized / balanced / overloaded) per employee and week.</p>
                    <div className="grid gap-4 sm:grid-cols-3">
                        <Field label="Target utilization (%)" htmlFor="hr-target"><Input id="hr-target" type="number" min={0} max={200} value={f.target_utilization_percent} onChange={(e) => set("target_utilization_percent", e.target.value)} /></Field>
                        <Field label="Overloaded above (%)" htmlFor="hr-over"><Input id="hr-over" type="number" min={0} max={300} value={f.overload_threshold_percent} onChange={(e) => set("overload_threshold_percent", e.target.value)} /></Field>
                        <Field label="Underutilized below (%)" htmlFor="hr-under"><Input id="hr-under" type="number" min={0} max={200} value={f.underutilized_threshold_percent} onChange={(e) => set("underutilized_threshold_percent", e.target.value)} /></Field>
                    </div>
                </Panel>
                {footer}
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <div className="grid items-start gap-4 lg:grid-cols-2">
                <Panel title="Self-service">
                    <div className="space-y-4">
                        <Field label="Fields employees may edit" hint="Identity, pay and job fields are never editable by employees.">
                            <div className="grid gap-2 sm:grid-cols-2">
                                {settings.options.self_service_fields.map((k) => (
                                    <label key={k} className="flex items-center gap-2 text-[13px] text-foreground">
                                        <Checkbox checked={f.self_service_editable_fields.includes(k)} onCheckedChange={(on) => set("self_service_editable_fields", toggle(f.self_service_editable_fields, k, !!on))} />
                                        {getDropdownOptionLabel(ProfileFieldFormOptions, k)}
                                    </label>
                                ))}
                            </div>
                        </Field>
                        <Toggle label="Profile changes require HR approval" hint="Edits become change requests for HR to approve." checked={f.profile_changes_require_approval} onChange={(v) => set("profile_changes_require_approval", v)} />
                    </div>
                </Panel>
                <Panel title="Directory">
                    <Field label="Fields shown in the company directory" hint="Name, photo, department and branch are always shown. Personal contact data cannot be added.">
                        <div className="grid gap-2 sm:grid-cols-2">
                            {settings.options.directory_fields.map((k) => (
                                <label key={k} className="flex items-center gap-2 text-[13px] text-foreground">
                                    <Checkbox checked={f.directory_visible_fields.includes(k)} onCheckedChange={(on) => set("directory_visible_fields", toggle(f.directory_visible_fields, k, !!on))} />
                                    {getDropdownOptionLabel(ProfileFieldFormOptions, k)}
                                </label>
                            ))}
                        </div>
                    </Field>
                </Panel>
            </div>
            {footer}
        </div>
    );
}

export function Field({ label, htmlFor, hint, children }: { label: string; htmlFor?: string; hint?: string; children: ReactNode }) {
    return (
        <div className="space-y-1.5">
            <Label htmlFor={htmlFor}>{label}</Label>
            {children}
            {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
        </div>
    );
}

export function Toggle({ label, hint, checked, onChange }: { label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void }) {
    return (
        <label className="flex items-start justify-between gap-3">
            <span className="min-w-0">
                <span className="block text-[13px] text-foreground">{label}</span>
                {hint && <span className="block text-xs text-muted-foreground">{hint}</span>}
            </span>
            <Switch checked={checked} onCheckedChange={onChange} />
        </label>
    );
}
