import type { PaginationMeta } from "@/components/ui/data-table";
import type { TimeEntry } from "@/features/time/entries/interfaces/time-entries.interfaces";
import type { TimeMember } from "@/features/time/settings/interfaces/time-settings.interfaces";

export type TimesheetStatus = "OPEN" | "SUBMITTED" | "APPROVED" | "REJECTED" | "LOCKED";
export type TimesheetActionType = "SUBMITTED" | "APPROVED" | "REJECTED" | "REOPENED" | "LOCKED" | "UNLOCKED";

export interface Timesheet {
    id: string;
    membership_id: string;
    period_start: string;
    period_end: string;
    status: TimesheetStatus;
    total_minutes: number;
    billable_minutes: number;
    non_billable_minutes: number;
    expected_minutes: number | null;
    billable_amount?: string | null;
    currency?: string | null;
    submitted_at: string | null;
    approved_at: string | null;
    rejected_at: string | null;
    rejection_comment: string | null;
    submission_comment: string | null;
    unlock_reason: string | null;
    membership?: TimeMember;
    approver?: TimeMember | null;
    approved_by?: TimeMember | null;
    rejected_by?: TimeMember | null;
}

export interface TimesheetAction {
    id: string;
    action: TimesheetActionType;
    comment: string | null;
    from_status: TimesheetStatus | null;
    to_status: TimesheetStatus | null;
    created_at: string;
    actor: TimeMember | null;
}

export interface TimesheetDetail extends Timesheet {
    entries: TimeEntry[];
    actions: TimesheetAction[];
    can_approve: boolean;
}

export interface WeekData {
    membership: TimeMember | null;
    period_start: string;
    period_end: string;
    timesheet: (Timesheet & { actions: TimesheetAction[] }) | null;
    expected_minutes: number;
    entries: TimeEntry[];
    rules: { max_hours_per_day: string | null; allow_future_entries: boolean; require_approval: boolean };
}

export interface TeamWeekRow {
    membership: TimeMember;
    timesheet: Timesheet | null;
    status: TimesheetStatus | "NOT_STARTED";
    total_minutes: number;
    billable_minutes: number;
    expected_minutes: number;
}

export interface TeamWeek {
    period_start: string;
    period_end: string;
    scope: string;
    rows: TeamWeekRow[];
    counts: Record<string, number>;
}

export interface ApprovalRow extends Timesheet {
    projects: { project: { id: string; name: string; code: string | null } | null; minutes: number; billable_minutes: number }[];
}

export interface Paginated<T> {
    data: T[];
    pagination: PaginationMeta & { has_next: boolean; has_prev: boolean };
}
