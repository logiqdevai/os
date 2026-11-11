import type { ModuleKey } from "@/config/apps/app.types";
import type { PermissionScopeValue, ScopeType, UserSummary } from "@/features/admin/members/interfaces/members.interfaces";

export interface CatalogPermission {
    id: string;
    key: string;
    module: ModuleKey;
    resource: string;
    action: string;
    description: string | null;
    is_sensitive: boolean;
    is_field_level: boolean;
    roles_using: number;
    /** The signed-in admin holds this key (only held keys can be handed out). */
    held: boolean;
}

export interface PermissionGrant {
    id: string;
    membership_id: string;
    effect: "ALLOW" | "DENY";
    scope_type: ScopeType;
    scope_id: string | null;
    reason: string | null;
    valid_until: string | null;
    created_at: string;
    permission: { key: string; module: ModuleKey; is_sensitive: boolean; description: string | null };
    membership?: { id: string; user: UserSummary };
}

export interface CreateGrantDto {
    membership_id: string;
    permission_key: string;
    effect: "ALLOW" | "DENY";
    scope_type?: ScopeType;
    scope_id?: string;
    valid_until?: string;
    reason?: string;
}

export interface SimulateDto {
    membership_id: string;
    permission_key: string;
    branch_id?: string;
    team_id?: string;
}

export interface SimulateResult {
    allowed: boolean;
    reason: "allowed" | "out_of_scope" | "membership_inactive" | "module_disabled" | "explicit_deny" | "not_granted" | "unknown_permission";
    permission: { key: string; module: ModuleKey; is_sensitive: boolean; description: string | null };
    scope: PermissionScopeValue | null;
    in_scope: boolean | null;
    steps: { check: string; passed: boolean; detail: string }[];
    sources: { kind: "role" | "grant"; id: string; name: string; effect: "ALLOW" | "DENY"; scope_type: ScopeType; scope_id: string | null; valid_until: string | null; draft: boolean }[];
}
