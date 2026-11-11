import type { PaginationMeta } from "@/components/ui/data-table";

export interface Paginated<T> {
    data: T[];
    pagination: PaginationMeta & { has_next: boolean; has_prev: boolean };
}

export const PortalFeatureKeys = ["projects", "requests", "conversations", "documents", "proposals", "contracts", "billing", "knowledge"] as const;
export type PortalFeature = (typeof PortalFeatureKeys)[number];

export type PortalClientStatus = "enabled" | "disabled" | "not_set_up";
export type PortalMembershipStatus = "INVITED" | "ACTIVE" | "SUSPENDED" | "DEACTIVATED";
export type InvitationStatus = "PENDING" | "ACCEPTED" | "EXPIRED" | "CANCELLED" | "REJECTED";
export type ProfileChangeStatus = "PENDING" | "APPROVED" | "REJECTED" | "AUTO_APPLIED";

export interface PortalUserRef {
    id: string;
    email: string;
    display_name: string | null;
    first_name: string | null;
    last_name: string | null;
    profile_photo_url: string | null;
    last_login_at?: string | null;
}

export interface PortalOverview {
    enabled: boolean;
    clients: { enabled: number; disabled: number };
    users: { active: number; active_last_7_days: number };
    invitations_pending: number;
    profile_changes_pending: number;
    portal_requests_open: number | null;
    deliverables_awaiting_review: number | null;
    recent_activity: PortalActivityRow[] | null;
}

export interface PortalSettings {
    organization_id: string;
    enabled: boolean;
    custom_domain: string | null;
    branding: Record<string, string> | null;
    features: Record<PortalFeature, boolean>;
    default_role_slug: string;
    profile_changes_require_approval: boolean;
    welcome_message: string | null;
    support_email: string | null;
    organization: { display_name: string; slug: string; logo_url: string | null } | null;
}

export interface PortalClientRow {
    id: string;
    name: string;
    type: string;
    website: string | null;
    email: string | null;
    portal_status: PortalClientStatus;
    portal_enabled_at: string | null;
    users: number;
    pending_invitations: number;
    last_active_at: string | null;
}

export interface CustomerRole {
    id: string;
    name: string;
    slug: string;
    description: string | null;
    permissions: string[];
}

export interface PortalMembershipRow {
    id: string;
    customer_id: string;
    status: PortalMembershipStatus;
    joined_at: string;
    last_active_at: string | null;
    user: PortalUserRef;
    role: { id: string; name: string; slug: string } | null;
    company?: { id: string; name: string } | null;
    _count?: { project_access: number };
}

export interface PortalInvitationRow {
    id: string;
    email: string;
    status: InvitationStatus;
    expires_at: string;
    created_at: string;
    last_sent_at: string | null;
    send_count: number;
    role: { id: string; name: string } | null;
    customer: { id: string; name: string } | null;
}

export interface PortalClientDetail {
    company: { id: string; name: string; type: string; website: string | null; email: string | null; phone: string | null };
    settings: { enabled: boolean; welcome_message: string | null; default_role_slug: string | null; features: Record<string, boolean> | null } | null;
    portal_status: PortalClientStatus;
    users: PortalMembershipRow[];
    invitations: PortalInvitationRow[];
    pending_profile_changes: number;
    projects: { id: string; name: string; code: string | null; visibility: "INTERNAL" | "CUSTOMER_VISIBLE"; progress_percent: number; health: string }[];
}

export interface InviteResult {
    email: string;
    status: "invited" | "already_member" | "already_invited";
    email_sent?: boolean;
    invite_url?: string;
}

export interface ProfileChangeRow {
    id: string;
    status: ProfileChangeStatus;
    changes: Record<string, { from: unknown; to: unknown }>;
    created_at: string;
    reviewed_at: string | null;
    review_note: string | null;
    company: { id: string; name: string };
    contact: { id: string; first_name: string; last_name: string | null } | null;
    requested_by: PortalUserRef;
}

export interface PortalActivityRow {
    id: string;
    event_type: string;
    resource_type: string | null;
    created_at: string;
    outcome: string;
    actor: PortalUserRef | null;
    is_portal_user: boolean;
    company: { id: string; name: string } | null;
}

export interface PortalApprovalRow {
    id: string;
    name: string;
    status: string;
    due_date: string | null;
    submitted_at: string | null;
    accepted_at: string | null;
    approval_mode: "ANY_ONE" | "ALL";
    project: { id: string; name: string; code: string | null; company: { id: string; name: string } | null };
    approvers: { required: boolean; portal_membership: { id: string; user: { display_name: string | null; email: string } } }[];
    reviews: { decision: string; comment: string | null; decided_at: string }[];
}
