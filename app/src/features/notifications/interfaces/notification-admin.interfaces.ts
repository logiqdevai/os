import type { MemberUser, NotificationCategory, NotificationChannel, NotificationLevel, NotificationPriority, DigestFrequency, Paginated } from "./notifications.interfaces";

/** 14 administration (event catalog, templates, defaults, delivery rules, delivery log, settings). */

export type DeliveryMode = "IMMEDIATE" | "DIGEST" | "OFF";
export type DeliveryStatus = "PENDING" | "QUEUED" | "SENT" | "DELIVERED" | "FAILED" | "SKIPPED" | "DIGESTED" | "EXPIRED" | "CANCELLED";
export type SkipReason =
    | "PREFERENCE_OFF" | "LEVEL_FILTERED" | "RECORD_MUTED" | "QUIET_HOURS" | "CHANNEL_DISABLED" | "CHANNEL_NOT_AVAILABLE" | "NO_ADDRESS" | "NO_DEVICE"
    | "DEDUPLICATED" | "COALESCED" | "THROTTLED" | "PERMISSION_DENIED" | "NOT_CUSTOMER_VISIBLE" | "EXPIRED";
export type EventStatus = "RECEIVED" | "PROCESSING" | "PROCESSED" | "IGNORED" | "FAILED";
export type DigestStatus = "OPEN" | "SCHEDULED" | "SENDING" | "SENT" | "EMPTY" | "FAILED";
export type RuleKind = "DEDUPLICATE" | "COALESCE" | "THROTTLE" | "SUPPRESS";
export type CoalesceKey = "RECORD" | "RECORD_AND_ACTOR" | "EVENT_TYPE" | "RECIPIENT";
export type Scope = "platform" | "organization";

export interface EventTypeRow {
    id: string;
    organization_id: string | null;
    key: string;
    module: string;
    name: string;
    description: string | null;
    category: NotificationCategory;
    priority: NotificationPriority;
    customer_visible: boolean;
    default_channels: NotificationChannel[];
    forced_channels: NotificationChannel[];
    mandatory_by_default: boolean;
    can_coalesce: boolean;
    coalesce_window_seconds: number | null;
    supports_digest: boolean;
    default_expiry_minutes: number | null;
    available_actions: string[];
    is_active: boolean;
    deprecated_at: string | null;
    scope: Scope;
    org_mandatory?: boolean;
    org_enabled?: boolean | null;
    org_template_count?: number;
}

export interface EventTypeList extends Paginated<EventTypeRow> {
    stats: { total: number; mandatory: number; customer_visible: number };
}

export interface TemplateRow {
    id: string;
    organization_id: string | null;
    event_type_id: string;
    channel: NotificationChannel;
    locale: string | null;
    subject: string | null;
    title: string;
    body: string;
    html_body: string | null;
    cta_label: string | null;
    cta_url: string | null;
    version: number;
    is_active: boolean;
    updated_at: string;
    scope: Scope;
    editable: boolean;
    event_type?: { id: string; key: string; name: string; module: string };
}

export interface TemplateDetail extends TemplateRow {
    versions: { id: string; version: number; subject: string | null; title: string; body: string; created_at: string }[];
}

export interface OrgDefault {
    id: string;
    module: string | null;
    event_type_id: string | null;
    enabled: boolean;
    channels: NotificationChannel[];
    portal_channels: NotificationChannel[];
    delivery_mode: DeliveryMode;
    digest_frequency: DigestFrequency;
    is_mandatory: boolean;
    updated_at: string;
    event_type?: { id: string; key: string; name: string; module: string; mandatory_by_default: boolean } | null;
}

export interface EventTypeDetail extends EventTypeRow {
    editable: boolean;
    templates: TemplateRow[];
    org_default: OrgDefault | null;
    recent_events: { id: string; status: EventStatus; entity_type: string | null; entity_label: string | null; notification_count: number; idempotency_key: string; received_at: string; error: string | null }[];
    rules: DeliveryRule[];
    stats: { notifications_30d: number };
}

export interface DefaultsResponse {
    modules: OrgDefault[];
    events: OrgDefault[];
    enabled_channels: NotificationChannel[];
    portal_enabled_channels: NotificationChannel[];
    available_modules: string[];
}

export interface DeliveryRule {
    id: string;
    name: string;
    kind: RuleKind;
    event_type_id: string | null;
    module: string | null;
    channel: NotificationChannel | null;
    window_seconds: number | null;
    max_per_window: number | null;
    coalesce_key: CoalesceKey | null;
    conditions: Record<string, string> | null;
    priority: number;
    is_active: boolean;
    event_type?: { id: string; key: string; name: string } | null;
}

export interface DeliveryRow {
    id: string;
    channel: NotificationChannel;
    status: DeliveryStatus;
    skip_reason: SkipReason | null;
    attempt_count: number;
    max_attempts: number;
    next_attempt_at: string | null;
    sent_at: string | null;
    delivered_at: string | null;
    failed_at: string | null;
    failure_reason: string | null;
    destination: string | null;
    provider: string | null;
    opened_at: string | null;
    digest_id: string | null;
    comm_message_id: string | null;
    created_at: string;
    notification: { id: string; title: string; event_key: string; module: string; recipient_membership: { id: string; user: MemberUser } | null };
}

export interface DeliveryList extends Paginated<DeliveryRow> {
    stats: { total_24h: number; sent_24h: number; failed_24h: number; skipped_24h: number; pending_24h: number };
}

export interface DeliveryDetail extends DeliveryRow {
    last_attempted_at: string | null;
    rendered_subject: string | null;
    rendered_body: string | null;
    preview_hidden: boolean;
    locale: string | null;
    provider_message_id: string | null;
    can_retry: boolean;
    template: { id: string; channel: NotificationChannel; locale: string | null; version: number; organization_id: string | null } | null;
    digest: { id: string; frequency: DigestFrequency; status: DigestStatus; scheduled_for: string; sent_at: string | null } | null;
}

export interface EventLogRow {
    id: string;
    event_key: string;
    idempotency_key: string;
    entity_type: string | null;
    entity_label: string | null;
    status: EventStatus;
    notification_count: number;
    error: string | null;
    received_at: string;
    processed_at: string | null;
    actor: { id: string; user: MemberUser } | null;
}

export interface DigestRow {
    id: string;
    frequency: DigestFrequency;
    channel: NotificationChannel;
    status: DigestStatus;
    item_count: number;
    period_start: string;
    scheduled_for: string;
    sent_at: string | null;
    failure_reason: string | null;
    membership: { id: string; user: MemberUser } | null;
}

export interface OrgSettings {
    enabled_channels: NotificationChannel[];
    portal_enabled_channels: NotificationChannel[];
    email_sender_identity_id: string | null;
    sms_sender_identity_id: string | null;
    default_level: NotificationLevel;
    default_digest_frequency: DigestFrequency;
    default_digest_hour: number;
    default_digest_weekday: number;
    hide_previews_by_default: boolean;
    max_delivery_attempts: number;
    retry_backoff_seconds: number;
    retention_days: number | null;
    webhook_events_enabled: boolean;
    providers: {
        email: { connected: boolean; reason: string | null };
        sms: { connected: boolean; reason: string | null };
        push: { connected: boolean; reason: string | null; active_browsers: number };
    };
    sender_identities: { id: string; address: string; display_name: string | null; status: string }[];
    sms_sender_identities: { id: string; address: string; display_name: string | null; status: string }[];
}

export type EventTypeDto = Partial<Pick<EventTypeRow, "name" | "description" | "category" | "priority" | "default_channels" | "forced_channels" | "mandatory_by_default" | "customer_visible" | "supports_digest" | "is_active">> & { key?: string; module?: string };
export interface TemplateDto {
    event_type_id?: string;
    channel?: NotificationChannel;
    locale?: string | null;
    subject?: string | null;
    title: string;
    body: string;
    html_body?: string | null;
    cta_label?: string | null;
    cta_url?: string | null;
    is_active?: boolean;
}
export interface OrgDefaultDto {
    module?: string | null;
    event_type_id?: string | null;
    enabled: boolean;
    channels: NotificationChannel[];
    delivery_mode?: DeliveryMode;
    digest_frequency?: DigestFrequency;
    is_mandatory?: boolean;
}
export type DeliveryRuleDto = Omit<Partial<DeliveryRule>, "id" | "event_type">;
export type OrgSettingsDto = Partial<Omit<OrgSettings, "providers" | "sender_identities" | "sms_sender_identities">>;
export interface TemplatePreview {
    subject: string;
    title: string;
    body: string;
    html: string;
    missing_variables: string[];
}
