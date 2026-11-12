import type { BadgeVariant } from "@/components/ui/badge";
import type { TimeEntryStatus, TimeScope } from "@/features/time/entries/interfaces/time-entries.interfaces";
import type { TimesheetStatus } from "@/features/time/timesheets/interfaces/timesheets.interfaces";
import type { BillingRateScope, RateStatusFilter, TimeRateKind } from "@/features/time/rates/interfaces/rates.interfaces";
import type { ReportGroupBy } from "@/features/time/reports/interfaces/reports.interfaces";
import type { TimeNonBillableCategory, TimeRoundingMode, TimesheetApproverPolicy } from "@/features/time/settings/interfaces/time-settings.interfaces";
import type { TimeSuggestionSource } from "@/features/time/suggestions/interfaces/suggestions.interfaces";
import type { TimeImportStatus } from "@/features/time/imports/interfaces/imports.interfaces";
import type { TimeReportFrequency } from "@/features/time/schedules/interfaces/schedules.interfaces";
import type { DropdownOption } from "@/lib/dropdown-option-label.utils";

/** Canonical labels for 18 Time Tracking enums (schema: TimeEntry, Timesheet, BillingRate, TimeTrackingSettings). */
export const TimeEntryStatusFormOptions: DropdownOption<TimeEntryStatus>[] = [
    { id: "DRAFT", label: "Draft" },
    { id: "SUBMITTED", label: "Submitted" },
    { id: "APPROVED", label: "Approved" },
    { id: "REJECTED", label: "Rejected" },
    { id: "INVOICED", label: "Invoiced" },
    { id: "LOCKED", label: "Locked" },
];
export const TimeEntryStatusFilterOptions: DropdownOption<TimeEntryStatus | "all">[] = [{ id: "all", label: "All statuses" }, ...TimeEntryStatusFormOptions];
export const TimeEntryStatusTone: Record<TimeEntryStatus, BadgeVariant> = { DRAFT: "neutral", SUBMITTED: "info", APPROVED: "success", REJECTED: "danger", INVOICED: "violet", LOCKED: "secondary" };

export const TimesheetStatusFormOptions: DropdownOption<TimesheetStatus | "NOT_STARTED">[] = [
    { id: "NOT_STARTED", label: "Not started" },
    { id: "OPEN", label: "Open" },
    { id: "SUBMITTED", label: "Submitted" },
    { id: "APPROVED", label: "Approved" },
    { id: "REJECTED", label: "Rejected" },
    { id: "LOCKED", label: "Locked" },
];
export const TimesheetStatusTone: Record<TimesheetStatus | "NOT_STARTED", BadgeVariant> = { NOT_STARTED: "secondary", OPEN: "neutral", SUBMITTED: "info", APPROVED: "success", REJECTED: "danger", LOCKED: "violet" };

export const TimeScopeOptions: DropdownOption<TimeScope>[] = [
    { id: "mine", label: "Mine" },
    { id: "team", label: "Team" },
    { id: "all", label: "All" },
];

export const BillableFilterOptions: DropdownOption<"all" | "true" | "false">[] = [
    { id: "all", label: "Billable & not" },
    { id: "true", label: "Billable" },
    { id: "false", label: "Non-billable" },
];

export const NonBillableCategoryFormOptions: DropdownOption<TimeNonBillableCategory>[] = [
    { id: "INTERNAL", label: "Internal" },
    { id: "PRE_SALES", label: "Pre-sales" },
    { id: "WARRANTY", label: "Warranty" },
    { id: "OVERHEAD", label: "Overhead" },
    { id: "LEAVE", label: "Leave" },
    { id: "TRAINING", label: "Training" },
    { id: "ADMIN", label: "Admin" },
];

export const RateKindFormOptions: DropdownOption<TimeRateKind>[] = [
    { id: "BILLING", label: "Billing rate" },
    { id: "COST", label: "Cost rate" },
];
export const RateScopeFormOptions: DropdownOption<BillingRateScope>[] = [
    { id: "ORGANIZATION", label: "Organization default" },
    { id: "PROJECT", label: "Project" },
    { id: "MEMBER", label: "Member" },
    { id: "PROJECT_MEMBER", label: "Member on a project" },
    { id: "PRODUCT", label: "Product / service" },
];
export const RateStatusFilterOptions: DropdownOption<RateStatusFilter>[] = [
    { id: "active", label: "Active" },
    { id: "scheduled", label: "Scheduled" },
    { id: "expired", label: "Expired" },
    { id: "archived", label: "Archived" },
    { id: "all", label: "All" },
];

export const ReportGroupByOptions: DropdownOption<ReportGroupBy>[] = [
    { id: "project", label: "By project" },
    { id: "customer", label: "By customer" },
    { id: "member", label: "By person" },
    { id: "activity", label: "By activity" },
    { id: "task", label: "By task" },
    { id: "day", label: "By day" },
];

export const RoundingModeFormOptions: DropdownOption<TimeRoundingMode>[] = [
    { id: "NONE", label: "No rounding" },
    { id: "NEAREST", label: "Nearest" },
    { id: "UP", label: "Round up" },
    { id: "DOWN", label: "Round down" },
];

export const ApproverPolicyFormOptions: DropdownOption<TimesheetApproverPolicy>[] = [
    { id: "MANAGER", label: "The member's manager" },
    { id: "TEAM_LEAD", label: "Team lead" },
    { id: "PROJECT_OWNER", label: "Project owner" },
    { id: "SPECIFIC_MEMBER", label: "A specific member" },
];

export const SuggestionSourceFormOptions: DropdownOption<TimeSuggestionSource>[] = [
    { id: "CALENDAR", label: "Calendar" },
    { id: "TASK_ACTIVITY", label: "Task activity" },
    { id: "COMMIT", label: "Commit" },
    { id: "ATTENDANCE", label: "Attendance" },
    { id: "AI", label: "AI" },
];
export const TimeImportStatusFormOptions: DropdownOption<TimeImportStatus>[] = [
    { id: "PENDING", label: "Waiting for mapping" },
    { id: "PROCESSING", label: "Importing" },
    { id: "COMPLETED", label: "Completed" },
    { id: "FAILED", label: "Failed" },
    { id: "CANCELLED", label: "Cancelled" },
];
export const TimeImportStatusTone: Record<TimeImportStatus, BadgeVariant> = { PENDING: "neutral", PROCESSING: "warning", COMPLETED: "success", FAILED: "danger", CANCELLED: "neutral" };
export const ReportFrequencyFormOptions: DropdownOption<TimeReportFrequency>[] = [
    { id: "DAILY", label: "Daily (yesterday)" },
    { id: "WEEKLY", label: "Weekly (last week)" },
    { id: "MONTHLY", label: "Monthly (last month)" },
];
export const IsoWeekdayOptions: DropdownOption<string>[] = [
    { id: "1", label: "Monday" },
    { id: "2", label: "Tuesday" },
    { id: "3", label: "Wednesday" },
    { id: "4", label: "Thursday" },
    { id: "5", label: "Friday" },
    { id: "6", label: "Saturday" },
    { id: "7", label: "Sunday" },
];
export const ProjectBillableDefaultOptions: DropdownOption<"inherit" | "billable" | "non_billable">[] = [
    { id: "inherit", label: "Organization default" },
    { id: "billable", label: "Billable" },
    { id: "non_billable", label: "Non-billable" },
];
