import type { ModuleKey } from "@/config/apps/app.types";
import type { ScopeType } from "@/config/constants/dropdowns/admin/scope-type-form.options";
import type { UserSummary } from "@/features/admin/members/interfaces/members.interfaces";

export type AccessReviewStatus = "DRAFT" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
export type AccessReviewDecision = "PENDING" | "CERTIFIED" | "REVOKED" | "MODIFIED";
export type ReviewerStrategy = "BRANCH_MANAGERS" | "TEAM_LEADS" | "LINE_MANAGER" | "SPECIFIC";

export interface ReviewPerson {
    id: string;
    job_title: string | null;
    user: UserSummary;
}

export interface AccessReviewStats {
    total: number;
    decided: number;
    pending: number;
    certified: number;
    revoked: number;
    modified: number;
    /** REVOKED / MODIFIED decisions not applied yet. */
    pending_apply: number;
}

/** AccessReview (01 §98). */
export interface AccessReview {
    id: string;
    name: string;
    description: string | null;
    status: AccessReviewStatus;
    scope_type: ScopeType;
    scope_id: string | null;
    modules: ModuleKey[];
    reviewer_strategy: ReviewerStrategy;
    reviewer_membership_ids: string[];
    starts_at: string | null;
    due_at: string;
    completed_at: string | null;
    created_at: string;
    created_by: ReviewPerson | null;
    stats: AccessReviewStats;
}

export interface AccessReviewDetail extends AccessReview {
    scope_label: string | null;
    reviewers: { reviewer: ReviewPerson | null; assigned: number; decided: number; has_decide_permission: boolean }[];
    unassigned_items: number;
}

export interface RequestedChanges {
    remove_role_assignment_ids: string[];
    revoke_grant_ids: string[];
    disable_modules: ModuleKey[];
}

/** AccessReviewItem.access_snapshot — frozen when the review started. */
export interface AccessSnapshot {
    status: string;
    job_title: string | null;
    roles: { assignment_id: string; role_id: string; role_name: string; scope_type: ScopeType; scope_id: string | null; valid_until: string | null }[];
    grants: { grant_id: string; key: string; effect: "ALLOW" | "DENY"; scope_type: ScopeType; scope_id: string | null }[];
    module_overrides: { module: ModuleKey; enabled: boolean }[];
    branches: { branch_id: string; name: string; is_primary: boolean }[];
    teams: { team_id: string; name: string }[];
    modules: ModuleKey[];
    permission_count: number;
    mfa_enabled: boolean;
    last_active_at: string | null;
    requested_changes?: RequestedChanges;
}

export interface AccessReviewItem {
    id: string;
    review_id: string;
    membership_id: string;
    reviewer_membership_id: string | null;
    decision: AccessReviewDecision;
    decided_at: string | null;
    comment: string | null;
    access_snapshot: AccessSnapshot;
    applied_at: string | null;
    membership: ReviewPerson;
    reviewer: ReviewPerson | null;
    /** The signed-in member is the assigned reviewer and may decide now. */
    can_decide: boolean;
}

export interface CreateAccessReviewDto {
    name: string;
    description?: string;
    scope_type: ScopeType;
    scope_id?: string;
    modules: ModuleKey[];
    reviewer_strategy: ReviewerStrategy;
    reviewer_membership_ids: string[];
    starts_at?: string;
    due_at: string;
    start?: boolean;
}

export interface DecideItemDto {
    decision: Exclude<AccessReviewDecision, "PENDING">;
    comment?: string;
    changes?: RequestedChanges;
}

export interface ApplyResult {
    applied: number;
    failed: number;
    results: { item_id: string; membership_id: string; applied: boolean; changes: number; error?: string }[];
}
