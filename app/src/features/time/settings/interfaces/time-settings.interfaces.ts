export type TimeNonBillableCategory = "INTERNAL" | "PRE_SALES" | "WARRANTY" | "OVERHEAD" | "LEAVE" | "TRAINING" | "ADMIN";
export type TimeRoundingMode = "NONE" | "NEAREST" | "UP" | "DOWN";
export type TimesheetApproverPolicy = "PROJECT_OWNER" | "TEAM_LEAD" | "MANAGER" | "SPECIFIC_MEMBER";
export type TimesheetPeriodType = "WEEKLY" | "BIWEEKLY" | "SEMI_MONTHLY" | "MONTHLY" | "CUSTOM";

/** Person shape returned by every Time endpoint (Membership + User). */
export interface TimeMember {
    id: string;
    job_title: string | null;
    user: { id: string; email: string; display_name: string | null; first_name: string | null; last_name: string | null; profile_photo_url: string | null };
}

export interface TimeTrackingSettings {
    organization_id: string;
    period_type: TimesheetPeriodType;
    week_start: number | null;
    require_approval: boolean;
    approver_policy: TimesheetApproverPolicy;
    default_approver_membership_id: string | null;
    lock_on_approval: boolean;
    allow_self_approval: boolean;
    default_billable: boolean;
    require_billable_override_reason: boolean;
    rounding_increment_minutes: number;
    rounding_mode: TimeRoundingMode;
    min_entry_minutes: number | null;
    max_hours_per_day: string | null;
    allow_overlapping_entries: boolean;
    allow_future_entries: boolean;
    require_project: boolean;
    require_task_or_ticket: boolean;
    require_description: boolean;
    require_activity_type: boolean;
    edit_window_days: number | null;
    locked_before_date: string | null;
    idle_timeout_minutes: number | null;
    timer_auto_stop_hours: number | null;
    missing_time_reminder_enabled: boolean;
    submission_reminder_enabled: boolean;
    default_expected_hours_per_week: string;
    utilization_target_percent: string | null;
    utilization_billable_only: boolean;
    reporting_currency: string | null;
}

export type UpdateTimeSettingsDto = Partial<Omit<TimeTrackingSettings, "organization_id" | "max_hours_per_day" | "default_expected_hours_per_week" | "utilization_target_percent">> & {
    max_hours_per_day?: number | null;
    default_expected_hours_per_week?: number;
    utilization_target_percent?: number | null;
};

export interface TimeActivityType {
    id: string;
    name: string;
    slug: string;
    description: string | null;
    color: string | null;
    default_billable: boolean | null;
    default_non_billable_category: TimeNonBillableCategory | null;
    is_default: boolean;
    sort_order: number;
    archived_at: string | null;
}

export interface ActivityTypeDto {
    name: string;
    description?: string;
    color?: string;
    default_billable?: boolean | null;
    default_non_billable_category?: TimeNonBillableCategory | null;
    is_default?: boolean;
}

export interface TimeProjectOption {
    id: string;
    name: string;
    code: string | null;
    color: string | null;
    company: { id: string; name: string } | null;
    time_settings: { default_billable: boolean | null; require_task: boolean; default_activity_type_id: string | null } | null;
}

export interface TimeTaskOption {
    id: string;
    number: number;
    title: string;
    project_id: string | null;
    completed_at: string | null;
    team: { task_key: string | null } | null;
}
