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

export const ActivityScopeOptions: { id: "organization" | "project" | "customer"; label: string }[] = [
    { id: "organization", label: "Organization" },
    { id: "project", label: "Project" },
    { id: "customer", label: "Customer" },
];
