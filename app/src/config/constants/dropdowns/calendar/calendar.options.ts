import type {
    AttendeeResponse, BookingLinkAudience, BookingLinkStatus, BookingStatus, CalendarKind, CalendarRole, CalendarView, EventVisibility, HostAssignment, ResourceKind,
} from "@/features/calendar/interfaces/calendar.interfaces";

export const CalendarViewOptions: { id: CalendarView; label: string }[] = [
    { id: "day", label: "Day" },
    { id: "week", label: "Week" },
    { id: "month", label: "Month" },
    { id: "agenda", label: "Agenda" },
];

export const EventVisibilityFormOptions: { id: EventVisibility; label: string }[] = [
    { id: "PRIVATE", label: "Private (others see Busy)" },
    { id: "TEAM", label: "Team" },
    { id: "ORGANIZATION", label: "Organization" },
    { id: "CUSTOMER_VISIBLE", label: "Visible to customer" },
];

export const RepeatFormOptions: { id: "none" | "DAILY" | "WEEKLY" | "MONTHLY"; label: string }[] = [
    { id: "none", label: "Does not repeat" },
    { id: "DAILY", label: "Every day" },
    { id: "WEEKLY", label: "Every week" },
    { id: "MONTHLY", label: "Every month" },
];

export const ReminderFormOptions: { id: string; label: string }[] = [
    { id: "none", label: "No reminder" },
    { id: "0", label: "At start" },
    { id: "5", label: "5 minutes before" },
    { id: "10", label: "10 minutes before" },
    { id: "15", label: "15 minutes before" },
    { id: "30", label: "30 minutes before" },
    { id: "60", label: "1 hour before" },
    { id: "1440", label: "1 day before" },
];

export const AttendeeResponseOptions: { id: AttendeeResponse; label: string }[] = [
    { id: "NEEDS_ACTION", label: "Awaiting reply" },
    { id: "ACCEPTED", label: "Going" },
    { id: "TENTATIVE", label: "Maybe" },
    { id: "DECLINED", label: "Declined" },
];

export const CalendarKindFormOptions: { id: CalendarKind; label: string }[] = [
    { id: "PERSONAL", label: "Personal" },
    { id: "TEAM", label: "Team" },
    { id: "PROJECT", label: "Project" },
    { id: "CUSTOMER", label: "Customer" },
    { id: "BRANCH", label: "Branch" },
    { id: "ORGANIZATION", label: "Organization" },
    { id: "RESOURCE", label: "Resource" },
    { id: "EXTERNAL", label: "External" },
];
export const CalendarKindFilterOptions: { id: CalendarKind | "all"; label: string }[] = [{ id: "all", label: "All kinds" }, ...CalendarKindFormOptions];

export const CalendarRoleOptions: { id: CalendarRole; label: string }[] = [
    { id: "FREE_BUSY", label: "Free/busy only" },
    { id: "READ", label: "See all details" },
    { id: "WRITE", label: "Make changes" },
    { id: "MANAGE", label: "Manage and share" },
];

export const ResourceKindFormOptions: { id: ResourceKind; label: string }[] = [
    { id: "ROOM", label: "Room" },
    { id: "EQUIPMENT", label: "Equipment" },
    { id: "VEHICLE", label: "Vehicle" },
    { id: "OTHER", label: "Other" },
];
export const ResourceKindFilterOptions: { id: ResourceKind | "all"; label: string }[] = [{ id: "all", label: "All kinds" }, ...ResourceKindFormOptions];

export const BookingLinkStatusFormOptions: { id: BookingLinkStatus; label: string }[] = [
    { id: "ACTIVE", label: "Active" },
    { id: "DRAFT", label: "Draft" },
    { id: "PAUSED", label: "Paused" },
    { id: "ARCHIVED", label: "Archived" },
];
export const BookingLinkStatusFilterOptions: { id: BookingLinkStatus | "all"; label: string }[] = [{ id: "all", label: "All (not archived)" }, ...BookingLinkStatusFormOptions];

export const BookingLinkAudienceOptions: { id: BookingLinkAudience; label: string }[] = [
    { id: "PUBLIC", label: "Public" },
    { id: "PORTAL", label: "Client portal" },
    { id: "INTERNAL", label: "Internal" },
];

export const HostAssignmentFormOptions: { id: HostAssignment; label: string }[] = [
    { id: "SINGLE", label: "One host" },
    { id: "ROUND_ROBIN", label: "Round robin (any free host)" },
    { id: "COLLECTIVE", label: "Collective (all hosts)" },
];

export const BookingStatusFormOptions: { id: BookingStatus; label: string }[] = [
    { id: "PENDING", label: "Pending" },
    { id: "CONFIRMED", label: "Confirmed" },
    { id: "RESCHEDULED", label: "Rescheduled" },
    { id: "CANCELLED", label: "Cancelled" },
    { id: "NO_SHOW", label: "No-show" },
    { id: "COMPLETED", label: "Completed" },
];
export const BookingStatusFilterOptions: { id: BookingStatus | "all"; label: string }[] = [{ id: "all", label: "All statuses" }, ...BookingStatusFormOptions];

export const WeekdayLongOptions: { id: number; label: string }[] = [
    { id: 1, label: "Monday" },
    { id: 2, label: "Tuesday" },
    { id: 3, label: "Wednesday" },
    { id: 4, label: "Thursday" },
    { id: 5, label: "Friday" },
    { id: 6, label: "Saturday" },
    { id: 0, label: "Sunday" },
];
