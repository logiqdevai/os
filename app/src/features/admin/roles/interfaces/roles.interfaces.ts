import type { ModuleKey } from "@/config/apps/app.types";
import type { ScopeType } from "@/config/constants/dropdowns/admin/scope-type-form.options";

export type RoleType = "SYSTEM" | "ORGANIZATION" | "BRANCH" | "TEAM" | "PROJECT" | "CUSTOMER_PORTAL";
export type RoleStatus = "DRAFT" | "PUBLISHED" | "DEPRECATED";
export type PermissionEffect = "ALLOW" | "DENY";

export interface Role {
    id: string;
    organization_id: string | null;
    name: string;
    slug: string;
    description: string | null;
    type: RoleType;
    status: RoleStatus;
    is_system: boolean;
    template_role_id: string | null;
    default_scope: ScopeType;
    modules: ModuleKey[];
    version: number;
    published_at: string | null;
    created_at: string;
    updated_at: string;
    is_template: boolean;
    _count?: { permissions: number; assignments: number };
}

export interface RolePermissionRow {
    role_id: string;
    permission_id: string;
    effect: PermissionEffect;
    permission: { key: string; module: ModuleKey; resource: string; action: string; is_sensitive: boolean; description: string | null };
}

export interface RoleDetail extends Omit<Role, "_count"> {
    permissions: RolePermissionRow[];
    versions: { id: string; version: number; note: string | null; published_at: string; published_by: { id: string; user: { display_name: string | null; email: string } } | null }[];
    template: { id: string; name: string } | null;
    _count: { assignments: number; permissions?: number };
}

export interface RolePermissionInput {
    key: string;
    effect?: PermissionEffect;
}

export interface CreateRoleDto {
    name: string;
    description?: string;
    type?: RoleType;
    default_scope?: ScopeType;
    modules?: ModuleKey[];
    template_role_id?: string;
    permissions?: RolePermissionInput[];
}
export type UpdateRoleDto = Partial<Omit<CreateRoleDto, "template_role_id">>;
