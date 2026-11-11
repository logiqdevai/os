import type { ScopeType, UserSummary } from "@/features/admin/members/interfaces/members.interfaces";

export type ServiceAccountStatus = "ACTIVE" | "SUSPENDED" | "REVOKED";

export interface ServiceAccount {
    id: string;
    name: string;
    purpose: string | null;
    status: ServiceAccountStatus;
    expires_at: string | null;
    created_at: string;
    owner_membership_id: string | null;
    owner: { id: string; user: UserSummary } | null;
    role_assignments: { id: string; scope_type: ScopeType; role: { id: string; name: string } }[];
    _count?: { api_keys: number };
}

export interface ServiceAccountDetail extends Omit<ServiceAccount, "role_assignments"> {
    role_assignments: { id: string; scope_type: ScopeType; scope_id: string | null; valid_until: string | null; created_at: string; role: { id: string; name: string; type: string } }[];
    api_keys: { id: string; name: string; key_prefix: string; scopes: string[]; expires_at: string | null; last_used_at: string | null; revoked_at: string | null; created_at: string }[];
    permission_count: number;
}

export interface ServiceAccountDto {
    name: string;
    purpose?: string;
    expires_at?: string;
    owner_membership_id?: string;
    role_id?: string;
    scope_type?: ScopeType;
    scope_id?: string;
}

export interface ServiceAccountRoleDto {
    role_id: string;
    scope_type?: ScopeType;
    scope_id?: string;
    valid_until?: string;
}
