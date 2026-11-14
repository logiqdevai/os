import type { PaginationMeta } from "@/components/ui/data-table";

export const ChannelKinds = {
    PUBLIC: "PUBLIC",
    PRIVATE: "PRIVATE",
    DIRECT: "DIRECT",
    GROUP_DIRECT: "GROUP_DIRECT",
    PROJECT: "PROJECT",
    CUSTOMER: "CUSTOMER",
    ANNOUNCEMENT: "ANNOUNCEMENT",
    RECORD: "RECORD",
} as const;
export type ChannelKind = (typeof ChannelKinds)[keyof typeof ChannelKinds];

export const CreatableChannelKinds = { PUBLIC: "PUBLIC", PRIVATE: "PRIVATE" } as const;
export type CreatableChannelKind = (typeof CreatableChannelKinds)[keyof typeof CreatableChannelKinds];

export const ChannelMemberRoles = { OWNER: "OWNER", ADMIN: "ADMIN", MEMBER: "MEMBER", GUEST: "GUEST", EXTERNAL: "EXTERNAL", READ_ONLY: "READ_ONLY" } as const;
export type ChannelMemberRole = (typeof ChannelMemberRoles)[keyof typeof ChannelMemberRoles];

export const PresenceStates = { ACTIVE: "ACTIVE", AWAY: "AWAY", DO_NOT_DISTURB: "DO_NOT_DISTURB", OFFLINE: "OFFLINE" } as const;
export type PresenceState = (typeof PresenceStates)[keyof typeof PresenceStates];

export interface Participant {
    membership_id: string | null;
    name: string;
    profile_photo_url: string | null;
    job_title?: string | null;
}

export interface ChannelSummary {
    id: string;
    kind: ChannelKind;
    status: "ACTIVE" | "ARCHIVED" | "DELETED";
    slug: string | null;
    name: string | null;
    display_name: string | null;
    description: string | null;
    topic: string | null;
    purpose: string | null;
    posting_policy: string;
    external_access_enabled: boolean;
    is_confidential: boolean;
    member_count: number;
    message_count: number;
    last_message_at: string | null;
    archived_at: string | null;
    created_at: string;
}

/** Sidebar row (GET /messaging/channels). */
export interface MyChannel extends ChannelSummary {
    label: string;
    participants: Participant[];
    my_role: ChannelMemberRole;
    is_favorite: boolean;
    muted_until: string | null;
    unread_count: number;
    mention_count: number;
    last_read_message_id: string | null;
}

export interface BrowseChannel extends ChannelSummary {
    is_member: boolean;
}

export interface ChannelSources {
    teams: { id: string; name: string; member_ids: string[] }[];
    projects: { id: string; name: string; code: string | null; member_ids: string[] }[];
}

export interface ChannelDetail extends ChannelSummary {
    label: string;
    /** Team / project this channel is for (null when not linked, or the project is outside your access). */
    team: { id: string; name: string } | null;
    project: { id: string; name: string; code: string | null } | null;
    participants: Participant[];
    pin_count: number;
    is_member: boolean;
    my_role: ChannelMemberRole | null;
    is_favorite: boolean;
    muted_until: string | null;
    unread_count: number;
    mention_count: number;
    last_read_message_id: string | null;
    can_manage: boolean;
    can_post: boolean;
}

export interface ChannelMemberRow {
    id: string;
    role: ChannelMemberRole;
    membership_id: string | null;
    external_user_id: string | null;
    external: boolean;
    external_label: string | null;
    name: string;
    email: string | null;
    profile_photo_url: string | null;
    job_title: string | null;
    joined_at: string;
}

export interface ReactionGroup {
    emoji: string;
    count: number;
    membership_ids: string[];
}

export interface MessageAttachment {
    id: string;
    document_id: string;
    kind: string;
    file_name: string;
    mime_type: string | null;
    size_bytes: number | null;
}

/** File uploaded for a message (POST /messaging/channels/:id/attachments), posted with the message. */
export interface UploadedAttachment {
    document_id: string;
    file_name: string;
    mime_type: string | null;
    size_bytes: number;
    kind: string;
}

export interface Message {
    id: string;
    channel_id: string;
    kind: "USER" | "SYSTEM" | "INTEGRATION" | "VOICE";
    visibility: "INTERNAL" | "EXTERNAL";
    status: string;
    body: string;
    body_plain: string | null;
    parent_message_id: string | null;
    reply_count: number;
    last_reply_at: string | null;
    is_edited: boolean;
    edited_at: string | null;
    deleted_at: string | null;
    pinned_at: string | null;
    system_event: string | null;
    /** INTEGRATION messages: the bot / source shown instead of an author. */
    integration_source?: string | null;
    client_message_id: string | null;
    created_at: string;
    author: { membership_id: string | null; user_id: string; name: string; profile_photo_url: string | null; job_title: string | null; external: boolean } | null;
    reactions: ReactionGroup[];
    attachments: MessageAttachment[];
    mentioned_membership_ids: string[];
    mentions_channel: boolean;
    is_saved?: boolean;
    /** Client-only: optimistic send state. */
    pending?: "sending" | "failed";
}

export interface MessageWithChannel extends Message {
    channel: { id: string; name: string | null; kind: ChannelKind; slug: string | null };
}

export interface MessagePage {
    data: Message[];
    has_more: boolean;
}

export interface ThreadResponse {
    root: Message;
    replies: Message[];
    following: boolean;
}

export interface ThreadInboxItem {
    root: MessageWithChannel;
    last_replies: Message[];
    unread: boolean;
}

export interface MentionItem {
    id: string;
    read_at: string | null;
    created_at: string;
    message: MessageWithChannel;
}

export interface SavedItem {
    id: string;
    note: string | null;
    saved_at: string;
    message: MessageWithChannel;
}

export interface Presence {
    membership_id: string;
    state: PresenceState;
    status_text: string | null;
    status_emoji: string | null;
    last_seen_at: string | null;
}

export interface DirectoryMember {
    membership_id: string;
    user_id: string;
    name: string;
    email: string;
    job_title: string | null;
    profile_photo_url: string | null;
    is_me: boolean;
    presence: Presence;
}

export interface Draft {
    id: string;
    channel_id: string;
    thread_root_message_id: string | null;
    body: string;
    updated_at: string;
}

export interface Paginated<T> {
    data: T[];
    pagination: PaginationMeta & { has_next: boolean; has_prev: boolean };
}

export interface CreateChannelDto {
    name: string;
    kind?: CreatableChannelKind;
    description?: string;
    topic?: string;
    purpose?: string;
    team_id?: string;
    project_id?: string;
    membership_ids?: string[];
}
export type UpdateChannelDto = Partial<Pick<CreateChannelDto, "name" | "description" | "topic" | "purpose">>;

export interface PostMessageDto {
    body: string;
    parent_message_id?: string;
    client_message_id?: string;
    attachments?: UploadedAttachment[];
}

export interface TypingEvent {
    channel_id: string;
    thread_root_id: string | null;
    membership_id: string;
    name: string;
}
