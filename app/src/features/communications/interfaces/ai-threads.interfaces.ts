import type { CommChannel, CommMessageStatus } from "./communications.interfaces";

export type CommAiTask = "SUBJECT_LINES" | "WRITE_EMAIL" | "WRITE_SMS" | "IMPROVE_TONE" | "TRANSLATE";
export type CommAiTone = "friendly" | "professional" | "formal" | "enthusiastic" | "concise";

export interface CommAiStatus {
    configured: boolean;
    model: string | null;
    message: string | null;
}

export interface CommAiInput {
    task: CommAiTask;
    channel?: CommChannel;
    prompt?: string;
    subject?: string;
    body?: string;
    tone?: CommAiTone;
    language?: string;
    campaign_id?: string;
    template_id?: string;
}

export interface CommAiOutput {
    subject_lines?: string[];
    preheader?: string | null;
    subject?: string | null;
    body_html?: string | null;
    body_text?: string | null;
    body?: string | null;
}

export type CommAiResult =
    | { available: true; generation_id: string; task: CommAiTask; model: string; output: CommAiOutput }
    | { available: false; reason: "ai_not_configured" | "ai_provider_error"; message: string };

/** 11 CommThread — conversation of one-off email / SMS. */
export interface CommThreadListItem {
    id: string;
    subject: string | null;
    channel: CommChannel;
    message_count: number;
    visible_message_count: number;
    last_message_at: string | null;
    archived_at: string | null;
    contact: { id: string; first_name: string; last_name: string | null; email: string | null } | null;
    company: { id: string; name: string } | null;
    last_message: { id: string; subject: string | null; body_text: string | null; status: CommMessageStatus; to_address: string; to_name: string | null; created_at: string; sent_at: string | null; replied_at: string | null } | null;
}

export interface CommThreadMessage {
    id: string;
    channel: CommChannel;
    kind: string;
    status: CommMessageStatus;
    subject: string | null;
    body_html: string | null;
    body_text: string | null;
    to_address: string;
    to_name: string | null;
    from_address: string | null;
    from_name: string | null;
    in_reply_to_message_id: string | null;
    created_at: string;
    scheduled_at: string | null;
    sent_at: string | null;
    delivered_at: string | null;
    first_opened_at: string | null;
    replied_at: string | null;
    failure_reason: string | null;
    sent_by: { id: string; user: { display_name: string | null; first_name: string | null; last_name: string | null; email: string } } | null;
}

export interface CommThreadDetail {
    id: string;
    subject: string | null;
    channel: CommChannel;
    archived_at: string | null;
    contact: { id: string; first_name: string; last_name: string | null; email: string | null; mobile: string | null } | null;
    company: { id: string; name: string } | null;
    project: { id: string; name: string } | null;
    messages: CommThreadMessage[];
}
