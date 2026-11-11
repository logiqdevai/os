import { ForbiddenException, Injectable } from '@nestjs/common';
import { LedgerPlLine, LedgerRecordStatus, LedgerRecordType, LedgerReportBasis, LedgerSettlementKind, Prisma, TimeEntryStatus } from 'generated/prisma';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import { OrgContext } from '@/shared/authorization/interfaces/org-context.interface';
import { dec, num, todayUtc, toDateOnly } from '@/modules/finance-shared/money.utils';
import { LedgerConfigService } from './ledger-config.service';
import { LedgerRecordsService, recordKey } from './ledger-records.service';
import { ProfitabilityQuery, ReportRange } from '../dto/ledger.schemas';

export interface ReportRow {
    type: LedgerRecordType;
    date: Date;
    net: number;
    vat: number;
    gross: number;
    vat_percent: number;
    category_id: string | null;
    category_name: string;
    pl_line: LedgerPlLine;
    is_operating: boolean;
    company_id: string | null;
    company_name: string | null;
    project_id: string | null;
    source: string;
    recurring: boolean;
}

export const PL_LINES: LedgerPlLine[] = ['REVENUE', 'COST_OF_OPERATIONS', 'EMPLOYEE_EXPENSES', 'OFFICE_EXPENSES', 'SOFTWARE_EXPENSES', 'MARKETING_EXPENSES', 'PROFESSIONAL_EXPENSES', 'OTHER_OPERATING_EXPENSES'];

const monthKey = (d: Date) => d.toISOString().slice(0, 7);
const r2 = (n: number) => Math.round(n * 100) / 100;

/**
 * 09 reporting — dashboard, profit & loss, VAT, profitability and cash flow, computed live from posted ledger records.
 * ACCRUAL uses transaction dates and net amounts; CASH uses settlement dates (payments − refunds) pro rata to net.
 * Every report respects the caller's record-type keys and scope (LedgerRecordsService.readWhere).
 */
@Injectable()
export class LedgerReportsService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly config: LedgerConfigService,
        private readonly records: LedgerRecordsService,
    ) { }

    range(r: ReportRange) {
        const today = todayUtc();
        const from = r.from ? toDateOnly(r.from)! : new Date(Date.UTC(today.getUTCFullYear(), 0, 1));
        const to = r.to ? toDateOnly(r.to)! : today;
        return { from, to };
    }

    /** Posted records of the range as normalized rows (reporting currency only; other currencies converted with fx_rate). */
    async rows(ctx: OrgContext, r: ReportRange, extra: Prisma.LedgerRecordWhereInput = {}): Promise<ReportRow[]> {
        const { from, to } = this.range(r);
        const basis = r.basis ?? LedgerReportBasis.ACCRUAL;
        const where: Prisma.LedgerRecordWhereInput = {
            organization_id: ctx.organization_id,
            deleted_at: null,
            status: LedgerRecordStatus.POSTED,
            AND: [this.records.readWhere(ctx), extra],
            ...(r.branch_id && { branch_id: r.branch_id }),
            ...(r.project_id && { project_id: r.project_id }),
            ...(r.company_id && { company_id: r.company_id }),
            ...(r.department_id && { department_id: r.department_id }),
            ...(r.category_id && { OR: [{ category_id: r.category_id }, { subcategory_id: r.category_id }] }),
        };
        const select = {
            id: true, type: true, transaction_date: true, net_amount: true, vat_amount: true, gross_amount: true, vat_percent: true, fx_rate: true, currency: true,
            category_id: true, company_id: true, project_id: true, source: true, recurring_expense_id: true, counterparty_name: true,
            category: { select: { name: true, pl_line: true, is_operating: true, parent: { select: { pl_line: true } } } },
            company: { select: { name: true } },
        } satisfies Prisma.LedgerRecordSelect;
        type Rec = Prisma.LedgerRecordGetPayload<{ select: typeof select }>;
        const toRow = (rec: Rec, date: Date, factor: number): ReportRow => {
            const fx = rec.fx_rate ? Number(rec.fx_rate) : 1;
            const pl = rec.type === 'INCOME' ? 'REVENUE' : (rec.category?.pl_line ?? rec.category?.parent?.pl_line ?? 'OTHER_OPERATING_EXPENSES');
            return {
                type: rec.type, date,
                net: Number(rec.net_amount) * factor * fx, vat: Number(rec.vat_amount) * factor * fx, gross: Number(rec.gross_amount) * factor * fx,
                vat_percent: Number(rec.vat_percent),
                category_id: rec.category_id, category_name: rec.category?.name ?? 'Uncategorized', pl_line: pl as LedgerPlLine, is_operating: rec.category?.is_operating ?? true,
                company_id: rec.company_id, company_name: rec.company?.name ?? rec.counterparty_name ?? null, project_id: rec.project_id, source: rec.source, recurring: !!rec.recurring_expense_id,
            };
        };
        if (basis === LedgerReportBasis.ACCRUAL) {
            const recs = await this.prisma.ledgerRecord.findMany({ where: { ...where, transaction_date: { gte: from, lte: to } }, select });
            return recs.map((rec) => toRow(rec, rec.transaction_date, 1));
        }
        const settlements = await this.prisma.ledgerSettlement.findMany({
            where: { settled_on: { gte: from, lte: to }, kind: { in: [LedgerSettlementKind.PAYMENT, LedgerSettlementKind.REFUND, LedgerSettlementKind.ADJUSTMENT] }, record: where },
            select: { amount: true, kind: true, settled_on: true, record: { select } },
        });
        return settlements.map((s) => {
            const gross = Number(s.record.gross_amount) || 1;
            const factor = (Number(s.amount) / gross) * (s.kind === LedgerSettlementKind.REFUND ? -1 : 1);
            return toRow(s.record, s.settled_on, factor);
        });
    }

    private totals(rows: ReportRow[]) {
        let income = 0, expenses = 0, vatCollected = 0, vatPaid = 0, payroll = 0, recurring = 0, operating = 0, grossIncome = 0;
        for (const r of rows) {
            if (r.type === 'INCOME') {
                income += r.net;
                grossIncome += r.gross;
                vatCollected += r.vat;
            } else {
                expenses += r.net;
                vatPaid += r.vat;
                if (r.source === 'PAYROLL') payroll += r.net;
                if (r.recurring) recurring += r.net;
                if (r.is_operating) operating += r.net;
            }
        }
        return {
            total_income: r2(income), gross_income: r2(grossIncome), total_expenses: r2(expenses), net_profit: r2(income - expenses),
            margin_percent: income ? r2(((income - expenses) / income) * 100) : null,
            vat_collected: r2(vatCollected), vat_paid: r2(vatPaid), net_vat: r2(vatCollected - vatPaid),
            payroll_expenses: r2(payroll), recurring_expenses: r2(recurring), operating_expenses: r2(operating),
        };
    }

    private byMonth(rows: ReportRow[], from: Date, to: Date) {
        const months: { month: string; income: number; expenses: number; profit: number }[] = [];
        const cursor = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), 1));
        while (cursor <= to) {
            months.push({ month: monthKey(cursor), income: 0, expenses: 0, profit: 0 });
            cursor.setUTCMonth(cursor.getUTCMonth() + 1);
        }
        for (const r of rows) {
            const m = months.find((x) => x.month === monthKey(r.date));
            if (!m) continue;
            if (r.type === 'INCOME') m.income += r.net;
            else m.expenses += r.net;
        }
        return months.map((m) => ({ month: m.month, income: r2(m.income), expenses: r2(m.expenses), profit: r2(m.income - m.expenses) }));
    }

    private byCategory(rows: ReportRow[], type: LedgerRecordType) {
        const map = new Map<string, { category_id: string | null; name: string; amount: number; vat: number }>();
        for (const r of rows.filter((x) => x.type === type)) {
            const k = r.category_id ?? 'none';
            const cur = map.get(k) ?? { category_id: r.category_id, name: r.category_name, amount: 0, vat: 0 };
            cur.amount += r.net;
            cur.vat += r.vat;
            map.set(k, cur);
        }
        return [...map.values()].map((c) => ({ ...c, amount: r2(c.amount), vat: r2(c.vat) })).sort((a, b) => b.amount - a.amount);
    }

    // --- Dashboard ---------------------------------------------------------------------------------------

    async dashboard(ctx: OrgContext, r: ReportRange) {
        const { from, to } = this.range(r);
        const currency = await this.config.reportingCurrency(ctx.organization_id);
        const rows = await this.rows(ctx, r);
        const readable = this.records.readWhere(ctx);
        const [outstanding, overdue, cash, upcoming, pending] = await Promise.all([
            this.prisma.ledgerRecord.groupBy({ by: ['type'], where: { organization_id: ctx.organization_id, deleted_at: null, status: 'POSTED', amount_remaining: { gt: 0 }, AND: [readable] }, _sum: { amount_remaining: true }, _count: { _all: true } }),
            this.prisma.ledgerRecord.groupBy({ by: ['type'], where: { organization_id: ctx.organization_id, deleted_at: null, status: 'POSTED', payment_status: 'OVERDUE', AND: [readable] }, _sum: { amount_remaining: true }, _count: { _all: true } }),
            this.cashPosition(ctx),
            this.prisma.recurringExpense.findMany({ where: { organization_id: ctx.organization_id, status: 'ACTIVE', next_occurrence_date: { lte: new Date(Date.now() + 30 * 86_400_000) } }, orderBy: { next_occurrence_date: 'asc' }, take: 8, select: { id: true, name: true, next_occurrence_date: true, expected_gross_amount: true, currency: true } }),
            this.prisma.ledgerRecord.count({ where: { organization_id: ctx.organization_id, deleted_at: null, status: 'PENDING_REVIEW', AND: [readable] } }),
        ]);
        const pick = (list: typeof outstanding, type: LedgerRecordType) => list.find((x) => x.type === type);
        return {
            currency,
            basis: r.basis ?? 'ACCRUAL',
            from: from.toISOString().slice(0, 10),
            to: to.toISOString().slice(0, 10),
            can: { income: ctx.can(recordKey('INCOME', 'read')), expenses: ctx.can(recordKey('EXPENSE', 'read')), payroll: ctx.can('finance.payroll.read'), vat: ctx.can('finance.vat.read') },
            totals: this.totals(rows),
            receivables: { amount: num(pick(outstanding, 'INCOME')?._sum.amount_remaining), count: pick(outstanding, 'INCOME')?._count._all ?? 0, overdue_amount: num(pick(overdue, 'INCOME')?._sum.amount_remaining), overdue_count: pick(overdue, 'INCOME')?._count._all ?? 0 },
            payables: { amount: num(pick(outstanding, 'EXPENSE')?._sum.amount_remaining), count: pick(outstanding, 'EXPENSE')?._count._all ?? 0, overdue_amount: num(pick(overdue, 'EXPENSE')?._sum.amount_remaining), overdue_count: pick(overdue, 'EXPENSE')?._count._all ?? 0 },
            pending_review: pending,
            trend: this.byMonth(rows, from, to),
            expenses_by_category: this.byCategory(rows, 'EXPENSE').slice(0, 10),
            income_by_category: this.byCategory(rows, 'INCOME').slice(0, 10),
            cash_position: cash,
            upcoming_expenses: upcoming,
        };
    }

    /** Live balance per tracked bank account / cash box: opening balance (or latest snapshot) + settlements since. */
    async cashPosition(ctx: OrgContext) {
        const methods = await this.prisma.ledgerPaymentMethod.findMany({ where: { organization_id: ctx.organization_id, track_balance: true, archived_at: null }, select: { id: true, name: true, type: true, currency: true, opening_balance: true, opening_date: true } });
        const out: { id: string; name: string; type: string; currency: string | null; balance: number; as_of: string }[] = [];
        for (const m of methods) {
            const snap = await this.prisma.ledgerBalanceSnapshot.findFirst({ where: { payment_method_id: m.id }, orderBy: { as_of: 'desc' } });
            const start = snap?.as_of ?? m.opening_date ?? new Date(0);
            let balance = dec(snap?.balance ?? m.opening_balance ?? 0);
            const settlements = await this.prisma.ledgerSettlement.findMany({
                where: { payment_method_id: m.id, settled_on: snap ? { gt: start } : { gte: start }, record: { organization_id: ctx.organization_id, status: 'POSTED', deleted_at: null } },
                select: { amount: true, kind: true, record: { select: { type: true } } },
            });
            for (const s of settlements) {
                if (s.kind === 'WRITE_OFF') continue;
                const inflow = s.record.type === 'INCOME' ? s.kind !== 'REFUND' : s.kind === 'REFUND';
                balance = inflow ? balance.plus(s.amount) : balance.minus(s.amount);
            }
            out.push({ id: m.id, name: m.name, type: m.type, currency: m.currency, balance: num(balance), as_of: todayUtc().toISOString().slice(0, 10) });
        }
        return out;
    }

    // --- Profit & loss --------------------------------------------------------------------------------------

    async profitLoss(ctx: OrgContext, r: ReportRange) {
        this.assertBoth(ctx);
        const { from, to } = this.range(r);
        const current = await this.plFor(ctx, r);
        let comparison: Awaited<ReturnType<LedgerReportsService['plFor']>> | null = null;
        let compareRange: { from: string; to: string } | null = null;
        if (r.compare) {
            let cFrom: Date, cTo: Date;
            if (r.compare === 'previous_year') {
                cFrom = new Date(Date.UTC(from.getUTCFullYear() - 1, from.getUTCMonth(), from.getUTCDate()));
                cTo = new Date(Date.UTC(to.getUTCFullYear() - 1, to.getUTCMonth(), to.getUTCDate()));
            } else {
                const span = to.getTime() - from.getTime() + 86_400_000;
                cTo = new Date(from.getTime() - 86_400_000);
                cFrom = new Date(cTo.getTime() - span + 86_400_000);
            }
            compareRange = { from: cFrom.toISOString().slice(0, 10), to: cTo.toISOString().slice(0, 10) };
            comparison = await this.plFor(ctx, { ...r, ...compareRange });
        }
        return { currency: await this.config.reportingCurrency(ctx.organization_id), basis: r.basis ?? 'ACCRUAL', from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10), ...current, comparison, compare_range: compareRange };
    }

    private async plFor(ctx: OrgContext, r: ReportRange) {
        const rows = await this.rows(ctx, r);
        const lines = PL_LINES.map((line) => {
            const lineRows = rows.filter((x) => (line === 'REVENUE' ? x.type === 'INCOME' : x.type === 'EXPENSE' && x.pl_line === line));
            const cats = new Map<string, { category_id: string | null; name: string; amount: number }>();
            for (const x of lineRows) {
                const k = x.category_id ?? 'none';
                const c = cats.get(k) ?? { category_id: x.category_id, name: x.category_name, amount: 0 };
                c.amount += x.net;
                cats.set(k, c);
            }
            return { line, amount: r2(lineRows.reduce((a, x) => a + x.net, 0)), categories: [...cats.values()].map((c) => ({ ...c, amount: r2(c.amount) })).sort((a, b) => b.amount - a.amount) };
        });
        const revenue = lines[0].amount;
        const totalExpenses = r2(lines.slice(1).reduce((a, l) => a + l.amount, 0));
        return { lines, revenue, total_expenses: totalExpenses, net_operating_result: r2(revenue - totalExpenses), margin_percent: revenue ? r2(((revenue - totalExpenses) / revenue) * 100) : null };
    }

    // --- VAT ----------------------------------------------------------------------------------------------------

    async vat(ctx: OrgContext, r: ReportRange) {
        const { from, to } = this.range(r);
        const rows = await this.rows(ctx, r);
        const t = this.totals(rows);
        const group = r.group_by ?? 'rate';
        const map = new Map<string, { key: string; label: string; income_net: number; vat_collected: number; expense_net: number; vat_paid: number }>();
        for (const x of rows) {
            const key = group === 'rate' ? `${x.vat_percent}` : group === 'category' ? x.category_id ?? 'none' : group === 'counterparty' ? x.company_id ?? x.company_name ?? 'none' : monthKey(x.date);
            const label = group === 'rate' ? `${x.vat_percent}%` : group === 'category' ? x.category_name : group === 'counterparty' ? x.company_name ?? 'No counterparty' : key;
            const cur = map.get(key) ?? { key, label, income_net: 0, vat_collected: 0, expense_net: 0, vat_paid: 0 };
            if (x.type === 'INCOME') {
                cur.income_net += x.net;
                cur.vat_collected += x.vat;
            } else {
                cur.expense_net += x.net;
                cur.vat_paid += x.vat;
            }
            map.set(key, cur);
        }
        const groups = [...map.values()].map((g) => ({ ...g, income_net: r2(g.income_net), vat_collected: r2(g.vat_collected), expense_net: r2(g.expense_net), vat_paid: r2(g.vat_paid), net_vat: r2(g.vat_collected - g.vat_paid) }));
        groups.sort((a, b) => (group === 'month' ? a.key.localeCompare(b.key) : Math.abs(b.net_vat) - Math.abs(a.net_vat)));
        const returns = await this.prisma.vatReturn.findMany({ where: { organization_id: ctx.organization_id }, orderBy: { created_at: 'desc' }, take: 12, include: { period: { select: { id: true, name: true, start_date: true, end_date: true, status: true } } } });
        return { currency: await this.config.reportingCurrency(ctx.organization_id), basis: r.basis ?? 'ACCRUAL', from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10), group_by: group, vat_collected: t.vat_collected, vat_paid: t.vat_paid, net_vat: t.net_vat, groups, returns };
    }

    // --- Profitability ------------------------------------------------------------------------------------------

    async profitability(ctx: OrgContext, q: ProfitabilityQuery) {
        const scope = q.scope ?? 'PROJECT';
        const { from, to } = this.range(q);
        const rows = await this.rows(ctx, { ...q, basis: 'ACCRUAL' });
        const key = (x: ReportRow) => (scope === 'PROJECT' ? x.project_id : x.company_id);
        const subjects = new Map<string, { revenue: number; direct_expenses: number }>();
        for (const x of rows) {
            const k = key(x);
            if (!k) continue;
            const cur = subjects.get(k) ?? { revenue: 0, direct_expenses: 0 };
            if (x.type === 'INCOME') cur.revenue += x.net;
            else cur.direct_expenses += x.net;
            subjects.set(k, cur);
        }
        // Employee cost from approved time (18 §7): duration × cost-rate snapshot.
        const time = await this.prisma.timeEntry.findMany({
            where: { organization_id: ctx.organization_id, date: { gte: from, lte: to }, status: { in: [TimeEntryStatus.APPROVED, TimeEntryStatus.INVOICED, TimeEntryStatus.LOCKED] }, project_id: { not: null }, cost_amount: { not: null } },
            select: { project_id: true, cost_amount: true, duration_minutes: true, project: { select: { company_id: true } } },
        });
        const labor = new Map<string, { cost: number; minutes: number }>();
        for (const t of time) {
            const k = scope === 'PROJECT' ? t.project_id : t.project?.company_id;
            if (!k) continue;
            const cur = labor.get(k) ?? { cost: 0, minutes: 0 };
            cur.cost += Number(t.cost_amount);
            cur.minutes += t.duration_minutes;
            labor.set(k, cur);
            if (!subjects.has(k)) subjects.set(k, { revenue: 0, direct_expenses: 0 });
        }
        const ids = [...subjects.keys()];
        const [names, receivables] = await Promise.all([
            scope === 'PROJECT'
                ? this.prisma.project.findMany({ where: { id: { in: ids }, organization_id: ctx.organization_id }, select: { id: true, name: true, company: { select: { name: true } } } })
                : this.prisma.crmCompany.findMany({ where: { id: { in: ids }, organization_id: ctx.organization_id }, select: { id: true, name: true } }),
            this.prisma.ledgerRecord.groupBy({
                by: [scope === 'PROJECT' ? 'project_id' : 'company_id'],
                where: { organization_id: ctx.organization_id, type: 'INCOME', status: 'POSTED', deleted_at: null, transaction_date: { gte: from, lte: to }, [scope === 'PROJECT' ? 'project_id' : 'company_id']: { in: ids } },
                _sum: { amount_paid: true, amount_remaining: true },
            }),
        ]);
        const showNames = ctx.can('finance.payroll.read');
        const items = ids.map((id) => {
            const s = subjects.get(id)!;
            const l = labor.get(id) ?? { cost: 0, minutes: 0 };
            const rec = receivables.find((x) => (x as Record<string, unknown>)[scope === 'PROJECT' ? 'project_id' : 'company_id'] === id);
            const n = names.find((x) => x.id === id) as { name: string; company?: { name: string } | null } | undefined;
            const totalCost = s.direct_expenses + l.cost;
            return {
                id, name: n?.name ?? 'Unknown', customer: n?.company?.name ?? null,
                revenue: r2(s.revenue), payments_received: num(rec?._sum.amount_paid), outstanding_revenue: num(rec?._sum.amount_remaining),
                direct_expenses: r2(s.direct_expenses), employee_costs: r2(l.cost), hours: r2(l.minutes / 60), total_cost: r2(totalCost),
                gross_profit: r2(s.revenue - totalCost), margin_percent: s.revenue ? r2(((s.revenue - totalCost) / s.revenue) * 100) : null,
            };
        });
        items.sort((a, b) => b.gross_profit - a.gross_profit);
        const sumOf = (k: 'revenue' | 'total_cost' | 'gross_profit' | 'employee_costs' | 'direct_expenses') => r2(items.reduce((a, x) => a + x[k], 0));
        return {
            scope, currency: await this.config.reportingCurrency(ctx.organization_id), from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10), employee_cost_detail: showNames,
            totals: { revenue: sumOf('revenue'), direct_expenses: sumOf('direct_expenses'), employee_costs: sumOf('employee_costs'), total_cost: sumOf('total_cost'), gross_profit: sumOf('gross_profit') },
            items,
        };
    }

    // --- Cash flow / aging ---------------------------------------------------------------------------------------

    async cashFlow(ctx: OrgContext, r: ReportRange) {
        const { from, to } = this.range(r);
        const rows = await this.rows(ctx, { ...r, basis: 'CASH' });
        const months = this.byMonth(rows.map((x) => ({ ...x, net: x.gross })), from, to);
        return { currency: await this.config.reportingCurrency(ctx.organization_id), from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10), months: months.map((m) => ({ month: m.month, inflow: m.income, outflow: m.expenses, net: m.profit })) };
    }

    async aging(ctx: OrgContext, type: LedgerRecordType) {
        this.records.assertKey(ctx, type, 'read');
        const today = todayUtc();
        const open = await this.prisma.ledgerRecord.findMany({
            where: { organization_id: ctx.organization_id, type, status: 'POSTED', deleted_at: null, amount_remaining: { gt: 0 }, AND: [this.records.readWhere(ctx)] },
            select: { id: true, number: true, description: true, due_date: true, transaction_date: true, amount_remaining: true, currency: true, counterparty_name: true, company_id: true },
            orderBy: { due_date: 'asc' },
        });
        const buckets = { current: 0, d1_30: 0, d31_60: 0, d61_90: 0, d90_plus: 0 };
        const rowsOut = open.map((x) => {
            const due = x.due_date ?? x.transaction_date;
            const days = Math.floor((today.getTime() - due.getTime()) / 86_400_000);
            const amount = Number(x.amount_remaining);
            const bucket = days <= 0 ? 'current' : days <= 30 ? 'd1_30' : days <= 60 ? 'd31_60' : days <= 90 ? 'd61_90' : 'd90_plus';
            buckets[bucket] += amount;
            return { ...x, days_overdue: Math.max(0, days), bucket };
        });
        return { type, buckets: Object.fromEntries(Object.entries(buckets).map(([k, v]) => [k, r2(v)])), rows: rowsOut };
    }

    /** Ledger report as CSV (export needs the export key of each record type). */
    toCsv(headers: string[], rows: (string | number | null | undefined)[][]) {
        const esc = (v: string | number | null | undefined) => {
            const s = v === null || v === undefined ? '' : String(v);
            return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
        };
        return [headers.map(esc).join(','), ...rows.map((r) => r.map(esc).join(','))].join('\n');
    }

    private assertBoth(ctx: OrgContext) {
        if (!ctx.can('finance.profit_loss.read')) throw new ForbiddenException({ message: 'You do not have permission to do this (finance.profit_loss.read)', code: 'permission_denied' });
    }
}
