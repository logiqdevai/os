import type { PaginationMeta } from "@/components/ui/data-table";

export interface Paginated<T> {
    data: T[];
    pagination: PaginationMeta & { has_next: boolean; has_prev: boolean };
}

export const NotificationStates = {
    UNREAD: "unread",
    ALL: "all",
    ACTION: "action",
    READ: "read",
    SNOOZED: "snoozed",
    ARCHIVED: "archived",
} as const;
export type NotificationState = (typeof NotificationStates)[keyof typeof NotificationStates];

export type NotificationCategory =
    | "GENERAL" | "MENTION" | "DIRECT_MESSAGE" | "REPLY" | "REACTION" | "ASSIGNMENT" | "APPROVAL" | "STATUS_CHANGE" | "REMINDER"
    | "DUE_DATE" | "INVITATION" | "SHARE" | "SLA" | "SECURITY" | "BILLING" | "ANNOUNCEMENT" | "SYSTEM";
export type NotificationPriority = "LOW" | "NORMAL" | "IMPORTANT" | "CRITICAL";
export type NotificationChannel = "IN_APP" | "EMAIL" | "SMS" | "PUSH" | "DESKTOP";
export type NotificationLevel = "ALL" | "IMPORTANT_ONLY" | "MENTIONS_AND_DIRECT" | "NONE";
export type DigestFrequency = "IMMEDIATE" | "HOURLY" | "DAILY" | "WEEKLY";
export type AnnouncementStatus = "DRAFT" | "SCHEDULED" | "LIVE" | "EXPIRED" | "WITHDRAWN";

export interface MemberUser {
    id: string;
    email: string;
    display_name: string | null;
    first_name: string | null;
    last_name: string | null;
    profile_photo_url: string | null;
}

export interface NotificationAction {
    key: string;
    label: string;
    style?: "primary" | "default" | "danger";
}

export interface NotificationItem {
    id: string;
    event_key: string;
    module: string;
    category: NotificationCategory;
    priority: NotificationPriority;
    title: string;
    body: string | null;
    action_url: string | null;
    entity_type: string | null;
    entity_id: string | null;
    entity_label: string | null;
    is_mandatory: boolean;
    requires_action: boolean;
    actions: NotificationAction[] | null;
    action_taken: string | null;
    action_taken_at: string | null;
    data: Record<string, unknown> | null;
    seen_at: string | null;
    read_at: string | null;
    archived_at: string | null;
    snoozed_until: string | null;
    created_at: string;
    last_event_at: string;
    actor: { id: string; user: MemberUser } | null;
    event_type: { id: string; key: string; name: string; description?: string | null } | null;
}

export interface NotificationCounts {
    unread: number;
    unseen: number;
    action: number;
}

export interface RecipientSettings {
    level: NotificationLevel;
    in_app_enabled: boolean;
    email_enabled: boolean;
    push_enabled: boolean;
    sound_enabled: boolean;
    show_previews: boolean;
    dnd_enabled: boolean;
    dnd_start_time: string | null;
    dnd_end_time: string | null;
    dnd_weekdays: number[];
    dnd_until: string | null;
    timezone: string | null;
    dnd_allow_critical: boolean;
    digest_frequency: DigestFrequency;
    organization: { enabled_channels: NotificationChannel[] };
}
export type UpdateRecipientSettingsDto = Partial<Omit<RecipientSettings, "organization">>;

export interface EventPreferenceRow {
    event_type: { id: string; key: string; name: string; description: string | null; module: string; category: NotificationCategory; priority: NotificationPriority };
    mandatory: boolean;
    channels: { channel: NotificationChannel; enabled: boolean; source: "own" | "organization" | "platform"; locked: boolean }[];
}

export interface ActivityItem {
    id: string;
    event_key: string;
    module: string;
    summary: string;
    entity_type: string | null;
    entity_id: string | null;
    entity_label: string | null;
    project_id: string | null;
    company_id: string | null;
    occurred_at: string;
    actor: { id: string; user: MemberUser } | null;
}

export interface AnnouncementAudience {
    membership_ids?: string[];
    team_ids?: string[];
    branch_ids?: string[];
}

export interface AnnouncementAudienceOptions {
    members: { id: string; name: string; email: string }[];
    teams: { id: string; name: string; member_count: number }[];
    branches: { id: string; name: string }[];
}

export interface Announcement {
    id: string;
    title: string;
    body: string;
    severity: NotificationPriority;
    audience: AnnouncementAudience | null;
    requires_ack: boolean;
    status: AnnouncementStatus;
    publish_at: string | null;
    published_at: string | null;
    expires_at: string | null;
    withdrawn_at: string | null;
    created_at: string;
    created_by?: { id: string; user: MemberUser } | null;
    _count?: { acknowledgements: number };
    acknowledged_at?: string | null;
}

export interface AnnouncementDetail extends Announcement {
    audience_size: number;
    acknowledgements: { id: string; acknowledged_at: string; membership: { id: string; user: MemberUser } | null }[];
}

export interface AnnouncementDto {
    title: string;
    body: string;
    severity?: NotificationPriority;
    requires_ack?: boolean;
    audience?: AnnouncementAudience | null;
    publish_at?: string | null;
    expires_at?: string | null;
}
