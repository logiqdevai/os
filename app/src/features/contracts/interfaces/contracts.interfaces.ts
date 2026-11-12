import type { PaginationMeta } from "@/components/ui/data-table";

export interface Paginated<T> {
    data: T[];
    pagination: PaginationMeta & { has_next: boolean; has_prev: boolean };
}

export const ContractStatuses = {
    DRAFT: "DRAFT",
    INTERNAL_REVIEW: "INTERNAL_REVIEW",
    CUSTOMER_REVIEW: "CUSTOMER_REVIEW",
    APPROVAL_REQUIRED: "APPROVAL_REQUIRED",
    READY_FOR_SIGNATURE: "READY_FOR_SIGNATURE",
    PARTIALLY_SIGNED: "PARTIALLY_SIGNED",
    FULLY_SIGNED: "FULLY_SIGNED",
    ACTIVE: "ACTIVE",
    EXPIRING: "EXPIRING",
    RENEWED: "RENEWED",
    SUPERSEDED: "SUPERSEDED",
    TERMINATED: "TERMINATED",
    EXPIRED: "EXPIRED",
    CANCELLED: "CANCELLED",
    ARCHIVED: "ARCHIVED",
} as const;
export type ContractStatus = (typeof ContractStatuses)[keyof typeof ContractStatuses];

export const ContractVersionStatuses = { DRAFT: "DRAFT", IN_REVIEW: "IN_REVIEW", APPROVED: "APPROVED", LOCKED_FOR_SIGNATURE: "LOCKED_FOR_SIGNATURE", SIGNED: "SIGNED", SUPERSEDED: "SUPERSEDED" } as const;
export type ContractVersionStatus = (typeof ContractVersionStatuses)[keyof typeof ContractVersionStatuses];

export const ContractRelationKinds = { STANDALONE: "STANDALONE", AMENDMENT: "AMENDMENT", RENEWAL: "RENEWAL", SOW: "SOW", CHANGE_ORDER: "CHANGE_ORDER", TERMINATION_AGREEMENT: "TERMINATION_AGREEMENT" } as const;
export type ContractRelationKind = (typeof ContractRelationKinds)[keyof typeof ContractRelationKinds];

export const ContractRenewalTypes = { NONE: "NONE", MANUAL: "MANUAL", AUTOMATIC: "AUTOMATIC", EVERGREEN: "EVERGREEN" } as const;
export type ContractRenewalType = (typeof ContractRenewalTypes)[keyof typeof ContractRenewalTypes];

export const ContractPartyTypes = { AGENCY: "AGENCY", CUSTOMER: "CUSTOMER", VENDOR: "VENDOR", PARTNER: "PARTNER", CONTRACTOR: "CONTRACTOR", EMPLOYEE: "EMPLOYEE", OTHER: "OTHER" } as const;
export type ContractPartyType = (typeof ContractPartyTypes)[keyof typeof ContractPartyTypes];

export const ContractObligationTypes = { DELIVERABLE: "DELIVERABLE", PAYMENT: "PAYMENT", REPORTING: "REPORTING", RENEWAL_NOTICE: "RENEWAL_NOTICE", SLA: "SLA", SECURITY_REVIEW: "SECURITY_REVIEW", CUSTOMER_APPROVAL: "CUSTOMER_APPROVAL", OTHER: "OTHER" } as const;
export type ContractObligationType = (typeof ContractObligationTypes)[keyof typeof ContractObligationTypes];

export const ContractObligationStatuses = { OPEN: "OPEN", IN_PROGRESS: "IN_PROGRESS", FULFILLED: "FULFILLED", OVERDUE: "OVERDUE", WAIVED: "WAIVED", CANCELLED: "CANCELLED" } as const;
export type ContractObligationStatus = (typeof ContractObligationStatuses)[keyof typeof ContractObligationStatuses];

export const ContractTerminationTypes = { FOR_CONVENIENCE: "FOR_CONVENIENCE", FOR_CAUSE: "FOR_CAUSE", MUTUAL: "MUTUAL", EXPIRY: "EXPIRY", OTHER: "OTHER" } as const;
export type ContractTerminationType = (typeof ContractTerminationTypes)[keyof typeof ContractTerminationTypes];

export const SignatureRequestStatuses = { NOT_SENT: "NOT_SENT", SENT: "SENT", DELIVERED: "DELIVERED", VIEWED: "VIEWED", PARTIALLY_SIGNED: "PARTIALLY_SIGNED", FULLY_SIGNED: "FULLY_SIGNED", DECLINED: "DECLINED", EXPIRED: "EXPIRED", CANCELLED: "CANCELLED", FAILED: "FAILED" } as const;
export type SignatureRequestStatus = (typeof SignatureRequestStatuses)[keyof typeof SignatureRequestStatuses];

export const SignerStatuses = { PENDING: "PENDING", SENT: "SENT", DELIVERED: "DELIVERED", VIEWED: "VIEWED", SIGNED: "SIGNED", DECLINED: "DECLINED", BOUNCED: "BOUNCED" } as const;
export type SignerStatus = (typeof SignerStatuses)[keyof typeof SignerStatuses];

export const SigningOrders = { SEQUENTIAL: "SEQUENTIAL", PARALLEL: "PARALLEL" } as const;
export type SigningOrder = (typeof SigningOrders)[keyof typeof SigningOrders];

export const ContractTemplateStatuses = { DRAFT: "DRAFT", PUBLISHED: "PUBLISHED", DEPRECATED: "DEPRECATED" } as const;
export type ContractTemplateStatus = (typeof ContractTemplateStatuses)[keyof typeof ContractTemplateStatuses];

export const ContractClauseStatuses = { DRAFT: "DRAFT", ACTIVE: "ACTIVE", DEPRECATED: "DEPRECATED" } as const;
export type ContractClauseStatus = (typeof ContractClauseStatuses)[keyof typeof ContractClauseStatuses];

export type ApprovalDecision = "PENDING" | "APPROVED" | "REJECTED";
export type ReviewDecision = "PENDING" | "APPROVED" | "REJECTED" | "CHANGES_REQUESTED";

export interface MemberRef {
    id: string;
    job_title: string | null;
    user: { id: string; email: string; display_name: string | null; first_name: string | null; last_name: string | null; profile_photo_url: string | null } | null;
}

export interface LookupItem {
    id: string;
    label: string;
    sub?: string | null;
    email?: string | null;
    currency?: string | null;
    company_id?: string | null;
}

export interface ContractListItem {
    id: string;
    number: string;
    title: string;
    status: ContractStatus;
    relation_kind: ContractRelationKind;
    type_id: string | null;
    primary_company_id: string | null;
    owner_membership_id: string | null;
    currency: string | null;
    start_date: string | null;
    end_date: string | null;
    effective_date: string | null;
    expiration_date: string | null;
    renewal_date: string | null;
    notice_deadline: string | null;
    renewal_type: ContractRenewalType;
    renewal_term_months: number | null;
    notice_days: number | null;
    total_value: string | null;
    one_time_value: string | null;
    recurring_value: string | null;
    billing_frequency: string | null;
    payment_terms: string | null;
    customer_visible: boolean;
    processes_personal_data: boolean;
    current_version_id: string | null;
    signed_version_id: string | null;
    signature_date: string | null;
    archived_at: string | null;
    created_at: string;
    updated_at: string;
    confidential_hidden?: boolean;
    type?: { id: string; name: string } | null;
    primary_company?: { id: string; name: string } | null;
    owner?: MemberRef | null;
    current_version?: { id: string; label: string; version_number: number; status: ContractVersionStatus } | null;
    _count?: { obligations: number; signature_requests: number; children: number };
}

export interface ContractSignatory {
    id: string;
    membership_id: string | null;
    contact_id: string | null;
    name: string;
    title: string | null;
    email: string;
    phone: string | null;
    is_required: boolean;
}

export interface ContractParty {
    id: string;
    party_type: ContractPartyType;
    company_id: string | null;
    legal_name: string;
    registration_number: string | null;
    vat_number: string | null;
    company?: { id: string; name: string } | null;
    signatories: ContractSignatory[];
}

export interface ContractVersionSummary {
    id: string;
    label: string;
    version_number: number;
    status: ContractVersionStatus;
    change_summary: string | null;
    content_hash: string | null;
    locked_at: string | null;
    approved_at: string | null;
    signed_at: string | null;
    created_at: string;
    customer_visible: boolean;
}

export interface ContractRef {
    id: string;
    number: string;
    title: string;
    status: ContractStatus;
}

export interface ContractDetail extends ContractListItem {
    branch?: { id: string; name: string } | null;
    template?: { id: string; name: string } | null;
    proposal?: { id: string; number: string; title: string } | null;
    parent?: ContractRef | null;
    children: (ContractRef & { relation_kind: ContractRelationKind; relation_sequence: number | null; created_at: string })[];
    superseded_by?: { id: string; number: string; title: string } | null;
    parties: ContractParty[];
    projects: { project_id: string; role: string; project: { id: string; name: string; code: string | null } }[];
    versions: ContractVersionSummary[];
    termination: { type: ContractTerminationType; reason: string | null; effective_date: string; notice_date: string | null; notes: string | null } | null;
    renewal_decisions: { id: string; decision: "RENEW" | "DO_NOT_RENEW"; reason: string | null; decided_at: string; resulting_contract_id: string | null }[];
    language: string;
    proposal_id: string | null;
    parent_contract_id: string | null;
}

export interface ContractSection {
    id: string;
    key: string;
    title: string;
    body: string | null;
    is_appendix: boolean;
    sort_order: number;
    clause_version_id: string | null;
    clause_version?: { id: string; version_number: number; clause: { id: string; key: string; name: string } } | null;
}

export interface ContractApproval {
    id: string;
    step: number;
    step_name: string | null;
    approver_membership_id: string;
    decision: ApprovalDecision;
    comment: string | null;
    requested_at: string;
    decided_at: string | null;
    approver: MemberRef;
}

export interface ContractReview {
    id: string;
    reviewer_membership_id: string | null;
    reviewer_contact_id: string | null;
    is_internal: boolean;
    decision: ReviewDecision;
    comment: string | null;
    requested_at: string;
    due_at: string | null;
    decided_at: string | null;
    reviewer: MemberRef | null;
    reviewer_contact: { id: string; first_name: string; last_name: string | null; email: string | null } | null;
}

export interface ContractVersionDetail extends ContractVersionSummary {
    contract_id: string;
    sections: ContractSection[];
    approvals: ContractApproval[];
    reviews: ContractReview[];
    template_version: { id: string; version_number: number; template: { id: string; name: string } } | null;
    signature_requests: { id: string; status: SignatureRequestStatus; created_at: string; completed_at: string | null }[];
    unresolved_blocking_comments: number;
    editable: boolean;
}

export interface ApprovalPreview {
    source: "rules" | "type" | "none";
    matched_rules: { id: string; name: string }[];
    steps: { step: number; step_name: string | null; approver_membership_id: string; rule_id: string | null; rule_name: string | null; approver: MemberRef | null }[];
}

export interface DiffLine {
    op: "same" | "add" | "del";
    text: string;
}

export interface VersionCompare {
    from: { id: string; label: string; status: ContractVersionStatus; content_hash: string | null };
    to: { id: string; label: string; status: ContractVersionStatus; content_hash: string | null };
    sections: { key: string; status: "added" | "removed" | "changed" | "same"; title: string; diff: DiffLine[] }[];
    summary: { added: number; removed: number; changed: number; same: number };
}

export interface ContractComment {
    id: string;
    version_id: string;
    section_id: string | null;
    parent_comment_id: string | null;
    is_internal: boolean;
    is_blocking: boolean;
    body: string;
    resolved_at: string | null;
    created_at: string;
    author: MemberRef | null;
    section: { id: string; key: string; title: string } | null;
    version?: { id: string; label: string };
}

export interface HistoryItem {
    id: string;
    kind: "audit" | "signature";
    type: string;
    at: string;
    actor: string | null;
    metadata: Record<string, unknown> | null;
}

export interface ContractDashboard {
    by_status: Partial<Record<ContractStatus, number>>;
    total: number;
    expiring: { within_30: number; within_60: number; within_90: number };
    pending_signature: number;
    obligations: { open: number; overdue: number };
    value: { active_total: string | number; active_recurring: string | number } | null;
    recent: ContractListItem[];
    notice_deadlines: ContractListItem[];
}

export interface RenewalItem extends ContractListItem {
    days_to_end: number | null;
    latest_decision: { decision: "RENEW" | "DO_NOT_RENEW"; decided_at: string } | null;
}

export interface Signer {
    id: string;
    signatory_id?: string | null;
    name: string;
    email: string;
    title?: string | null;
    order: number;
    status: SignerStatus;
    signature_type?: "TYPED" | "DRAWN" | "UPLOADED" | null;
    identity_verified_at?: string | null;
    viewed_at: string | null;
    signed_at: string | null;
    declined_at?: string | null;
    decline_reason?: string | null;
    ip_address?: string | null;
}

export interface SignatureRequest {
    id: string;
    status: SignatureRequestStatus;
    signing_order: SigningOrder;
    message: string | null;
    sent_at: string | null;
    expires_at: string | null;
    completed_at: string | null;
    cancelled_at: string | null;
    reminders_sent: number;
    created_at: string;
    contract: ContractRef & { owner_membership_id?: string | null };
    contract_version: { id: string; label: string; content_hash?: string | null; status?: ContractVersionStatus } | null;
    signers: Signer[];
    events?: { id: string; type: string; occurred_at: string; ip_address: string | null; signer_id: string | null }[];
}

export interface SigningLink {
    signer_id: string;
    name: string;
    email: string;
    url: string;
    order?: number;
    active?: boolean;
}

export interface CreateSignatureResult {
    request: SignatureRequest;
    links: SigningLink[];
    email_sent: boolean;
    mail_configured: boolean;
}

export interface Certificate {
    certificate_id: string;
    issued_by: string;
    status: SignatureRequestStatus;
    document: { number?: string; title?: string; version?: string; content_hash?: string | null; signed_hash?: string | null };
    signing_order: SigningOrder;
    created_at: string;
    sent_at: string | null;
    completed_at: string | null;
    signers: { name: string; title: string | null; email: string; order: number; status: SignerStatus; auth_method: string | null; identity_verified_at: string | null; consent_version: string | null; consent_accepted_at: string | null; signature_type: string | null; viewed_at: string | null; signed_at: string | null; ip_address: string | null; user_agent: string | null }[];
    events: { type: string; occurred_at: string; signer: string | null; ip_address: string | null }[];
}

export interface Obligation {
    id: string;
    contract_id: string;
    section_id: string | null;
    type: ContractObligationType;
    title: string;
    description: string | null;
    responsible_party_id: string | null;
    responsible_membership_id: string | null;
    due_date: string | null;
    frequency: string | null;
    status: ContractObligationStatus;
    reminder_days_before: number | null;
    fulfilled_at: string | null;
    is_overdue: boolean;
    contract: ContractRef;
    section: { id: string; key: string; title: string } | null;
    responsible: MemberRef | null;
}

export interface ContractType {
    id: string;
    name: string;
    slug: string;
    description: string | null;
    default_template_id: string | null;
    default_renewal_type: ContractRenewalType;
    default_notice_days: number | null;
    reminder_windows_days: number[];
    archived_at: string | null;
    default_template?: { id: string; name: string } | null;
    _count?: { contracts: number; templates: number };
}

export interface TemplateSectionDef {
    key: string;
    title: string;
    body?: string;
    clause_key?: string;
    is_optional?: boolean;
    is_appendix?: boolean;
    sort_order?: number;
}

export interface ContractTemplateVersion {
    id: string;
    version_number: number;
    change_summary: string | null;
    published_at: string | null;
    created_at: string;
    sections: TemplateSectionDef[];
}

export interface ContractTemplate {
    id: string;
    name: string;
    slug: string;
    description: string | null;
    language: string;
    status: ContractTemplateStatus;
    type_id: string | null;
    current_version_id: string | null;
    updated_at: string;
    type?: { id: string; name: string } | null;
    current_version?: { id: string; version_number: number; published_at: string | null } | null;
    versions?: ContractTemplateVersion[];
    _count?: { versions: number; contracts: number };
}

export interface ContractClause {
    id: string;
    key: string;
    name: string;
    category: string;
    description: string | null;
    status: ContractClauseStatus;
    current_version_id: string | null;
    updated_at: string;
    current_version?: { id: string; version_number: number; text: string; effective_date: string | null } | null;
    versions?: { id: string; version_number: number; text: string; change_summary: string | null; created_at: string }[];
    _count?: { versions: number };
}

export interface ApprovalRule {
    id: string;
    name: string;
    conditions: { field: string; operator: string; value: unknown }[];
    steps: { step: number; name?: string; approver: { membership_id?: string; team_id?: string } }[];
    priority: number;
    enabled: boolean;
}

export interface MyApproval {
    id: string;
    step: number;
    step_name: string | null;
    requested_at: string;
    version: { id: string; label: string; contract: ContractRef };
}

// --- DTOs -----------------------------------------------------------------------------------

export interface SignatoryInput {
    membership_id?: string;
    contact_id?: string;
    name: string;
    title?: string;
    email: string;
    phone?: string;
    is_required?: boolean;
}

export interface PartyInput {
    party_type: ContractPartyType;
    company_id?: string;
    legal_name: string;
    registration_number?: string;
    vat_number?: string;
    signatories?: SignatoryInput[];
}

export interface CreateContractDto {
    title: string;
    type_id?: string;
    template_id?: string;
    primary_company_id?: string;
    owner_membership_id?: string;
    branch_id?: string;
    proposal_id?: string;
    proposal_version_id?: string;
    currency?: string;
    language?: string;
    effective_date?: string;
    start_date?: string;
    end_date?: string;
    renewal_type?: ContractRenewalType;
    renewal_term_months?: number;
    notice_days?: number;
    total_value?: number;
    one_time_value?: number;
    recurring_value?: number;
    billing_frequency?: string;
    payment_terms?: string;
    customer_visible?: boolean;
    processes_personal_data?: boolean;
    parties?: PartyInput[];
    project_ids?: string[];
}
export type UpdateContractDto = Partial<Omit<CreateContractDto, "template_id" | "parties" | "project_ids" | "proposal_id" | "proposal_version_id">>;

export interface SectionInput {
    key: string;
    title: string;
    body?: string;
    clause_version_id?: string;
    is_appendix?: boolean;
}

export interface CreateObligationDto {
    contract_id: string;
    section_id?: string;
    type?: ContractObligationType;
    title: string;
    description?: string;
    responsible_membership_id?: string;
    due_date?: string;
    frequency?: string;
    reminder_days_before?: number;
}
export type UpdateObligationDto = Partial<Omit<CreateObligationDto, "contract_id">> & { status?: ContractObligationStatus };

// --- Public signing ---------------------------------------------------------------------------

export type SigningState = "ACTIVE" | "WAITING" | "SIGNED" | "COMPLETED" | "DECLINED" | "EXPIRED" | "CANCELLED";

export interface PublicSigningState {
    state: SigningState;
    organization: { name: string; logo_url: string | null };
    contract: { number: string; title: string };
    version: { label: string; content_hash: string | null };
    parties: { party_type: ContractPartyType; legal_name: string }[];
    message: string | null;
    expires_at: string | null;
    signer: { name: string; title: string | null; email_masked: string; phone_masked: string | null; sms_available: boolean; identity_verified: boolean; signed_at: string | null; signature_type: string | null };
    signers: { name: string; status: SignerStatus; order: number; is_you: boolean; signed_at: string | null }[];
    consent_text: { id: string; version: string; locale: string; body: string };
    sections: { key: string; title: string; body: string | null; is_appendix: boolean }[] | null;
}

export interface ContractAnalytics {
    range: { from: string; to: string };
    values_visible: boolean;
    kpis: {
        cycle_time_days: number | null;
        approval_time_days: number | null;
        signature_turnaround_days: number | null;
        signed_in_range: number;
        renewal_rate: number | null;
        renewed: number;
        due_for_renewal: number;
        overdue_obligations: number;
        active_value: number | null;
        active_count: number;
    };
    cycle_by_stage: { stage: "draft_to_approval" | "approval" | "approval_to_signature" | "signature"; days: number | null }[];
    by_status: { status: ContractStatus; count: number; value: number | null }[];
    by_type: { type_id: string | null; type: string; count: number; value: number | null; recurring: number | null }[];
    signed_per_month: { month: string; signed: number; value: number | null }[];
    risk: { level: string | null; count: number }[];
    renewals_pipeline: { key: string; label: string; count: number; value: number | null; recurring: number | null }[];
    slowest_in_flight: { id: string; number: string; title: string; status: ContractStatus; company: string | null; days_in_stage: number; since: string }[];
}

export type ContractAiFindingStatus = "OPEN" | "ACCEPTED" | "DISMISSED";
export type ContractRiskLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export interface ContractAiFinding {
    id: string;
    version_id: string;
    kind: string;
    severity: ContractRiskLevel;
    message: string;
    recommendation: string | null;
    status: ContractAiFindingStatus;
    model: string | null;
    review_run_id: string | null;
    confidence: number | null;
    reviewed_at: string | null;
    resolution_note: string | null;
    created_at: string;
    section: { id: string; key: string; title: string } | null;
    reviewed_by: { id: string; user: { display_name: string | null; first_name: string | null; last_name: string | null; email: string | null } | null } | null;
    disclaimer: string;
}

export interface ContractRisk {
    score: number;
    level: ContractRiskLevel;
    factors: { factor: string; points: number; note: string }[];
}

export type AiUnavailable = { available: false; reason: "ai_not_configured" | "ai_provider_error"; message: string };

export type ContractAiReviewResult = { available: true; run_id: string; model: string; disclaimer: string; findings: ContractAiFinding[]; risk: ContractRisk | null } | AiUnavailable;

export interface ObligationSuggestion {
    id: string;
    contract_id: string;
    type: ContractObligationType;
    title: string;
    description: string | null;
    due_date: string | null;
    frequency: string | null;
    extraction_confidence: number | null;
    responsible_party_id: string | null;
    section: { id: string; key: string; title: string; body: string | null } | null;
}

export type ContractAiExtractResult = { available: true; run_id: string; model: string; disclaimer: string; suggestions: ObligationSuggestion[] } | AiUnavailable;
