import { Injectable, NotFoundException } from '@nestjs/common';
import { InvoiceStatus, PaymentStatus, Prisma, RefundStatus, SubscriptionStatus } from 'generated/prisma';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import { AuditService } from '@/shared/audit/audit.service';
import { OrgContext } from '@/shared/authorization/interfaces/org-context.interface';
import { monthlyEquivalent, num, round2, sum, todayUtc, toDateOnly } from '@/modules/finance-shared/money.utils';
import { InvoicesService, OPEN_STATUSES } from './invoices.service';
import { FinanceRange } from '../dto/billing.schemas';

const r2 = (n: number) => Math.round(n * 100) / 100;
const monthKey = (d: Date) => d.toISOString().slice(0, 7);
export const FINANCE_REPORTS = ['revenue', 'invoices', 'outstanding', 'tax', 'customers', 'payments', 'subscriptions'] as const;
export type FinanceReportKey = (typeof FINANCE_REPORTS)[number];

/**
 * 08 "Financial Dashboard" and "Financial Reporting" — billing KPIs in the organization's default currency (other currencies
 * are listed separately, never mixed), plus tabular reports with CSV export. P&L, VAT position and profitability are 09.
 */
@Injectable()
export class FinanceReportsService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly audit: AuditService,
        private readonly invoices: InvoicesService,
    ) { }

    private async currency(ctx: OrgContext) {
        return (await this.prisma.organization.findUnique({ where: { id: ctx.organization_id }, select: { default_currency: true } }))?.default_currency ?? 'EUR';
    }

    async dashboard(ctx: OrgContext, q: FinanceRange) {
        const currency = await this.currency(ctx);
        const today = todayUtc();
        const monthStart = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
        const yearStart = new Date(Date.UTC(today.getUTCFullYear(), 0, 1));
        const from12 = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - 11, 1));
        const inv: Prisma.InvoiceWhereInput = { organization_id: ctx.organization_id, currency, AND: [this.invoices.scope(ctx)], ...(q.branch_id && { branch_id: q.branch_id }) };
        const pay: Prisma.PaymentWhereInput = { organization_id: ctx.organization_id, currency, ...(q.connection_id && { provider_connection_id: q.connection_id }) };

        const [outstanding, overdue, paidThisMonth, refundsMonth, issued12, payments12, subs, statusCounts, aging, topCustomers, attempts, otherCurrencies, recentPayments] = await Promise.all([
            this.prisma.invoice.aggregate({ where: { ...inv, status: { in: OPEN_STATUSES } }, _sum: { amount_due: true }, _count: { _all: true } }),
            this.prisma.invoice.aggregate({ where: { ...inv, status: InvoiceStatus.OVERDUE, amount_due: { gt: 0 } }, _sum: { amount_due: true }, _count: { _all: true } }),
            this.prisma.payment.aggregate({ where: { ...pay, status: { in: [PaymentStatus.SUCCEEDED, PaymentStatus.PARTIALLY_REFUNDED, PaymentStatus.REFUNDED] }, received_at: { gte: monthStart } }, _sum: { amount: true, fee_amount: true }, _count: { _all: true } }),
            this.prisma.refund.aggregate({ where: { status: RefundStatus.SUCCEEDED, processed_at: { gte: yearStart }, payment: pay }, _sum: { amount: true } }),
            this.prisma.invoice.findMany({ where: { ...inv, status: { notIn: ['DRAFT', 'VOID', 'CANCELLED', 'SCHEDULED'] }, issue_date: { gte: from12 } }, select: { issue_date: true, subtotal: true, discount_total: true, total: true, company_id: true } }),
            this.prisma.payment.findMany({ where: { ...pay, status: { in: [PaymentStatus.SUCCEEDED, PaymentStatus.PARTIALLY_REFUNDED, PaymentStatus.REFUNDED] }, received_at: { gte: from12 } }, select: { received_at: true, amount: true, refunded_amount: true } }),
            this.prisma.subscription.findMany({ where: { organization_id: ctx.organization_id, currency, status: { in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.PAST_DUE, SubscriptionStatus.TRIALING] } }, select: { period_amount: true, interval: true, interval_count: true, status: true } }),
            this.prisma.invoice.groupBy({ by: ['status'], where: { organization_id: ctx.organization_id, AND: [this.invoices.scope(ctx)] }, _count: { _all: true } }),
            this.prisma.invoice.findMany({ where: { ...inv, status: { in: OPEN_STATUSES }, amount_due: { gt: 0 } }, select: { due_date: true, amount_due: true } }),
            this.prisma.invoice.groupBy({ by: ['company_id'], where: { ...inv, status: { notIn: ['DRAFT', 'VOID', 'CANCELLED'] }, issue_date: { gte: yearStart } }, _sum: { total: true, amount_paid: true }, orderBy: { _sum: { total: 'desc' } }, take: 8 }),
            this.prisma.payment.groupBy({ by: ['status'], where: { ...pay, created_at: { gte: new Date(Date.now() - 90 * 86_400_000) } }, _count: { _all: true } }),
            this.prisma.invoice.groupBy({ by: ['currency'], where: { organization_id: ctx.organization_id, currency: { not: currency }, status: { in: OPEN_STATUSES }, AND: [this.invoices.scope(ctx)] }, _sum: { amount_due: true }, _count: { _all: true } }),
            ctx.can('finance.payments.read') ? this.prisma.payment.findMany({ where: { organization_id: ctx.organization_id }, orderBy: { created_at: 'desc' }, take: 6, select: { id: true, amount: true, currency: true, status: true, method_type: true, received_at: true, billing_profile: { select: { legal_name: true } } } }) : Promise.resolve([]),
        ]);

        const months: { month: string; invoiced: number; collected: number }[] = [];
        for (let i = 0; i < 12; i++) months.push({ month: monthKey(new Date(Date.UTC(from12.getUTCFullYear(), from12.getUTCMonth() + i, 1))), invoiced: 0, collected: 0 });
        for (const i of issued12) {
            const m = months.find((x) => x.month === monthKey(i.issue_date!));
            if (m) m.invoiced += Number(i.subtotal) - Number(i.discount_total);
        }
        for (const p of payments12) {
            const m = months.find((x) => x.month === monthKey(p.received_at!));
            if (m) m.collected += Number(p.amount) - Number(p.refunded_amount);
        }
        const mrr = round2(sum(subs.filter((s) => s.status !== 'TRIALING').map((s) => monthlyEquivalent(s.period_amount, s.interval, s.interval_count))));
        const buckets = { current: 0, d1_30: 0, d31_60: 0, d61_90: 0, d90_plus: 0 };
        for (const a of aging) {
            const days = a.due_date ? Math.floor((today.getTime() - a.due_date.getTime()) / 86_400_000) : 0;
            const k = days <= 0 ? 'current' : days <= 30 ? 'd1_30' : days <= 60 ? 'd31_60' : days <= 90 ? 'd61_90' : 'd90_plus';
            buckets[k] += Number(a.amount_due);
        }
        const names = await this.prisma.crmCompany.findMany({ where: { id: { in: topCustomers.map((t) => t.company_id) } }, select: { id: true, name: true } });
        const succeeded = attempts.filter((a) => (['SUCCEEDED', 'PARTIALLY_REFUNDED', 'REFUNDED'] as string[]).includes(a.status)).reduce((x, a) => x + a._count._all, 0);
        const failed = attempts.find((a) => a.status === 'FAILED')?._count._all ?? 0;
        const revenueYtd = issued12.filter((i) => i.issue_date! >= yearStart).reduce((a, i) => a + Number(i.subtotal) - Number(i.discount_total), 0);
        const customersYtd = new Set(issued12.filter((i) => i.issue_date! >= yearStart).map((i) => i.company_id)).size;
        const canMoney = ctx.can('finance.payments.read');
        return {
            currency,
            kpis: {
                outstanding: num(outstanding._sum.amount_due), outstanding_count: outstanding._count._all,
                overdue: num(overdue._sum.amount_due), overdue_count: overdue._count._all,
                mrr: num(mrr), arr: num(mrr.times(12)), active_subscriptions: subs.filter((s) => s.status !== 'TRIALING').length, trialing_subscriptions: subs.filter((s) => s.status === 'TRIALING').length,
                collected_this_month: canMoney ? num(paidThisMonth._sum.amount) : null, fees_this_month: canMoney ? num(paidThisMonth._sum.fee_amount) : null, payments_this_month: paidThisMonth._count._all,
                revenue_ytd: r2(revenueYtd), arpu_ytd: customersYtd ? r2(revenueYtd / customersYtd) : null, refunds_ytd: canMoney ? num(refundsMonth._sum.amount) : null,
                payment_success_rate: succeeded + failed ? r2((succeeded / (succeeded + failed)) * 100) : null,
            },
            monthly: months.map((m) => ({ ...m, invoiced: r2(m.invoiced), collected: canMoney ? r2(m.collected) : 0 })),
            aging: Object.entries(buckets).map(([bucket, amount]) => ({ bucket, amount: r2(amount) })),
            status_counts: statusCounts.map((s) => ({ status: s.status, count: s._count._all })),
            top_customers: topCustomers.map((t) => ({ company_id: t.company_id, name: names.find((n) => n.id === t.company_id)?.name ?? 'Unknown', invoiced: num(t._sum.total), paid: canMoney ? num(t._sum.amount_paid) : null })),
            other_currencies: otherCurrencies.map((o) => ({ currency: o.currency, outstanding: num(o._sum.amount_due), count: o._count._all })),
            recent_payments: recentPayments,
        };
    }

    /** Tabular report rows; `format=csv` exports (needs finance.reports.export, checked by the controller). */
    async report(ctx: OrgContext, key: string, q: FinanceRange) {
        if (!(FINANCE_REPORTS as readonly string[]).includes(key)) throw new NotFoundException({ message: 'Unknown report', code: 'report_not_found' });
        const today = todayUtc();
        const from = q.from ? toDateOnly(q.from)! : new Date(Date.UTC(today.getUTCFullYear(), 0, 1));
        const to = q.to ? new Date(toDateOnly(q.to)!.getTime() + 86_399_999) : new Date(today.getTime() + 86_399_999);
        const inv: Prisma.InvoiceWhereInput = { organization_id: ctx.organization_id, AND: [this.invoices.scope(ctx)], ...(q.branch_id && { branch_id: q.branch_id }) };
        let columns: { key: string; label: string; type?: 'money' | 'date' | 'number' | 'text' }[] = [];
        let rows: Record<string, string | number | null>[] = [];

        if (key === 'revenue') {
            const list = await this.prisma.invoice.findMany({ where: { ...inv, status: { notIn: ['DRAFT', 'VOID', 'CANCELLED', 'SCHEDULED'] }, issue_date: { gte: from, lte: to } }, select: { issue_date: true, currency: true, subtotal: true, discount_total: true, tax_total: true, total: true, amount_paid: true } });
            const map = new Map<string, Record<string, number | string>>();
            for (const i of list) {
                const k = `${monthKey(i.issue_date!)}|${i.currency}`;
                const r = (map.get(k) ?? { month: monthKey(i.issue_date!), currency: i.currency, invoices: 0, net: 0, tax: 0, total: 0, paid: 0 }) as Record<string, number | string>;
                r.invoices = (r.invoices as number) + 1;
                r.net = r2((r.net as number) + Number(i.subtotal) - Number(i.discount_total));
                r.tax = r2((r.tax as number) + Number(i.tax_total));
                r.total = r2((r.total as number) + Number(i.total));
                r.paid = r2((r.paid as number) + Number(i.amount_paid));
                map.set(k, r);
            }
            columns = [{ key: 'month', label: 'Month' }, { key: 'currency', label: 'Currency' }, { key: 'invoices', label: 'Invoices', type: 'number' }, { key: 'net', label: 'Net revenue', type: 'money' }, { key: 'tax', label: 'Tax', type: 'money' }, { key: 'total', label: 'Total', type: 'money' }, { key: 'paid', label: 'Paid', type: 'money' }];
            rows = [...map.values()].sort((a, b) => String(a.month).localeCompare(String(b.month))) as Record<string, string | number>[];
        } else if (key === 'invoices' || key === 'outstanding') {
            const list = await this.prisma.invoice.findMany({
                where: { ...inv, ...(key === 'outstanding' ? { status: { in: OPEN_STATUSES }, amount_due: { gt: 0 } } : { status: { not: 'DRAFT' }, issue_date: { gte: from, lte: to } }) },
                orderBy: key === 'outstanding' ? { due_date: 'asc' } : { issue_date: 'asc' },
                select: { number: true, status: true, issue_date: true, due_date: true, currency: true, total: true, amount_paid: true, amount_due: true, company: { select: { name: true } } }, take: 5000,
            });
            columns = [{ key: 'number', label: 'Invoice' }, { key: 'customer', label: 'Customer' }, { key: 'status', label: 'Status' }, { key: 'issue_date', label: 'Issued', type: 'date' }, { key: 'due_date', label: 'Due', type: 'date' }, ...(key === 'outstanding' ? [{ key: 'days_overdue', label: 'Days overdue', type: 'number' as const }] : []), { key: 'currency', label: 'Currency' }, { key: 'total', label: 'Total', type: 'money' }, { key: 'amount_paid', label: 'Paid', type: 'money' }, { key: 'amount_due', label: 'Due', type: 'money' }];
            rows = list.map((i) => ({ number: i.number, customer: i.company?.name ?? '', status: i.status, issue_date: i.issue_date?.toISOString().slice(0, 10) ?? null, due_date: i.due_date?.toISOString().slice(0, 10) ?? null, days_overdue: i.due_date ? Math.max(0, Math.floor((today.getTime() - i.due_date.getTime()) / 86_400_000)) : 0, currency: i.currency, total: num(i.total), amount_paid: num(i.amount_paid), amount_due: num(i.amount_due) }));
        } else if (key === 'tax') {
            const lines = await this.prisma.invoiceLineItem.findMany({ where: { invoice: { ...inv, status: { notIn: ['DRAFT', 'VOID', 'CANCELLED'] }, issue_date: { gte: from, lte: to } } }, select: { tax_percent: true, net_amount: true, tax_amount: true, tax_rate: { select: { name: true } }, invoice: { select: { currency: true } } } });
            const map = new Map<string, Record<string, string | number>>();
            for (const l of lines) {
                const k = `${l.tax_rate?.name ?? `${l.tax_percent ?? 0}%`}|${l.invoice.currency}`;
                const r = map.get(k) ?? { rate: l.tax_rate?.name ?? `${Number(l.tax_percent ?? 0)}%`, percent: Number(l.tax_percent ?? 0), currency: l.invoice.currency, net: 0, tax: 0 };
                r.net = r2((r.net as number) + Number(l.net_amount));
                r.tax = r2((r.tax as number) + Number(l.tax_amount));
                map.set(k, r);
            }
            columns = [{ key: 'rate', label: 'Tax rate' }, { key: 'percent', label: '%', type: 'number' }, { key: 'currency', label: 'Currency' }, { key: 'net', label: 'Taxable amount', type: 'money' }, { key: 'tax', label: 'Tax', type: 'money' }];
            rows = [...map.values()];
        } else if (key === 'customers') {
            const g = await this.prisma.invoice.groupBy({ by: ['company_id', 'currency'], where: { ...inv, status: { notIn: ['DRAFT', 'VOID', 'CANCELLED'] }, issue_date: { gte: from, lte: to } }, _sum: { total: true, amount_paid: true, amount_due: true }, _count: { _all: true } });
            const names = await this.prisma.crmCompany.findMany({ where: { id: { in: g.map((x) => x.company_id) } }, select: { id: true, name: true } });
            columns = [{ key: 'customer', label: 'Customer' }, { key: 'currency', label: 'Currency' }, { key: 'invoices', label: 'Invoices', type: 'number' }, { key: 'invoiced', label: 'Invoiced', type: 'money' }, { key: 'paid', label: 'Paid', type: 'money' }, { key: 'outstanding', label: 'Outstanding', type: 'money' }];
            rows = g.map((x) => ({ customer: names.find((n) => n.id === x.company_id)?.name ?? 'Unknown', currency: x.currency, invoices: x._count._all, invoiced: num(x._sum.total), paid: num(x._sum.amount_paid), outstanding: num(x._sum.amount_due) })).sort((a, b) => (b.invoiced as number) - (a.invoiced as number));
        } else if (key === 'payments') {
            const list = await this.prisma.payment.findMany({ where: { organization_id: ctx.organization_id, received_at: { gte: from, lte: to } }, orderBy: { received_at: 'asc' }, take: 5000, select: { received_at: true, status: true, provider: true, method_type: true, reference: true, currency: true, amount: true, fee_amount: true, refunded_amount: true, billing_profile: { select: { legal_name: true } } } });
            columns = [{ key: 'date', label: 'Date', type: 'date' }, { key: 'customer', label: 'Customer' }, { key: 'status', label: 'Status' }, { key: 'provider', label: 'Provider' }, { key: 'method', label: 'Method' }, { key: 'reference', label: 'Reference' }, { key: 'currency', label: 'Currency' }, { key: 'amount', label: 'Amount', type: 'money' }, { key: 'fee', label: 'Fee', type: 'money' }, { key: 'refunded', label: 'Refunded', type: 'money' }];
            rows = list.map((p) => ({ date: p.received_at?.toISOString().slice(0, 10) ?? null, customer: p.billing_profile?.legal_name ?? '', status: p.status, provider: p.provider, method: p.method_type, reference: p.reference, currency: p.currency, amount: num(p.amount), fee: num(p.fee_amount), refunded: num(p.refunded_amount) }));
        } else if (key === 'subscriptions') {
            const list = await this.prisma.subscription.findMany({ where: { organization_id: ctx.organization_id }, orderBy: { created_at: 'asc' }, select: { status: true, currency: true, period_amount: true, interval: true, interval_count: true, started_at: true, cancelled_at: true, company: { select: { name: true } } } });
            columns = [{ key: 'customer', label: 'Customer' }, { key: 'status', label: 'Status' }, { key: 'interval', label: 'Billing' }, { key: 'currency', label: 'Currency' }, { key: 'period_amount', label: 'Per period', type: 'money' }, { key: 'mrr', label: 'MRR', type: 'money' }, { key: 'started', label: 'Started', type: 'date' }, { key: 'cancelled', label: 'Cancelled', type: 'date' }];
            rows = list.map((s) => ({ customer: s.company?.name ?? '', status: s.status, interval: `${s.interval_count > 1 ? `${s.interval_count} × ` : ''}${s.interval}`, currency: s.currency, period_amount: num(s.period_amount), mrr: ['ACTIVE', 'PAST_DUE'].includes(s.status) ? num(monthlyEquivalent(s.period_amount, s.interval, s.interval_count)) : 0, started: s.started_at?.toISOString().slice(0, 10) ?? null, cancelled: s.cancelled_at?.toISOString().slice(0, 10) ?? null }));
        }
        return { report: key, from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10), columns, rows };
    }

    async exportCsv(ctx: OrgContext, key: string, q: FinanceRange) {
        const r = await this.report(ctx, key, q);
        await this.audit.record(ctx, 'finance.report.exported', { resource_type: 'finance_report', metadata: { report: key, from: r.from, to: r.to, rows: r.rows.length, sensitive: true } });
        const esc = (v: unknown) => {
            const s = v === null || v === undefined ? '' : String(v);
            return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
        };
        return [r.columns.map((c) => esc(c.label)).join(','), ...r.rows.map((row) => r.columns.map((c) => esc(row[c.key])).join(','))].join('\n');
    }
}
