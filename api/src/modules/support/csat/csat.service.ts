import { BadRequestException, GoneException, Injectable, NotFoundException } from '@nestjs/common';
import { ModuleKey, Prisma } from 'generated/prisma';
import { z } from 'zod';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import { AuditService } from '@/shared/audit/audit.service';
import { EventsService } from '@/shared/events/events.service';
import { OrgContext } from '@/shared/authorization/interfaces/org-context.interface';
import { BaseListQuerySchema } from '@/shared/utils/pagination/pagination.utils';
import { paginate, skipTake } from '@/shared/utils/pagination/pagination.utils';
import { MEMBER_SELECT, SUPPORT_PERMS } from '../common/support.constants';
import { isOrgWide } from '../common/support-scope.utils';

export const CsatQuerySchema = BaseListQuerySchema.extend({
    from: z.coerce.date().optional(),
    to: z.coerce.date().optional(),
    agent_membership_id: z.string().uuid().optional(),
    company_id: z.string().uuid().optional(),
    rating: z.coerce.number().int().min(1).max(5).optional(),
});
export type CsatQuery = z.infer<typeof CsatQuerySchema>;

const EXPIRY_DAYS = 14;

/** Customer satisfaction (13 §9): requested on resolve, submitted by link token or from the portal. */
@Injectable()
export class CsatService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly audit: AuditService,
        private readonly events: EventsService,
    ) { }

    /** Create a pending rating request (idempotent per ticket / conversation while one is open). */
    async request(ctx: OrgContext, input: { ticket_id?: string | null; conversation_id?: string | null; contact_id?: string | null; rated_by_user_id?: string | null; agent_membership_id?: string | null }) {
        const settings = await this.prisma.supportSettings.findUnique({ where: { organization_id: ctx.organization_id } });
        if (!settings?.csat_enabled) return null;
        const existing = await this.prisma.supportCsatRating.findFirst({
            where: { organization_id: ctx.organization_id, submitted_at: null, ...(input.ticket_id ? { ticket_id: input.ticket_id } : { conversation_id: input.conversation_id }) },
        });
        if (existing) return existing;
        const requestedAt = new Date(Date.now() + settings.csat_delay_minutes * 60_000);
        const row = await this.prisma.supportCsatRating.create({
            data: {
                organization_id: ctx.organization_id,
                ticket_id: input.ticket_id ?? null,
                conversation_id: input.conversation_id ?? null,
                contact_id: input.contact_id ?? null,
                rated_by_user_id: input.rated_by_user_id ?? null,
                agent_membership_id: input.agent_membership_id ?? null,
                requested_at: requestedAt,
                expires_at: new Date(requestedAt.getTime() + EXPIRY_DAYS * 86400_000),
            },
        });
        this.events.publish(ctx, {
            event_key: 'support.csat.requested',
            module: ModuleKey.SUPPORT,
            entity_type: input.ticket_id ? 'TICKET' : 'SUPPORT_CONVERSATION',
            entity_id: input.ticket_id ?? input.conversation_id ?? null,
            payload: { csat_id: row.id, token: row.token, rated_by_user_id: row.rated_by_user_id, contact_id: row.contact_id, send_at: requestedAt },
        });
        return row;
    }

    /** Public rating page by token (link in the resolution email). */
    async byToken(token: string) {
        const row = await this.prisma.supportCsatRating.findUnique({
            where: { token },
            include: { organization: { select: { display_name: true, logo_url: true } }, ticket: { select: { reference: true, subject: true } } },
        });
        if (!row) throw new NotFoundException({ message: 'Rating link not found', code: 'csat_not_found' });
        const settings = await this.prisma.supportSettings.findUnique({ where: { organization_id: row.organization_id }, select: { csat_scale: true, csat_question: true, csat_thank_you: true } });
        return {
            id: row.id,
            organization: row.organization,
            ticket: row.ticket,
            submitted: !!row.submitted_at,
            rating: row.rating,
            expired: !!row.expires_at && row.expires_at < new Date() && !row.submitted_at,
            scale: settings?.csat_scale ?? 'STARS_5',
            question: settings?.csat_question ?? 'How would you rate the support you received?',
            thank_you: settings?.csat_thank_you ?? 'Thank you for your feedback.',
        };
    }

    async submitByToken(token: string, rating: number, comment?: string, userId?: string | null) {
        const row = await this.prisma.supportCsatRating.findUnique({ where: { token } });
        if (!row) throw new NotFoundException({ message: 'Rating link not found', code: 'csat_not_found' });
        return this.submit(row, rating, comment, userId);
    }

    async submit(row: { id: string; organization_id: string; submitted_at: Date | null; expires_at: Date | null; ticket_id: string | null; conversation_id: string | null; agent_membership_id: string | null }, rating: number, comment?: string, userId?: string | null) {
        if (row.submitted_at) throw new BadRequestException({ message: 'This rating was already submitted', code: 'csat_already_submitted' });
        if (row.expires_at && row.expires_at < new Date()) throw new GoneException({ message: 'This rating link has expired', code: 'csat_expired' });
        const settings = await this.prisma.supportSettings.findUnique({ where: { organization_id: row.organization_id }, select: { csat_scale: true, csat_follow_up_threshold: true } });
        if (settings?.csat_scale === 'THUMBS' && rating !== 1 && rating !== 5) throw new BadRequestException({ message: 'Rating must be 1 (down) or 5 (up)', code: 'csat_invalid' });
        const updated = await this.prisma.supportCsatRating.update({
            where: { id: row.id },
            data: { rating, comment: comment?.slice(0, 4000) ?? null, submitted_at: new Date(), ...(userId ? { rated_by_user_id: userId } : {}) },
        });
        const ctx = { organization_id: row.organization_id, user_id: userId ?? null, membership_id: null, service_account_id: null, api_key_id: null, actor_type: 'USER', channel: 'ui', effective: { permissions: {}, modules: [] }, can: () => false, scopeOf: () => null } as unknown as OrgContext;
        await this.audit.record(ctx, 'support_csat.submitted', { resource_type: 'support_csat_rating', resource_id: row.id, metadata: { rating, ticket_id: row.ticket_id, conversation_id: row.conversation_id } });
        const lowScore = !!settings?.csat_follow_up_threshold && rating <= settings.csat_follow_up_threshold;
        this.events.publish(ctx, {
            event_key: lowScore ? 'support.csat.low_rating' : 'support.csat.submitted',
            module: ModuleKey.SUPPORT,
            entity_type: row.ticket_id ? 'TICKET' : 'SUPPORT_CONVERSATION',
            entity_id: row.ticket_id ?? row.conversation_id,
            payload: { rating, comment, agent_membership_id: row.agent_membership_id },
        });
        return { success: true, rating: updated.rating };
    }

    // --- Agency reads ----------------------------------------------------------------------------

    private where(ctx: OrgContext, q: Partial<CsatQuery>): Prisma.SupportCsatRatingWhereInput {
        const scope = ctx.scopeOf(SUPPORT_PERMS.csatRead);
        const scoped: Prisma.SupportCsatRatingWhereInput = !scope || scope.organization
            ? {}
            : {
                OR: [
                    ...(scope.team_ids.length ? [{ ticket: { team_id: { in: scope.team_ids } } }] : []),
                    ...(scope.branch_ids.length ? [{ ticket: { branch_id: { in: scope.branch_ids } } }] : []),
                    ...(scope.customer_ids.length ? [{ ticket: { company_id: { in: scope.customer_ids } } }] : []),
                    ...(ctx.membership_id ? [{ agent_membership_id: ctx.membership_id }] : []),
                ],
            };
        // Agent-level breakdown needs support.analytics.read (13 §9); without it the caller sees their own ratings only.
        const agent = q.agent_membership_id && (ctx.can(SUPPORT_PERMS.analyticsRead) || q.agent_membership_id === ctx.membership_id) ? { agent_membership_id: q.agent_membership_id } : {};
        return {
            AND: [
                { organization_id: ctx.organization_id, submitted_at: { not: null, ...(q.from && { gte: q.from }), ...(q.to && { lte: q.to }) } },
                scoped,
                agent,
                q.company_id ? { OR: [{ ticket: { company_id: q.company_id } }, { conversation: { company_id: q.company_id } }] } : {},
                q.rating ? { rating: q.rating } : {},
            ],
        };
    }

    async ratings(ctx: OrgContext, q: CsatQuery) {
        const where = this.where(ctx, q);
        const [rows, total] = await Promise.all([
            this.prisma.supportCsatRating.findMany({
                where,
                ...skipTake(q),
                orderBy: { submitted_at: 'desc' },
                include: {
                    ticket: { select: { id: true, reference: true, subject: true, company: { select: { id: true, name: true } } } },
                    conversation: { select: { id: true, subject: true, customer_name: true } },
                    agent: { select: MEMBER_SELECT },
                    contact: { select: { id: true, first_name: true, last_name: true } },
                },
            }),
            this.prisma.supportCsatRating.count({ where }),
        ]);
        return paginate(rows, total, q);
    }

    async summary(ctx: OrgContext, q: Partial<CsatQuery>) {
        const where = this.where(ctx, q);
        const settings = await this.prisma.supportSettings.findUnique({ where: { organization_id: ctx.organization_id }, select: { csat_enabled: true, csat_scale: true } });
        const [agg, dist, requested, byAgent] = await Promise.all([
            this.prisma.supportCsatRating.aggregate({ where, _avg: { rating: true }, _count: { _all: true } }),
            this.prisma.supportCsatRating.groupBy({ by: ['rating'], where, _count: { _all: true } }),
            this.prisma.supportCsatRating.count({ where: { organization_id: ctx.organization_id, requested_at: { ...(q.from && { gte: q.from }), ...(q.to && { lte: q.to }) } } }),
            ctx.can(SUPPORT_PERMS.analyticsRead) && isOrgWide(ctx, SUPPORT_PERMS.csatRead)
                ? this.prisma.supportCsatRating.groupBy({ by: ['agent_membership_id'], where, _avg: { rating: true }, _count: { _all: true } })
                : Promise.resolve([]),
        ]);
        const responses = agg._count._all;
        const satisfied = dist.filter((d) => (d.rating ?? 0) >= 4).reduce((s, d) => s + d._count._all, 0);
        const agentIds = byAgent.map((a) => a.agent_membership_id).filter(Boolean) as string[];
        const agents = agentIds.length ? await this.prisma.membership.findMany({ where: { id: { in: agentIds } }, select: MEMBER_SELECT }) : [];
        return {
            enabled: settings?.csat_enabled ?? true,
            scale: settings?.csat_scale ?? 'STARS_5',
            responses,
            requested,
            response_rate: requested ? Math.round((responses / requested) * 1000) / 10 : null,
            average: agg._avg.rating ? Math.round(agg._avg.rating * 100) / 100 : null,
            csat_percent: responses ? Math.round((satisfied / responses) * 1000) / 10 : null,
            distribution: [1, 2, 3, 4, 5].map((r) => ({ rating: r, count: dist.find((d) => d.rating === r)?._count._all ?? 0 })),
            by_agent: byAgent.map((a) => ({ agent: agents.find((m) => m.id === a.agent_membership_id) ?? null, average: a._avg.rating, count: a._count._all })),
        };
    }
}
