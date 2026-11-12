import type { PaginationMeta } from "@/components/ui/data-table";

/** Decimal columns arrive as strings from the API. */
export type Money = string | number;

export const ProposalStatuses = {
    DRAFT: "DRAFT",
    IN_REVIEW: "IN_REVIEW",
    PENDING_APPROVAL: "PENDING_APPROVAL",
    APPROVED: "APPROVED",
    SENT: "SENT",
    VIEWED: "VIEWED",
    CHANGES_REQUESTED: "CHANGES_REQUESTED",
    ACCEPTED: "ACCEPTED",
    REJECTED: "REJECTED",
    EXPIRED: "EXPIRED",
    CANCELLED: "CANCELLED",
} as const;
export type ProposalStatus = (typeof ProposalStatuses)[keyof typeof ProposalStatuses];

export const ProposalVersionStatuses = { DRAFT: "DRAFT", IN_REVIEW: "IN_REVIEW", APPROVED: "APPROVED", SENT: "SENT", SUPERSEDED: "SUPERSEDED" } as const;
export type ProposalVersionStatus = (typeof ProposalVersionStatuses)[keyof typeof ProposalVersionStatuses];

export const ProposalSectionTypes = {
    COVER: "COVER", EXECUTIVE_SUMMARY: "EXECUTIVE_SUMMARY", OVERVIEW: "OVERVIEW", REQUIREMENTS: "REQUIREMENTS", SOLUTION: "SOLUTION", SCOPE: "SCOPE", FEATURES: "FEATURES",
    DELIVERABLES: "DELIVERABLES", PHASES: "PHASES", MILESTONES: "MILESTONES", TIMELINE: "TIMELINE", PRICING: "PRICING", PAYMENT_SCHEDULE: "PAYMENT_SCHEDULE",
    SUPPORT_OPTIONS: "SUPPORT_OPTIONS", ASSUMPTIONS: "ASSUMPTIONS", EXCLUSIONS: "EXCLUSIONS", WARRANTY: "WARRANTY", TERMS: "TERMS", NEXT_STEPS: "NEXT_STEPS", SIGNATURE: "SIGNATURE", CUSTOM: "CUSTOM",
} as const;
export type ProposalSectionType = (typeof ProposalSectionTypes)[keyof typeof ProposalSectionTypes];

export const ProposalPaymentTriggers = { ON_ACCEPTANCE: "ON_ACCEPTANCE", ON_SIGNATURE: "ON_SIGNATURE", ON_DATE: "ON_DATE", ON_MILESTONE: "ON_MILESTONE", ON_DELIVERY: "ON_DELIVERY", RECURRING: "RECURRING" } as const;
export type ProposalPaymentTrigger = (typeof ProposalPaymentTriggers)[keyof typeof ProposalPaymentTriggers];

export const ProposalApprovalDecisions = { PENDING: "PENDING", APPROVED: "APPROVED", REJECTED: "REJECTED", CHANGES_REQUESTED: "CHANGES_REQUESTED" } as const;
export type ProposalApprovalDecision = (typeof ProposalApprovalDecisions)[keyof typeof ProposalApprovalDecisions];

export const ProposalDeliveryChannels = { EMAIL: "EMAIL", CUSTOMER_PORTAL: "CUSTOMER_PORTAL", PDF: "PDF", LINK: "LINK" } as const;
export type ProposalDeliveryChannel = (typeof ProposalDeliveryChannels)[keyof typeof ProposalDeliveryChannels];

export const ProposalDeliveryStatuses = { QUEUED: "QUEUED", SENT: "SENT", DELIVERED: "DELIVERED", FAILED: "FAILED" } as const;
export type ProposalDeliveryStatus = (typeof ProposalDeliveryStatuses)[keyof typeof ProposalDeliveryStatuses];

export const ProposalLostReasons = { PRICE: "PRICE", SCOPE: "SCOPE", TIMING: "TIMING", COMPETITOR: "COMPETITOR", NO_DECISION: "NO_DECISION", OTHER: "OTHER" } as const;
export type ProposalLostReason = (typeof ProposalLostReasons)[keyof typeof ProposalLostReasons];

export const ProposalLinkAccessModes = { ANYONE_WITH_LINK: "ANYONE_WITH_LINK", EMAIL_VERIFIED: "EMAIL_VERIFIED" } as const;
export type ProposalLinkAccessMode = (typeof ProposalLinkAccessModes)[keyof typeof ProposalLinkAccessModes];

export const ProposalCustomerDecisions = { ACCEPTED: "ACCEPTED", REJECTED: "REJECTED", CHANGES_REQUESTED: "CHANGES_REQUESTED" } as const;
export type ProposalCustomerDecision = (typeof ProposalCustomerDecisions)[keyof typeof ProposalCustomerDecisions];

export type BillingFrequency = "monthly" | "quarterly" | "annual" | "custom";

export interface MemberRef {
    id: string;
    job_title: string | null;
    user: { id: string; email: string; display_name: string | null; first_name: string | null; last_name: string | null; profile_photo_url: string | null };
}

export interface Paginated<T> {
    data: T[];
    pagination: PaginationMeta & { has_next: boolean; has_prev: boolean };
}

export interface ProposalListItem {
    id: string;
    number: string;
    title: string;
    status: ProposalStatus;
    lost_reason: ProposalLostReason | null;
    currency: string;
    language: string;
    company_id: string | null;
    contact_id: string | null;
    deal_id: string | null;
    project_id: string | null;
    owner_membership_id: string | null;
    branch_id: string | null;
    valid_until: string | null;
    net_total: Money;
    gross_total: Money;
    recurring_monthly: Money;
    requires_contract: boolean;
    current_version_id: string | null;
    sent_version_id: string | null;
    accepted_version_id: string | null;
    contract_id: string | null;
    sent_at: string | null;
    first_viewed_at: string | null;
    last_viewed_at: string | null;
    view_count: number;
    accepted_at: string | null;
    rejected_at: string | null;
    archived_at: string | null;
    created_at: string;
    updated_at: string;
    link_access_mode: ProposalLinkAccessMode;
    reminder_days: number[];
    company: { id: string; name: string } | null;
    contact: { id: string; first_name: string; last_name: string | null; email: string | null } | null;
    deal: { id: string; name: string } | null;
    owner: MemberRef | null;
    current_version: { id: string; version_number: number; status: ProposalVersionStatus } | null;
    sent_version: { id: string; version_number: number } | null;
}

export interface ProposalSection {
    id: string;
    type: ProposalSectionType;
    title: string;
    body: string | null;
    sort_order: number;
    is_internal: boolean;
    is_ai_generated: boolean;
}

export interface ProposalLineItem {
    id: string;
    product_id: string | null;
    group_name: string | null;
    name: string;
    description: string | null;
    quantity: Money;
    unit: string | null;
    unit_price: Money;
    discount_percent: Money | null;
    discount_amount: Money;
    tax_percent: Money | null;
    net_amount: Money;
    tax_amount: Money;
    gross_amount: Money;
    is_recurring: boolean;
    billing_frequency: BillingFrequency | null;
    is_optional: boolean;
    selected_by_customer: boolean | null;
}

export interface ProposalPaymentItem {
    id?: string;
    name: string;
    trigger: ProposalPaymentTrigger;
    percentage: Money | null;
    amount: Money | null;
    due_date: string | null;
    milestone_name: string | null;
    frequency: string | null;
}

export interface ProposalApproval {
    id: string;
    version_id: string;
    approver_membership_id: string;
    step: number;
    decision: ProposalApprovalDecision;
    rule_id: string | null;
    comment: string | null;
    requested_at: string;
    due_at: string | null;
    decided_at: string | null;
    approver: MemberRef;
}

export interface ProposalVersionSummary {
    id: string;
    version_number: number;
    status: ProposalVersionStatus;
    change_summary: string | null;
    gross_total: Money;
    created_at: string;
    sent_at: string | null;
    locked_at: string | null;
    content_hash: string | null;
    is_ai_generated: boolean;
}

export interface ProposalVersionDetail extends ProposalVersionSummary {
    payment_terms: string | null;
    validity_days: number | null;
    net_total: Money;
    discount_total: Money;
    tax_total: Money;
    recurring_monthly: Money;
    recurring_annual: Money;
    optional_total: number;
    editable: boolean;
    variables: Record<string, string> | null;
    sections: ProposalSection[];
    line_items: ProposalLineItem[];
    payment_schedule: ProposalPaymentItem[];
    approvals: ProposalApproval[];
}

export interface ProposalDetail extends ProposalListItem {
    branch: { id: string; name: string } | null;
    template: { id: string; name: string; version: number } | null;
    versions: ProposalVersionSummary[];
    version: ProposalVersionDetail | null;
}

export interface ProposalSummary {
    open_value: number;
    open_count: number;
    accepted_90d_value: number;
    accepted_90d_count: number;
    win_rate: number | null;
    awaiting_approval: number;
    expiring_7d: number;
    drafts: number;
}

export interface ProposalEvent {
    id: string;
    type: string;
    actor_user_id: string | null;
    actor_contact_id: string | null;
    ip_address: string | null;
    user_agent: string | null;
    metadata: Record<string, unknown> | null;
    created_at: string;
    version: { version_number: number } | null;
}

export interface ProposalDelivery {
    id: string;
    channel: ProposalDeliveryChannel;
    status: ProposalDeliveryStatus;
    recipient_email: string | null;
    failed_reason: string | null;
    sent_at: string | null;
    created_at: string;
    version: { version_number: number } | null;
    recipient: { id: string; first_name: string; last_name: string | null } | null;
}

export interface AiDraftSection { type: ProposalSectionType; title: string; body: string }
export interface AiDraftLine { name: string; description?: string | null; quantity: number; unit?: string | null; unit_price: number; is_optional?: boolean; is_recurring?: boolean; billing_frequency?: "monthly" | "quarterly" | "annual" | null }
export interface AiGenerateDto { deal_id?: string; notes?: string; include_crm_notes?: boolean; sections?: ProposalSectionType[]; include_line_items?: boolean; tone?: "professional" | "friendly" | "concise" | "formal"; language?: string }
export type AiGenerateResult =
    | { available: true; run_id: string; model: string; sources: string[]; draft: { sections: AiDraftSection[]; line_items: AiDraftLine[]; assumptions: string[] }; usage: { input_tokens: number | null; output_tokens: number | null; cost: number | null } }
    | { available: false; reason: "ai_not_configured" | "ai_provider_error"; message: string };
export interface AiApplyDto { version_id: string; run_id: string; mode: "append" | "replace"; sections: AiDraftSection[]; line_items: AiDraftLine[] }

export interface ProposalTrackingEvent {
    id: string;
    type: string;
    created_at: string;
    version_number: number | null;
    proposal: { id: string; number: string; title: string; company: string | null };
    actor: "staff" | "customer" | "system";
    contact: string | null;
    time_on_page_seconds: number | null;
    sections_opened: number | null;
    reminder: boolean;
    detail: string | null;
    ip_address: string | null;
    user_agent: string | null;
}

export interface ProposalTrackingProposal {
    id: string;
    number: string;
    title: string;
    status: ProposalStatus | null;
    company: string | null;
    valid_until: string | null;
    views: number;
    time_on_page_seconds: number;
    last_viewed_at: string;
    hot: boolean;
    sections: { id: string; title: string; seconds: number }[];
}

export interface ProposalTracking {
    range: { from: string; to: string };
    summary: { views_today: number; views_in_range: number; proposals_viewed: number; hot_proposals: number; not_opened: number; delivery_failures: number; avg_time_on_page_seconds: number | null };
    proposals: ProposalTrackingProposal[];
    events: Paginated<ProposalTrackingEvent>;
}

export interface ProposalActivity {
    events: ProposalEvent[];
    deliveries: ProposalDelivery[];
}

export interface ProposalComment {
    id: string;
    body: string;
    is_internal: boolean;
    resolved_at: string | null;
    created_at: string;
    section_id: string | null;
    author_contact_id: string | null;
    author: MemberRef | null;
    section: { id: string; title: string } | null;
    version: { version_number: number } | null;
}

export interface SendCheck {
    key: string;
    ok: boolean;
    blocking: boolean;
    label: string;
    detail: string;
}

export interface SendPreview {
    version_id: string;
    version_number: number;
    is_resend: boolean;
    ready: boolean;
    checks: SendCheck[];
    email_enabled: boolean;
    default_valid_until: string;
    recipients: { contact_id: string; name: string; email: string | null }[];
}

export interface SendResult {
    public_url: string;
    email_enabled: boolean;
    deliveries: ProposalDelivery[];
}

export interface ReviewPreview {
    matched_rules: { id: string; name: string; priority: number }[];
    steps: { step: number; name: string; approver_membership_id: string; rule_id: string; rule_name: string; approver?: MemberRef }[];
}

export interface CompareResult {
    from: { id: string; version_number: number; status: ProposalVersionStatus };
    to: { id: string; version_number: number; status: ProposalVersionStatus };
    sections: { type: ProposalSectionType; title: string; status: "added" | "removed" | "changed" | "same"; from: string | null; to: string | null }[];
    line_items: { name: string; status: "added" | "removed" | "changed" | "same"; from: { quantity: Money; unit_price: Money; net_amount: Money } | null; to: { quantity: Money; unit_price: Money; net_amount: Money } | null }[];
    totals: { from: Record<string, Money>; to: Record<string, Money> };
    payment_terms: { from: string | null; to: string | null };
}

export interface MyApproval {
    id: string;
    step: number;
    requested_at: string;
    due_at: string | null;
    version: { id: string; version_number: number; gross_total: Money; proposal: { id: string; number: string; title: string; currency: string; company: { name: string } | null } };
}

export interface ProposalAnalytics {
    range: { from: string; to: string };
    created: number;
    sent: number;
    viewed_rate: number | null;
    accepted: number;
    lost: number;
    win_rate: number | null;
    accepted_value: number;
    avg_accepted_value: number | null;
    avg_days_to_accept: number | null;
    by_status: Record<string, number>;
    lost_reasons: Record<string, number>;
    months: { month: string; created: number; sent: number; accepted: number; accepted_value: number }[];
    by_owner: { owner: MemberRef | null; sent: number; accepted: number; lost: number; accepted_value: number; win_rate: number | null }[];
    currencies: string[];
}

export interface TemplateSection {
    type: ProposalSectionType;
    title: string;
    body_template?: string;
    is_required?: boolean;
}

export interface ProposalTemplate {
    id: string;
    name: string;
    slug: string;
    description: string | null;
    work_type: string | null;
    language: string;
    sections: TemplateSection[];
    defaults: { payment_terms?: string } | null;
    variables: string[] | null;
    default_validity_days: number;
    is_default: boolean;
    version: number;
    archived_at: string | null;
    updated_at: string;
    _count?: { proposals: number };
    versions?: { id: string; version_number: number; change_summary: string | null; created_at: string }[];
}

export interface ApprovalCondition {
    field: "gross_total" | "net_total" | "discount_percent" | "discount_total" | "recurring_monthly" | "currency" | "requires_contract";
    operator: ">" | ">=" | "<" | "<=" | "=" | "!=";
    value: number | string | boolean;
}

export interface ApprovalRule {
    id: string;
    name: string;
    conditions: ApprovalCondition[];
    steps: { step: number; name: string; approver_membership_id: string }[];
    priority: number;
    enabled: boolean;
    approvers: MemberRef[];
}

export interface LookupOption {
    id: string;
    name?: string;
    first_name?: string;
    last_name?: string | null;
    email?: string | null;
    currency?: string | null;
    company_id?: string | null;
    value?: Money;
    code?: string | null;
    user?: MemberRef["user"];
}

// --- DTOs ---------------------------------------------------------------------------------------

export interface SectionInput {
    id?: string;
    type: ProposalSectionType;
    title: string;
    body?: string | null;
    is_internal?: boolean;
    is_ai_generated?: boolean;
}

export interface LineItemInput {
    product_id?: string | null;
    group_name?: string | null;
    name: string;
    description?: string | null;
    quantity: number;
    unit?: string | null;
    unit_price: number;
    discount_percent?: number | null;
    discount_amount?: number | null;
    tax_percent?: number | null;
    is_recurring?: boolean;
    billing_frequency?: BillingFrequency | null;
    is_optional?: boolean;
}

export interface PaymentInput {
    name: string;
    trigger: ProposalPaymentTrigger;
    percentage?: number | null;
    amount?: number | null;
    due_date?: string | null;
    milestone_name?: string | null;
    frequency?: string | null;
}

export interface SaveContentDto {
    sections?: SectionInput[];
    line_items?: LineItemInput[];
    payment_schedule?: PaymentInput[];
    payment_terms?: string | null;
    validity_days?: number | null;
    change_summary?: string | null;
}

export interface CreateProposalDto {
    title: string;
    currency?: string;
    language?: string;
    company_id?: string | null;
    contact_id?: string | null;
    deal_id?: string | null;
    project_id?: string | null;
    owner_membership_id?: string | null;
    branch_id?: string | null;
    template_id?: string | null;
    requires_contract?: boolean;
}

export interface UpdateProposalDto extends Partial<CreateProposalDto> {
    valid_until?: string | null;
    reminder_days?: number[];
    link_access_mode?: ProposalLinkAccessMode;
}

export interface SendProposalDto {
    version_id?: string;
    channels: ProposalDeliveryChannel[];
    recipient_contact_ids?: string[];
    extra_emails?: string[];
    subject?: string;
    message?: string;
    valid_until?: string;
    reminder_days?: number[];
    link_access_mode?: ProposalLinkAccessMode;
}

export interface CreateTemplateDto {
    name: string;
    description?: string | null;
    work_type?: string | null;
    language?: string;
    sections: TemplateSection[];
    defaults?: Record<string, unknown> | null;
    variables?: string[];
    default_validity_days?: number;
    is_default?: boolean;
    change_summary?: string;
}

export interface ApprovalRuleDto {
    name: string;
    conditions: ApprovalCondition[];
    steps: { step: number; name: string; approver_membership_id: string }[];
    priority?: number;
    enabled?: boolean;
}

// --- Public customer view ---------------------------------------------------------------------------

export type PublicProposalState = "ACTIVE" | "DECIDED" | "EXPIRED" | "CANCELLED" | "VERIFICATION_REQUIRED";

export interface PublicTotals {
    net_total: number;
    discount_total: number;
    tax_total: number;
    gross_total: number;
    recurring_monthly: number;
    recurring_annual: number;
    optional_total: number;
}

export interface PublicProposal {
    state: PublicProposalState;
    organization: { name: string; logo_url: string | null };
    proposal: { number: string; title: string; currency: string; language: string; valid_until: string | null; status: ProposalStatus; requires_contract: boolean };
    hint?: string | null;
    recipient?: { company: string | null; contact: string | null; email: string | null };
    version?: {
        version_number: number;
        sent_at: string | null;
        payment_terms: string | null;
        sections: { id: string; type: ProposalSectionType; title: string; body: string | null }[];
        line_items: Omit<ProposalLineItem, "product_id">[];
        payment_schedule: ProposalPaymentItem[];
        totals: PublicTotals;
    };
    decision?: { decision: ProposalCustomerDecision; signer_name: string; signer_title: string | null; created_at: string; feedback: string | null; selected_optional_item_ids: string[] } | null;
    comments?: { id: string; body: string; created_at: string; section_id: string | null; author_name?: string | null; from: "agency" | "customer" }[];
}

export interface PublicDecisionDto {
    decision: ProposalCustomerDecision;
    signer_name: string;
    signer_email: string;
    signer_title?: string;
    terms_accepted?: boolean;
    feedback?: string;
    selected_optional_item_ids?: string[];
}
