import type { PaginationMeta } from "@/components/ui/data-table";

export interface Paginated<T> {
    data: T[];
    pagination: PaginationMeta & { has_next: boolean; has_prev: boolean };
}

export const WikiSpaceKinds = { DEPARTMENT: "DEPARTMENT", TEAM: "TEAM", BRANCH: "BRANCH", PROJECT: "PROJECT", TOPIC: "TOPIC" } as const;
export type WikiSpaceKind = (typeof WikiSpaceKinds)[keyof typeof WikiSpaceKinds];

export const WikiPageStatuses = { DRAFT: "DRAFT", PUBLISHED: "PUBLISHED", NEEDS_REVIEW: "NEEDS_REVIEW", ARCHIVED: "ARCHIVED" } as const;
export type WikiPageStatus = (typeof WikiPageStatuses)[keyof typeof WikiPageStatuses];

export type WikiPageType =
    | "GENERAL" | "POLICY" | "PROCEDURE" | "RUNBOOK" | "MEETING_NOTES" | "DECISION_RECORD"
    | "HANDBOOK_CHAPTER" | "ONBOARDING_GUIDE" | "OFFBOARDING_GUIDE" | "FAQ";
export type WikiVisibility = "ORGANIZATION" | "BRANCH" | "TEAM" | "ROLE" | "MEMBERS";
export type WikiPermissionLevel = "VIEW" | "COMMENT" | "EDIT" | "MANAGE";
export type WikiPrincipalType = "MEMBERSHIP" | "TEAM" | "BRANCH" | "ROLE" | "DEPARTMENT";
export type WikiChecklistKind = "ONBOARDING" | "OFFBOARDING";
export type WikiChecklistAssigneeKind = "SUBJECT" | "MANAGER" | "CHECKLIST_OWNER" | "SPECIFIC_MEMBER";
export type WikiChecklistRunStatus = "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
export type WikiChecklistItemStatus = "PENDING" | "IN_PROGRESS" | "COMPLETED" | "SKIPPED";
export type CustomFormStatus = "DRAFT" | "PUBLISHED" | "CLOSED" | "ARCHIVED";
export type CustomFormKind = "FEEDBACK_SURVEY" | "CHECK_IN" | "EQUIPMENT_REQUEST" | "INCIDENT_REPORT" | "COMPLIANCE_ACKNOWLEDGEMENT" | "EXIT_INTERVIEW" | "CUSTOM";
export type CustomFormFieldType = "SHORT_TEXT" | "LONG_TEXT" | "NUMBER" | "EMAIL" | "SINGLE_CHOICE" | "MULTI_CHOICE" | "CHECKBOX" | "SCALE" | "DATE" | "FILE_UPLOAD" | "SIGNATURE" | "SECTION";
export type FormAssignmentTargetType = "MEMBERSHIP" | "TEAM" | "DEPARTMENT" | "BRANCH" | "ORGANIZATION";
export type FormAssignmentRecipientStatus = "PENDING" | "IN_PROGRESS" | "SUBMITTED" | "OVERDUE" | "CANCELLED";
export type FormSubmissionStatus = "DRAFT" | "SUBMITTED" | "UNDER_REVIEW" | "REVIEWED" | "REJECTED";
export type DocsLevel = "NONE" | WikiPermissionLevel;

export interface MemberRef {
    id: string;
    job_title: string | null;
    user: { id: string; email: string; display_name: string | null; first_name: string | null; last_name: string | null; profile_photo_url: string | null };
}

export interface WikiSpace {
    id: string;
    name: string;
    slug: string;
    description: string | null;
    icon: string | null;
    color: string | null;
    kind: WikiSpaceKind;
    team_id: string | null;
    branch_id: string | null;
    department_id: string | null;
    project_id: string | null;
    owner_membership_id: string | null;
    default_visibility: WikiVisibility;
    is_private: boolean;
    allow_customer_visible: boolean;
    members_can_publish: boolean;
    require_review_before_publish: boolean;
    archived_at: string | null;
    created_at: string;
    updated_at: string;
    owner?: MemberRef | null;
    team?: { id: string; name: string } | null;
    branch?: { id: string; name: string } | null;
    project?: { id: string; name: string } | null;
    page_count?: number;
    last_page_update?: string | null;
    _count?: { members: number };
}

export interface WikiSpaceMember {
    space_id: string;
    membership_id: string;
    level: WikiPermissionLevel;
    created_at: string;
    membership: MemberRef;
}

export interface WikiSpaceDetail extends WikiSpace {
    members: WikiSpaceMember[];
    department?: { id: string; name: string } | null;
    my_level: DocsLevel;
}

export interface WikiPageListItem {
    id: string;
    space_id: string;
    parent_page_id: string | null;
    title: string;
    slug: string;
    icon: string | null;
    page_type: WikiPageType;
    status: WikiPageStatus;
    excerpt: string | null;
    visibility: WikiVisibility;
    customer_visible: boolean;
    depth: number;
    sort_order: number;
    current_version_number: number;
    published_version_number: number | null;
    published_at: string | null;
    next_review_at: string | null;
    stale_flagged_at: string | null;
    requires_acknowledgement: boolean;
    word_count: number;
    archived_at: string | null;
    deleted_at: string | null;
    last_edited_at: string | null;
    created_at: string;
    updated_at: string;
    owner: MemberRef | null;
    space: { id: string; name: string; slug: string; icon: string | null; color: string | null };
    required_by?: string | null;
    snippet?: string | null;
    title_match?: boolean;
}

export interface WikiTreeNode {
    id: string;
    parent_page_id: string | null;
    title: string;
    slug: string;
    icon: string | null;
    status: WikiPageStatus;
    page_type: WikiPageType;
    depth: number;
    sort_order: number;
    updated_at: string;
}

export interface WikiPageDetail extends Omit<WikiPageListItem, "space" | "snippet" | "title_match"> {
    content_markdown: string | null;
    review_interval_days: number | null;
    last_reviewed_at: string | null;
    owner_membership_id: string | null;
    template?: { id: string; name: string } | null;
    space: { id: string; name: string; slug: string; icon: string | null; color: string | null; allow_customer_visible: boolean; members_can_publish: boolean; require_review_before_publish: boolean };
    breadcrumbs: { id: string; title: string; icon: string | null }[];
    children: { id: string; title: string; icon: string | null; status: WikiPageStatus; page_type: WikiPageType; excerpt: string | null; updated_at: string }[];
    reviewers: MemberRef[];
    my_level: DocsLevel;
    can: { comment: boolean; edit: boolean; manage: boolean; publish: boolean; archive: boolean; delete: boolean };
    is_favorite: boolean;
    my_acknowledgement: { required_by: string | null; acknowledged_at: string | null; acknowledged_version_number: number | null; is_current: boolean } | null;
    has_unpublished_changes: boolean;
    backlink_count: number;
    comment_count: number;
}

export interface WikiHome {
    favorites: WikiPageListItem[];
    recent: WikiPageListItem[];
    recently_updated: WikiPageListItem[];
    required_reading: WikiPageListItem[];
    needs_review: WikiPageListItem[];
    spaces: (WikiSpace & { page_count: number })[];
}

export interface WikiPageVersion {
    id: string;
    version_number: number;
    title: string;
    change_summary: string | null;
    is_published_snapshot: boolean;
    restored_from_version_id: string | null;
    created_at: string;
    author: MemberRef | null;
    content_markdown?: string | null;
}

export interface WikiPageComment {
    id: string;
    page_id: string;
    parent_comment_id: string | null;
    author_membership_id: string | null;
    body: string;
    resolved_at: string | null;
    edited_at: string | null;
    created_at: string;
    author: MemberRef | null;
}

export interface WikiPageGrant {
    id: string;
    principal_type: WikiPrincipalType;
    principal_id: string;
    principal_label: string;
    level: WikiPermissionLevel;
    inherit: boolean;
}

export interface WikiPagePermissions {
    visibility: WikiVisibility;
    customer_visible: boolean;
    my_level: DocsLevel;
    grants: WikiPageGrant[];
}

export interface WikiPageLinks {
    outgoing: { id: string; entity_type: string; entity_id: string; label: string | null; page: { id: string; title: string; icon: string | null } | null }[];
    backlinks: { id: string; page: { id: string; title: string; icon: string | null; space: { id: string; name: string } }; created_at: string }[];
}

export interface WikiAcknowledgements {
    total: number;
    acknowledged: number;
    rows: { id: string; membership: MemberRef; required_by: string | null; acknowledged_at: string | null; is_current: boolean }[];
}

export interface WikiTemplate {
    id: string;
    organization_id: string | null;
    space_id: string | null;
    name: string;
    slug: string;
    description: string | null;
    icon: string | null;
    page_type: WikiPageType;
    content_markdown: string | null;
    default_review_interval_days: number | null;
    is_system: boolean;
    archived_at: string | null;
    created_at: string;
    space?: { id: string; name: string } | null;
    _count?: { pages: number };
}

export interface WikiChecklistItem {
    id: string;
    title: string;
    description: string | null;
    sort_order: number;
    page_id: string | null;
    requires_acknowledgement: boolean;
    form_id: string | null;
    due_offset_days: number | null;
    assignee_kind: WikiChecklistAssigneeKind;
    assignee_membership_id: string | null;
    is_required: boolean;
    page?: { id: string; title: string } | null;
    form?: { id: string; name: string } | null;
}

export interface WikiChecklist {
    id: string;
    kind: WikiChecklistKind;
    name: string;
    description: string | null;
    department_id: string | null;
    role_id: string | null;
    guide_page_id: string | null;
    auto_assign: boolean;
    is_active: boolean;
    archived_at: string | null;
    created_at: string;
    updated_at: string;
    department?: { id: string; name: string } | null;
    role?: { id: string; name: string } | null;
    guide_page?: { id: string; title: string } | null;
    items?: WikiChecklistItem[];
    _count?: { items: number; runs: number };
}

export interface WikiChecklistRun {
    id: string;
    checklist_id: string;
    subject_membership_id: string;
    status: WikiChecklistRunStatus;
    triggered_by: string;
    started_at: string | null;
    due_at: string | null;
    completed_at: string | null;
    progress_percent: number;
    created_at: string;
    checklist: { id: string; name: string; kind: WikiChecklistKind; description?: string | null; guide_page?: { id: string; title: string } | null };
    subject: MemberRef;
    _count?: { items: number };
}

export interface WikiChecklistRunDetail extends WikiChecklistRun {
    can_manage: boolean;
    items: {
        id: string;
        checklist_item_id: string;
        status: WikiChecklistItemStatus;
        completed_at: string | null;
        skipped_reason: string | null;
        checklist_item: WikiChecklistItem;
    }[];
}

export interface FormFieldOption {
    value: string;
    label: string;
}

export interface FormField {
    key: string;
    type: CustomFormFieldType;
    label: string;
    description?: string;
    required: boolean;
    options?: FormFieldOption[];
    scale?: { min: number; max: number; min_label?: string; max_label?: string };
    max_files?: number;
}

export interface CustomForm {
    id: string;
    name: string;
    slug: string;
    description: string | null;
    kind: CustomFormKind;
    status: CustomFormStatus;
    space_id: string | null;
    fields_schema: FormField[];
    is_anonymous: boolean;
    allow_multiple_submissions: boolean;
    requires_review: boolean;
    reviewer_membership_ids: string[];
    confirmation_message: string | null;
    opens_at: string | null;
    closes_at: string | null;
    current_version_number: number;
    published_at: string | null;
    created_at: string;
    updated_at: string;
    owner?: MemberRef | null;
    space?: { id: string; name: string } | null;
    _count?: { submissions: number; assignments: number };
}

export interface CustomFormDetail extends CustomForm {
    versions: { id: string; version_number: number; change_summary: string | null; created_at: string }[];
    public_link_enabled: boolean;
}

export interface FillableForm {
    id: string;
    name: string;
    description: string | null;
    kind?: CustomFormKind;
    is_anonymous?: boolean;
    organization_name?: string;
    allow_multiple_submissions?: boolean;
    confirmation_message: string | null;
    closes_at: string | null;
    version_number: number;
    fields: FormField[];
    already_submitted?: boolean;
}

export interface FormSubmission {
    id: string;
    status: FormSubmissionStatus;
    is_anonymous: boolean;
    answers: Record<string, unknown>;
    submitted_at: string | null;
    review_notes: string | null;
    reviewed_at: string | null;
    respondent: MemberRef | null;
    form_version: { version_number: number };
}

export interface FormSummary {
    total_responses: number;
    recipients: number;
    submitted_recipients: number;
    questions: {
        key: string;
        label: string;
        type: CustomFormFieldType;
        responses: number;
        options?: { value: string; label: string; count: number }[];
        yes?: number;
        average?: number | null;
        latest?: string[];
    }[];
}

export interface FormAssignment {
    id: string;
    target_type: FormAssignmentTargetType;
    target_id: string | null;
    due_at: string | null;
    message: string | null;
    recipient_count: number;
    submitted_count: number;
    cancelled_at: string | null;
    created_at: string;
}

export interface FormRecipient {
    id: string;
    status: FormAssignmentRecipientStatus;
    submitted_at: string | null;
    membership: MemberRef;
    assignment: { id: string; due_at: string | null; target_type: FormAssignmentTargetType };
}

export interface MyFormAssignment {
    id: string;
    status: FormAssignmentRecipientStatus;
    assignment: { id: string; due_at: string | null; message: string | null; form: { id: string; name: string; description: string | null; kind: CustomFormKind } };
}

export interface DocsDirectory {
    members: MemberRef[];
    teams: { id: string; name: string; kind: string }[];
    branches: { id: string; name: string }[];
}

export interface DocsAnalytics {
    pages: { total: number; by_status: Partial<Record<WikiPageStatus, number>>; review_overdue: number };
    views: { total: number; daily: { day: string; views: number; readers: number }[]; top_pages: { page: { id: string; title: string; icon: string | null }; views: number }[] };
    search: { top: { query: string; count: number }[]; zero_results: { query: string; count: number }[] };
    acknowledgements: { total: number; acknowledged: number };
}

// --- DTOs ---------------------------------------------------------------------------------

export interface CreateSpaceDto {
    name: string;
    description?: string;
    icon?: string;
    kind?: WikiSpaceKind;
    default_visibility?: WikiVisibility;
    is_private?: boolean;
    allow_customer_visible?: boolean;
    members_can_publish?: boolean;
    require_review_before_publish?: boolean;
}
export type UpdateSpaceDto = Partial<CreateSpaceDto>;

export interface CreatePageDto {
    space_id: string;
    parent_page_id?: string;
    template_id?: string;
    title: string;
    icon?: string;
    page_type?: WikiPageType;
    content_markdown?: string;
    visibility?: WikiVisibility;
    review_interval_days?: number;
    requires_acknowledgement?: boolean;
    publish?: boolean;
}

export interface UpdatePageDto {
    title?: string;
    icon?: string;
    page_type?: WikiPageType;
    content_markdown?: string;
    review_interval_days?: number;
    requires_acknowledgement?: boolean;
    customer_visible?: boolean;
    owner_membership_id?: string;
    change_summary?: string;
}

export interface CreateTemplateDto {
    name: string;
    description?: string;
    icon?: string;
    page_type?: WikiPageType;
    content_markdown?: string;
    default_review_interval_days?: number;
}

export interface ChecklistItemInput {
    id?: string;
    title: string;
    description?: string;
    page_id?: string;
    requires_acknowledgement?: boolean;
    form_id?: string;
    due_offset_days?: number;
    assignee_kind?: WikiChecklistAssigneeKind;
    assignee_membership_id?: string;
    is_required?: boolean;
}

export interface CreateChecklistDto {
    kind: WikiChecklistKind;
    name: string;
    description?: string;
    guide_page_id?: string;
    auto_assign?: boolean;
    is_active?: boolean;
    items?: ChecklistItemInput[];
}

export interface CreateFormDto {
    name: string;
    description?: string;
    kind?: CustomFormKind;
    fields_schema?: FormField[];
    is_anonymous?: boolean;
    allow_multiple_submissions?: boolean;
    requires_review?: boolean;
    confirmation_message?: string;
    closes_at?: string;
}
export type UpdateFormDto = Partial<CreateFormDto>;
