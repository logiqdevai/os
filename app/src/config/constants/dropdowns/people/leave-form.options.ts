import type { BadgeVariant } from "@/components/ui/badge";
import type { LeaveAccrualMethod, LeaveCategory, LeaveDayPart, LeaveRequestStatus } from "@/features/people/leave/interfaces/leave.interfaces";
import type { BoardState } from "@/features/people/attendance/interfaces/attendance.interfaces";
import type { AttendanceSource, CapacityStatus, LeaveApproverStrategy } from "@/features/people/overview/interfaces/overview.interfaces";
import type { DropdownOption } from "@/lib/dropdown-option-label.utils";

export const LeaveStatusFormOptions: DropdownOption<LeaveRequestStatus>[] = [
    { id: "DRAFT", label: "Draft" },
    { id: "PENDING", label: "Pending" },
    { id: "APPROVED", label: "Approved" },
    { id: "REJECTED", label: "Rejected" },
    { id: "CANCELLED", label: "Cancelled" },
    { id: "WITHDRAWN", label: "Withdrawn" },
];
export const LeaveStatusFilterOptions: DropdownOption<LeaveRequestStatus | "all">[] = [{ id: "all", label: "All statuses" }, ...LeaveStatusFormOptions];
export const LeaveStatusTone: Record<LeaveRequestStatus, BadgeVariant> = { DRAFT: "neutral", PENDING: "warning", APPROVED: "success", REJECTED: "danger", CANCELLED: "neutral", WITHDRAWN: "neutral" };

export const LeaveDayPartFormOptions: DropdownOption<LeaveDayPart>[] = [
    { id: "FULL_DAY", label: "Full day" },
    { id: "FIRST_HALF", label: "Morning (first half)" },
    { id: "SECOND_HALF", label: "Afternoon (second half)" },
];

export const AttendanceStateOptions: DropdownOption<BoardState>[] = [
    { id: "CLOCKED_IN", label: "Clocked in" },
    { id: "ON_BREAK", label: "On break" },
    { id: "CLOCKED_OUT", label: "Clocked out" },
    { id: "ON_LEAVE", label: "On leave" },
    { id: "NOT_IN", label: "Not in" },
];
export const AttendanceStateTone: Record<BoardState, BadgeVariant> = { CLOCKED_IN: "success", ON_BREAK: "warning", CLOCKED_OUT: "neutral", ON_LEAVE: "violet", NOT_IN: "secondary" };

export const CapacityStatusOptions: DropdownOption<CapacityStatus>[] = [
    { id: "UNDERUTILIZED", label: "Underutilized" },
    { id: "BALANCED", label: "Balanced" },
    { id: "OVERLOADED", label: "Overloaded" },
];
export const CapacityStatusFilterOptions: DropdownOption<CapacityStatus | "all">[] = [{ id: "all", label: "Any status" }, ...CapacityStatusOptions];
export const CapacityStatusTone: Record<CapacityStatus, BadgeVariant> = { UNDERUTILIZED: "info", BALANCED: "success", OVERLOADED: "danger" };


export const LeaveCategoryFormOptions: DropdownOption<LeaveCategory>[] = [
    { id: "VACATION", label: "Vacation" },
    { id: "SICK", label: "Sick" },
    { id: "PERSONAL", label: "Personal" },
    { id: "MATERNITY", label: "Maternity" },
    { id: "PATERNITY", label: "Paternity" },
    { id: "PARENTAL", label: "Parental" },
    { id: "UNPAID", label: "Unpaid" },
    { id: "PUBLIC_HOLIDAY", label: "Public holiday" },
    { id: "COMPANY_HOLIDAY", label: "Company holiday" },
    { id: "TIME_OFF", label: "Time off in lieu" },
    { id: "OTHER", label: "Other" },
];

export const LeaveAccrualFormOptions: DropdownOption<LeaveAccrualMethod>[] = [
    { id: "ANNUAL_UPFRONT", label: "Annual, up front" },
    { id: "MONTHLY", label: "Monthly" },
    { id: "PER_HOURS_WORKED", label: "Per hours worked" },
    { id: "NONE", label: "No accrual" },
];

/** LeaveType.color stores a semantic tone name (never a hex colour). */
export const LeaveApproverStrategyFormOptions: DropdownOption<LeaveApproverStrategy>[] = [
    { id: "DIRECT_MANAGER", label: "Direct manager" },
    { id: "HR", label: "HR" },
    { id: "MANAGER_THEN_HR", label: "Manager, then HR" },
    { id: "CUSTOM", label: "Custom workflow (Automation)" },
];

export const AttendanceSourceFormOptions: DropdownOption<AttendanceSource>[] = [
    { id: "WEB", label: "Web" },
    { id: "MOBILE", label: "Mobile" },
    { id: "MANUAL", label: "Manual" },
    { id: "IMPORT", label: "Import" },
    { id: "SYSTEM", label: "System" },
];

export const HolidayKindFormOptions: DropdownOption<"PUBLIC" | "COMPANY">[] = [
    { id: "PUBLIC", label: "Public holiday" },
    { id: "COMPANY", label: "Company holiday" },
];
