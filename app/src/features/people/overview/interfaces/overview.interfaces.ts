import type { AvailabilityStatus, Ref } from "@/features/people/employees/interfaces/employees.interfaces";

export interface PeopleOverview {
    headcount: {
        active: number;
        by_status: Record<string, number>;
        by_type: { type: string; count: number }[];
        by_department: { department: Ref | null; count: number }[];
        hires_90d: number;
        leavers_90d: number;
        onboarding: number;
        offboarding: number;
    } | null;
    leave: {
        out_today: { request_id: string; employee_id: string; name: string; photo_url: string | null; leave_type: { name: string; color: string | null }; until: string }[];
        pending_requests: number;
        upcoming_14d: number;
    } | null;
    attendance: { clocked_in_now: number; late_today: number; worked_minutes_7d: number; overtime_minutes_7d: number; records_7d: number } | null;
    capacity: { week_start: string; computed: boolean; available_hours: number; planned_hours: number; logged_hours: number; allocation_percent: number | null; overloaded: number; underutilized: number } | null;
    performance: { active_cycle: { id: string; name: string; due_date: string | null; total: number; completed: number; by_status: Record<string, number> } | null } | null;
    celebrations: { employee_id: string; name: string; photo_url: string | null; kind: "ANNIVERSARY" | "BIRTHDAY"; date: string; years?: number }[] | null;
}

export type CapacityStatus = "UNDERUTILIZED" | "BALANCED" | "OVERLOADED";

export interface CapacityPeriod {
    period_start: string;
    period_end: string;
    scheduled_hours: number;
    holiday_hours: number;
    leave_hours: number;
    available_hours: number;
    planned_hours: number;
    logged_hours: number;
    allocation_percent: number;
    utilization_percent: number;
    status: CapacityStatus;
    breakdown: { projects: { project_id: string; name: string; hours: number }[] };
}

export interface CapacityReport {
    from: string;
    to: string;
    weeks: number;
    thresholds: { overload: number; underutilized: number; target: number };
    totals: { available_hours: number; planned_hours: number; logged_hours: number };
    rows: { employee: { id: string; name: string; photo_url: string | null; job_title: string | null; department: Ref | null; availability_status: AvailabilityStatus }; periods: CapacityPeriod[] }[];
}

export interface HrSettings {
    default_weekly_hours: string;
    leave_approver_strategy: "DIRECT_MANAGER" | "HR" | "MANAGER_THEN_HR" | "CUSTOM";
    profile_changes_require_approval: boolean;
    target_utilization_percent: string;
    overload_threshold_percent: string;
    underutilized_threshold_percent: string;
    late_tolerance_minutes: number;
    overtime_threshold_minutes: number;
}
