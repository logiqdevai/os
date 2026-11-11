import { Prisma } from 'generated/prisma';
import { OrgContext } from '@/shared/authorization/interfaces/org-context.interface';

const NONE = { id: { in: [] as string[] } };

/**
 * Ticket scope (roles-and-permissions rule §3): organization-wide sees all; otherwise tickets in the caller's
 * branches, teams (ticket team or inbox team), projects, customers or explicit resources, plus tickets assigned to them.
 */
export function ticketScopeWhere(ctx: OrgContext, key: string): Prisma.TicketWhereInput {
    const s = ctx.scopeOf(key);
    if (!s) return NONE;
    if (s.organization) return {};
    const or: Prisma.TicketWhereInput[] = [];
    if (s.branch_ids.length) or.push({ branch_id: { in: s.branch_ids } }, { inbox: { branch_id: { in: s.branch_ids } } });
    if (s.team_ids.length) or.push({ team_id: { in: s.team_ids } }, { inbox: { team_id: { in: s.team_ids } } });
    if (s.project_ids.length) or.push({ project_id: { in: s.project_ids } });
    if (s.customer_ids.length) or.push({ company_id: { in: s.customer_ids } });
    if (s.resource_ids.length) or.push({ id: { in: s.resource_ids } });
    if (ctx.membership_id) or.push({ assignee_membership_id: ctx.membership_id });
    return or.length ? { OR: or } : NONE;
}

/** Conversation scope: same rules through the conversation's inbox, team and customer. */
export function conversationScopeWhere(ctx: OrgContext, key: string): Prisma.SupportConversationWhereInput {
    const s = ctx.scopeOf(key);
    if (!s) return NONE;
    if (s.organization) return {};
    const or: Prisma.SupportConversationWhereInput[] = [];
    if (s.branch_ids.length) or.push({ inbox: { branch_id: { in: s.branch_ids } } });
    if (s.team_ids.length) or.push({ team_id: { in: s.team_ids } }, { inbox: { team_id: { in: s.team_ids } } });
    if (s.customer_ids.length) or.push({ company_id: { in: s.customer_ids } });
    if (s.resource_ids.length) or.push({ id: { in: s.resource_ids } });
    if (ctx.membership_id) or.push({ assignee_membership_id: ctx.membership_id }, { participants: { some: { membership_id: ctx.membership_id } } });
    return or.length ? { OR: or } : NONE;
}

/** Whether the caller's scope for `key` covers the whole organization (org-wide analytics, settings). */
export const isOrgWide = (ctx: OrgContext, key: string) => !!ctx.scopeOf(key)?.organization;
