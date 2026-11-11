import { OrgContext } from '@/shared/authorization/interfaces/org-context.interface';

/**
 * Scope narrowing shared by 08 and 09 (roles-and-permissions rule §3: lists AND single reads respect scope).
 * Finance records carry branch_id, company_id (customer) and project_id; a scoped role sees records inside its
 * branches, customers or projects. Records without any of those are only visible to organization-wide holders.
 */
export function scopeFilter(ctx: OrgContext, key: string, fields: { branch?: string; company?: string; project?: string } = {}) {
    const scope = ctx.scopeOf(key);
    if (!scope) return { id: '__none__' } as Record<string, unknown>;
    if (scope.organization) return {};
    const or: Record<string, unknown>[] = [];
    if (fields.branch && scope.branch_ids.length) or.push({ [fields.branch]: { in: scope.branch_ids } });
    if (fields.company && scope.customer_ids.length) or.push({ [fields.company]: { in: scope.customer_ids } });
    if (fields.project && scope.project_ids.length) or.push({ [fields.project]: { in: scope.project_ids } });
    if (!or.length) return { id: '__none__' } as Record<string, unknown>;
    return { OR: or };
}

/** Membership id of the caller, or null for API keys of service accounts / system jobs. */
export const actorMembership = (ctx: OrgContext) => ctx.membership_id ?? null;
