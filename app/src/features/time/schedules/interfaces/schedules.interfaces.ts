import type { TimeMember } from "@/features/time/settings/interfaces/time-settings.interfaces";

export type TimeReportFrequency = "DAILY" | "WEEKLY" | "MONTHLY";

export interface ReportScheduleFilters {
    scope?: "mine" | "team" | "all";
    project_id?: string;
    company_id?: string;
    membership_id?: string;
    billable?: boolean;
}

export interface TimeReportSchedule {
    id: string;
    name: string;
    report_key: string;
    filters: ReportScheduleFilters;
    frequency: TimeReportFrequency;
    day_of_week: number | null;
    day_of_month: number | null;
    time_of_day: string;
    timezone: string;
    recipient_membership_ids: string[];
    recipient_emails: string[];
    is_active: boolean;
    next_run_at: string | null;
    last_run_at: string | null;
    last_error: string | null;
    created_by_membership_id: string | null;
    created_by: TimeMember | null;
    exports: { id: string; status: string; row_count: number | null; created_at: string; error: string | null }[];
}

export interface ReportScheduleDto {
    name: string;
    report_key: string;
    filters: ReportScheduleFilters;
    frequency: TimeReportFrequency;
    day_of_week?: number;
    day_of_month?: number;
    time_of_day: string;
    timezone: string;
    recipient_membership_ids: string[];
    recipient_emails: string[];
    is_active: boolean;
}
