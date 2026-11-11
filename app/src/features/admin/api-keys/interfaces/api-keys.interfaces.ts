import type { ScopeType, UserSummary } from "@/features/admin/members/interfaces/members.interfaces";

export interface ApiKey {
    id: string;
    name: string;
    key_prefix: string;
    scopes: string[];
    scope_type: ScopeType;
    scope_id: string | null;
    rotation_due_at: string | null;
    expires_at: string | null;
    last_used_at: string | null;
    revoked_at: string | null;
    created_at: string;
    allowed_ip_ranges: string[];
    rotated_from_id: string | null;
    membership: { id: string; user: UserSummary } | null;
    service_account: { id: string; name: string; status: string } | null;
}

/** Returned once by create / rotate. */
export interface ApiKeyWithSecret extends ApiKey {
    secret: string;
}

export interface CreateApiKeyDto {
    name: string;
    service_account_id?: string;
    scopes?: string[];
    expires_at?: string;
    rotation_due_at?: string;
    allowed_ip_ranges?: string[];
}
