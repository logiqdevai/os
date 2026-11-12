import { Injectable } from '@nestjs/common';
import { ModuleKey, Prisma } from 'generated/prisma';
import { z } from 'zod';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import { AuditService } from '@/shared/audit/audit.service';
import { EventsService } from '@/shared/events/events.service';
import { OrgContext } from '@/shared/authorization/interfaces/org-context.interface';
import { CRM_FINANCIALS, MEMBER_SELECT } from '../common/crm.constants';
import { activityScopeWhere, dealScopeWhere, leadScopeWhere, ownerFilter, toNumber } from '../common/crm-scope.utils';
import { CsvExport, memberLabel, toCsv } from '../common/csv.utils';
import { CrmDefaultsService } from '../common/crm-defaults.service';
import { CrmPipelinesService } from '../pipelines/pipelines.service';

export const REPORT_KEYS = ['pipeline', 'win-loss', 'conversion', 'activity'] as const;
export type ReportKey = (typeof REPORT_KEYS)[number];

export const ReportQuerySchema = z.object({
    from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    pipeline_id: z.string().uuid().optional(),
    owner: z.string().optional(),
    team_id: z.string().uuid().optional(),
});
export type ReportQuery = z.infer<typeof ReportQuerySchema>;

const KEY = 'crm.dashboards.read';
const round2 = (n: number) => Math.round(n * 100) / 100;
const pct = (a: number, b: number) => (b ? Math.round((a / b) * 1000) / 10 : null);
const monthKey = (d: Date) => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
const weekKey = (d: Date) => { const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - ((d.getUTCDay() + 6) % 7))); return x.toISOString().slice(0, 10); };

/**
 * 02 §32–33 — CRM reports (mockup `reports`): pipeline by stage and owner, win / loss with reasons, lead conversion
 * by source, activity by type and owner. Every figure is computed by the API with the dashboard formulas
 * (win rate = won / (won + lost); weighted = value × probability; ABANDONED excluded). Scoped by `crm.dashboards.read`;
 * money only with `crm.financials.read`; CSV export needs `crm.records.export` and is audited.
 */
@Injectable()
export class CrmReportsService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly audit: AuditService,
        private readonly events: EventsService,
        private readonly defaults: CrmDefaultsService,
        private readonly pipelines: CrmPipelinesService,
    ) { }

    private range(q: ReportQuery) {
        const to = q.to ? new Date(`${q.to}T23:59:59.999Z`) : new Date();
        const from = q.from ? new Date(`${q.from}T00:00:00.000Z`) : new Date(Date.UTC(to.getUTCFullYear(), to.getUTCMonth() - 5, 1));
        return { from, to };
    }

    private dealBase(ctx: OrgContext, q: ReportQuery): Prisma.CrmDealWhereInput {
        return {
            organization_id: ctx.organization_id, archived_at: null, merged_into_id: null, ...dealScopeWhere(ctx, KEY),
            ...(q.pipeline_id && { pipeline_id: q.pipeline_id }), ...(q.team_id && { team_id: q.team_id }), ...ownerFilter(ctx, q.owner),
        };
    }

    private async members(ids: (string | null)[]) {
        const unique = [...new Set(ids.filter((x): x is string => !!x))];
        const rows = unique.length ? await this.prisma.membership.findMany({ where: { id: { in: unique } }, select: MEMBER_SELECT }) : [];
        return new Map(rows.map((m) => [m.id, m]));
    }

    async run(ctx: OrgContext, report: ReportKey, q: ReportQuery) {
        await this.defaults.ensure(ctx.organization_id);
        switch (report) {
            case 'pipeline': return this.pipeline(ctx, q);
            case 'win-loss': return this.winLoss(ctx, q);
            case 'conversion': return this.conversion(ctx, q);
            case 'activity': return this.activity(ctx, q);
        }
    }

    /** Open pipeline right now: by stage (count, value, weighted) and by owner. */
    async pipeline(ctx: OrgContext, q: ReportQuery) {
        const money = ctx.can(CRM_FINANCIALS);
        const pipeline = await this.pipelines.resolve(ctx, q.pipeline_id);
        const open = await this.prisma.crmDeal.findMany({
            where: { ...this.dealBase(ctx, { ...q, pipeline_id: pipeline.id }), status: 'OPEN' },
            select: { value: true, probability: true, stage_id: true, owner_membership_id: true, expected_close_date: true, stage: { select: { probability: true } } },
        });
        const stages = pipeline.stages.filter((s) => !s.is_won && !s.is_lost).map((s) => {
            const rows = open.filter((d) => d.stage_id === s.id);
            const value = rows.reduce((n, d) => n + toNumber(d.value), 0);
            const weighted = rows.reduce((n, d) => n + toNumber(d.value) * (d.probability ?? d.stage.probability) / 100, 0);
            return { stage_id: s.id, stage: s.name, color: s.color, probability: s.probability, count: rows.length, value: money ? round2(value) : null, weighted: money ? round2(weighted) : null };
        });
        const owners = await this.members(open.map((d) => d.owner_membership_id));
        const byOwnerMap = new Map<string, { count: number; value: number; weighted: number; overdue: number }>();
        const today = Date.now();
        for (const d of open) {
            const k = d.owner_membership_id ?? 'unassigned';
            const o = byOwnerMap.get(k) ?? { count: 0, value: 0, weighted: 0, overdue: 0 };
            o.count++; o.value += toNumber(d.value); o.weighted += toNumber(d.value) * (d.probability ?? d.stage.probability) / 100;
            if (d.expected_close_date && d.expected_close_date.getTime() < today - 86400_000) o.overdue++;
            byOwnerMap.set(k, o);
        }
        const by_owner = [...byOwnerMap.entries()].map(([id, o]) => ({ owner_membership_id: id === 'unassigned' ? null : id, owner: owners.get(id) ?? null, count: o.count, overdue: o.overdue, value: money ? round2(o.value) : null, weighted: money ? round2(o.weighted) : null }))
            .sort((a, b) => (b.value ?? b.count) - (a.value ?? a.count));
        const totalValue = open.reduce((n, d) => n + toNumber(d.value), 0);
        return {
            report: 'pipeline', financials_hidden: !money, currency: pipeline.currency, pipeline: { id: pipeline.id, name: pipeline.name },
            totals: { count: open.length, value: money ? round2(totalValue) : null, weighted: money ? round2(stages.reduce((n, s) => n + (s.weighted ?? 0), 0)) : null },
            by_stage: stages, by_owner,
        };
    }

    /** Deals closed in the period: win rate, values, by owner, by month and lost reasons. */
    async winLoss(ctx: OrgContext, q: ReportQuery) {
        const money = ctx.can(CRM_FINANCIALS);
        const { from, to } = this.range(q);
        const closed = await this.prisma.crmDeal.findMany({
            where: { ...this.dealBase(ctx, q), status: { in: ['WON', 'LOST'] }, actual_close_date: { gte: from, lte: to } },
            select: { status: true, value: true, currency: true, owner_membership_id: true, actual_close_date: true, created_at: true, lost_reason_id: true, loss_reason: { select: { name: true } }, competitor: true },
        });
        const won = closed.filter((d) => d.status === 'WON');
        const lost = closed.filter((d) => d.status === 'LOST');
        const sum = (rows: typeof closed) => rows.reduce((n, d) => n + toNumber(d.value), 0);
        const cycle = won.length ? Math.round(won.reduce((n, d) => n + ((d.actual_close_date!.getTime() - d.created_at.getTime()) / 86400_000), 0) / won.length) : null;
        const owners = await this.members(closed.map((d) => d.owner_membership_id));
        const ownerMap = new Map<string, { won: number; lost: number; won_value: number }>();
        for (const d of closed) {
            const k = d.owner_membership_id ?? 'unassigned';
            const o = ownerMap.get(k) ?? { won: 0, lost: 0, won_value: 0 };
            if (d.status === 'WON') { o.won++; o.won_value += toNumber(d.value); } else o.lost++;
            ownerMap.set(k, o);
        }
        const reasonMap = new Map<string, { count: number; value: number }>();
        for (const d of lost) {
            const k = d.loss_reason?.name ?? 'No reason given';
            const r = reasonMap.get(k) ?? { count: 0, value: 0 };
            r.count++; r.value += toNumber(d.value);
            reasonMap.set(k, r);
        }
        const months: { month: string; won: number; lost: number; won_value: number | null }[] = [];
        for (let m = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), 1)); m <= to; m = new Date(Date.UTC(m.getUTCFullYear(), m.getUTCMonth() + 1, 1))) {
            const k = monthKey(m);
            const rows = closed.filter((d) => monthKey(d.actual_close_date!) === k);
            months.push({ month: k, won: rows.filter((d) => d.status === 'WON').length, lost: rows.filter((d) => d.status === 'LOST').length, won_value: money ? round2(sum(rows.filter((d) => d.status === 'WON'))) : null });
        }
        return {
            report: 'win-loss', financials_hidden: !money, currency: closed[0]?.currency ?? null, from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10),
            totals: {
                won: won.length, lost: lost.length, win_rate: pct(won.length, won.length + lost.length),
                won_value: money ? round2(sum(won)) : null, lost_value: money ? round2(sum(lost)) : null,
                avg_won_value: money && won.length ? round2(sum(won) / won.length) : null, avg_sales_cycle_days: cycle,
            },
            by_owner: [...ownerMap.entries()].map(([id, o]) => ({ owner_membership_id: id === 'unassigned' ? null : id, owner: owners.get(id) ?? null, won: o.won, lost: o.lost, win_rate: pct(o.won, o.won + o.lost), won_value: money ? round2(o.won_value) : null })).sort((a, b) => b.won - a.won),
            lost_reasons: [...reasonMap.entries()].map(([reason, r]) => ({ reason, count: r.count, share: pct(r.count, lost.length), value: money ? round2(r.value) : null })).sort((a, b) => b.count - a.count),
            by_month: months,
        };
    }

    /** Leads created in the period: converted / lost / open, by source, and average days to convert. */
    async conversion(ctx: OrgContext, q: ReportQuery) {
        const { from, to } = this.range(q);
        const leads = await this.prisma.crmLead.findMany({
            where: { organization_id: ctx.organization_id, merged_into_id: null, ...leadScopeWhere(ctx, KEY), ...ownerFilter(ctx, q.owner), created_at: { gte: from, lte: to } },
            select: { created_at: true, converted_at: true, converted_deal_id: true, lead_source: { select: { name: true } }, status: { select: { is_lost: true } }, converted_deal: { select: { status: true } } },
        });
        const converted = leads.filter((l) => l.converted_at);
        const lost = leads.filter((l) => !l.converted_at && l.status?.is_lost);
        const withDeal = converted.filter((l) => l.converted_deal_id);
        const wonFromLeads = withDeal.filter((l) => l.converted_deal?.status === 'WON');
        const sourceMap = new Map<string, { created: number; converted: number; lost: number; won: number }>();
        for (const l of leads) {
            const k = l.lead_source?.name ?? 'No source';
            const s = sourceMap.get(k) ?? { created: 0, converted: 0, lost: 0, won: 0 };
            s.created++;
            if (l.converted_at) s.converted++;
            else if (l.status?.is_lost) s.lost++;
            if (l.converted_deal?.status === 'WON') s.won++;
            sourceMap.set(k, s);
        }
        const months: { month: string; created: number; converted: number }[] = [];
        for (let m = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), 1)); m <= to; m = new Date(Date.UTC(m.getUTCFullYear(), m.getUTCMonth() + 1, 1))) {
            const k = monthKey(m);
            months.push({ month: k, created: leads.filter((l) => monthKey(l.created_at) === k).length, converted: converted.filter((l) => monthKey(l.converted_at!) === k).length });
        }
        return {
            report: 'conversion', from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10),
            totals: {
                created: leads.length, converted: converted.length, lost: lost.length, open: leads.length - converted.length - lost.length,
                conversion_rate: pct(converted.length, leads.length),
                avg_days_to_convert: converted.length ? Math.round(converted.reduce((n, l) => n + (l.converted_at!.getTime() - l.created_at.getTime()) / 86400_000, 0) / converted.length) : null,
            },
            funnel: [
                { step: 'Leads created', count: leads.length },
                { step: 'Converted', count: converted.length },
                { step: 'Deal created', count: withDeal.length },
                { step: 'Deal won', count: wonFromLeads.length },
            ],
            by_source: [...sourceMap.entries()].map(([source, s]) => ({ source, ...s, conversion_rate: pct(s.converted, s.created) })).sort((a, b) => b.created - a.created),
            by_month: months,
        };
    }

    /** Activities in the period: completed by type, by owner, per week, plus overdue open activities. */
    async activity(ctx: OrgContext, q: ReportQuery) {
        const { from, to } = this.range(q);
        const base: Prisma.CrmActivityWhereInput = { organization_id: ctx.organization_id, ...activityScopeWhere(ctx, KEY), ...ownerFilter(ctx, q.owner) };
        const [done, overdue, planned] = await Promise.all([
            this.prisma.crmActivity.findMany({ where: { ...base, status: 'COMPLETED', completed_at: { gte: from, lte: to } }, select: { type: true, owner_membership_id: true, completed_at: true } }),
            this.prisma.crmActivity.count({ where: { ...base, status: 'PLANNED', starts_at: { lt: new Date() } } }),
            this.prisma.crmActivity.count({ where: { ...base, status: 'PLANNED', starts_at: { gte: new Date() } } }),
        ]);
        const byType = new Map<string, number>();
        const byOwner = new Map<string, Record<string, number>>();
        const byWeek = new Map<string, number>();
        for (const a of done) {
            byType.set(a.type, (byType.get(a.type) ?? 0) + 1);
            const k = a.owner_membership_id ?? 'unassigned';
            const o = byOwner.get(k) ?? {};
            o[a.type] = (o[a.type] ?? 0) + 1;
            byOwner.set(k, o);
            const w = weekKey(a.completed_at!);
            byWeek.set(w, (byWeek.get(w) ?? 0) + 1);
        }
        const owners = await this.members([...byOwner.keys()]);
        const weeks: { week: string; completed: number }[] = [];
        for (let w = new Date(weekKey(from)); w <= to; w = new Date(w.getTime() + 7 * 86400_000)) {
            const k = w.toISOString().slice(0, 10);
            weeks.push({ week: k, completed: byWeek.get(k) ?? 0 });
        }
        return {
            report: 'activity', from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10),
            totals: { completed: done.length, overdue, upcoming: planned },
            by_type: [...byType.entries()].map(([type, count]) => ({ type, count })).sort((a, b) => b.count - a.count),
            by_owner: [...byOwner.entries()].map(([id, counts]) => ({ owner_membership_id: id === 'unassigned' ? null : id, owner: owners.get(id) ?? null, total: Object.values(counts).reduce((n, c) => n + c, 0), counts })).sort((a, b) => b.total - a.total),
            by_week: weeks,
        };
    }

    /** Report table as CSV (sensitive: `crm.records.export`, audited as counts). */
    async export(ctx: OrgContext, report: ReportKey, q: ReportQuery): Promise<CsvExport> {
        const r = await this.run(ctx, report, q) as Record<string, any>;
        let headers: string[] = [];
        let rows: (string | number | null | undefined)[][] = [];
        const who = (o: { owner?: unknown; owner_membership_id?: string | null }) => (o.owner_membership_id ? memberLabel(o.owner as never) : 'Unassigned');
        if (report === 'pipeline') {
            headers = ['section', 'name', 'count', 'value', 'weighted', 'overdue'];
            rows = [
                ...r.by_stage.map((s: any) => ['stage', s.stage, s.count, s.value, s.weighted, '']),
                ...r.by_owner.map((o: any) => ['owner', who(o), o.count, o.value, o.weighted, o.overdue]),
            ];
        } else if (report === 'win-loss') {
            headers = ['section', 'name', 'won', 'lost', 'win_rate_%', 'won_value', 'count', 'value'];
            rows = [
                ...r.by_owner.map((o: any) => ['owner', who(o), o.won, o.lost, o.win_rate, o.won_value, '', '']),
                ...r.lost_reasons.map((x: any) => ['lost_reason', x.reason, '', '', '', '', x.count, x.value]),
                ...r.by_month.map((m: any) => ['month', m.month, m.won, m.lost, '', m.won_value, '', '']),
            ];
        } else if (report === 'conversion') {
            headers = ['section', 'name', 'created', 'converted', 'lost', 'won', 'conversion_rate_%'];
            rows = [
                ...r.by_source.map((s: any) => ['source', s.source, s.created, s.converted, s.lost, s.won, s.conversion_rate]),
                ...r.by_month.map((m: any) => ['month', m.month, m.created, m.converted, '', '', '']),
            ];
        } else {
            headers = ['section', 'name', 'completed'];
            rows = [
                ...r.by_type.map((t: any) => ['type', t.type, t.count]),
                ...r.by_owner.map((o: any) => ['owner', who(o), o.total]),
                ...r.by_week.map((w: any) => ['week', w.week, w.completed]),
            ];
        }
        await this.audit.record(ctx, 'crm.records.exported', { resource_type: 'crm_report', metadata: { entity: `report:${report}`, count: rows.length, filters: q } });
        this.events.publish(ctx, { event_key: 'crm.records.exported', module: ModuleKey.CRM, payload: { entity: `report:${report}`, count: rows.length } });
        return { filename: `crm-${report}-${new Date().toISOString().slice(0, 10)}.csv`, content: toCsv(headers, rows), count: rows.length };
    }
}
