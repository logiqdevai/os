import type { PaginationMeta } from "@/components/ui/data-table";

export interface Paginated<T> {
    data: T[];
    pagination: PaginationMeta & { has_next: boolean; has_prev: boolean };
}

// --- Enums (Prisma) ------------------------------------------------------------------------------

export const SupportChannelTypes = { LIVE_CHAT: "LIVE_CHAT", EMAIL: "EMAIL", WIDGET: "WIDGET", PORTAL: "PORTAL", FORM: "FORM", API: "API", PHONE: "PHONE" } as const;
export type SupportChannelType = (typeof SupportChannelTypes)[keyof typeof SupportChannelTypes];

export const ConversationStatuses = { OPEN: "OPEN", PENDING: "PENDING", SNOOZED: "SNOOZED", RESOLVED: "RESOLVED" } as const;
export type ConversationStatus = (typeof ConversationStatuses)[keyof typeof ConversationStatuses];

export type MessageKind = "CUSTOMER" | "AGENT" | "INTERNAL_NOTE" | "AI_AGENT" | "SYSTEM";

export const TicketPriorities = { LOW: "LOW", NORMAL: "NORMAL", HIGH: "HIGH", URGENT: "URGENT" } as const;
export type TicketPriority = (typeof TicketPriorities)[keyof typeof TicketPriorities];

export const TicketStatusCategories = { NEW: "NEW", OPEN: "OPEN", PENDING_CUSTOMER: "PENDING_CUSTOMER", ON_HOLD: "ON_HOLD", RESOLVED: "RESOLVED", CLOSED: "CLOSED" } as const;
export type TicketStatusCategory = (typeof TicketStatusCategories)[keyof typeof TicketStatusCategories];

export const TicketTypes = { QUESTION: "QUESTION", BUG: "BUG", FEATURE_REQUEST: "FEATURE_REQUEST", CHANGE_REQUEST: "CHANGE_REQUEST", BILLING: "BILLING", ACCOUNT: "ACCOUNT", INCIDENT: "INCIDENT", OTHER: "OTHER" } as const;
export type TicketType = (typeof TicketTypes)[keyof typeof TicketTypes];

export type TicketSource = "CONVERSATION" | "EMAIL" | "LIVE_CHAT" | "WIDGET" | "PORTAL" | "FORM" | "AI_AGENT" | "MANUAL" | "API" | "CHANNEL_MESSAGE";
export type SlaMetric = "FIRST_RESPONSE" | "NEXT_RESPONSE" | "RESOLUTION";
export type SlaTimerStatus = "RUNNING" | "PAUSED" | "MET" | "BREACHED" | "CANCELLED";
export type KnowledgeArticleStatus = "DRAFT" | "IN_REVIEW" | "PUBLISHED" | "ARCHIVED";
export type KnowledgeVisibility = "PUBLIC" | "CUSTOMERS" | "INTERNAL";
export type CannedScope = "PERSONAL" | "TEAM" | "ORGANIZATION";
export type RoutingStrategy = "MANUAL" | "ROUND_ROBIN" | "LOAD_BALANCED" | "SKILL_BASED";
export type CsatScale = "STARS_5" | "THUMBS";

// --- Shared shapes -------------------------------------------------------------------------------

export interface PersonUser {
    id: string;
    email?: string | null;
    display_name: string | null;
    first_name: string | null;
    last_name: string | null;
    profile_photo_url: string | null;
}

export interface MemberRef {
    id: string;
    job_title?: string | null;
    user: PersonUser;
}

export interface StatusRef {
    id: string;
    name: string;
    slug?: string;
    category: TicketStatusCategory;
    color: string | null;
    customer_label?: string | null;
    pauses_sla?: boolean;
}

// --- Conversations -------------------------------------------------------------------------------

export interface ConversationListItem {
    id: string;
    subject: string | null;
    status: ConversationStatus;
    priority: TicketPriority;
    channel_type: SupportChannelType;
    customer_name: string | null;
    customer_email: string | null;
    last_message_at: string | null;
    created_at: string;
    snoozed_until: string | null;
    inbox: { id: string; name: string; color: string | null } | null;
    assignee: MemberRef | null;
    company: { id: string; name: string } | null;
    contact: { id: string; first_name: string; last_name: string | null; email: string | null } | null;
    customer: PersonUser | null;
    primary_tickets: { id: string; reference: string; sla_breached: boolean; sla_at_risk: boolean }[];
    last_message: { id: string; kind: MessageKind; body: string; created_at: string; author_name: string | null } | null;
    unread: boolean;
}

export interface SupportMessage {
    id: string;
    kind: MessageKind;
    body: string;
    created_at: string;
    channel_type: SupportChannelType | null;
    author: MemberRef | null;
    author_user: PersonUser | null;
    author_name: string | null;
    author_email: string | null;
    mentions: string[];
    delivery_status: string | null;
    delivery_error?: string | null;
    is_first_response: boolean;
}

export interface ConversationDetail extends Omit<ConversationListItem, "last_message" | "unread"> {
    ai_summary: string | null;
    merged_into: { id: string; subject: string | null } | null;
    team: { id: string; name: string } | null;
    channel: { id: string; name: string; type: SupportChannelType; email_address: string | null } | null;
    participants: { membership_id: string; role: string; membership: MemberRef }[];
    primary_tickets: (ConversationListItem["primary_tickets"][number] & { subject: string; priority: TicketPriority; status: StatusRef | null; resolution_due_at: string | null; first_response_due_at: string | null })[];
    ticket_links: { ticket: { id: string; reference: string; subject: string; status: StatusRef | null } }[];
    csat_ratings: { id: string; rating: number | null; comment: string | null; submitted_at: string | null; requested_at: string }[];
    messages: SupportMessage[];
    customer_history: { id: string; subject: string | null; status: ConversationStatus; channel_type: SupportChannelType; created_at: string }[];
}

export interface ConversationCounts {
    all: number;
    mine: number;
    unassigned: number;
    mentions: number;
    snoozed: number;
}

export interface PostMessageDto {
    kind: "AGENT" | "INTERNAL_NOTE";
    body: string;
    mentions?: string[];
    canned_response_id?: string;
    then_status?: "OPEN" | "PENDING" | "RESOLVED";
}

// --- Tickets -------------------------------------------------------------------------------------

export interface TicketListItem {
    id: string;
    number: number;
    reference: string;
    subject: string;
    type: TicketType;
    source: TicketSource;
    priority: TicketPriority;
    created_at: string;
    updated_at: string;
    due_at: string | null;
    first_response_due_at: string | null;
    next_response_due_at: string | null;
    resolution_due_at: string | null;
    sla_breached: boolean;
    sla_at_risk: boolean;
    status: StatusRef | null;
    category: { id: string; name: string; color: string | null } | null;
    inbox: { id: string; name: string } | null;
    team: { id: string; name: string } | null;
    assignee: MemberRef | null;
    company: { id: string; name: string } | null;
    requester: { id: string; first_name: string; last_name: string | null; email: string | null } | null;
    requester_user: PersonUser | null;
    requester_name: string | null;
    requester_email: string | null;
    project: { id: string; name: string; code: string | null } | null;
    _count?: { task_links: number; followers: number };
}

export interface SlaTimer {
    id: string;
    metric: SlaMetric;
    status: SlaTimerStatus;
    target_minutes: number;
    started_at: string;
    due_at: string;
    completed_at: string | null;
    breached_at: string | null;
    at_risk_at: string | null;
    elapsed_minutes: number | null;
}

export interface TicketDetail extends TicketListItem {
    description: string | null;
    channel_type: SupportChannelType | null;
    resolution: string | null;
    customer_visible: boolean;
    escalation_level: number;
    conversation_id: string | null;
    resolved_at: string | null;
    closed_at: string | null;
    first_responded_at: string | null;
    sla_policy: { id: string; name: string; use_business_hours: boolean } | null;
    sla_timers: SlaTimer[];
    followers: { membership_id: string; membership: MemberRef }[];
    following: boolean;
    task_links: { id: string; kind: "CONVERTED" | "LINKED"; task: { id: string; identifier: string; title: string; status: { name: string; category: string; color: string | null } | null; assignee: MemberRef | null } }[];
    relations_from: { id: string; type: string; target: { id: string; reference: string; subject: string; status: StatusRef | null } }[];
    relations_to: { id: string; type: string; source: { id: string; reference: string; subject: string; status: StatusRef | null } }[];
    incident: { id: string; title: string; status: string; severity: string } | null;
    merged_into: { id: string; reference: string; subject: string } | null;
    status_history: { id: string; changed_at: string; changed_via: string; reason: string | null; from_status: StatusRef | null; to_status: StatusRef | null }[];
    csat_ratings: { id: string; rating: number | null; comment: string | null; submitted_at: string | null }[];
}

export interface TicketCounts {
    open: number;
    mine: number;
    unassigned: number;
    breached: number;
    at_risk: number;
    resolved: number;
}

export interface CreateTicketDto {
    subject: string;
    description?: string;
    type?: TicketType;
    priority?: TicketPriority;
    category_id?: string;
    inbox_id?: string;
    team_id?: string;
    assignee_membership_id?: string;
    company_id?: string;
    requester_email?: string;
    requester_name?: string;
    project_id?: string;
    conversation_id?: string;
    customer_visible?: boolean;
}

export type UpdateTicketDto = Partial<Omit<CreateTicketDto, "conversation_id" | "assignee_membership_id">> & { resolution?: string | null; sla_policy_id?: string };

// --- Configuration -------------------------------------------------------------------------------

export interface TicketStatusRow extends StatusRef {
    sort_order: number;
    is_default: boolean;
    allowed_transitions: string[];
    _count?: { tickets: number };
}

export interface TicketCategoryRow {
    id: string;
    name: string;
    slug: string;
    description: string | null;
    color: string | null;
    default_priority: TicketPriority | null;
    default_inbox_id: string | null;
    default_team_id: string | null;
    default_sla_policy_id: string | null;
    _count?: { tickets: number };
}

export interface Inbox {
    id: string;
    name: string;
    slug: string;
    description: string | null;
    color: string | null;
    is_default: boolean;
    routing_strategy: RoutingStrategy;
    signature: string | null;
    auto_reply_body: string | null;
    team_id: string | null;
    branch_id: string | null;
    default_assignee_membership_id: string | null;
    default_sla_policy_id: string | null;
    team: { id: string; name: string } | null;
    branch: { id: string; name: string } | null;
    default_assignee: MemberRef | null;
    channels: { id: string; type: SupportChannelType; name: string; is_active: boolean; verified_at: string | null }[];
    _count?: { conversations: number; tickets: number };
}

export interface SupportChannel {
    id: string;
    inbox_id: string;
    type: SupportChannelType;
    name: string;
    email_address: string | null;
    widget_key: string | null;
    allowed_origins: string[];
    config: Record<string, unknown> | null;
    ai_agent_enabled: boolean;
    is_active: boolean;
    csat_enabled: boolean;
    verified_at: string | null;
    inbox: { id: string; name: string };
    _count?: { conversations: number };
}

/** GET /support/channels/:id/email-setup — never contains the secret. */
export interface EmailChannelSetup {
    channel_id: string;
    email_address: string | null;
    inbound_url: string;
    has_inbound_secret: boolean;
    inbound_secret_set_at: string | null;
    last_inbound_at: string | null;
    verified_at: string | null;
    outbound: { connected: true; connection_name: string } | { connected: false; reason: string };
}

export interface Agent extends MemberRef {
    profile: { availability: "ONLINE" | "AWAY" | "OFFLINE"; max_open_conversations: number | null; skills: string[]; languages: string[] } | null;
    open_conversations: number;
}

export interface SlaTarget {
    priority: TicketPriority;
    first_response_minutes: number | null;
    next_response_minutes: number | null;
    resolution_minutes: number | null;
}

export interface SlaPolicy {
    id: string;
    name: string;
    description: string | null;
    is_default: boolean;
    use_business_hours: boolean;
    at_risk_threshold_percent: string | number;
    conditions: Record<string, string[]> | null;
    archived_at: string | null;
    targets: SlaTarget[];
    _count?: { tickets: number };
}

export interface SlaPolicyDto {
    name: string;
    description?: string;
    is_default?: boolean;
    use_business_hours?: boolean;
    at_risk_threshold_percent?: number;
    targets: SlaTarget[];
}

export interface SupportSettings {
    organization_id: string;
    ticket_prefix: string;
    default_sla_policy_id: string | null;
    default_inbox_id: string | null;
    auto_close_after_days: number | null;
    inactivity_after_hours: number | null;
    reopen_window_days: number | null;
    csat_enabled: boolean;
    csat_delay_minutes: number;
    csat_scale: CsatScale;
    csat_question: string | null;
    csat_thank_you: string | null;
    csat_follow_up_threshold: number | null;
    default_signature: string | null;
    ai_agent_enabled: boolean;
    ai_require_reply_approval: boolean;
    ai_require_task_approval: boolean;
    ai_provider_connected: boolean;
}

export interface CannedResponse {
    id: string;
    name: string;
    shortcut: string | null;
    category: string | null;
    body: string;
    scope: CannedScope;
    team_id: string | null;
    owner_membership_id: string | null;
    usage_count: number;
    team: { id: string; name: string } | null;
    owner: MemberRef | null;
}

export interface CannedDto {
    name: string;
    shortcut?: string;
    category?: string;
    body: string;
    scope?: CannedScope;
    team_id?: string | null;
}

// --- Knowledge base ------------------------------------------------------------------------------

export interface KnowledgeCategory {
    id: string;
    name: string;
    slug: string;
    description: string | null;
    visibility: KnowledgeVisibility;
    sort_order: number;
    _count?: { articles: number };
}

export interface ArticleListItem {
    id: string;
    title: string;
    slug: string;
    summary: string | null;
    status: KnowledgeArticleStatus;
    visibility: KnowledgeVisibility;
    is_faq: boolean;
    locale: string;
    current_version: number;
    view_count: number;
    helpful_count: number;
    not_helpful_count: number;
    published_at: string | null;
    updated_at: string;
    category: { id: string; name: string } | null;
    author: MemberRef | null;
}

export interface ArticleDetail extends ArticleListItem {
    body: string;
    keywords: string[];
    category_id: string | null;
    help_center_path: string | null;
    versions: { id: string; version: number; title: string; change_note: string | null; created_at: string }[];
    feedback: { id: string; is_helpful: boolean; comment: string | null; created_at: string }[];
}

export interface ArticleDto {
    title: string;
    slug?: string;
    summary?: string;
    body: string;
    category_id?: string | null;
    visibility?: KnowledgeVisibility;
    is_faq?: boolean;
    keywords?: string[];
    change_note?: string;
}

// --- Analytics & CSAT ----------------------------------------------------------------------------

export interface SupportAnalytics {
    range: { from: string; to: string };
    org_wide: boolean;
    totals: { tickets_created: number; tickets_resolved: number; conversations_created: number; open_backlog: number; reopened: number; resolved_by_ai: number };
    first_response: { average_minutes: number | null; median_minutes: number | null; responded: number };
    resolution: { average_minutes: number | null; median_minutes: number | null; resolved: number };
    sla: { compliance: number | null; by_metric: { metric: SlaMetric; met: number; breached: number; compliance: number | null }[] };
    csat: { responses: number; average: number | null; satisfied_percent: number | null };
    volume: { date: string; created: number; resolved: number }[];
    backlog_by_priority: { priority: TicketPriority; count: number }[];
    by_source: { key: string; count: number }[];
    by_priority: { key: string; count: number }[];
    by_category: { key: string; count: number }[];
    agents: { agent: MemberRef | null; assigned: number; resolved: number; median_first_response_minutes: number | null }[];
}

export interface CsatSummary {
    enabled: boolean;
    scale: CsatScale;
    responses: number;
    requested: number;
    response_rate: number | null;
    average: number | null;
    csat_percent: number | null;
    distribution: { rating: number; count: number }[];
}

export interface AiReplySuggestion {
    available: boolean;
    reason?: string;
    suggestion: { id: string; body: string } | null;
    articles: { id: string; title: string; slug: string; summary: string | null; visibility: KnowledgeVisibility }[];
}

// --- Incidents (13 §3, §5) -----------------------------------------------------------------------

export type IncidentStatus = "DETECTED" | "CONFIRMED" | "RESOLVED" | "DISMISSED";
export type IncidentSeverity = "MINOR" | "MAJOR" | "CRITICAL";
export type IncidentUpdateStatus = "INVESTIGATING" | "IDENTIFIED" | "MONITORING" | "RESOLVED";

export interface IncidentUpdate {
    id: string;
    status: IncidentUpdateStatus;
    body: string;
    customer_visible: boolean;
    created_at: string;
    author?: MemberRef | null;
}

export interface IncidentListItem {
    id: string;
    title: string;
    description: string | null;
    status: IncidentStatus;
    severity: IncidentSeverity;
    affected_services: string[];
    detected_by_ai: boolean;
    ticket_count: number;
    first_reported_at: string | null;
    resolved_at: string | null;
    created_at: string;
    updated_at: string;
    updates: IncidentUpdate[];
    _count?: { tickets: number };
}

export interface IncidentDetail extends IncidentListItem {
    owner: MemberRef | null;
    tickets: { id: string; reference: string; subject: string; priority: TicketPriority; created_at: string; company: { id: string; name: string } | null; status: { name: string; category: TicketStatusCategory; color: string | null } | null }[];
}

export interface IncidentDto {
    title?: string;
    description?: string;
    severity?: IncidentSeverity;
    affected_services?: string[];
    ticket_ids?: string[];
    status?: IncidentStatus;
}

// --- AI review queue (13 §3) ---------------------------------------------------------------------

export type AiSuggestionStatus = "PENDING" | "ACCEPTED" | "REJECTED" | "AUTO_APPLIED" | "EXPIRED";

export interface AiSuggestion {
    id: string;
    kind: string;
    status: AiSuggestionStatus;
    conversation_id: string | null;
    ticket_id: string | null;
    model: string;
    payload: { body?: string; text?: string; summary?: string; edited_body?: string; article_ids?: string[]; [key: string]: unknown };
    explanation: string | null;
    confidence: number | null;
    review_note: string | null;
    reviewed_at: string | null;
    was_correct: boolean | null;
    created_at: string;
    expires_at: string | null;
    conversation: { id: string; subject: string | null; customer_name: string | null; customer_email: string | null; channel_type: SupportChannelType; status: ConversationStatus } | null;
    ticket: { id: string; reference: string; subject: string } | null;
    reviewed_by: MemberRef | null;
}

export interface AiStatus {
    configured: boolean;
    agent_enabled: boolean;
    require_reply_approval: boolean;
    pending_suggestions: number;
}

// ---------------------------------------------------------------- AI auto-answer + office hours (13 §3, §5)

export type ChannelAiMode = "OFF" | "SUGGEST" | "AUTO_REPLY";

export interface ChannelAiConfig {
    mode: ChannelAiMode;
    /** 0.5–0.99 */
    min_confidence: number;
    max_turns: number;
    handover_phrases: string[];
}

export type WeekdayKey = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";

export interface OfficeHoursConfig {
    enabled: boolean;
    use_organization_hours: boolean;
    timezone?: string | null;
    days?: Partial<Record<WeekdayKey, { start: string; end: string } | null>>;
    offline_message?: string | null;
}

/** GET /support/channels/:id/automation */
export interface ChannelAutomation {
    channel_id: string;
    ai: ChannelAiConfig;
    office_hours: OfficeHoursConfig;
    office_hours_status: { enabled: boolean; open: boolean; next_open_at: string | null; timezone: string | null };
}

export type SupportAiSessionStatus = "ACTIVE" | "RESOLVED_BY_AI" | "HANDED_OVER" | "ABANDONED" | "FAILED";

/** GET /support/ai/conversations/:id/sessions */
export interface SupportAiSession {
    id: string;
    conversation_id: string;
    status: SupportAiSessionStatus;
    model: string;
    turn_count: number;
    cited_article_ids: string[];
    handover_reason: string | null;
    handover_summary: string | null;
    handover_label: string | null;
    usage: { input_tokens?: number; output_tokens?: number; cost?: number } | null;
    started_at: string;
    handed_over_at: string | null;
    ended_at: string | null;
}

/** Socket `typing` on the /support namespace (agents watching a conversation). */
export interface SupportTypingEvent {
    conversation_id: string;
    from: "visitor" | "agent" | "ai";
    name: string | null;
    membership_id?: string | null;
    internal: boolean;
    active: boolean;
}

/** GET /help/:orgSlug/articles/:slug — public article (linked from AI answers). */
export interface PublicHelpArticle {
    id: string;
    title: string;
    slug: string;
    summary: string | null;
    body: string;
    published_at: string | null;
    updated_at: string;
    category: { id: string; name: string; slug: string } | null;
    related: { id: string; title: string; slug: string }[];
}
