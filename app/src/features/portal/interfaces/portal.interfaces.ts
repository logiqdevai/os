import type { PaginationMeta } from "@/components/ui/data-table";

export interface Paginated<T> {
    data: T[];
    pagination: PaginationMeta & { has_next: boolean; has_prev: boolean };
}

export type PortalFeature = "projects" | "requests" | "conversations" | "documents" | "proposals" | "contracts" | "billing" | "knowledge";

export interface PortalMembershipOption {
    id: string;
    organization: { id: string; display_name: string; logo_url: string | null; slug: string };
    company: { id: string; name: string } | null;
    role: string | null;
    last_active_at: string | null;
}

export interface PortalSession {
    user: { id: string; email: string; display_name: string | null; first_name: string | null; last_name: string | null; profile_photo_url: string | null } | null;
    membership_id: string;
    organization: { id: string; display_name: string; slug: string; logo_url: string | null; default_currency: string } | null;
    branding: Record<string, unknown>;
    company: { id: string; name: string; website: string | null } | null;
    role: { id: string; name: string; slug: string } | null;
    permissions: string[];
    features: Record<PortalFeature, boolean>;
    welcome_message: string | null;
    support_email: string | null;
    profile_changes_require_approval: boolean;
}

export interface PublicPerson {
    id: string;
    display_name: string | null;
    first_name: string | null;
    last_name: string | null;
    profile_photo_url: string | null;
}

export interface PortalProject {
    id: string;
    name: string;
    code: string | null;
    description: string | null;
    health: string;
    progress_percent: number;
    planned_start: string | null;
    target_completion: string | null;
    customer_deadline: string | null;
    completed_at: string | null;
    status: { name: string; category: string; color: string | null } | null;
    approvals_waiting?: number;
}

export interface PortalDeliverable {
    id: string;
    name: string;
    description: string | null;
    status: string;
    due_date: string | null;
    submitted_at: string | null;
    accepted_at: string | null;
    approval_mode: "ANY_ONE" | "ALL";
    project?: { id: string; name: string };
    reviews: { decision: string; comment: string | null; decided_at: string }[];
    you_can_decide?: boolean;
}

export interface PortalProjectDetail extends PortalProject {
    milestones: { id: string; name: string; description: string | null; status: string; planned_date: string | null; actual_date: string | null; progress_percent: number; completed_at: string | null }[];
    deliverables: PortalDeliverable[];
    status_updates: { id: string; summary: string; completed_work: string | null; current_work: string | null; upcoming_work: string | null; progress_percent: number | null; health: string | null; required_actions: string | null; published_at: string }[];
    tasks: { id: string; title: string; due_date: string | null; completed_at: string | null; status: { name: string; category: string } | null }[];
    members: { role_label: string | null; membership: { id: string; user: PublicPerson } }[];
    can_approve: boolean;
}

export interface PortalRequestStatus {
    label: string;
    category: "NEW" | "OPEN" | "PENDING_CUSTOMER" | "ON_HOLD" | "RESOLVED" | "CLOSED";
    color: string | null;
}

export interface PortalRequest {
    id: string;
    reference: string;
    subject: string;
    type: string;
    priority: "LOW" | "NORMAL" | "HIGH" | "URGENT";
    created_at: string;
    updated_at: string;
    resolved_at: string | null;
    requester_name: string | null;
    status: PortalRequestStatus | null;
    project: { id: string; name: string } | null;
    assigned: boolean;
}

export interface PortalMessage {
    id: string;
    kind: "CUSTOMER" | "AGENT" | "AI_AGENT";
    body: string;
    created_at: string;
    author: { id: string; user: PublicPerson } | null;
    author_user: PublicPerson | null;
    author_name: string | null;
    mine: boolean;
}

export interface PortalRequestDetail extends PortalRequest {
    description: string | null;
    requester_user: PublicPerson | null;
    messages: PortalMessage[];
    linked_work: { title: string; completed_at: string | null; status: { name: string; category: string } | null }[];
    can_edit: boolean;
    can_reply: boolean;
    rating: { submitted: boolean; rating: number | null; comment: string | null; can_rate: boolean } | null;
}

export interface PortalConversation {
    id: string;
    subject: string | null;
    status: "OPEN" | "RESOLVED";
    created_at: string;
    last_message_at: string | null;
    ticket: { id: string; reference: string } | null;
    last_message: { body: string; kind: string; created_at: string } | null;
    unread: boolean;
}

export interface PortalConversationDetail {
    id: string;
    subject: string | null;
    status: "OPEN" | "RESOLVED";
    created_at: string;
    ticket: { id: string; reference: string } | null;
    messages: PortalMessage[];
}

export interface PortalDocument {
    id: string;
    title: string | null;
    filename: string;
    mimetype: string | null;
    size: number | null;
    url: string | null;
    created_at: string;
    uploaded_via_portal?: boolean;
    project: { id: string; name: string } | null;
}

export interface PortalNotificationTopic {
    module: string;
    label: string;
    description: string;
    enabled: boolean;
}

export type PortalDigestFrequency = "IMMEDIATE" | "HOURLY" | "DAILY" | "WEEKLY";

/** GET /portal/notification-preferences (14 tables, recipient = the portal membership). */
export interface PortalNotificationPreferences {
    email_enabled: boolean;
    in_app_enabled: boolean;
    digest_frequency: PortalDigestFrequency;
    email_available: boolean;
    topics: PortalNotificationTopic[];
}

export interface PortalNotificationPreferencesDto {
    email_enabled?: boolean;
    in_app_enabled?: boolean;
    digest_frequency?: PortalDigestFrequency;
    topics?: { module: string; enabled: boolean }[];
}

export interface PortalProposal {
    id: string;
    number: string;
    title: string;
    status: string;
    currency: string;
    gross_total: string;
    valid_until: string | null;
    sent_at: string | null;
    accepted_at: string | null;
    can_accept: boolean;
}

export interface PortalContract {
    id: string;
    number: string;
    title: string;
    status: string;
    currency: string | null;
    total_value: string | null;
    start_date: string | null;
    end_date: string | null;
    signature_date: string | null;
    awaiting_signature: boolean;
}

export interface PortalInvoice {
    id: string;
    number: string;
    status: string;
    currency: string;
    issue_date: string | null;
    due_date: string | null;
    total: string;
    amount_paid: string;
    amount_due: string;
    paid_at: string | null;
    project: { id: string; name: string } | null;
    pay_url: string | null;
}

export interface PortalDashboard {
    projects: { items: PortalProject[]; total: number } | null;
    approvals: { items: PortalDeliverable[]; total: number } | null;
    requests: { items: PortalRequest[]; total: number } | null;
    invoices: { items: PortalInvoice[]; total: number; outstanding: { currency: string; amount_due: string | null; count: number }[] } | null;
    documents: { items: PortalDocument[]; total: number } | null;
    conversations: { items: PortalConversation[]; unread: number } | null;
    announcements: { id: string; status: string; body: string; created_at: string; incident: { title: string; severity: string; status: string } }[];
}

export interface HelpArticle {
    id: string;
    title: string;
    slug: string;
    summary: string | null;
    is_faq: boolean;
    updated_at: string;
    category: { id: string; name: string; slug: string } | null;
    body?: string;
    related?: { id: string; title: string; slug: string }[];
}

export interface HelpHome {
    organization: { display_name: string; slug: string; logo_url: string | null };
    categories: { id: string; name: string; slug: string; description: string | null; _count: { articles: number } }[];
    faqs: HelpArticle[];
    popular: HelpArticle[];
}

export interface PortalCompany {
    company: { id: string; name: string; legal_name: string | null; website: string | null; email: string | null; phone: string | null; vat_number: string | null; tax_id: string | null; registration_number: string | null };
    contacts: { id: string; first_name: string; last_name: string | null; job_title: string | null; email: string | null; phone: string | null; mobile: string | null }[];
    pending_changes: { id: string; contact_id: string | null; changes: Record<string, { from: unknown; to: unknown }>; created_at: string }[];
    can_edit: boolean;
}

export interface PortalTeam {
    members: { id: string; status: string; joined_at: string; last_active_at: string | null; is_me: boolean; user: PublicPerson & { email: string }; role: { id: string; name: string; slug: string } | null }[];
    invitations: { id: string; email: string; status: string; expires_at: string; role: { id: string; name: string } | null }[];
    roles: { id: string; name: string; slug: string; description: string | null; permissions: string[] }[];
    can_manage: boolean;
}
