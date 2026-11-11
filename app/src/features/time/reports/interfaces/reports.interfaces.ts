import type { TimeMember } from "@/features/time/settings/interfaces/time-settings.interfaces";

export type ReportGroupBy = "project" | "member" | "customer" | "activity" | "day" | "task";

export interface ReportGroup {
    key: string;
    label: string;
    sublabel: string | null;
    total_minutes: number;
    billable_minutes: number;
    non_billable_minutes: number;
    entries: number;
    billable_amount?: number;
    cost_amount?: number;
}

export interface TimeSummaryReport {
    from: string;
    to: string;
    scope: string;
    group_by: ReportGroupBy;
    currency: string | null;
    totals: { total_minutes: number; billable_minutes: number; non_billable_minutes: number; entries: number; billable_ratio: number | null; billable_amount?: number; cost_amount?: number };
    groups: ReportGroup[];
    by_day: { date: string; billable_minutes: number; non_billable_minutes: number }[];
    non_billable_by_category: { category: string; minutes: number }[];
}

export interface UtilizationRow {
    membership: TimeMember;
    expected_minutes: number;
    logged_minutes: number;
    billable_minutes: number;
    leave_minutes: number;
    utilization_percent: number | null;
    billable_ratio: number | null;
}

export interface UtilizationReport {
    from: string;
    to: string;
    scope: string;
    working_days: number;
    target_percent: number | null;
    billable_only: boolean;
    rows: UtilizationRow[];
    totals: { expected_minutes: number; logged_minutes: number; utilization_percent: number | null };
}

export interface UnbilledProject {
    project: { id: string; name: string; code: string | null } | null;
    entries: number;
    billable_minutes: number;
    amount?: number;
    currency: string | null;
    oldest_date: string;
    newest_date: string;
    missing_rate: number;
    entry_ids: string[];
}

export interface UnbilledReport {
    groups: { customer: { id: string; name: string } | null; billable_minutes: number; amount?: number; projects: UnbilledProject[] }[];
    totals: { entries: number; billable_minutes: number; amount?: number; currency: string | null; missing_rate: number; no_project: number };
    awaiting_approval: { entries: number; billable_minutes: number };
}

export interface ReportFilters {
    from: string;
    to: string;
    group_by?: ReportGroupBy;
    scope?: string;
    project_id?: string;
    membership_id?: string;
    billable?: string;
}
