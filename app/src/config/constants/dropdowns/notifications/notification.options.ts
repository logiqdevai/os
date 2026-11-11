import type { CoalesceKey, DeliveryMode, DeliveryStatus, DigestStatus, EventStatus, RuleKind, SkipReason } from "@/features/notifications/interfaces/notification-admin.interfaces";
import type {
    AnnouncementStatus, DigestFrequency, NotificationCategory, NotificationChannel, NotificationLevel, NotificationPriority, NotificationState,
} from "@/features/notifications/interfaces/notifications.interfaces";

/** Inbox tabs (14 §7). */
export const NotificationStateOptions: { id: NotificationState; label: string }[] = [
    { id: "unread", label: "Unread" },
    { id: "all", label: "All" },
    { id: "action", label: "Waiting on you" },
    { id: "snoozed", label: "Snoozed" },
    { id: "archived", label: "Archived" },
];

export const NotificationCategoryFormOptions: { id: NotificationCategory; label: string }[] = [
    { id: "MENTION", label: "Mentions" },
    { id: "ASSIGNMENT", label: "Assigned to me" },
    { id: "APPROVAL", label: "Approvals" },
    { id: "INVITATION", label: "Invitations" },
    { id: "REMINDER", label: "Reminders" },
    { id: "STATUS_CHANGE", label: "Updates" },
    { id: "DIRECT_MESSAGE", label: "Direct messages" },
    { id: "REPLY", label: "Replies" },
    { id: "REACTION", label: "Reactions" },
    { id: "DUE_DATE", label: "Due dates" },
    { id: "SHARE", label: "Shared with me" },
    { id: "SLA", label: "SLA" },
    { id: "SECURITY", label: "Security" },
    { id: "BILLING", label: "Billing" },
    { id: "ANNOUNCEMENT", label: "Announcements" },
    { id: "SYSTEM", label: "System" },
    { id: "GENERAL", label: "General" },
];
export const NotificationCategoryFilterOptions: { id: NotificationCategory | "all"; label: string }[] = [{ id: "all", label: "All categories" }, ...NotificationCategoryFormOptions];

/** ModuleKey labels used by the inbox / activity filters. */
export const ModuleLabelOptions: { id: string; label: string }[] = [
    { id: "CRM", label: "CRM" },
    { id: "PROPOSALS", label: "Proposals" },
    { id: "CONTRACTS", label: "Contracts" },
    { id: "PROJECTS", label: "Projects" },
    { id: "TASKS", label: "Tasks" },
    { id: "CUSTOMER_PORTAL", label: "Client portal" },
    { id: "FINANCE", label: "Billing" },
    { id: "INCOME_EXPENSE", label: "Income & expenses" },
    { id: "EMPLOYEES", label: "People" },
    { id: "COMMUNICATION", label: "Campaigns" },
    { id: "MESSAGING", label: "Messages" },
    { id: "SUPPORT", label: "Support" },
    { id: "NOTIFICATIONS", label: "Notifications" },
    { id: "BUSINESS_DOCS", label: "Docs" },
    { id: "DOCUMENTS", label: "Files" },
    { id: "TIME_TRACKING", label: "Time" },
    { id: "CALENDAR", label: "Calendar" },
    { id: "AUTOMATION", label: "Automation" },
    { id: "ADMINISTRATION", label: "Admin" },
];
export const ModuleFilterOptions: { id: string; label: string }[] = [{ id: "all", label: "All modules" }, ...ModuleLabelOptions];

export const NotificationPriorityFormOptions: { id: NotificationPriority; label: string }[] = [
    { id: "LOW", label: "Low" },
    { id: "NORMAL", label: "Normal" },
    { id: "IMPORTANT", label: "Important" },
    { id: "CRITICAL", label: "Critical" },
];

export const NotificationChannelOptions: { id: NotificationChannel; label: string }[] = [
    { id: "IN_APP", label: "In-app" },
    { id: "EMAIL", label: "Email" },
    { id: "SMS", label: "SMS" },
    { id: "PUSH", label: "Push" },
    { id: "DESKTOP", label: "Desktop" },
];

export const NotificationLevelFormOptions: { id: NotificationLevel; label: string }[] = [
    { id: "ALL", label: "Everything" },
    { id: "IMPORTANT_ONLY", label: "Important only" },
    { id: "MENTIONS_AND_DIRECT", label: "Mentions and direct only" },
    { id: "NONE", label: "Nothing (mandatory only)" },
];

export const DigestFrequencyFormOptions: { id: DigestFrequency; label: string }[] = [
    { id: "IMMEDIATE", label: "Send right away" },
    { id: "HOURLY", label: "Hourly digest" },
    { id: "DAILY", label: "Daily digest" },
    { id: "WEEKLY", label: "Weekly digest" },
];

export const AnnouncementStatusFormOptions: { id: AnnouncementStatus; label: string }[] = [
    { id: "DRAFT", label: "Draft" },
    { id: "SCHEDULED", label: "Scheduled" },
    { id: "LIVE", label: "Live" },
    { id: "EXPIRED", label: "Expired" },
    { id: "WITHDRAWN", label: "Withdrawn" },
];
export const AnnouncementStatusFilterOptions: { id: AnnouncementStatus | "all"; label: string }[] = [{ id: "all", label: "All statuses" }, ...AnnouncementStatusFormOptions];

export const PreferenceSourceOptions: { id: "own" | "organization" | "platform"; label: string }[] = [
    { id: "own", label: "Your choice" },
    { id: "organization", label: "Organization default" },
    { id: "platform", label: "Default" },
];

export const WeekdayShortOptions: { id: number; label: string }[] = [
    { id: 1, label: "Mon" },
    { id: 2, label: "Tue" },
    { id: 3, label: "Wed" },
    { id: 4, label: "Thu" },
    { id: 5, label: "Fri" },
    { id: 6, label: "Sat" },
    { id: 0, label: "Sun" },
];

// ---------------------------------------------------------------- administration (14 §4–§10)

export const DeliveryModeFormOptions: { id: DeliveryMode; label: string }[] = [
    { id: "IMMEDIATE", label: "Right away" },
    { id: "DIGEST", label: "In a digest" },
    { id: "OFF", label: "Off" },
];

export const DeliveryStatusOptions: { id: DeliveryStatus; label: string }[] = [
    { id: "PENDING", label: "Pending" },
    { id: "QUEUED", label: "Queued" },
    { id: "SENT", label: "Sent" },
    { id: "DELIVERED", label: "Delivered" },
    { id: "FAILED", label: "Failed" },
    { id: "SKIPPED", label: "Skipped" },
    { id: "DIGESTED", label: "In digest" },
    { id: "EXPIRED", label: "Expired" },
    { id: "CANCELLED", label: "Cancelled" },
];
export const DeliveryStatusFilterOptions: { id: DeliveryStatus | "all"; label: string }[] = [{ id: "all", label: "All statuses" }, ...DeliveryStatusOptions];

export const SkipReasonOptions: { id: SkipReason; label: string }[] = [
    { id: "PREFERENCE_OFF", label: "Turned off by the recipient" },
    { id: "LEVEL_FILTERED", label: "Filtered by level" },
    { id: "RECORD_MUTED", label: "Record muted" },
    { id: "QUIET_HOURS", label: "Quiet hours" },
    { id: "CHANNEL_DISABLED", label: "Channel off / suppressed" },
    { id: "CHANNEL_NOT_AVAILABLE", label: "No provider connected" },
    { id: "NO_ADDRESS", label: "No address" },
    { id: "NO_DEVICE", label: "No device" },
    { id: "DEDUPLICATED", label: "Duplicate" },
    { id: "COALESCED", label: "Coalesced" },
    { id: "THROTTLED", label: "Throttled" },
    { id: "PERMISSION_DENIED", label: "No access" },
    { id: "NOT_CUSTOMER_VISIBLE", label: "Not for customers" },
    { id: "EXPIRED", label: "Expired" },
];
export const SkipReasonFilterOptions: { id: SkipReason | "all"; label: string }[] = [{ id: "all", label: "Any reason" }, ...SkipReasonOptions];

export const EventStatusOptions: { id: EventStatus; label: string }[] = [
    { id: "RECEIVED", label: "Received" },
    { id: "PROCESSING", label: "Processing" },
    { id: "PROCESSED", label: "Processed" },
    { id: "IGNORED", label: "Ignored" },
    { id: "FAILED", label: "Failed" },
];

export const DigestStatusOptions: { id: DigestStatus; label: string }[] = [
    { id: "OPEN", label: "Collecting" },
    { id: "SCHEDULED", label: "Scheduled" },
    { id: "SENDING", label: "Sending" },
    { id: "SENT", label: "Sent" },
    { id: "EMPTY", label: "Empty" },
    { id: "FAILED", label: "Failed" },
];

export const RuleKindFormOptions: { id: RuleKind; label: string; hint: string }[] = [
    { id: "DEDUPLICATE", label: "Deduplicate", hint: "Never send the same event about the same record twice inside the window." },
    { id: "COALESCE", label: "Coalesce", hint: "Fold repeated events into the recipient's unread notification." },
    { id: "THROTTLE", label: "Throttle", hint: "At most N notifications per recipient inside the window." },
    { id: "SUPPRESS", label: "Suppress", hint: "Drop matching events (mandatory events are never suppressed)." },
];

export const CoalesceKeyFormOptions: { id: CoalesceKey; label: string }[] = [
    { id: "RECORD", label: "Same record" },
    { id: "RECORD_AND_ACTOR", label: "Same record and person" },
    { id: "EVENT_TYPE", label: "Same event type" },
    { id: "RECIPIENT", label: "Anything for the recipient" },
];

export const EventScopeFilterOptions: { id: "all" | "platform" | "organization"; label: string }[] = [
    { id: "all", label: "All event types" },
    { id: "platform", label: "Platform" },
    { id: "organization", label: "This organization" },
];

export const HourOptions: { id: string; label: string }[] = Array.from({ length: 24 }, (_, h) => ({ id: String(h), label: `${String(h).padStart(2, "0")}:00` }));

export const ActivityScopeOptions: { id: "organization" | "project" | "customer"; label: string }[] = [
    { id: "organization", label: "Organization" },
    { id: "project", label: "Project" },
    { id: "customer", label: "Customer" },
];
