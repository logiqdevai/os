import { Injectable, Logger } from '@nestjs/common';
import {
    CreditNoteStatus, InvoiceStatus, LedgerRecordSource, LedgerRecordStatus, LedgerRecordType, LedgerSettlementKind, LedgerVatTreatment, ModuleKey, PaymentStatus,
    Prisma, ProductType, RefundStatus, TaxBehavior,
} from 'generated/prisma';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import { AuditService } from '@/shared/audit/audit.service';
import { EventsService } from '@/shared/events/events.service';
import { OrgContext } from '@/shared/authorization/interfaces/org-context.interface';
import { NumberingService } from '@/modules/numbering/numbering.service';
import { dec, max0, round2, sum } from '@/modules/finance-shared/money.utils';
import { LedgerConfigService } from './ledger-config.service';
import { LedgerRecordsService } from './ledger-records.service';

const PRODUCT_CATEGORY: Partial<Record<ProductType, string>> = {
    SERVICE: 'income.development',
    PACKAGE: 'income.development',
    DEVELOPMENT_HOURS: 'income.development',
    MAINTENANCE_PLAN: 'income.maintenance',
    SUPPORT_PLAN: 'income.support',
    SUBSCRIPTION: 'income.subscriptions',
    LICENSE: 'income.subscriptions',
    OTHER: 'income.other',
};

/**
 * 08 → 09 boundary (one source of truth): Billing owns invoices and payments; this service derives the income record of
 * each invoice (source INVOICE_SYNC, exactly one record per invoice row) and of payments not allocated to an invoice
 * (PAYMENT_SYNC). Billing calls it after every invoice / payment / refund / credit-note change. Amounts and settlements of
 * synced records are rebuilt from Billing each time, so they never drift; category and notes stay editable in 09.
 */
@Injectable()
export class LedgerSyncService {
    private readonly logger = new Logger(LedgerSyncService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly audit: AuditService,
        private readonly events: EventsService,
        private readonly numbering: NumberingService,
        private readonly config: LedgerConfigService,
        private readonly records: LedgerRecordsService,
    ) { }

    /** Never throws: a ledger hiccup must not fail the billing action; it is logged and retried on the next change. */
    async syncInvoiceSafe(ctx: OrgContext, invoiceId: string) {
        try {
            await this.syncInvoice(ctx, invoiceId);
        } catch (error) {
            this.logger.error(`ledger sync failed for invoice ${invoiceId}: ${(error as Error).message}`);
        }
    }

    async syncPaymentSafe(ctx: OrgContext, paymentId: string) {
        try {
            await this.syncPayment(ctx, paymentId);
        } catch (error) {
            this.logger.error(`ledger sync failed for payment ${paymentId}: ${(error as Error).message}`);
        }
    }

    async syncInvoice(ctx: OrgContext, invoiceId: string) {
        const settings = await this.config.settings(ctx.organization_id);
        if (!settings.auto_sync_invoices) return null;
        const invoice = await this.prisma.invoice.findFirst({
            where: { id: invoiceId, organization_id: ctx.organization_id },
            include: {
                company: { select: { name: true } },
                line_items: { include: { product: { select: { type: true } } }, orderBy: { sort_order: 'asc' } },
                allocations: { include: { payment: { include: { refunds: { where: { status: RefundStatus.SUCCEEDED } }, allocations: true } } } },
                credit_notes: { where: { status: CreditNoteStatus.APPLIED } },
                ledger_record: true,
            },
        });
        if (!invoice) return null;
        const existing = invoice.ledger_record;

        if (invoice.status === InvoiceStatus.DRAFT || invoice.status === InvoiceStatus.SCHEDULED) return existing;
        if (invoice.status === InvoiceStatus.VOID || invoice.status === InvoiceStatus.CANCELLED) {
            if (existing && existing.status !== LedgerRecordStatus.VOIDED) {
                const r = await this.prisma.ledgerRecord.update({ where: { id: existing.id }, data: { status: LedgerRecordStatus.VOIDED, voided_at: new Date(), void_reason: 'INVOICE_VOIDED', payment_status: 'CANCELLED' } });
                await this.audit.record(ctx, 'ledger.record.voided', { resource_type: 'ledger_record', resource_id: r.id, metadata: { reason: 'INVOICE_VOIDED', invoice_id: invoice.id } });
                return r;
            }
            return existing;
        }

        // Accrual amounts: invoice totals minus applied credit notes.
        const credited = invoice.credit_notes;
        const net = max0(round2(dec(invoice.subtotal).minus(invoice.discount_total).minus(sum(credited.map((c) => c.subtotal)))));
        const vat = max0(round2(dec(invoice.tax_total).minus(sum(credited.map((c) => c.tax_total)))));
        const gross = round2(net.plus(vat));
        const vatPercent = net.greaterThan(0) ? round2(vat.dividedBy(net).times(100)) : dec(0);

        const firstType = invoice.line_items.find((l) => l.product?.type)?.product?.type;
        const categoryKey = invoice.subscription_id ? 'income.subscriptions' : firstType ? PRODUCT_CATEGORY[firstType] ?? 'income.other' : 'income.development';
        const category = existing?.category_id ? null : await this.config.categoryByKey(ctx.organization_id, categoryKey);
        const reportingCurrency = await this.config.reportingCurrency(ctx.organization_id);

        const data = {
            description: `Invoice ${invoice.number}${invoice.company?.name ? ` — ${invoice.company.name}` : ''}`,
            reference_number: invoice.number,
            transaction_date: invoice.issue_date ?? new Date(),
            due_date: invoice.due_date,
            currency: invoice.currency,
            fx_rate: invoice.currency === reportingCurrency ? dec(1) : null,
            net_amount: net,
            vat_percent: vatPercent,
            vat_amount: vat,
            gross_amount: gross,
            reporting_gross_amount: invoice.currency === reportingCurrency ? gross : null,
            vat_treatment: vat.isZero() ? LedgerVatTreatment.ZERO_RATED : LedgerVatTreatment.STANDARD,
            pricing_mode: TaxBehavior.EXCLUSIVE,
            company_id: invoice.company_id,
            counterparty_name: invoice.company?.name ?? null,
            project_id: invoice.project_id,
            contract_id: invoice.contract_id,
            subscription_id: invoice.subscription_id,
            branch_id: invoice.branch_id,
            status: LedgerRecordStatus.POSTED,
        } satisfies Prisma.LedgerRecordUncheckedUpdateInput;

        const record = await this.prisma.$transaction(async (tx) => {
            let recordId = existing?.id;
            if (!existing) {
                const number = await this.numbering.next(tx, ctx.organization_id, 'ledger_income', { prefix: 'INC' });
                const created = await tx.ledgerRecord.create({
                    data: {
                        ...data,
                        organization_id: ctx.organization_id,
                        number,
                        type: LedgerRecordType.INCOME,
                        source: LedgerRecordSource.INVOICE_SYNC,
                        is_manual: false,
                        invoice_id: invoice.id,
                        category_id: category?.id ?? null,
                        category_path_snapshot: category?.name ?? null,
                        posted_at: new Date(),
                        period_id: await this.records.periodIdFor(ctx.organization_id, data.transaction_date, tx),
                        amount_remaining: gross,
                    },
                });
                recordId = created.id;
            } else {
                await tx.ledgerRecord.update({ where: { id: existing.id }, data: { ...data, voided_at: null, void_reason: null } });
            }
            // Settlements mirror allocations, refunds and write-offs (rebuilt every time: Billing is the source of truth).
            await tx.ledgerSettlement.deleteMany({ where: { record_id: recordId } });
            const rows: Prisma.LedgerSettlementCreateManyInput[] = [];
            for (const a of invoice.allocations) {
                if (a.payment.status !== PaymentStatus.SUCCEEDED && a.payment.status !== PaymentStatus.PARTIALLY_REFUNDED && a.payment.status !== PaymentStatus.REFUNDED) continue;
                rows.push({ record_id: recordId!, kind: LedgerSettlementKind.PAYMENT, amount: a.amount, currency: invoice.currency, settled_on: a.payment.received_at ?? a.created_at, payment_id: a.payment_id, reference: a.payment.reference });
                // Refunds of a payment split over several invoices are attributed pro rata to the allocation.
                const paymentTotal = sum(a.payment.allocations.map((x) => x.amount));
                for (const r of a.payment.refunds) {
                    const share = paymentTotal.greaterThan(0) ? round2(dec(r.amount).times(a.amount).dividedBy(paymentTotal)) : dec(r.amount);
                    if (share.greaterThan(0)) rows.push({ record_id: recordId!, kind: LedgerSettlementKind.REFUND, amount: share, currency: invoice.currency, settled_on: r.processed_at ?? r.created_at, payment_id: a.payment_id, refund_id: r.id, reference: r.reason });
                }
            }
            if (dec(invoice.written_off_amount).greaterThan(0)) {
                rows.push({ record_id: recordId!, kind: LedgerSettlementKind.WRITE_OFF, amount: invoice.written_off_amount, currency: invoice.currency, settled_on: invoice.uncollectible_at ?? new Date(), notes: invoice.uncollectible_reason });
            }
            if (rows.length) await tx.ledgerSettlement.createMany({ data: rows });
            return this.records.recomputePayment(tx, recordId!);
        });

        if (!existing) {
            await this.audit.record(ctx, 'ledger.record.created', { resource_type: 'ledger_record', resource_id: record.id, metadata: { source: 'INVOICE_SYNC', invoice_id: invoice.id, gross_amount: gross.toString() } });
            this.events.publish(ctx, { event_key: 'finance.income.created', module: ModuleKey.INCOME_EXPENSE, entity_kind: 'ledger_record', entity_id: record.id, payload: { number: record.number, invoice_id: invoice.id, source: 'INVOICE_SYNC' } });
        } else {
            await this.audit.record(ctx, 'ledger.record.synced', { resource_type: 'ledger_record', resource_id: record.id, metadata: { invoice_id: invoice.id, payment_status: record.payment_status, gross_amount: gross.toString() } });
        }
        return record;
    }

    /** Payments not allocated to an invoice become their own income record; processing fees become an expense. */
    async syncPayment(ctx: OrgContext, paymentId: string) {
        const settings = await this.config.settings(ctx.organization_id);
        if (!settings.auto_sync_payments) return null;
        const payment = await this.prisma.payment.findFirst({
            where: { id: paymentId, organization_id: ctx.organization_id },
            include: { allocations: { select: { invoice_id: true } }, refunds: { where: { status: RefundStatus.SUCCEEDED } }, origin_ledger_record: true, billing_profile: { select: { company_id: true, legal_name: true } } },
        });
        if (!payment) return null;
        for (const a of payment.allocations) await this.syncInvoice(ctx, a.invoice_id);

        const succeeded = payment.status === PaymentStatus.SUCCEEDED || payment.status === PaymentStatus.PARTIALLY_REFUNDED || payment.status === PaymentStatus.REFUNDED;
        const existing = payment.origin_ledger_record;
        if (payment.allocations.length || !succeeded) {
            if (existing && existing.status !== LedgerRecordStatus.VOIDED) {
                await this.prisma.ledgerRecord.update({ where: { id: existing.id }, data: { status: LedgerRecordStatus.VOIDED, voided_at: new Date(), void_reason: payment.allocations.length ? 'PAYMENT_ALLOCATED' : 'PAYMENT_NOT_SUCCEEDED', payment_status: 'CANCELLED' } });
            }
        } else {
            const gross = round2(payment.amount);
            const vat = round2(payment.tax_amount);
            const net = round2(gross.minus(vat));
            const received = payment.received_at ?? payment.created_at;
            const category = existing?.category_id ? null : await this.config.categoryByKey(ctx.organization_id, 'income.other');
            const record = await this.prisma.$transaction(async (tx) => {
                const base = {
                    description: `Payment ${payment.reference ?? payment.provider_payment_id ?? payment.id.slice(0, 8)}`,
                    reference_number: payment.reference ?? payment.provider_payment_id,
                    transaction_date: received,
                    currency: payment.currency,
                    net_amount: net, vat_amount: vat, gross_amount: gross,
                    vat_percent: net.greaterThan(0) ? round2(vat.dividedBy(net).times(100)) : dec(0),
                    company_id: payment.billing_profile?.company_id ?? null,
                    counterparty_name: payment.billing_profile?.legal_name ?? null,
                    status: LedgerRecordStatus.POSTED,
                };
                let id = existing?.id;
                if (!existing) {
                    const number = await this.numbering.next(tx, ctx.organization_id, 'ledger_income', { prefix: 'INC' });
                    const created = await tx.ledgerRecord.create({
                        data: { ...base, organization_id: ctx.organization_id, number, type: 'INCOME', source: LedgerRecordSource.PAYMENT_SYNC, is_manual: false, origin_payment_id: payment.id, category_id: category?.id ?? null, category_path_snapshot: category?.name ?? null, posted_at: new Date(), amount_remaining: gross, period_id: await this.records.periodIdFor(ctx.organization_id, received, tx) },
                    });
                    id = created.id;
                } else {
                    await tx.ledgerRecord.update({ where: { id: existing.id }, data: { ...base, voided_at: null, void_reason: null } });
                }
                await tx.ledgerSettlement.deleteMany({ where: { record_id: id } });
                await tx.ledgerSettlement.createMany({
                    data: [
                        { record_id: id!, kind: LedgerSettlementKind.PAYMENT, amount: gross, currency: payment.currency, settled_on: received, payment_id: payment.id, reference: payment.reference },
                        ...payment.refunds.map((r) => ({ record_id: id!, kind: LedgerSettlementKind.REFUND, amount: r.amount, currency: payment.currency, settled_on: r.processed_at ?? r.created_at, payment_id: payment.id, refund_id: r.id })),
                    ],
                });
                return this.records.recomputePayment(tx, id!);
            });
            if (!existing) await this.audit.record(ctx, 'ledger.record.created', { resource_type: 'ledger_record', resource_id: record.id, metadata: { source: 'PAYMENT_SYNC', payment_id: payment.id } });
        }

        // Processing fees → one expense per payment (idempotent through metadata.fee_for_payment_id).
        if (succeeded && dec(payment.fee_amount).greaterThan(0)) {
            const already = await this.prisma.ledgerRecord.findFirst({ where: { organization_id: ctx.organization_id, type: 'EXPENSE', metadata: { path: ['fee_for_payment_id'], equals: payment.id } }, select: { id: true } });
            if (!already) {
                const category = await this.config.categoryByKey(ctx.organization_id, 'expense.fees');
                const received = payment.received_at ?? payment.created_at;
                await this.prisma.$transaction(async (tx) => {
                    const number = await this.numbering.next(tx, ctx.organization_id, 'ledger_expense', { prefix: 'EXP' });
                    const created = await tx.ledgerRecord.create({
                        data: {
                            organization_id: ctx.organization_id, number, type: 'EXPENSE', status: 'POSTED', source: LedgerRecordSource.PAYMENT_SYNC, is_manual: false,
                            description: `Payment processing fee (${payment.provider})`, reference_number: payment.provider_payment_id, transaction_date: received, currency: payment.currency,
                            net_amount: payment.fee_amount, vat_amount: 0, vat_percent: 0, gross_amount: payment.fee_amount, vat_treatment: 'OUT_OF_SCOPE', amount_remaining: 0,
                            category_id: category?.id ?? null, category_path_snapshot: category?.name ?? null, posted_at: new Date(), metadata: { fee_for_payment_id: payment.id },
                            period_id: await this.records.periodIdFor(ctx.organization_id, received, tx),
                        },
                    });
                    await tx.ledgerSettlement.create({ data: { record_id: created.id, kind: 'PAYMENT', amount: payment.fee_amount, currency: payment.currency, settled_on: received, payment_id: payment.id } });
                    await this.records.recomputePayment(tx, created.id);
                });
            }
        }
        return null;
    }
}
