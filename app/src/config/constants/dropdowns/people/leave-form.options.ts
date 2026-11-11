import type { BadgeVariant } from "@/components/ui/badge";
import type { LeaveDayPart, LeaveRequestStatus } from "@/features/people/leave/interfaces/leave.interfaces";
import type { BoardState } from "@/features/people/attendance/interfaces/attendance.interfaces";
import type { CapacityStatus } from "@/features/people/overview/interfaces/overview.interfaces";
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

export const LeaveTypeColorTone: Record<string, BadgeVariant> = { info: "info", success: "success", warning: "warning", danger: "danger", violet: "violet", neutral: "neutral" };
