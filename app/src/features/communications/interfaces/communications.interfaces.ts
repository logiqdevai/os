import type { PaginationMeta } from "@/components/ui/data-table";

export interface Paginated<T> {
    data: T[];
    pagination: PaginationMeta & { has_next: boolean; has_prev: boolean };
}

export const CommChannels = { EMAIL: "EMAIL", SMS: "SMS" } as const;
export type CommChannel = (typeof CommChannels)[keyof typeof CommChannels];

export type CampaignStatus = "DRAFT" | "PENDING_APPROVAL" | "APPROVED" | "SCHEDULED" | "SENDING" | "PAUSED" | "COMPLETED" | "CANCELLED" | "FAILED";
export type CampaignAudienceMode = "INCLUDE" | "EXCLUDE";
export type CommMessageStatus = "DRAFT" | "SCHEDULED" | "QUEUED" | "SENDING" | "SENT" | "DELIVERED" | "FAILED" | "BOUNCED" | "CANCELLED";
export type CommMessageKind = "CUSTOMER" | "CAMPAIGN" | "TRANSACTIONAL" | "NOTIFICATION" | "INTERNAL";
export type CommMessageSource = "MANUAL" | "CAMPAIGN" | "AUTOMATION" | "MODULE" | "NOTIFICATION" | "API";
export type CommRecipientStatus = "PENDING" | "EXCLUDED" | "QUEUED" | "SENT" | "DELIVERED" | "OPENED" | "CLICKED" | "REPLIED" | "BOUNCED" | "FAILED" | "UNSUBSCRIBED";
export type CommRecipientKind = "CRM_CONTACT" | "MEMBERSHIP" | "PORTAL_USER" | "EXTERNAL";
export type CommTemplateStatus = "DRAFT" | "ACTIVE" | "ARCHIVED";
export type CommTemplateVersionStatus = "DRAFT" | "PUBLISHED" | "ARCHIVED";
export type CommTemplateKind = "COMMUNICATION" | "CAMPAIGN" | "NOTIFICATION" | "SYSTEM";
export type CommTemplateCategory = string;
export type SegmentEntityType = "CRM_CONTACT" | "CRM_COMPANY" | "MEMBERSHIP";
export type CommConsentStatus = "UNKNOWN" | "PENDING_DOUBLE_OPT_IN" | "OPTED_IN" | "OPTED_OUT";
export type CommSuppressionReason = "UNSUBSCRIBE" | "HARD_BOUNCE" | "SOFT_BOUNCE" | "COMPLAINT" | "INVALID_ADDRESS" | "CONSENT_WITHDRAWN" | "MANUAL";
export type CommSenderDomainStatus = "PENDING" | "VERIFIED" | "FAILED" | "DISABLED";
export type CommSenderIdentityStatus = "PENDING_VERIFICATION" | "VERIFIED" | "FAILED" | "DISABLED";

export interface PersonRef {
    id: string;
    user: { display_name: string | null; first_name: string | null; last_name: string | null; email: string; profile_photo_url?: string | null };
}

// ---------------------------------------------------------------- campaigns

export interface CampaignAudience {
    id: string;
    mode: CampaignAudienceMode;
    list_id: string | null;
    segment_id: string | null;
    list?: { id: string; name: string; member_count: number } | null;
    segment?: { id: string; name: string; last_count: number | null; entity_type: SegmentEntityType } | null;
}

export interface PreflightIssue {
    kind: string;
    severity: "error" | "warning" | "info";
    message: string;
}

export interface Campaign {
    id: string;
    name: string;
    description: string | null;
    channel: CommChannel;
    status: CampaignStatus;
    campaign_type: string | null;
    template_id: string | null;
    subject: string | null;
    preheader: string | null;
    body_html: string | null;
    body_text: string | null;
    sender_identity_id: string | null;
    from_name: string | null;
    reply_to_address: string | null;
    tracking_enabled: boolean;
    require_consent: boolean;
    scheduled_at: string | null;
    schedule_timezone: string | null;
    send_rate_per_hour: number | null;
    topic_id: string | null;
    /** A/B test (variants in CampaignVariant). */
    ab_test_enabled: boolean;
    ab_metric: CampaignAbMetric | null;
    ab_test_percent: number | null;
    ab_wait_hours: number | null;
    ab_winner_selected_at: string | null;
    /** Deliver at the scheduled local time in each recipient's time zone. */
    send_in_recipient_timezone: boolean;
    /** RFC 5545 RRULE; null = one-off. */
    recurrence_rule: string | null;
    recurrence_ends_at: string | null;
    next_run_at: string | null;
    started_at: string | null;
    completed_at: string | null;
    cancelled_at: string | null;
    approved_at: string | null;
    failure_reason: string | null;
    audience_count: number;
    excluded_count: number;
    sent_count: number;
    delivered_count: number;
    opened_count: number;
    clicked_count: number;
    bounced_count: number;
    failed_count: number;
    unsubscribed_count: number;
    archived_at: string | null;
    created_at: string;
    updated_at: string;
    owner?: PersonRef | null;
    template?: { id: string; name: string } | null;
}

export interface CampaignApproval {
    id: string;
    decision: "PENDING" | "APPROVED" | "REJECTED";
    comment: string | null;
    requested_at: string;
    decided_at: string | null;
    approver: PersonRef;
}

export interface CampaignRun {
    id: string;
    run_number: number;
    status: string;
    scheduled_for: string;
    started_at: string | null;
    completed_at: string | null;
    audience_count: number;
    sent_count: number;
    failed_count: number;
}

export type CampaignAbMetric = "OPEN" | "CLICK";

export interface CampaignVariant {
    id: string;
    label: string;
    subject: string | null;
    preheader: string | null;
    body_html: string | null;
    body_text: string | null;
    share_percent: number | null;
    is_winner: boolean;
    sent_count: number;
    delivered_count: number;
    opened_count: number;
    clicked_count: number;
    sort_order: number;
    open_rate?: number;
    click_rate?: number;
}

export interface CampaignVariantsState {
    ab_test_enabled: boolean;
    ab_metric: CampaignAbMetric | null;
    ab_test_percent: number | null;
    ab_wait_hours: number | null;
    ab_winner_selected_at: string | null;
    winner_decides_at: string | null;
    holdout_count: number;
    variants: CampaignVariant[];
}

export interface CampaignVariantInput {
    subject?: string | null;
    preheader?: string | null;
    body_html?: string | null;
    body_text?: string | null;
    share_percent?: number | null;
}

export interface CampaignDetail extends Campaign {
    approval_required: boolean;
    variants: CampaignVariant[];
    topic?: { id: string; name: string; default_opt_in: boolean } | null;
    branch?: { id: string; name: string } | null;
    sender_identity?: { id: string; address: string; display_name: string | null; status: CommSenderIdentityStatus } | null;
    audiences: CampaignAudience[];
    approvals: CampaignApproval[];
    runs: CampaignRun[];
    created_by?: PersonRef | null;
    approved_by?: PersonRef | null;
    preflight?: { checked_at: string; issues: PreflightIssue[] } | null;
}

export interface AudienceInput {
    mode?: CampaignAudienceMode;
    list_id?: string;
    segment_id?: string;
}

export interface CampaignInput {
    name?: string;
    description?: string;
    channel?: CommChannel;
    template_id?: string;
    subject?: string;
    preheader?: string;
    body_html?: string;
    body_text?: string;
    sender_identity_id?: string;
    from_name?: string;
    reply_to_address?: string;
    tracking_enabled?: boolean;
    require_consent?: boolean;
    send_rate_per_hour?: number;
    topic_id?: string | null;
    ab_test_enabled?: boolean;
    ab_metric?: CampaignAbMetric;
    ab_test_percent?: number;
    ab_wait_hours?: number;
    send_in_recipient_timezone?: boolean;
    schedule_timezone?: string;
    recurrence_rule?: string | null;
    recurrence_ends_at?: string | null;
    audiences?: AudienceInput[];
}

export interface AudienceCounts {
    total: number;
    included: number;
    excluded: number;
    by_reason: Record<string, number>;
}

export interface ResolvedAudience {
    counts: AudienceCounts;
    sample: { kind: CommRecipientKind; address: string; name: string | null; contact_id: string | null }[];
    excluded_sample: { address: string | null; name: string | null; reason: string }[];
}

export interface PreflightResult {
    checked_at: string;
    issues: PreflightIssue[];
    approval_required: boolean;
    counts: AudienceCounts | null;
    ok: boolean;
}

export interface CampaignStats {
    counters: Record<string, number>;
    rates: { delivery_rate: number; open_rate: number; click_rate: number; click_to_open_rate: number; bounce_rate: number; unsubscribe_rate: number };
    granularity: "hour" | "day";
    series: { t: string; sent?: number; delivered?: number; opened?: number; clicked?: number; bounced?: number }[];
    links: { id: string; original_url: string; click_count: number; unique_click_count: number }[];
    recipients_by_status: Record<string, number>;
}

export interface CampaignRecipient {
    id: string;
    kind: CommRecipientKind;
    address: string;
    name: string | null;
    status: CommRecipientStatus;
    exclusion_reason: string | null;
    sent_at: string | null;
    message?: { id: string; status: CommMessageStatus; delivered_at: string | null; first_opened_at: string | null; first_clicked_at: string | null; failure_reason: string | null } | null;
}

// ---------------------------------------------------------------- templates

export interface TemplateVersion {
    id: string;
    version: number;
    status: CommTemplateVersionStatus;
    subject: string | null;
    preheader?: string | null;
    body_html?: string | null;
    body_text?: string | null;
    change_note: string | null;
    published_at: string | null;
    created_at: string;
    updated_at: string;
    created_by?: PersonRef | null;
}

export interface Template {
    id: string;
    name: string;
    slug: string;
    description: string | null;
    channel: CommChannel;
    kind: CommTemplateKind;
    category: CommTemplateCategory;
    status: CommTemplateStatus;
    language: string;
    variables: string[] | null;
    usage_count: number;
    last_used_at: string | null;
    archived_at: string | null;
    updated_at: string;
    current_version?: { id: string; version: number; subject: string | null; published_at: string | null } | null;
    _count?: { versions: number };
}

export interface TemplateDetail extends Template {
    default_sender_identity_id: string | null;
    current_version: TemplateVersion | null;
    draft_version: TemplateVersion | null;
    versions: TemplateVersion[];
}

export interface TemplateContent {
    subject?: string;
    preheader?: string;
    body_html?: string;
    body_text?: string;
    change_note?: string;
}

export interface TemplateInput extends TemplateContent {
    name?: string;
    description?: string;
    channel?: CommChannel;
    category?: CommTemplateCategory;
    language?: string;
    default_sender_identity_id?: string;
}

export interface TemplatePreview {
    subject: string;
    preheader: string;
    body_html: string;
    body_text: string;
    variables: string[];
    missing_variables: string[];
    sms_segments: number;
}

// ---------------------------------------------------------------- audience

export interface SegmentRule {
    field: string;
    op: string;
    value?: unknown;
}
export interface SegmentDefinition {
    and?: (SegmentRule | SegmentDefinition)[];
    or?: (SegmentRule | SegmentDefinition)[];
}

export interface SegmentField {
    key: string;
    label: string;
    type: "string" | "enum" | "id" | "date" | "array" | "tag" | "consent";
    group: string;
    options?: string[];
    ops: string[];
}

export interface Segment {
    id: string;
    name: string;
    description: string | null;
    entity_type: SegmentEntityType;
    definition: SegmentDefinition;
    channel: CommChannel | null;
    require_consent: boolean;
    last_count: number | null;
    last_evaluated_at: string | null;
    archived_at: string | null;
    updated_at: string;
    _count?: { audiences: number };
}

export interface SegmentDetail extends Segment {
    audiences: { id: string; campaign: { id: string; name: string; status: CampaignStatus; channel: CommChannel } }[];
}

export interface SegmentInput {
    name?: string;
    description?: string;
    entity_type?: SegmentEntityType;
    definition?: SegmentDefinition;
    channel?: CommChannel;
    require_consent?: boolean;
}

export interface AudienceMember {
    kind: CommRecipientKind;
    address: string | null;
    name: string | null;
    contact_id: string | null;
    membership_id: string | null;
}

export interface SegmentPreview {
    count: number;
    sample: AudienceMember[];
    excluded: { no_consent: number; suppressed: number; no_address: number };
}

export interface RecipientList {
    id: string;
    name: string;
    description: string | null;
    channel: CommChannel | null;
    member_count: number;
    archived_at: string | null;
    updated_at: string;
    _count?: { audiences: number };
}

export interface RecipientListMember {
    id: string;
    kind: CommRecipientKind;
    address: string | null;
    name: string | null;
    created_at: string;
    contact?: { id: string; first_name: string; last_name: string | null; email: string | null; mobile: string | null; company?: { id: string; name: string } | null } | null;
    membership?: { id: string; user: { email: string; display_name: string | null; first_name: string | null; last_name: string | null } } | null;
}

export interface ListMemberInput {
    kind: CommRecipientKind;
    contact_id?: string;
    membership_id?: string;
    address?: string;
    name?: string;
}

export interface Suppression {
    id: string;
    channel: CommChannel;
    address: string;
    reason: CommSuppressionReason;
    notes: string | null;
    expires_at: string | null;
    blocks_transactional: boolean;
    removed_at: string | null;
    created_at: string;
    contact?: { id: string; first_name: string; last_name: string | null } | null;
    campaign?: { id: string; name: string } | null;
}

export interface SuppressionInput {
    channel: CommChannel;
    address: string;
    reason?: CommSuppressionReason;
    notes?: string;
    blocks_transactional?: boolean;
}

export interface Consent {
    id: string;
    channel: CommChannel;
    status: CommConsentStatus;
    source: string;
    consented_at: string | null;
    withdrawn_at: string | null;
    updated_at: string;
    contact: { id: string; first_name: string; last_name: string | null; email: string | null; mobile: string | null; company?: { id: string; name: string } | null };
}

// ---------------------------------------------------------------- messages

export interface CommMessage {
    id: string;
    channel: CommChannel;
    kind: CommMessageKind;
    source: CommMessageSource;
    status: CommMessageStatus;
    subject: string | null;
    to_address: string;
    to_name: string | null;
    scheduled_at: string | null;
    sent_at: string | null;
    delivered_at: string | null;
    first_opened_at: string | null;
    first_clicked_at: string | null;
    failure_reason: string | null;
    open_count: number;
    click_count: number;
    created_at: string;
    campaign?: { id: string; name: string } | null;
    recipient_contact?: { id: string; first_name: string; last_name: string | null } | null;
    company?: { id: string; name: string } | null;
    sent_by?: PersonRef | null;
}

export interface CommMessageDetail extends CommMessage {
    body_html: string | null;
    body_text: string | null;
    reply_to_address: string | null;
    last_error: string | null;
    sms_segment_count: number | null;
    sender_identity?: { id: string; address: string; display_name: string | null } | null;
    template?: { id: string; name: string } | null;
    delivery_events: { id: string; type: string; occurred_at: string; url: string | null; reason: string | null }[];
}

export interface SendMessageInput {
    channel: CommChannel;
    to_address?: string;
    to_name?: string;
    template_id?: string;
    subject?: string;
    body_html?: string;
    body_text?: string;
    sender_identity_id?: string;
    kind?: "CUSTOMER" | "TRANSACTIONAL";
    scheduled_at?: string;
    send?: boolean;
}

// ---------------------------------------------------------------- senders, overview, analytics

export interface SenderDomain {
    id: string;
    domain: string;
    status: CommSenderDomainStatus;
    dns_records: { record?: string; type: string; name: string; value: string; status?: string; priority?: number }[] | null;
    verified_at: string | null;
    last_checked_at: string | null;
    failure_reason: string | null;
    created_at: string;
    _count?: { identities: number };
}

export interface SenderIdentity {
    id: string;
    channel: CommChannel;
    address: string;
    display_name: string | null;
    reply_to_address: string | null;
    status: CommSenderIdentityStatus;
    is_default: boolean;
    failure_reason: string | null;
    verified_at: string | null;
    sender_domain?: { id: string; domain: string; status: CommSenderDomainStatus } | null;
    branch?: { id: string; name: string } | null;
}

export interface SenderIdentityInput {
    channel: CommChannel;
    address: string;
    display_name?: string;
    reply_to_address?: string;
    is_default?: boolean;
}

export interface ProviderChannelStatus {
    connected: boolean;
    reason?: string;
    name?: string;
    provider?: string;
    status?: string;
    last_error?: string | null;
    default_from?: string | null;
}
export interface ProviderStatus {
    email: ProviderChannelStatus;
    sms: ProviderChannelStatus;
}

export interface CommOverview {
    campaigns_by_status: Partial<Record<CampaignStatus, number>>;
    upcoming: Pick<Campaign, "id" | "name" | "channel" | "status" | "scheduled_at" | "audience_count" | "sent_count" | "started_at">[];
    recent: (Pick<Campaign, "id" | "name" | "channel" | "status" | "completed_at" | "sent_count" | "delivered_count"> & { open_rate: number; click_rate: number })[];
    providers: ProviderStatus;
    failed_last_24h: number;
}

export interface AnalyticsTotals {
    sent_count: number;
    delivered_count: number;
    unique_opened_count: number;
    unique_clicked_count: number;
    bounced_count: number;
    unsubscribed_count: number;
    failed_count: number;
    [key: string]: number;
}
export interface AnalyticsRates {
    delivery_rate: number;
    open_rate: number;
    click_rate: number;
    bounce_rate: number;
    unsubscribe_rate: number;
}
export interface AnalyticsSummary {
    from: string;
    to: string;
    totals: AnalyticsTotals;
    rates: AnalyticsRates;
    previous: { totals: AnalyticsTotals; rates: AnalyticsRates };
    series: { date: string; sent: number; delivered: number; opened: number; clicked: number; bounced: number; email: number; sms: number }[];
    top_campaigns: { id: string; name: string; channel: CommChannel; status: CampaignStatus; sent_count: number; open_rate: number; click_rate: number }[];
}

export interface CommSettings {
    approval_required: boolean;
    approval_min_recipients: number | null;
    footer_address: string | null;
    double_opt_in_default: boolean;
}
