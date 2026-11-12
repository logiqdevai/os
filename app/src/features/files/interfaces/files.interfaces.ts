import type { PaginationMeta } from "@/components/ui/data-table";

export interface Paginated<T> {
    data: T[];
    pagination: PaginationMeta & { has_next: boolean; has_prev: boolean };
}

export type DocumentStatus = "DRAFT" | "ACTIVE" | "APPROVED" | "ARCHIVED" | "DELETED";
export type DocumentTypeGroup = "image" | "pdf" | "document" | "spreadsheet" | "presentation" | "video" | "audio" | "archive" | "text" | "other";
export type ShareSubjectType = "MEMBERSHIP" | "TEAM" | "PORTAL_USER" | "EXTERNAL_EMAIL" | "PUBLIC_LINK";
export type SharePermission = "VIEW" | "COMMENT" | "EDIT" | "MANAGE";
export type ShareStatus = "ACTIVE" | "EXPIRED" | "REVOKED";
export type ApprovalStatus = "PENDING" | "APPROVED" | "REJECTED" | "CHANGES_REQUESTED" | "CANCELLED";
export type ApprovalDecision = "APPROVED" | "REJECTED" | "CHANGES_REQUESTED";
export type VaultEntryType = "PASSWORD" | "API_KEY" | "SSH_KEY" | "NOTE" | "FILE";
export type VaultScope = "ORGANIZATION" | "CUSTOMER" | "PROJECT";

export interface MemberRef {
    id: string;
    job_title?: string | null;
    user: { id: string; email: string; display_name: string | null; first_name: string | null; last_name: string | null; profile_photo_url: string | null };
}

export interface FolderNode {
    id: string;
    name: string;
    parent_folder_id: string | null;
    path: string;
    depth: number;
    color: string | null;
    is_system: boolean;
    legal_hold: boolean;
    _count: { documents: number; children: number };
}

export interface FolderDetail {
    id: string;
    name: string;
    description: string | null;
    parent_folder_id: string | null;
    legal_hold: boolean;
    breadcrumbs?: { id: string; name: string }[];
    ancestors?: { id: string; name: string }[];
    children: { id: string; name: string; color: string | null; legal_hold: boolean; updated_at: string; _count: { documents: number; children: number } }[];
    is_favorite?: boolean;
}

export interface DocumentRow {
    id: string;
    title: string;
    filename: string;
    description: string | null;
    mimetype: string | null;
    size: number;
    status: DocumentStatus;
    folder_id: string | null;
    legal_hold: boolean;
    is_sensitive: boolean;
    customer_visible: boolean;
    deleted_at: string | null;
    updated_at: string;
    created_at: string;
    type_group: DocumentTypeGroup;
    is_favorite: boolean;
    current_version: { id: string; version_number: number; status: string; scan_status: string; size_bytes: number; mimetype: string; created_at: string } | null;
    category: { id: string; name: string; color: string | null } | null;
    folder: { id: string; name: string } | null;
    owner: MemberRef | null;
    _count: { shares: number; versions: number };
}

export interface DocumentDetail extends DocumentRow {
    keywords: string[];
    effective_legal_hold: boolean;
    legal_hold_reason?: string | null;
    breadcrumbs: { id: string; name: string }[];
    project: { id: string; name: string } | null;
    company: { id: string; name: string } | null;
    retention_policy: { id: string; name: string; retain_days: number; action: string } | null;
    attachments: { id: string; entity_type: string; entity_id: string; role: string | null; source_module: string | null; created_at: string }[];
}

export interface DocumentVersion {
    id: string;
    version_number: number;
    filename: string;
    mimetype: string;
    size_bytes: number;
    status: string;
    scan_status: string;
    change_note: string | null;
    created_at: string;
    author: MemberRef | null;
}

export interface DownloadUrl {
    path: string;
    expires_at: string;
    filename: string;
    mimetype: string;
    size_bytes: number;
}

export interface DocumentShare {
    id: string;
    subject_type: ShareSubjectType;
    permission: SharePermission;
    status: ShareStatus;
    allow_download: boolean;
    expires_at: string | null;
    access_count: number;
    external_email: string | null;
    external_name: string | null;
    link_token_last4: string | null;
    has_password?: boolean;
    created_at: string;
    document: { id: string; title: string | null; filename: string; mimetype: string | null } | null;
    folder: { id: string; name: string } | null;
    membership: MemberRef | null;
    team: { id: string; name: string } | null;
    shared_by: MemberRef | null;
    /** Only in the create response. */
    link_token?: string | null;
    share_url?: string | null;
}

export interface DocumentApprovalRow {
    id: string;
    status: ApprovalStatus;
    title: string | null;
    message: string | null;
    due_at: string | null;
    require_all: boolean;
    created_at: string;
    completed_at: string | null;
    document: { id: string; title: string; mimetype: string | null };
    version: { id: string; version_number: number; filename: string } | null;
    requested_by: MemberRef | null;
    approvers: { id: string; membership_id: string | null; decision: ApprovalDecision | null; comment: string | null; decided_at: string | null; membership: MemberRef | null }[];
    version_superseded: boolean;
    my_decision: string | null;
    can_decide: boolean;
}

export interface VaultEntry {
    id: string;
    name: string;
    type: VaultEntryType;
    scope: VaultScope;
    username: string | null;
    url: string | null;
    notes: string | null;
    secret_hint: string | null;
    expires_at: string | null;
    archived_at: string | null;
    last_revealed_at?: string | null;
    created_at: string;
    updated_at: string;
    owner: MemberRef | null;
    company: { id: string; name: string } | null;
    project: { id: string; name: string } | null;
    _count?: { grants: number };
    is_expired: boolean;
    expiring_soon: boolean;
    can_reveal?: boolean;
}

export interface RevealResult {
    secret: string;
    revealed_at: string;
    hide_after_seconds: number;
}

export interface StorageUsage {
    driver: string;
    used_bytes: number;
    quota_bytes: number | null;
    documents: number;
    versions: number;
    trash: { documents: number; bytes: number };
    by_type: { type: string; bytes: number; count: number }[];
}

export interface PublicShareInfo {
    organization: { id: string; name: string } | null;
    kind: "document" | "folder";
    title: string;
    requires_password: boolean;
    allow_download: boolean;
    expires_at: string | null;
    message: string | null;
    recipient_name: string | null;
}

export interface PublicShareAccess extends Omit<PublicShareInfo, "requires_password" | "recipient_name"> {
    links_expire_at: string;
    files: { id: string; title: string; filename: string; mimetype: string | null; size: number; updated_at: string; preview_path: string; download_path: string | null }[];
}

export interface CreateShareDto {
    document_id?: string;
    folder_id?: string;
    subject_type: ShareSubjectType;
    membership_id?: string;
    team_id?: string;
    external_email?: string;
    external_name?: string;
    permission?: SharePermission;
    allow_download?: boolean;
    expires_at?: string;
    password?: string;
    message?: string;
}

export interface CreateVaultEntryDto {
    name: string;
    type?: VaultEntryType;
    scope?: VaultScope;
    username?: string;
    secret?: string;
    url?: string;
    notes?: string;
    expires_at?: string;
}

// --- Vault grants (17 §12) ---------------------------------------------------------------
export type VaultGrantSubjectType = "MEMBERSHIP" | "TEAM" | "PORTAL_USER";

export interface PortalUserRef {
    id: string;
    email: string;
    display_name: string | null;
    first_name: string | null;
    last_name: string | null;
}

export interface VaultGrant {
    id: string;
    subject_type: VaultGrantSubjectType;
    membership_id: string | null;
    team_id: string | null;
    portal_user_id: string | null;
    can_reveal: boolean;
    can_manage: boolean;
    expires_at: string | null;
    created_at: string;
    membership: MemberRef | null;
    team: { id: string; name: string } | null;
    portal_user: PortalUserRef | null;
}

export interface VaultEntryDetail extends VaultEntry {
    has_secret: boolean;
    grants: VaultGrant[];
}

export interface CreateVaultGrantDto {
    subject_type: VaultGrantSubjectType;
    membership_id?: string;
    team_id?: string;
    portal_user_id?: string;
    can_reveal?: boolean;
    can_manage?: boolean;
    expires_at?: string;
}

// --- Retention (17 §13) ----------------------------------------------------------------------
export type RetentionAnchor = "CREATED" | "LAST_MODIFIED" | "ARCHIVED" | "RECORD_CLOSED";
export type RetentionAction = "ARCHIVE" | "SOFT_DELETE" | "PERMANENT_DELETE";
export type DocumentScopeKind = "ORGANIZATION" | "BRANCH" | "TEAM" | "PROJECT" | "CUSTOMER" | "EMPLOYEE" | "RECORD";

export interface RetentionPolicy {
    id: string;
    name: string;
    description: string | null;
    category_id: string | null;
    category: { id: string; name: string } | null;
    scope: DocumentScopeKind | null;
    retain_days: number | null;
    anchor: RetentionAnchor;
    action: RetentionAction;
    enforced_by_module: string | null;
    is_active: boolean;
    is_default: boolean;
    created_at: string;
    _count: { documents: number; default_for_categories: number };
}

export interface RetentionPolicyDto {
    name: string;
    description?: string;
    category_id?: string | null;
    scope?: DocumentScopeKind | null;
    retain_days?: number | null;
    anchor?: RetentionAnchor;
    action?: RetentionAction;
    is_active?: boolean;
}

export interface DocumentCategoryRef {
    id: string;
    name: string;
    color?: string | null;
}

// --- Templates (17 §4, §7) -------------------------------------------------------------------
export type FolderTemplateTarget = "PROJECT_TYPE" | "CUSTOMER" | "EMPLOYEE" | "ORGANIZATION";

export interface FolderTemplateNode {
    name: string;
    customer_visible?: boolean;
    children?: FolderTemplateNode[];
}

export interface FolderTemplate {
    id: string;
    name: string;
    description: string | null;
    target: FolderTemplateTarget;
    project_type_id: string | null;
    project_type?: { id: string; name: string } | null;
    structure: FolderTemplateNode[];
    is_default: boolean;
    archived_at: string | null;
    created_at: string;
    folder_count?: number;
    applied_count?: number;
}

export interface FolderTemplateDto {
    name: string;
    description?: string | null;
    target: FolderTemplateTarget;
    structure: FolderTemplateNode[];
    is_default?: boolean;
}

export interface TemplateVariable {
    key: string;
    label?: string;
    required?: boolean;
    default?: string;
}

export interface DocumentTemplate {
    id: string;
    name: string;
    description: string | null;
    category: { id: string; name: string } | null;
    folder: { id: string; name: string } | null;
    scope: DocumentScopeKind;
    variables: TemplateVariable[] | null;
    usage_count: number;
    last_used_at: string | null;
    archived_at: string | null;
    created_at: string;
    source_version: { id: string; document_id: string; filename: string; mimetype: string; version_number: number };
    body_preview?: string;
    detected_variables?: TemplateVariable[];
}

export interface DocumentTemplateDto {
    document_id: string;
    name: string;
    description?: string | null;
    category_id?: string | null;
    folder_id?: string | null;
    variables?: TemplateVariable[];
}
