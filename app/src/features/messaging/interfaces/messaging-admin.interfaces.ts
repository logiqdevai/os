import type { ChannelKind } from "./messaging.interfaces";

/** Person as returned by the messaging API (MEMBERSHIP_PERSON_SELECT). */
export interface MessagingPerson {
    id: string;
    job_title?: string | null;
    user: { id?: string; email: string | null; display_name: string | null; first_name: string | null; last_name: string | null; profile_photo_url?: string | null };
}

// ---------------------------------------------------------------- calls

export type ChannelCallKind = "VOICE" | "VIDEO" | "HUDDLE";
export type ChannelCallStatus = "RINGING" | "IN_PROGRESS" | "ENDED" | "MISSED" | "CANCELLED" | "FAILED";

export interface ChannelCall {
    id: string;
    channel_id: string;
    kind: ChannelCallKind;
    status: ChannelCallStatus;
    title: string | null;
    provider: string | null;
    meeting_url: string | null;
    started_at: string;
    ended_at: string | null;
    duration_seconds: number | null;
    participant_count: number;
    live: boolean;
    active_participant_ids: string[];
    channel: { id: string; name: string | null; kind: ChannelKind; slug: string | null };
    started_by: MessagingPerson | null;
    participants: { id: string; membership_id: string | null; joined_at: string | null; left_at: string | null; state: string; membership: MessagingPerson | null }[];
}

export interface CallList {
    calls_enabled: boolean;
    provider: string;
    data: ChannelCall[];
}

// ---------------------------------------------------------------- moderation

export type MessageReportStatus = "OPEN" | "UNDER_REVIEW" | "ACTIONED" | "DISMISSED";
export type ReportReason = "spam" | "abuse" | "sensitive_data" | "off_topic" | "other";
export type ModerationAction = "none" | "hide" | "delete" | "mute" | "ban" | "warning";

export interface MessageReport {
    id: string;
    message_id: string;
    reason: ReportReason;
    details: string | null;
    status: MessageReportStatus;
    action_taken: string | null;
    resolution_note: string | null;
    reviewed_at: string | null;
    created_at: string;
    reporter: MessagingPerson | null;
    message: {
        id: string;
        body: string;
        body_plain: string | null;
        created_at: string;
        hidden: boolean;
        delete_reason: string | null;
        channel_id: string;
        author_membership_id: string | null;
        author: MessagingPerson | null;
        channel: { id: string; name: string | null; kind: ChannelKind; slug: string | null };
    };
}

export interface ContextMessage {
    id: string;
    body_plain: string | null;
    created_at: string;
    deleted_at: string | null;
    author: MessagingPerson | null;
}

export interface MessageReportDetail extends MessageReport {
    context: { before: ContextMessage[]; after: ContextMessage[] };
    author_restrictions: Restriction[];
}

export interface Restriction {
    id: string;
    channel_id: string | null;
    membership_id: string | null;
    kind: "MUTED" | "BANNED";
    reason: string | null;
    expires_at: string | null;
    lifted_at: string | null;
    created_at: string;
    membership?: MessagingPerson | null;
    channel?: { id: string; name: string | null; kind: ChannelKind } | null;
}

// ---------------------------------------------------------------- retention, holds, exports

export type RetentionScope = "ORGANIZATION" | "BRANCH" | "TEAM" | "CHANNEL_KIND" | "CHANNEL";
export type RetentionAction = "UNLIMITED" | "ARCHIVE" | "DELETE";

export interface RetentionPolicy {
    id: string;
    name: string;
    scope: RetentionScope;
    branch_id: string | null;
    team_id: string | null;
    channel_kind: ChannelKind | null;
    action: RetentionAction;
    retention_days: number | null;
    applies_to_attachments: boolean;
    applies_to_reactions: boolean;
    applies_to_metadata: boolean;
    is_default: boolean;
    last_applied_at: string | null;
    branch: { id: string; name: string } | null;
    team: { id: string; name: string } | null;
    channels: { id: string; name: string | null; kind: ChannelKind }[];
}

export interface RetentionPolicyInput {
    name: string;
    scope: RetentionScope;
    branch_id?: string | null;
    team_id?: string | null;
    channel_kind?: ChannelKind | null;
    channel_ids?: string[];
    action: RetentionAction;
    retention_days?: number | null;
    applies_to_attachments?: boolean;
    applies_to_reactions?: boolean;
    applies_to_metadata?: boolean;
    is_default?: boolean;
}

export interface RetentionRunResult {
    dry_run: boolean;
    held_by: number;
    policies: { policy_id: string; name: string; action: RetentionAction; messages: number; attachments: number; channels_archived: number; held_skipped: number }[];
}

export interface LegalHold {
    id: string;
    name: string;
    reason: string;
    channel_ids: string[];
    membership_ids: string[];
    date_from: string | null;
    date_to: string | null;
    released_at: string | null;
    created_at: string;
    channels: { id: string; name: string | null; kind: ChannelKind }[];
    members: { id: string; name: string }[];
}

export interface LegalHoldInput {
    name: string;
    reason: string;
    channel_ids: string[];
    membership_ids: string[];
    date_from?: string | null;
    date_to?: string | null;
}

export type ExportFormat = "JSON" | "CSV" | "HTML";
export type ExportStatus = "PENDING" | "RUNNING" | "COMPLETED" | "FAILED" | "EXPIRED";

export interface ExportJob {
    id: string;
    status: ExportStatus;
    format: ExportFormat;
    filters: Record<string, unknown>;
    message_count: number | null;
    channel_count: number | null;
    error: string | null;
    created_at: string;
    completed_at: string | null;
    expires_at: string | null;
    requested_by: MessagingPerson | null;
}

export interface ExportInput {
    format: ExportFormat;
    channel_ids: string[];
    channel_kinds: ChannelKind[];
    date_from?: string;
    date_to?: string;
    include_threads: boolean;
    include_reactions: boolean;
    include_attachments_metadata: boolean;
}

// ---------------------------------------------------------------- admin overview, guests, settings, integrations

export interface MessagingOverview {
    range: "7d" | "30d" | "90d";
    totals: {
        messages: number; direct_messages: number; thread_replies: number; reactions: number; files: number; calls: number;
        active_members: number; members: number; guests: number; open_reports: number; active_restrictions: number;
        storage_bytes: number; stored_files: number; archived_channels: number;
    };
    channels_by_kind: Record<string, number>;
    top_channels: { channel_id: string; name: string; kind: ChannelKind | null; messages: number }[];
    series: { date: string; messages: number }[];
}

export interface GuestPerson {
    key: string;
    name: string;
    email: string | null;
    label: string | null;
    guest_kind: string | null;
    external: boolean;
    memberships: { id: string; channel: { id: string; name: string | null; kind: ChannelKind }; role: string; access_expires_at: string | null; joined_at: string; last_viewed_at: string | null }[];
}

export interface GuestList {
    guest_access_enabled: boolean;
    external_access_enabled: boolean;
    data: GuestPerson[];
    invitations: { id: string; email: string; name: string | null; role: string; expires_at: string; access_expires_at: string | null; created_at: string; channel: { id: string; name: string | null } }[];
}

export interface MessagingSettings {
    allow_delete_own_messages: boolean;
    delete_own_time_limit_minutes: number | null;
    allow_admin_delete_messages: boolean;
    edit_time_limit_minutes: number | null;
    preserve_edit_history: boolean;
    allowed_reactions: string[];
    read_receipts_direct: boolean;
    read_receipts_group: boolean;
    read_receipts_customer: boolean;
    presence_visibility: "everyone" | "members" | "nobody";
    default_notification_level: string;
    external_access_enabled: boolean;
    guest_access_enabled: boolean;
    guest_default_expiry_days: number | null;
    broadcast_mention_policy: "everyone" | "admins" | "owners";
    announcement_policy: "everyone" | "admins" | "owners";
    auto_create_project_channels: boolean;
    voice_messages_enabled: boolean;
    calls_enabled: boolean;
    call_provider: string | null;
    file_policy: { max_file_size_bytes?: number | null; blocked_extensions?: string[] } | null;
    admin_private_message_access_enabled: boolean;
    notification_previews_include_text: boolean;
    updated_at?: string;
}

export interface MessagingIntegration {
    id: string;
    kind: "INBOUND_WEBHOOK" | "BOT" | "CUSTOM" | string;
    status: "ACTIVE" | "DISABLED" | "ERROR";
    name: string;
    description: string | null;
    bot_display_name: string | null;
    default_channel_id: string | null;
    allowed_channel_ids: string[];
    rate_limit_per_minute: number | null;
    last_event_at: string | null;
    last_error: string | null;
    last_error_at: string | null;
    created_at: string;
    has_token: boolean;
    default_channel?: { id: string; name: string | null; kind: ChannelKind } | null;
    _count?: { messages: number };
}

export interface IntegrationInput {
    kind: "INBOUND_WEBHOOK" | "BOT" | "CUSTOM";
    name: string;
    description?: string | null;
    bot_display_name?: string | null;
    default_channel_id: string;
    allowed_channel_ids: string[];
    rate_limit_per_minute?: number | null;
}
