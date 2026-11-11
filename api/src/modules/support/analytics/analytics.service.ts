import { Injectable } from '@nestjs/common';
import { Prisma } from 'generated/prisma';
import { z } from 'zod';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import { OrgContext } from '@/shared/authorization/interfaces/org-context.interface';
import { MEMBER_SELECT, OPEN_CATEGORIES, SUPPORT_PERMS } from '../common/support.constants';
import { isOrgWide, ticketScopeWhere } from '../common/support-scope.utils';

export const AnalyticsQuerySchema = z.object({
    from: z.coerce.date().optional(),
    to: z.coerce.date().optional(),
    team_id: z.string().uuid().optional(),
    inbox_id: z.string().uuid().optional(),
    category_id: z.string().uuid().optional(),
    company_id: z.string().uuid().optional(),
    assignee_membership_id: z.string().uuid().optional(),
});
export type AnalyticsQuery = z.infer<typeof AnalyticsQuerySchema>;

const MAX_ROWS = 20000;

const minutesBetween = (a: Date, b: Date) => Math.max(0, (b.getTime() - a.getTime()) / 60_000);
const avg = (xs: number[]) => (xs.length ? Math.round(xs.reduce((s, x) => s + x, 0) / xs.length) : null);
const median = (xs: number[]) => {
    if (!xs.length) return null;
    const s = [...xs].sort((a, b) => a - b);
    const m = Math.floor(s.length / 2);
    return Math.round(s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2);
};
const dayKey = (d: Date) => d.toISOString().slice(0, 10);

/** Support analytics (13 §9): volume, first response, resolution, SLA compliance, CSAT, backlog, breakdowns. */
@Injectable()
export class SupportAnalyticsService {
    constructor(private readonly prisma: PrismaService) { }

    async overview(ctx: OrgContext, q: AnalyticsQuery) {
        const to = q.to ?? new Date();
        const from = q.from ?? new Date(to.getTime() - 30 * 86400_000);
        const base: Prisma.TicketWhereInput = {
            AND: [
                { organization_id: ctx.organization_id, merged_into_ticket_id: null },
                ticketScopeWhere(ctx, SUPPORT_PERMS.analyticsRead),
                q.team_id ? { team_id: q.team_id } : {},
                q.inbox_id ? { inbox_id: q.inbox_id } : {},
                q.category_id ? { category_id: q.category_id } : {},
                q.company_id ? { company_id: q.company_id } : {},
                q.assignee_membership_id ? { assignee_membership_id: q.assignee_membership_id } : {},
            ],
        };
        const range = { gte: from, lte: to };

        const [created, resolved, backlog, timers, csat, convCreated] = await Promise.all([
            this.prisma.ticket.findMany({
                where: { AND: [base, { created_at: range }] },
                select: { id: true, created_at: true, first_responded_at: true, priority: true, source: true, channel_type: true, category_id: true, assignee_membership_id: true, category: { select: { name: true } } },
                take: MAX_ROWS,
            }),
            this.prisma.ticket.findMany({
                where: { AND: [base, { resolved_at: range }] },
                select: { created_at: true, resolved_at: true, assignee_membership_id: true, resolved_by_ai: true, reopen_count: true },
                take: MAX_ROWS,
            }),
            this.prisma.ticket.groupBy({ by: ['priority'], where: { AND: [base, { archived_at: null, status: { category: { in: OPEN_CATEGORIES } } }] }, _count: { _all: true } }),
            this.prisma.ticketSlaTimer.findMany({
                where: { completed_at: range, status: { in: ['MET', 'BREACHED'] }, ticket: base },
                select: { metric: true, status: true },
                take: MAX_ROWS,
            }),
            this.prisma.supportCsatRating.findMany({
                where: { organization_id: ctx.organization_id, submitted_at: range, ...(isOrgWide(ctx, SUPPORT_PERMS.analyticsRead) && !q.team_id && !q.inbox_id && !q.category_id && !q.company_id && !q.assignee_membership_id ? {} : { ticket: base }) },
                select: { rating: true },
            }),
            this.prisma.supportConversation.count({ where: { organization_id: ctx.organization_id, created_at: range, ...(q.inbox_id && { inbox_id: q.inbox_id }), ...(q.team_id && { team_id: q.team_id }) } }),
        ]);

        // Volume series (created vs resolved per day).
        const days: string[] = [];
        for (let d = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate())); d <= to; d = new Date(d.getTime() + 86400_000)) days.push(dayKey(d));
        const createdBy = new Map<string, number>();
        created.forEach((t) => createdBy.set(dayKey(t.created_at), (createdBy.get(dayKey(t.created_at)) ?? 0) + 1));
        const resolvedBy = new Map<string, number>();
        resolved.forEach((t) => t.resolved_at && resolvedBy.set(dayKey(t.resolved_at), (resolvedBy.get(dayKey(t.resolved_at)) ?? 0) + 1));

        const frt = created.filter((t) => t.first_responded_at).map((t) => minutesBetween(t.created_at, t.first_responded_at as Date));
        const rt = resolved.filter((t) => t.resolved_at).map((t) => minutesBetween(t.created_at, t.resolved_at as Date));

        const sla = (['FIRST_RESPONSE', 'NEXT_RESPONSE', 'RESOLUTION'] as const).map((metric) => {
            const rows = timers.filter((t) => t.metric === metric);
            const met = rows.filter((t) => t.status === 'MET').length;
            return { metric, met, breached: rows.length - met, compliance: rows.length ? Math.round((met / rows.length) * 1000) / 10 : null };
        });
        const slaAll = timers.length ? Math.round((timers.filter((t) => t.status === 'MET').length / timers.length) * 1000) / 10 : null;

        const ratings = csat.map((c) => c.rating ?? 0).filter((r) => r > 0);
        const group = <K extends string>(rows: { key: K | null }[]) => {
            const m = new Map<string, number>();
            rows.forEach((r) => m.set(r.key ?? 'NONE', (m.get(r.key ?? 'NONE') ?? 0) + 1));
            return [...m.entries()].map(([key, count]) => ({ key, count })).sort((a, b) => b.count - a.count);
        };

        // Agent breakdown (org-wide scope only, 13 §9).
        let agents: { agent: unknown; assigned: number; resolved: number; median_first_response_minutes: number | null }[] = [];
        if (isOrgWide(ctx, SUPPORT_PERMS.analyticsRead)) {
            const ids = [...new Set([...created.map((t) => t.assignee_membership_id), ...resolved.map((t) => t.assignee_membership_id)].filter(Boolean) as string[])];
            const members = ids.length ? await this.prisma.membership.findMany({ where: { id: { in: ids } }, select: MEMBER_SELECT }) : [];
            agents = ids
                .map((id) => ({
                    agent: members.find((m) => m.id === id) ?? null,
                    assigned: created.filter((t) => t.assignee_membership_id === id).length,
                    resolved: resolved.filter((t) => t.assignee_membership_id === id).length,
                    median_first_response_minutes: median(created.filter((t) => t.assignee_membership_id === id && t.first_responded_at).map((t) => minutesBetween(t.created_at, t.first_responded_at as Date))),
                }))
                .sort((a, b) => b.resolved - a.resolved)
                .slice(0, 20);
        }

        return {
            range: { from, to },
            org_wide: isOrgWide(ctx, SUPPORT_PERMS.analyticsRead),
            totals: {
                tickets_created: created.length,
                tickets_resolved: resolved.length,
                conversations_created: convCreated,
                open_backlog: backlog.reduce((s, b) => s + b._count._all, 0),
                reopened: resolved.filter((t) => t.reopen_count > 0).length,
                resolved_by_ai: resolved.filter((t) => t.resolved_by_ai).length,
            },
            first_response: { average_minutes: avg(frt), median_minutes: median(frt), responded: frt.length },
            resolution: { average_minutes: avg(rt), median_minutes: median(rt), resolved: rt.length },
            sla: { compliance: slaAll, by_metric: sla },
            csat: { responses: ratings.length, average: ratings.length ? Math.round((ratings.reduce((s, r) => s + r, 0) / ratings.length) * 100) / 100 : null, satisfied_percent: ratings.length ? Math.round((ratings.filter((r) => r >= 4).length / ratings.length) * 1000) / 10 : null },
            volume: days.map((d) => ({ date: d, created: createdBy.get(d) ?? 0, resolved: resolvedBy.get(d) ?? 0 })),
            backlog_by_priority: backlog.map((b) => ({ priority: b.priority, count: b._count._all })),
            by_source: group(created.map((t) => ({ key: t.source }))),
            by_priority: group(created.map((t) => ({ key: t.priority }))),
            by_category: group(created.map((t) => ({ key: (t.category?.name ?? null) as string | null }))),
            agents,
        };
    }
}
