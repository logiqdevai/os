import { Injectable } from '@nestjs/common';
import { CampaignStatus, CommChannel, CommMessageKind, Prisma } from 'generated/prisma';
import { z } from 'zod';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import { OrgContext } from '@/shared/authorization/interfaces/org-context.interface';
import { utcDay } from '../common/comm.utils';
import { CommProviderService } from '../delivery/comm-provider.service';

export const AnalyticsQuerySchema = z.object({
    from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    channel: z.nativeEnum(CommChannel).optional(),
    kind: z.nativeEnum(CommMessageKind).optional(),
    campaign_id: z.string().uuid().optional(),
});
export type AnalyticsQuery = z.infer<typeof AnalyticsQuerySchema>;

const FIELDS = ['sent_count', 'delivered_count', 'opened_count', 'unique_opened_count', 'clicked_count', 'unique_clicked_count', 'replied_count', 'bounced_count', 'failed_count', 'complained_count', 'unsubscribed_count'] as const;
type Totals = Record<(typeof FIELDS)[number], number>;
const DAY = 24 * 3600 * 1000;

const rate = (n: number, d: number) => (d > 0 ? Math.round((n / d) * 1000) / 10 : 0);

function rates(t: Totals) {
    const base = t.delivered_count || t.sent_count;
    return {
        delivery_rate: rate(t.delivered_count, t.sent_count),
        open_rate: rate(t.unique_opened_count, base),
        click_rate: rate(t.unique_clicked_count, base),
        bounce_rate: rate(t.bounced_count, t.sent_count),
        unsubscribe_rate: rate(t.unsubscribed_count, base),
    };
}

/** 11 "Analytics & Reporting" — reads the CommDailyStat rollups and campaign counters. */
@Injectable()
export class AnalyticsService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly providers: CommProviderService,
    ) { }

    private range(query: AnalyticsQuery) {
        const to = query.to ? new Date(`${query.to}T00:00:00.000Z`) : utcDay(new Date());
        const from = query.from ? new Date(`${query.from}T00:00:00.000Z`) : new Date(to.getTime() - 29 * DAY);
        return { from, to };
    }

    private async totals(ctx: OrgContext, query: AnalyticsQuery, from: Date, to: Date) {
        const where: Prisma.CommDailyStatWhereInput = {
            organization_id: ctx.organization_id,
            date: { gte: from, lte: to },
            ...(query.channel && { channel: query.channel }),
            ...(query.kind ? { kind: query.kind } : { kind: { not: CommMessageKind.NOTIFICATION } }),
            ...(query.campaign_id && { campaign_id: query.campaign_id }),
        };
        const agg = await this.prisma.commDailyStat.aggregate({ where, _sum: Object.fromEntries(FIELDS.map((f) => [f, true])) as Prisma.CommDailyStatSumAggregateInputType });
        const t = Object.fromEntries(FIELDS.map((f) => [f, (agg._sum as Record<string, number | null>)[f] ?? 0])) as Totals;
        return { where, totals: t };
    }

    async summary(ctx: OrgContext, query: AnalyticsQuery) {
        const { from, to } = this.range(query);
        const span = to.getTime() - from.getTime() + DAY;
        const [{ where, totals }, previous] = await Promise.all([
            this.totals(ctx, query, from, to),
            this.totals(ctx, query, new Date(from.getTime() - span), new Date(from.getTime() - DAY)),
        ]);
        const rows = await this.prisma.commDailyStat.groupBy({ by: ['date', 'channel'], where, _sum: { sent_count: true, delivered_count: true, unique_opened_count: true, unique_clicked_count: true, bounced_count: true } });
        const byDay = new Map<string, { date: string; sent: number; delivered: number; opened: number; clicked: number; bounced: number; email: number; sms: number }>();
        for (let d = from.getTime(); d <= to.getTime(); d += DAY) {
            const k = new Date(d).toISOString().slice(0, 10);
            byDay.set(k, { date: k, sent: 0, delivered: 0, opened: 0, clicked: 0, bounced: 0, email: 0, sms: 0 });
        }
        for (const r of rows) {
            const k = r.date.toISOString().slice(0, 10);
            const row = byDay.get(k);
            if (!row) continue;
            row.sent += r._sum.sent_count ?? 0;
            row.delivered += r._sum.delivered_count ?? 0;
            row.opened += r._sum.unique_opened_count ?? 0;
            row.clicked += r._sum.unique_clicked_count ?? 0;
            row.bounced += r._sum.bounced_count ?? 0;
            if (r.channel === CommChannel.EMAIL) row.email += r._sum.sent_count ?? 0;
            else row.sms += r._sum.sent_count ?? 0;
        }
        const topCampaigns = await this.prisma.campaign.findMany({
            where: { organization_id: ctx.organization_id, started_at: { gte: from }, ...(query.channel && { channel: query.channel }) },
            orderBy: { sent_count: 'desc' },
            take: 5,
            select: { id: true, name: true, channel: true, status: true, sent_count: true, delivered_count: true, opened_count: true, clicked_count: true, bounced_count: true, started_at: true },
        });
        return {
            from: from.toISOString().slice(0, 10),
            to: to.toISOString().slice(0, 10),
            totals,
            rates: rates(totals),
            previous: { totals: previous.totals, rates: rates(previous.totals) },
            series: [...byDay.values()],
            top_campaigns: topCampaigns.map((c) => ({ ...c, open_rate: rate(c.opened_count, c.delivered_count || c.sent_count), click_rate: rate(c.clicked_count, c.delivered_count || c.sent_count) })),
        };
    }

    async overview(ctx: OrgContext) {
        const [statusCounts, upcoming, recent, providers, failedToday] = await Promise.all([
            this.prisma.campaign.groupBy({ by: ['status'], where: { organization_id: ctx.organization_id, archived_at: null, is_template: false }, _count: { _all: true } }),
            this.prisma.campaign.findMany({
                where: { organization_id: ctx.organization_id, status: { in: [CampaignStatus.SCHEDULED, CampaignStatus.SENDING, CampaignStatus.PAUSED, CampaignStatus.PENDING_APPROVAL] }, archived_at: null },
                orderBy: [{ scheduled_at: 'asc' }, { updated_at: 'desc' }],
                take: 6,
                select: { id: true, name: true, channel: true, status: true, scheduled_at: true, audience_count: true, sent_count: true, started_at: true },
            }),
            this.prisma.campaign.findMany({
                where: { organization_id: ctx.organization_id, status: CampaignStatus.COMPLETED, archived_at: null },
                orderBy: { completed_at: 'desc' },
                take: 5,
                select: { id: true, name: true, channel: true, status: true, completed_at: true, sent_count: true, delivered_count: true, opened_count: true, clicked_count: true },
            }),
            this.providers.status(ctx.organization_id),
            this.prisma.commMessage.count({ where: { organization_id: ctx.organization_id, status: { in: ['FAILED', 'BOUNCED'] }, updated_at: { gte: new Date(Date.now() - DAY) }, is_test: false } }),
        ]);
        return {
            campaigns_by_status: Object.fromEntries(statusCounts.map((s) => [s.status, s._count._all])),
            upcoming,
            recent: recent.map((c) => ({ ...c, open_rate: rate(c.opened_count, c.delivered_count || c.sent_count), click_rate: rate(c.clicked_count, c.delivered_count || c.sent_count) })),
            providers,
            failed_last_24h: failedToday,
        };
    }
}
