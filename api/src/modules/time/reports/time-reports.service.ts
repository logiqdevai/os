import { Injectable } from '@nestjs/common';
import { ModuleKey, Prisma, TimeEntryStatus, TimeExportStatus, TimeReportFormat } from 'generated/prisma';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import { AuditService } from '@/shared/audit/audit.service';
import { EventsService } from '@/shared/events/events.service';
import { OrgContext } from '@/shared/authorization/interfaces/org-context.interface';
import { MEMBER_SELECT, TIME_RATES_READ, TimeAccessService } from '../common/time-access.service';
import { addDays, isoDate, round2, toDateOnly, todayUtc, workingDays } from '../common/time-dates';
import { TimeReportQuery, UnbilledQuery } from './dto/time-report.dto';

type Member = Prisma.MembershipGetPayload<{ select: typeof MEMBER_SELECT }>;
const memberName = (m: Member | null | undefined) => (m ? m.user.display_name || [m.user.first_name, m.user.last_name].filter(Boolean).join(' ') || m.user.email : 'Unknown');

const REPORT_SELECT = {
    id: true, date: true, membership_id: true, duration_minutes: true, billable_minutes: true, is_billable: true, non_billable_category: true, status: true,
    billable_amount: true, billing_currency: true, cost_amount: true, description: true, invoice_id: true, billing_rate_amount: true, start_at: true, end_at: true,
    membership: { select: MEMBER_SELECT },
    project: { select: { id: true, name: true, code: true, company: { select: { id: true, name: true } } } },
    task: { select: { id: true, number: true, title: true, team: { select: { task_key: true } } } },
    activity_type: { select: { id: true, name: true } },
} satisfies Prisma.TimeEntrySelect;
type ReportEntry = Prisma.TimeEntryGetPayload<{ select: typeof REPORT_SELECT }>;

/** 18 §9–§10 — reports over the caller's scope (own / team / all), CSV export (logged in TimeExport) and unbilled time for 08. */
@Injectable()
export class TimeReportsService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly audit: AuditService,
        private readonly events: EventsService,
        private readonly access: TimeAccessService,
    ) { }

    private range(q: { from?: string; to?: string }) {
        const to = q.to ? toDateOnly(q.to) : todayUtc();
        const from = q.from ? toDateOnly(q.from) : addDays(to, -29);
        return { from, to };
    }

    private async entries(ctx: OrgContext, q: TimeReportQuery) {
        const { from, to } = this.range(q);
        const scope = this.access.effectiveScope(ctx, q.scope);
        const ids = await this.access.memberIds(ctx, scope);
        const where: Prisma.TimeEntryWhereInput = {
            organization_id: ctx.organization_id,
            deleted_at: null,
            date: { gte: from, lte: to },
            ...(ids && { membership_id: { in: ids } }),
            ...(q.membership_id && { AND: [{ membership_id: q.membership_id }] }),
            ...(q.project_id && { project_id: q.project_id }),
            ...(q.activity_type_id && { activity_type_id: q.activity_type_id }),
            ...(q.company_id && { project: { company_id: q.company_id } }),
            ...(q.billable !== undefined && { is_billable: q.billable }),
        };
        const rows = await this.prisma.timeEntry.findMany({ where, select: REPORT_SELECT, orderBy: [{ date: 'asc' }, { created_at: 'asc' }], take: 50_000 });
        return { rows, from, to, scope };
    }

    async summary(ctx: OrgContext, q: TimeReportQuery) {
        const { rows, from, to, scope } = await this.entries(ctx, q);
        const money = ctx.can(TIME_RATES_READ);
        const keyOf = (e: ReportEntry): [string, string, string | null] => {
            switch (q.group_by) {
                case 'member': return [e.membership_id, memberName(e.membership), e.membership.job_title];
                case 'customer': return [e.project?.company?.id ?? 'none', e.project?.company?.name ?? (e.project ? 'No customer' : 'Internal'), null];
                case 'activity': return [e.activity_type?.id ?? 'none', e.activity_type?.name ?? 'No activity', null];
                case 'day': return [isoDate(e.date), isoDate(e.date), null];
                case 'task': return [e.task?.id ?? 'none', e.task ? `${e.task.team?.task_key ? `${e.task.team.task_key}-` : '#'}${e.task.number} ${e.task.title}` : 'No task', e.project?.name ?? null];
                default: return [e.project?.id ?? 'none', e.project ? e.project.name : 'Internal (no project)', e.project?.company?.name ?? null];
            }
        };
        const groups = new Map<string, { key: string; label: string; sublabel: string | null; total_minutes: number; billable_minutes: number; non_billable_minutes: number; entries: number; billable_amount: number; cost_amount: number }>();
        const byDay = new Map<string, { date: string; billable_minutes: number; non_billable_minutes: number }>();
        for (let d = from; d <= to; d = addDays(d, 1)) byDay.set(isoDate(d), { date: isoDate(d), billable_minutes: 0, non_billable_minutes: 0 });
        let currency: string | null = null;
        for (const e of rows) {
            const [key, label, sublabel] = keyOf(e);
            const g = groups.get(key) ?? { key, label, sublabel, total_minutes: 0, billable_minutes: 0, non_billable_minutes: 0, entries: 0, billable_amount: 0, cost_amount: 0 };
            g.total_minutes += e.duration_minutes;
            g.billable_minutes += e.billable_minutes;
            g.non_billable_minutes += e.duration_minutes - e.billable_minutes;
            g.entries++;
            g.billable_amount += Number(e.billable_amount ?? 0);
            g.cost_amount += Number(e.cost_amount ?? 0);
            groups.set(key, g);
            const day = byDay.get(isoDate(e.date));
            if (day) {
                day.billable_minutes += e.billable_minutes;
                day.non_billable_minutes += e.duration_minutes - e.billable_minutes;
            }
            currency ??= e.billing_currency;
        }
        const strip = <T extends { billable_amount: number; cost_amount: number }>(g: T) => (money ? { ...g, billable_amount: round2(g.billable_amount), cost_amount: round2(g.cost_amount) } : { ...g, billable_amount: undefined, cost_amount: undefined });
        const total = rows.reduce((s, e) => s + e.duration_minutes, 0);
        const billable = rows.reduce((s, e) => s + e.billable_minutes, 0);
        const totals = strip({
            total_minutes: total, billable_minutes: billable, non_billable_minutes: total - billable, entries: rows.length,
            billable_ratio: total ? round2((billable / total) * 100) : null,
            billable_amount: rows.reduce((s, e) => s + Number(e.billable_amount ?? 0), 0), cost_amount: rows.reduce((s, e) => s + Number(e.cost_amount ?? 0), 0),
        });
        const nonBillable = new Map<string, number>();
        for (const e of rows) if (!e.is_billable) nonBillable.set(e.non_billable_category ?? 'UNCATEGORIZED', (nonBillable.get(e.non_billable_category ?? 'UNCATEGORIZED') ?? 0) + e.duration_minutes);
        return {
            from: isoDate(from), to: isoDate(to), scope, group_by: q.group_by, currency: money ? currency : null,
            totals,
            groups: [...groups.values()].sort((a, b) => (q.group_by === 'day' ? a.key.localeCompare(b.key) : b.total_minutes - a.total_minutes)).map(strip),
            by_day: [...byDay.values()],
            non_billable_by_category: [...nonBillable.entries()].map(([category, minutes]) => ({ category, minutes })).sort((a, b) => b.minutes - a.minutes),
        };
    }

    /** Utilization = logged / expected (expected from 10 Employee.weekly_capacity_hours or the organization default, Mon–Fri). */
    async utilization(ctx: OrgContext, q: TimeReportQuery) {
        const { from, to } = this.range(q);
        const scope = this.access.effectiveScope(ctx, q.scope);
        const ids = await this.access.memberIds(ctx, scope);
        const settings = await this.access.settings(ctx.organization_id);
        const members = await this.prisma.membership.findMany({
            where: { organization_id: ctx.organization_id, status: 'ACTIVE', type: 'INTERNAL', ...(ids && { id: { in: ids } }), ...(q.membership_id && { AND: [{ id: q.membership_id }] }) },
            select: MEMBER_SELECT,
        });
        const memberIds = members.map((m) => m.id);
        const [sums, leave, expected] = await Promise.all([
            this.prisma.timeEntry.groupBy({ by: ['membership_id'], where: { membership_id: { in: memberIds }, deleted_at: null, date: { gte: from, lte: to } }, _sum: { duration_minutes: true, billable_minutes: true } }),
            this.prisma.timeEntry.groupBy({ by: ['membership_id'], where: { membership_id: { in: memberIds }, deleted_at: null, date: { gte: from, lte: to }, non_billable_category: 'LEAVE' }, _sum: { duration_minutes: true } }),
            this.access.expectedWeeklyMinutes(ctx.organization_id, memberIds, Number(settings.default_expected_hours_per_week)),
        ]);
        const days = workingDays(from, to);
        const sumBy = new Map(sums.map((s) => [s.membership_id, s._sum]));
        const leaveBy = new Map(leave.map((s) => [s.membership_id, s._sum.duration_minutes ?? 0]));
        const target = settings.utilization_target_percent !== null ? Number(settings.utilization_target_percent) : null;
        const rows = members.map((m) => {
            const s = sumBy.get(m.id);
            const logged = s?.duration_minutes ?? 0;
            const billable = s?.billable_minutes ?? 0;
            const leaveMin = leaveBy.get(m.id) ?? 0;
            const expectedMin = Math.max(0, Math.round(((expected.get(m.id) ?? 0) * days) / 5) - leaveMin);
            const basis = settings.utilization_billable_only ? billable : logged - leaveMin;
            return {
                membership: m,
                expected_minutes: expectedMin,
                logged_minutes: logged,
                billable_minutes: billable,
                leave_minutes: leaveMin,
                utilization_percent: expectedMin ? round2((basis / expectedMin) * 100) : null,
                billable_ratio: logged ? round2((billable / logged) * 100) : null,
            };
        }).sort((a, b) => (b.utilization_percent ?? -1) - (a.utilization_percent ?? -1));
        const totalExpected = rows.reduce((s, r) => s + r.expected_minutes, 0);
        const totalLogged = rows.reduce((s, r) => s + r.logged_minutes - r.leave_minutes, 0);
        return {
            from: isoDate(from), to: isoDate(to), scope, working_days: days, target_percent: target, billable_only: settings.utilization_billable_only,
            rows,
            totals: { expected_minutes: totalExpected, logged_minutes: totalLogged, utilization_percent: totalExpected ? round2((totalLogged / totalExpected) * 100) : null },
        };
    }

    /** CSV of entries in scope. Every export is a TimeExport row and an audit event (18 §10, §13). */
    async exportCsv(ctx: OrgContext, q: TimeReportQuery) {
        const { rows, from, to, scope } = await this.entries(ctx, q);
        const money = ctx.can(TIME_RATES_READ);
        const header = ['Date', 'Member', 'Email', 'Customer', 'Project', 'Task', 'Activity', 'Description', 'Start', 'End', 'Hours', 'Billable', 'Billable hours', 'Non-billable category', 'Status', ...(money ? ['Rate', 'Amount', 'Currency', 'Cost'] : [])];
        const esc = (v: unknown) => {
            const s = v === null || v === undefined ? '' : String(v);
            return /[",\n\r]/.test(s) || /^[=+\-@]/.test(s) ? `"${(/^[=+\-@]/.test(s) ? `'${s}` : s).replace(/"/g, '""')}"` : s;
        };
        const lines = rows.map((e) => [
            isoDate(e.date), memberName(e.membership), e.membership.user.email, e.project?.company?.name ?? '', e.project?.name ?? '',
            e.task ? `${e.task.team?.task_key ? `${e.task.team.task_key}-` : '#'}${e.task.number} ${e.task.title}` : '', e.activity_type?.name ?? '', e.description ?? '',
            e.start_at?.toISOString() ?? '', e.end_at?.toISOString() ?? '', round2(e.duration_minutes / 60), e.is_billable ? 'yes' : 'no', round2(e.billable_minutes / 60), e.non_billable_category ?? '', e.status,
            ...(money ? [e.billing_rate_amount?.toString() ?? '', e.billable_amount?.toString() ?? '', e.billing_currency ?? '', e.cost_amount?.toString() ?? ''] : []),
        ].map(esc).join(','));
        const csv = [header.map(esc).join(','), ...lines].join('\r\n');
        const filters = { ...q, from: isoDate(from), to: isoDate(to), scope };
        const exp = await this.prisma.timeExport.create({
            data: { organization_id: ctx.organization_id, report_key: 'entries', format: TimeReportFormat.CSV, status: TimeExportStatus.COMPLETED, filters: filters as Prisma.InputJsonValue, row_count: rows.length, started_at: new Date(), completed_at: new Date(), created_by_membership_id: ctx.membership_id },
        });
        await this.audit.record(ctx, 'time.export.created', { resource_type: 'time_export', resource_id: exp.id, metadata: { format: 'CSV', filters, row_count: rows.length, includes_amounts: money } });
        this.events.publish(ctx, { event_key: 'time.export.created', module: ModuleKey.TIME_TRACKING, entity_kind: 'time_export', entity_id: exp.id, payload: { row_count: rows.length } });
        return { filename: `time-entries_${isoDate(from)}_${isoDate(to)}.csv`, csv, row_count: rows.length, export_id: exp.id };
    }

    async exports(ctx: OrgContext) {
        return this.prisma.timeExport.findMany({
            where: { organization_id: ctx.organization_id, ...(!ctx.can('time.entries.read_all') && { created_by_membership_id: ctx.membership_id ?? '__none__' }) },
            orderBy: { created_at: 'desc' },
            take: 50,
            include: { created_by: { select: MEMBER_SELECT } },
        });
    }

    /**
     * 18 §7 — "ready to invoice": APPROVED / LOCKED, billable, uninvoiced entries grouped by customer and project with the
     * snapshotted rates. 08 Billing pulls these; Time Tracking never creates invoices.
     */
    async unbilled(ctx: OrgContext, q: UnbilledQuery) {
        const money = ctx.can(TIME_RATES_READ);
        const where: Prisma.TimeEntryWhereInput = {
            organization_id: ctx.organization_id,
            deleted_at: null,
            is_billable: true,
            invoice_id: null,
            status: { in: [TimeEntryStatus.APPROVED, TimeEntryStatus.LOCKED] },
            ...(q.to && { date: { lte: toDateOnly(q.to) } }),
            ...(q.project_id && { project_id: q.project_id }),
            ...(q.company_id && { project: { company_id: q.company_id } }),
        };
        const [rows, pending] = await Promise.all([
            this.prisma.timeEntry.findMany({ where, select: REPORT_SELECT, orderBy: { date: 'asc' } }),
            this.prisma.timeEntry.aggregate({ where: { organization_id: ctx.organization_id, deleted_at: null, is_billable: true, invoice_id: null, status: { in: [TimeEntryStatus.DRAFT, TimeEntryStatus.SUBMITTED] } }, _sum: { billable_minutes: true }, _count: true }),
        ]);
        type ProjectGroup = { project: { id: string; name: string; code: string | null } | null; entries: number; billable_minutes: number; amount: number; currency: string | null; oldest_date: string; newest_date: string; missing_rate: number; entry_ids: string[] };
        const customers = new Map<string, { customer: { id: string; name: string } | null; projects: Map<string, ProjectGroup>; billable_minutes: number; amount: number }>();
        for (const e of rows) {
            const ck = e.project?.company?.id ?? 'none';
            const c = customers.get(ck) ?? { customer: e.project?.company ?? null, projects: new Map(), billable_minutes: 0, amount: 0 };
            const pk = e.project?.id ?? 'none';
            const p = c.projects.get(pk) ?? { project: e.project ? { id: e.project.id, name: e.project.name, code: e.project.code } : null, entries: 0, billable_minutes: 0, amount: 0, currency: null, oldest_date: isoDate(e.date), newest_date: isoDate(e.date), missing_rate: 0, entry_ids: [] };
            p.entries++;
            p.billable_minutes += e.billable_minutes;
            p.amount += Number(e.billable_amount ?? 0);
            p.currency ??= e.billing_currency;
            p.newest_date = isoDate(e.date);
            if (e.billing_rate_amount === null) p.missing_rate++;
            p.entry_ids.push(e.id);
            c.projects.set(pk, p);
            c.billable_minutes += e.billable_minutes;
            c.amount += Number(e.billable_amount ?? 0);
            customers.set(ck, c);
        }
        const groups = [...customers.values()]
            .map((c) => ({
                customer: c.customer,
                billable_minutes: c.billable_minutes,
                amount: money ? round2(c.amount) : undefined,
                projects: [...c.projects.values()].map((p) => ({ ...p, amount: money ? round2(p.amount) : undefined })).sort((a, b) => b.billable_minutes - a.billable_minutes),
            }))
            .sort((a, b) => b.billable_minutes - a.billable_minutes);
        return {
            groups,
            totals: {
                entries: rows.length,
                billable_minutes: rows.reduce((s, e) => s + e.billable_minutes, 0),
                amount: money ? round2(rows.reduce((s, e) => s + Number(e.billable_amount ?? 0), 0)) : undefined,
                currency: money ? rows.find((e) => e.billing_currency)?.billing_currency ?? null : null,
                missing_rate: rows.filter((e) => e.billing_rate_amount === null).length,
                no_project: rows.filter((e) => !e.project).length,
            },
            awaiting_approval: { entries: pending._count, billable_minutes: pending._sum.billable_minutes ?? 0 },
        };
    }
}
