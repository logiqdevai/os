import { Prisma } from 'generated/prisma';
import { OrgContext } from '@/shared/authorization/interfaces/org-context.interface';
import { CRM_FINANCIALS } from './crm.constants';

/**
 * CRM record visibility (02 §20–21). An organization-wide permission sees every record. A narrower scope sees:
 *  - records the caller owns (owner / secondary owner / account manager / project manager),
 *  - records of a team or branch in the scope,
 *  - companies listed as customer or resource scope, and records attached to them.
 * Returns `null` when the permission is organization-wide (no filter), or a `where` fragment otherwise.
 * When the caller does not hold the key at all the fragment matches nothing.
 */
const NOTHING = { id: { in: [] as string[] } };

function scopeOf(ctx: OrgContext, key: string) {
    const scope = ctx.scopeOf(key);
    if (!scope) return { none: true as const };
    if (scope.organization) return null;
    return scope;
}

const me = (ctx: OrgContext) => ctx.membership_id ?? '__none__';

export function companyScopeWhere(ctx: OrgContext, key: string): Prisma.CrmCompanyWhereInput {
    const s = scopeOf(ctx, key);
    if (s === null) return {};
    if ('none' in s) return NOTHING;
    return {
        OR: [
            { owner_membership_id: me(ctx) },
            { secondary_owner_membership_id: me(ctx) },
            { account_manager_membership_id: me(ctx) },
            { team_id: { in: s.team_ids } },
            { branches: { some: { branch_id: { in: s.branch_ids } } } },
            { id: { in: [...s.customer_ids, ...s.resource_ids] } },
        ],
    };
}

export function contactScopeWhere(ctx: OrgContext, key: string): Prisma.CrmContactWhereInput {
    const s = scopeOf(ctx, key);
    if (s === null) return {};
    if ('none' in s) return NOTHING;
    return {
        OR: [
            { owner_membership_id: me(ctx) },
            { secondary_owner_membership_id: me(ctx) },
            { id: { in: s.resource_ids } },
            { company: companyScopeWhere(ctx, key) },
        ],
    };
}

export function leadScopeWhere(ctx: OrgContext, key: string): Prisma.CrmLeadWhereInput {
    const s = scopeOf(ctx, key);
    if (s === null) return {};
    if ('none' in s) return NOTHING;
    return {
        OR: [
            { owner_membership_id: me(ctx) },
            { secondary_owner_membership_id: me(ctx) },
            { branch_id: { in: s.branch_ids } },
            { id: { in: s.resource_ids } },
        ],
    };
}

export function dealScopeWhere(ctx: OrgContext, key: string): Prisma.CrmDealWhereInput {
    const s = scopeOf(ctx, key);
    if (s === null) return {};
    if ('none' in s) return NOTHING;
    return {
        OR: [
            { owner_membership_id: me(ctx) },
            { secondary_owner_membership_id: me(ctx) },
            { project_manager_membership_id: me(ctx) },
            { team_id: { in: s.team_ids } },
            { branch_id: { in: s.branch_ids } },
            { company_id: { in: s.customer_ids } },
            { id: { in: s.resource_ids } },
        ],
    };
}

export function activityScopeWhere(ctx: OrgContext, key: string): Prisma.CrmActivityWhereInput {
    const s = scopeOf(ctx, key);
    if (s === null) return {};
    if ('none' in s) return NOTHING;
    return {
        OR: [
            { owner_membership_id: me(ctx) },
            { id: { in: s.resource_ids } },
            { deal: dealScopeWhere(ctx, key) },
            { company: companyScopeWhere(ctx, key) },
            { lead: leadScopeWhere(ctx, key) },
        ],
    };
}

/** `owner=me` → the caller's membership id; `owner=unassigned` → null filter. */
export function ownerFilter(ctx: OrgContext, owner?: string): { owner_membership_id?: string | null } {
    if (!owner) return {};
    if (owner === 'me') return { owner_membership_id: me(ctx) };
    if (owner === 'unassigned') return { owner_membership_id: null };
    return { owner_membership_id: owner };
}

const DEAL_MONEY = ['value', 'recurring_value', 'one_time_value', 'discount_amount', 'discount_percent', 'tax_amount'] as const;

/** Field-level permission (01 §60, 02 §21): drop money fields without `crm.financials.read`. */
export function redactDeal<T extends Record<string, any>>(ctx: OrgContext, deal: T): T {
    if (ctx.can(CRM_FINANCIALS) || !deal) return deal;
    const out: Record<string, any> = { ...deal };
    for (const k of DEAL_MONEY) if (k in out) out[k] = null;
    if ('line_items' in out) out.line_items = [];
    out.financials_hidden = true;
    return out as T;
}

export function redactLead<T extends Record<string, any>>(ctx: OrgContext, lead: T): T {
    if (ctx.can(CRM_FINANCIALS) || !lead) return lead;
    return { ...lead, estimated_value: null, financials_hidden: true };
}

export function redactCompany<T extends Record<string, any>>(ctx: OrgContext, company: T): T {
    if (ctx.can(CRM_FINANCIALS) || !company) return company;
    return { ...company, annual_revenue: null, partner_commission_percent: null, financials_hidden: true };
}

/** Lower-cased host of a website or the domain part of an email (for duplicate detection). */
export function domainOf(value?: string | null): string | null {
    if (!value) return null;
    const v = value.trim().toLowerCase();
    if (v.includes('@')) return v.split('@')[1] || null;
    try {
        const url = new URL(v.startsWith('http') ? v : `https://${v}`);
        return url.hostname.replace(/^www\./, '') || null;
    } catch {
        return null;
    }
}

/** Free-mail domains never count as a company match. */
export const PUBLIC_EMAIL_DOMAINS = new Set(['gmail.com', 'googlemail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'live.com', 'icloud.com', 'me.com', 'aol.com', 'proton.me', 'protonmail.com', 'gmx.com', 'mail.com', 'yandex.com']);

export const toNumber = (v: Prisma.Decimal | number | string | null | undefined) => (v === null || v === undefined ? 0 : Number(v));

/** Subset of a record for audit `before` snapshots. */
export function pick(obj: Record<string, any>, keys: string[]) {
    const out: Record<string, unknown> = {};
    for (const k of keys) out[k] = obj[k];
    return out;
}
