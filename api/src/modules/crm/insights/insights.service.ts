import { Injectable } from '@nestjs/common';
import { Prisma } from 'generated/prisma';
import { z } from 'zod';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import { OrgContext } from '@/shared/authorization/interfaces/org-context.interface';
import { CRM_FINANCIALS, COMPANY_REF_SELECT, MEMBER_SELECT } from '../common/crm.constants';
import { activityScopeWhere, dealScopeWhere, leadScopeWhere, ownerFilter, toNumber } from '../common/crm-scope.utils';
import { CrmDefaultsService } from '../common/crm-defaults.service';
import { CrmPipelinesService } from '../pipelines/pipelines.service';

export const DashboardQuerySchema = z.object({
    pipeline_id: z.string().uuid().optional(),
    owner: z.string().optional(),
    team_id: z.string().uuid().optional(),
});
export type DashboardQuery = z.infer<typeof DashboardQuerySchema>;

export const ForecastQuerySchema = z.object({
    pipeline_id: z.string().uuid().optional(),
    owner: z.string().optional(),
    team_id: z.string().uuid().optional(),
    /** Number of future months (including the current one). */
    months: z.coerce.number().int().min(1).max(24).optional().default(6),
});
export type ForecastQuery = z.infer<typeof ForecastQuerySchema>;

const round2 = (n: number) => Math.round(n * 100) / 100;
const monthKey = (d: Date) => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
const startOfMonth = (d = new Date()) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
const addMonths = (d: Date, n: number) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + n, 1));

/** 02 §11, §32 — CRM dashboard KPIs and forecast by close month. Every number is computed on the server. */
@Injectable()
export class CrmInsightsService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly defaults: CrmDefaultsService,
        private readonly pipelines: CrmPipelinesService,
    ) { }

    private dealWhere(ctx: OrgContext, key: string, q: { pipeline_id?: string; owner?: string; team_id?: string }): Prisma.CrmDealWhereInput {
        return {
            organization_id: ctx.organization_id,
            archived_at: null,
            merged_into_id: null,
            ...dealScopeWhere(ctx, key),
            ...(q.pipeline_id && { pipeline_id: q.pipeline_id }),
            ...(q.team_id && { team_id: q.team_id }),
            ...ownerFilter(ctx, q.owner),
        };
    }

    async dashboard(ctx: OrgContext, q: DashboardQuery) {
        await this.defaults.ensure(ctx.organization_id);
        const KEY = 'crm.dashboards.read';
        const money = ctx.can(CRM_FINANCIALS);
        const base = this.dealWhere(ctx, KEY, q);
        const monthStart = startOfMonth();
        const since90 = new Date(Date.now() - 90 * 86400_000);
        const sixMonthsAgo = addMonths(monthStart, -5);
        const leadBase: Prisma.CrmLeadWhereInput = { organization_id: ctx.organization_id, archived_at: null, ...leadScopeWhere(ctx, KEY), ...ownerFilter(ctx, q.owner) };
        const pipeline = await this.pipelines.resolve(ctx, q.pipeline_id);

        const [open, wonMonth, lostMonth, won90, lost90, leads90, converted90, newLeadsMonth, stageRows, closingSoon, wonHistory, myActivities] = await Promise.all([
            this.prisma.crmDeal.findMany({ where: { ...base, status: 'OPEN' }, select: { value: true, probability: true, stage: { select: { probability: true } } } }),
            this.prisma.crmDeal.aggregate({ where: { ...base, status: 'WON', actual_close_date: { gte: monthStart } }, _count: { _all: true }, _sum: { value: true } }),
            this.prisma.crmDeal.count({ where: { ...base, status: 'LOST', actual_close_date: { gte: monthStart } } }),
            this.prisma.crmDeal.aggregate({ where: { ...base, status: 'WON', actual_close_date: { gte: since90 } }, _count: { _all: true }, _sum: { value: true } }),
            this.prisma.crmDeal.count({ where: { ...base, status: 'LOST', actual_close_date: { gte: since90 } } }),
            this.prisma.crmLead.count({ where: { ...leadBase, created_at: { gte: since90 } } }),
            this.prisma.crmLead.count({ where: { ...leadBase, created_at: { gte: since90 }, converted_at: { not: null } } }),
            this.prisma.crmLead.count({ where: { ...leadBase, created_at: { gte: monthStart } } }),
            this.prisma.crmDeal.groupBy({ by: ['stage_id'], where: { ...base, pipeline_id: pipeline.id, status: 'OPEN' }, _count: { _all: true }, _sum: { value: true } }),
            this.prisma.crmDeal.findMany({
                where: { ...base, status: 'OPEN', expected_close_date: { not: null } },
                orderBy: { expected_close_date: 'asc' },
                take: 6,
                select: { id: true, name: true, value: true, currency: true, probability: true, expected_close_date: true, company: { select: COMPANY_REF_SELECT }, stage: { select: { id: true, name: true, color: true } }, owner: { select: MEMBER_SELECT } },
            }),
            this.prisma.crmDeal.findMany({ where: { ...base, status: 'WON', actual_close_date: { gte: sixMonthsAgo } }, select: { value: true, actual_close_date: true } }),
            ctx.can('crm.activities.read')
                ? this.prisma.crmActivity.findMany({
                    where: { organization_id: ctx.organization_id, ...activityScopeWhere(ctx, 'crm.activities.read'), owner_membership_id: ctx.membership_id ?? '__none__', status: 'PLANNED' },
                    orderBy: { starts_at: { sort: 'asc', nulls: 'last' } },
                    take: 6,
                    select: { id: true, type: true, title: true, starts_at: true, priority: true, deal: { select: { id: true, name: true } }, company: { select: { id: true, name: true } } },
                })
                : Promise.resolve(null),
        ]);

        const openValue = open.reduce((n, d) => n + toNumber(d.value), 0);
        const weighted = open.reduce((n, d) => n + toNumber(d.value) * (d.probability ?? d.stage.probability) / 100, 0);
        const closed90 = won90._count._all + lost90;
        const months: { month: string; value: number | null; count: number }[] = [];
        for (let i = 0; i < 6; i++) {
            const m = monthKey(addMonths(sixMonthsAgo, i));
            const rows = wonHistory.filter((d) => d.actual_close_date && monthKey(d.actual_close_date) === m);
            months.push({ month: m, count: rows.length, value: money ? round2(rows.reduce((n, d) => n + toNumber(d.value), 0)) : null });
        }
        const now = Date.now();
        return {
            currency: pipeline.currency,
            financials_hidden: !money,
            kpis: {
                open_deals: open.length,
                pipeline_value: money ? round2(openValue) : null,
                weighted_value: money ? round2(weighted) : null,
                won_this_month: wonMonth._count._all,
                won_value_this_month: money ? round2(toNumber(wonMonth._sum.value)) : null,
                lost_this_month: lostMonth,
                win_rate_90d: closed90 ? Math.round((won90._count._all / closed90) * 100) : null,
                avg_won_deal_90d: money && won90._count._all ? round2(toNumber(won90._sum.value) / won90._count._all) : null,
                lead_conversion_90d: leads90 ? Math.round((converted90 / leads90) * 100) : null,
                new_leads_this_month: newLeadsMonth,
            },
            pipeline: {
                id: pipeline.id,
                name: pipeline.name,
                stages: pipeline.stages.filter((s) => !s.is_won && !s.is_lost).map((s) => {
                    const row = stageRows.find((r) => r.stage_id === s.id);
                    return { id: s.id, name: s.name, color: s.color, probability: s.probability, count: row?._count._all ?? 0, value: money ? round2(toNumber(row?._sum.value)) : null };
                }),
            },
            won_by_month: months,
            closing_soon: closingSoon.map((d) => ({ ...d, value: money ? d.value : null, is_overdue: !!d.expected_close_date && d.expected_close_date.getTime() < now - 86400_000 })),
            my_activities: myActivities?.map((a) => ({ ...a, is_overdue: !!a.starts_at && a.starts_at.getTime() < now })) ?? null,
        };
    }

    /** Open deals bucketed by expected close month with total, weighted and per-category sums (02 §11). */
    async forecast(ctx: OrgContext, q: ForecastQuery) {
        await this.defaults.ensure(ctx.organization_id);
        const KEY = 'crm.forecast.read';
        const money = ctx.can(CRM_FINANCIALS);
        const base = this.dealWhere(ctx, KEY, q);
        const first = startOfMonth();
        const end = addMonths(first, q.months);
        const pipeline = q.pipeline_id ? await this.pipelines.findOne(ctx, q.pipeline_id) : null;
        const [open, won] = await Promise.all([
            this.prisma.crmDeal.findMany({
                where: { ...base, status: 'OPEN' },
                select: { id: true, name: true, value: true, currency: true, probability: true, forecast_category: true, expected_close_date: true, stage: { select: { name: true, probability: true } }, company: { select: { id: true, name: true } }, owner: { select: MEMBER_SELECT } },
                orderBy: { expected_close_date: { sort: 'asc', nulls: 'last' } },
            }),
            this.prisma.crmDeal.findMany({ where: { ...base, status: 'WON', actual_close_date: { gte: first, lt: end } }, select: { value: true, actual_close_date: true } }),
        ]);
        type Bucket = { key: string; label: string; from: string | null; count: number; total: number; weighted: number; commit: number; best_case: number; pipeline: number; won: number; won_count: number; deals: typeof open };
        const mk = (key: string, label: string, from: string | null): Bucket => ({ key, label, from, count: 0, total: 0, weighted: 0, commit: 0, best_case: 0, pipeline: 0, won: 0, won_count: 0, deals: [] });
        const buckets: Bucket[] = [mk('overdue', 'Past close date', null)];
        for (let i = 0; i < q.months; i++) {
            const m = addMonths(first, i);
            buckets.push(mk(monthKey(m), m.toLocaleString('en', { month: 'short', year: 'numeric', timeZone: 'UTC' }), m.toISOString().slice(0, 10)));
        }
        const later = mk('later', 'Later', end.toISOString().slice(0, 10));
        const noDate = mk('no_date', 'No close date', null);
        buckets.push(later, noDate);
        const byKey = new Map(buckets.map((b) => [b.key, b]));
        for (const d of open) {
            const b = !d.expected_close_date ? noDate : d.expected_close_date < first ? byKey.get('overdue')! : d.expected_close_date >= end ? later : byKey.get(monthKey(d.expected_close_date))!;
            const v = toNumber(d.value);
            const w = v * (d.probability ?? d.stage.probability) / 100;
            b.count++; b.total += v; b.weighted += w;
            if (d.forecast_category === 'COMMIT') b.commit += v;
            else if (d.forecast_category === 'BEST_CASE') b.best_case += v;
            else b.pipeline += v;
            if (b.deals.length < 25) b.deals.push(d);
        }
        for (const d of won) {
            const b = d.actual_close_date ? byKey.get(monthKey(d.actual_close_date)) : undefined;
            if (b) { b.won += toNumber(d.value); b.won_count++; }
        }
        const scrub = (b: Bucket) => ({
            ...b,
            total: money ? round2(b.total) : null, weighted: money ? round2(b.weighted) : null, commit: money ? round2(b.commit) : null,
            best_case: money ? round2(b.best_case) : null, pipeline: money ? round2(b.pipeline) : null, won: money ? round2(b.won) : null,
            deals: b.deals.map((d) => ({ ...d, value: money ? d.value : null })),
        });
        const all = buckets.reduce((acc, b) => ({ count: acc.count + b.count, total: acc.total + b.total, weighted: acc.weighted + b.weighted, commit: acc.commit + b.commit, won: acc.won + b.won }), { count: 0, total: 0, weighted: 0, commit: 0, won: 0 });
        return {
            currency: pipeline?.currency ?? open[0]?.currency ?? null,
            financials_hidden: !money,
            buckets: buckets.filter((b) => b.key !== 'overdue' || b.count > 0).map(scrub),
            totals: { count: all.count, total: money ? round2(all.total) : null, weighted: money ? round2(all.weighted) : null, commit: money ? round2(all.commit) : null, won: money ? round2(all.won) : null },
        };
    }
}
