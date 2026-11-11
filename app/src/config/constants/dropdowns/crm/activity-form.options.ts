import type { ActivityDirection, ActivityStatus, ActivityType, Priority } from "@/features/crm/activities/interfaces/activities.interfaces";
import type { DropdownOption } from "@/lib/dropdown-option-label.utils";

/** CrmActivity.type (02 §13). */
export const ActivityTypeFormOptions: DropdownOption<ActivityType>[] = [
    { id: "CALL", label: "Call" },
    { id: "MEETING", label: "Meeting" },
    { id: "EMAIL", label: "Email" },
    { id: "FOLLOW_UP", label: "Follow-up" },
    { id: "REMINDER", label: "Reminder" },
    { id: "APPOINTMENT", label: "Appointment" },
    { id: "INTERNAL_COMMENT", label: "Internal comment" },
    { id: "OTHER", label: "Other" },
];
export const ActivityTypeFilterOptions: DropdownOption<ActivityType | "all">[] = [{ id: "all", label: "All types" }, ...ActivityTypeFormOptions];

export const ActivityStatusFormOptions: DropdownOption<ActivityStatus>[] = [
    { id: "PLANNED", label: "Planned" },
    { id: "COMPLETED", label: "Completed" },
    { id: "CANCELLED", label: "Cancelled" },
    { id: "NO_SHOW", label: "No-show" },
];

export const PriorityFormOptions: DropdownOption<Priority>[] = [
    { id: "LOW", label: "Low" },
    { id: "NORMAL", label: "Normal" },
    { id: "HIGH", label: "High" },
    { id: "URGENT", label: "Urgent" },
];

export const ActivityDirectionFormOptions: DropdownOption<ActivityDirection>[] = [
    { id: "OUTBOUND", label: "Outbound" },
    { id: "INBOUND", label: "Inbound" },
];

/** Activities screen tabs (`due` filter of GET /crm/activities). */
export const ActivityDueFilterOptions: DropdownOption<"open" | "overdue" | "today" | "upcoming" | "completed" | "all">[] = [
    { id: "open", label: "Open" },
    { id: "overdue", label: "Overdue" },
    { id: "today", label: "Today" },
    { id: "upcoming", label: "Upcoming" },
    { id: "completed", label: "Completed" },
    { id: "all", label: "All" },
];
