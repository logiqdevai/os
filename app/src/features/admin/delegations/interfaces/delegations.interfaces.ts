import type { ScopeType } from "@/config/constants/dropdowns/admin/scope-type-form.options";
import type { UserSummary } from "@/features/admin/members/interfaces/members.interfaces";

export type DelegationStatus = "SCHEDULED" | "ACTIVE" | "EXPIRED" | "REVOKED";

interface DelegationParty {
    id: string;
    job_title: string | null;
    user: UserSummary;
}

/** Delegation (01 §94). `status` is computed by the API from the dates. */
export interface Delegation {
    id: string;
    delegator_membership_id: string;
    delegate_membership_id: string;
    permission_keys: string[];
    role_ids: string[];
    roles: { id: string; name: string }[];
    scope_type: ScopeType;
    scope_id: string | null;
    status: DelegationStatus;
    reason: string | null;
    starts_at: string;
    ends_at: string;
    revoked_at: string | null;
    created_at: string;
    delegator: DelegationParty;
    delegate: DelegationParty;
}

export interface CreateDelegationDto {
    delegate_membership_id: string;
    delegator_membership_id?: string;
    permission_keys: string[];
    role_ids: string[];
    scope_type: ScopeType;
    scope_id?: string;
    starts_at: string;
    ends_at: string;
    reason: string;
}
