import type { PaginationMeta } from "@/components/ui/data-table";
import type { TimeMember, TimeNonBillableCategory } from "@/features/time/settings/interfaces/time-settings.interfaces";

export type TimeEntryStatus = "DRAFT" | "SUBMITTED" | "APPROVED" | "REJECTED" | "INVOICED" | "LOCKED";
export type TimeEntrySource = "MANUAL" | "TIMER" | "CALENDAR" | "IMPORTED" | "GENERATED";
export type TimeScope = "mine" | "team" | "all";

export interface TimeEntry {
    id: string;
    membership_id: string;
    date: string;
    start_at: string | null;
    end_at: string | null;
    duration_minutes: number;
    billable_minutes: number;
    project_id: string | null;
    task_id: string | null;
    activity_type_id: string | null;
    description: string | null;
    is_billable: boolean;
    billable_overridden: boolean;
    billable_override_reason: string | null;
    non_billable_category: TimeNonBillableCategory | null;
    /** Amount fields are omitted without time.rates.read. */
    billing_rate_amount?: string | null;
    billing_currency?: string | null;
    billable_amount?: string | null;
    cost_rate_amount?: string | null;
    cost_amount?: string | null;
    status: TimeEntryStatus;
    source: TimeEntrySource;
    timer_id: string | null;
    timesheet_id: string | null;
    is_locked: boolean;
    invoice_id: string | null;
    rejection_reason: string | null;
    unlock_reason: string | null;
    created_at: string;
    updated_at: string;
    membership: TimeMember;
    project: { id: string; name: string; code: string | null; color: string | null; company: { id: string; name: string } | null } | null;
    task: { id: string; number: number; title: string; team: { task_key: string | null } | null } | null;
    activity_type: { id: string; name: string; color: string | null } | null;
    timesheet: { id: string; status: string; period_start: string; period_end: string } | null;
}

export interface TimeEntryDetail extends TimeEntry {
    approved_by: TimeMember | null;
    approved_at: string | null;
    rejected_by: TimeMember | null;
    invoice: { id: string; number: string | null } | null;
}

export interface TimeEntryList {
    data: TimeEntry[];
    pagination: PaginationMeta & { has_next: boolean; has_prev: boolean };
    scope: TimeScope;
    totals: { duration_minutes: number; billable_minutes: number };
}

export interface TimeEntryDto {
    date: string;
    start_at?: string;
    end_at?: string;
    duration_minutes?: number;
    project_id?: string | null;
    task_id?: string | null;
    activity_type_id?: string | null;
    description?: string | null;
    is_billable?: boolean;
    billable_override_reason?: string;
    non_billable_category?: TimeNonBillableCategory | null;
    membership_id?: string;
}

export interface WeekGridRow {
    project_id: string | null;
    task_id: string | null;
    activity_type_id: string | null;
    is_billable: boolean;
    description?: string;
    days: Record<string, number>;
}

export interface WeekGridResult {
    created: number;
    updated: number;
    deleted: number;
    unchanged: number;
    skipped: { date: string; reason: string }[];
    errors: { date: string; message: string }[];
}
