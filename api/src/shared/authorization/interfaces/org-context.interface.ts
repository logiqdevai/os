import { ScopeType } from 'generated/prisma';

/** Where a request came from. Written to every audit event's metadata (roles-and-permissions rule §5). */
export type AccessChannel = 'ui' | 'api' | 'mcp' | 'automation';

/** Credential that authenticated the request (set by JwtGuard on `request.user`). */
export interface RequestPrincipal {
    kind: 'user' | 'api_key';
    /** User id (null for API keys owned by a service account). */
    id: string | null;
    role?: string;
    session_id?: string | null;
    api_key_id?: string | null;
    /** For API keys the organization comes from the key, never from a header. */
    organization_id?: string | null;
    membership_id?: string | null;
    service_account_id?: string | null;
    api_key_scopes?: string[];
}

/**
 * Where one permission applies for this principal. `organization` = everywhere in the tenant.
 * Otherwise the record must sit inside one of the listed branches / teams / projects / customers / resources.
 */
export interface PermissionScope {
    organization: boolean;
    branch_ids: string[];
    team_ids: string[];
    project_ids: string[];
    customer_ids: string[];
    resource_ids: string[];
}

export interface ScopedSource {
    scope_type: ScopeType;
    scope_id: string | null;
}

/** Serializable effective permission set (cached in Redis). */
export interface EffectivePermissions {
    /** key -> scope */
    permissions: Record<string, PermissionScope>;
    /** Enabled ModuleKey values for the organization. */
    modules: string[];
}

/** Resolved tenant + identity context for one request, built by PermissionsGuard. Pass it to services. */
export interface OrgContext {
    organization_id: string;
    user_id: string | null;
    membership_id: string | null;
    service_account_id: string | null;
    api_key_id: string | null;
    actor_type: 'USER' | 'SERVICE_ACCOUNT' | 'SYSTEM';
    channel: AccessChannel;
    ip_address?: string | null;
    user_agent?: string | null;
    effective: EffectivePermissions;
    /** True when the principal holds the permission at any scope. */
    can(key: string): boolean;
    /** Scope of a permission (null when not held). */
    scopeOf(key: string): PermissionScope | null;
}
