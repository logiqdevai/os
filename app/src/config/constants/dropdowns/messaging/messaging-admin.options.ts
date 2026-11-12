import type { ChannelKind } from "@/features/messaging/interfaces/messaging.interfaces";
import type {
    ChannelCallKind, ExportFormat, MessageReportStatus, ModerationAction, ReportReason, RetentionAction, RetentionScope,
} from "@/features/messaging/interfaces/messaging-admin.interfaces";

export const ReportReasonOptions: { id: ReportReason; label: string }[] = [
    { id: "spam", label: "Spam" },
    { id: "abuse", label: "Harassment or abuse" },
    { id: "sensitive_data", label: "Shares sensitive data" },
    { id: "off_topic", label: "Off topic" },
    { id: "other", label: "Something else" },
];

export const ReportStatusOptions: { id: MessageReportStatus; label: string }[] = [
    { id: "OPEN", label: "Open" },
    { id: "UNDER_REVIEW", label: "Under review" },
    { id: "ACTIONED", label: "Actioned" },
    { id: "DISMISSED", label: "Dismissed" },
];

export const ModerationActionOptions: { id: ModerationAction; label: string; hint: string }[] = [
    { id: "none", label: "No action", hint: "Close the report without changes" },
    { id: "warning", label: "Warn the author", hint: "Record a warning; the message stays" },
    { id: "hide", label: "Hide the message", hint: "Removed from the channel, kept for audit" },
    { id: "delete", label: "Delete the message", hint: "Content erased permanently" },
    { id: "mute", label: "Mute the author here", hint: "Cannot post in this channel" },
    { id: "ban", label: "Ban the author here", hint: "Removed from this channel and cannot post" },
];

export const RestrictionDurationOptions: { id: string; label: string }[] = [
    { id: "24", label: "24 hours" },
    { id: "168", label: "7 days" },
    { id: "720", label: "30 days" },
    { id: "forever", label: "Until lifted" },
];

export const ChannelCallKindOptions: { id: ChannelCallKind; label: string }[] = [
    { id: "HUDDLE", label: "Huddle" },
    { id: "VOICE", label: "Voice call" },
    { id: "VIDEO", label: "Video call" },
];

export const RetentionScopeOptions: { id: RetentionScope; label: string }[] = [
    { id: "ORGANIZATION", label: "Whole organization" },
    { id: "CHANNEL_KIND", label: "Kind of conversation" },
    { id: "BRANCH", label: "Branch" },
    { id: "TEAM", label: "Team" },
    { id: "CHANNEL", label: "Specific channels" },
];

export const RetentionActionOptions: { id: RetentionAction; label: string }[] = [
    { id: "UNLIMITED", label: "Keep forever" },
    { id: "ARCHIVE", label: "Archive inactive channels" },
    { id: "DELETE", label: "Delete messages" },
];

export const RetentionChannelKindOptions: { id: ChannelKind; label: string }[] = [
    { id: "PUBLIC", label: "Public channels" },
    { id: "PRIVATE", label: "Private channels" },
    { id: "DIRECT", label: "Direct messages" },
    { id: "GROUP_DIRECT", label: "Group messages" },
    { id: "PROJECT", label: "Project channels" },
    { id: "CUSTOMER", label: "Customer channels" },
    { id: "ANNOUNCEMENT", label: "Announcements" },
];

export const ExportFormatOptions: { id: ExportFormat; label: string }[] = [
    { id: "JSON", label: "JSON" },
    { id: "CSV", label: "CSV (spreadsheet)" },
    { id: "HTML", label: "HTML (readable)" },
];

export const CallProviderOptions: { id: string; label: string }[] = [
    { id: "internal", label: "Huddles only (no media)" },
    { id: "google_meet", label: "Google Meet links" },
    { id: "zoom", label: "Zoom links" },
    { id: "teams", label: "Microsoft Teams links" },
    { id: "custom", label: "Other meeting links" },
];

export const PolicyLevelOptions: { id: "everyone" | "admins" | "owners"; label: string }[] = [
    { id: "everyone", label: "Everyone" },
    { id: "admins", label: "Channel admins" },
    { id: "owners", label: "Channel owners" },
];

export const OverviewRangeOptions: { id: "7d" | "30d" | "90d"; label: string }[] = [
    { id: "7d", label: "Last 7 days" },
    { id: "30d", label: "Last 30 days" },
    { id: "90d", label: "Last 90 days" },
];
