import type { ModuleKey } from "@/config/apps/app.types";
import type { MembershipStatus, MembershipType } from "@/config/constants/dropdowns/admin/membership-form.options";
import type { ScopeType } from "@/config/constants/dropdowns/admin/scope-type-form.options";

export type { MembershipStatus, MembershipType, ScopeType };

export interface UserSummary {
    id: string;
    email: string;
    display_name: string | null;
    first_name: string | null;
    last_name: string | null;
    profile_photo_url: string | null;
}

export interface MemberListItem {
    id: string;
    user_id: string;
    type: MembershipType;
    status: MembershipStatus;
    job_title: string | null;
    joined_at: string;
    last_active_at: string | null;
    user: UserSummary & { mfa_enabled: boolean; last_login_at: string | null };
    branches: { is_primary: boolean; branch: { id: string; name: string } }[];
    teams: { team: { id: string; name: string } }[];
    role_assignments: { id: string; scope_type: ScopeType; role: { id: string; name: string } }[];
}

export interface MemberRoleAssignment {
    id: string;
    role_id: string;
    scope_type: ScopeType;
    scope_id: string | null;
    valid_from: string;
    valid_until: string | null;
    reason: string | null;
    created_at: string;
    role: { id: string; name: string; slug: string; type: string; organization_id: string | null };
}

export interface MemberDetail {
    id: string;
    user_id: string;
    type: MembershipType;
    status: MembershipStatus;
    provisioning_source: string;
    job_title: string | null;
    default_branch_id: string | null;
    default_team_id: string | null;
    joined_at: string;
    last_active_at: string | null;
    suspended_at: string | null;
    deactivated_at: string | null;
    offboarding: Record<string, unknown> | null;
    user: UserSummary & { status: string; mfa_enabled: boolean; last_login_at: string | null; timezone: string | null; locale: string | null; password_changed_at: string | null };
    branches: { id: string; branch_id: string; is_primary: boolean; include_children: boolean; started_at: string; branch: { id: string; name: string; is_headquarters: boolean } }[];
    teams: { id: string; team_id: string; team_role: string | null; is_lead: boolean; started_at: string; team: { id: string; name: string; kind: string } }[];
    role_assignments: MemberRoleAssignment[];
    module_access: { id: string; module: ModuleKey; enabled: boolean }[];
    managed_branches: { id: string; branch: { id: string; name: string } }[];
    is_owner: boolean;
    is_self: boolean;
    /** Sign-in factors (types and dates only, never secrets). */
    mfa_factors: { totp: { verified_at: string; last_used_at: string | null } | null; recovery_codes: { total: number; remaining: number } };
}

export interface PermissionScopeValue {
    organization: boolean;
    branch_ids: string[];
    team_ids: string[];
    project_ids: string[];
    customer_ids: string[];
    resource_ids: string[];
}

export interface PermissionSource {
    kind: "role" | "grant";
    name: string;
    effect: "ALLOW" | "DENY";
    scope_type: ScopeType;
    scope_id: string | null;
}

export interface EffectivePermissions {
    membership_id: string;
    status: MembershipStatus;
    modules: ModuleKey[];
    permissions: { key: string; scope: PermissionScopeValue; sources: PermissionSource[] }[];
    denied: { key: string; sources: PermissionSource[] }[];
}

export interface UpdateMemberDto {
    job_title?: string;
    type?: MembershipType;
    default_branch_id?: string;
    default_team_id?: string;
}

export interface AssignRoleDto {
    role_id: string;
    scope_type?: ScopeType;
    scope_id?: string;
    valid_until?: string;
    reason?: string;
}

export interface MemberBranchDto {
    branch_id: string;
    is_primary?: boolean;
    include_children?: boolean;
}
