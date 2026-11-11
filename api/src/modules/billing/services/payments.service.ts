import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import {
    CreditNoteStatus, FinanceApprovalEntityType, InvoiceStatus, ModuleKey, PaymentMethodType, PaymentProvider, PaymentStatus, Prisma, RefundStatus,
} from 'generated/prisma';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import { AuditService } from '@/shared/audit/audit.service';
import { EventsService } from '@/shared/events/events.service';
import { OrgContext } from '@/shared/authorization/interfaces/org-context.interface';
import { orderBy, paginate, skipTake } from '@/shared/utils/pagination/pagination.utils';
import { NumberingService } from '@/modules/numbering/numbering.service';
import { FinanceApprovalsService } from '@/modules/finance-shared/finance-approvals.service';
import { computeVat, dec, max0, round2, sum, todayUtc, toDateOnly } from '@/modules/finance-shared/money.utils';
import { scopeFilter } from '@/modules/finance-shared/finance-scope.utils';
import { LedgerSyncService } from '@/modules/ledger/services/ledger-sync.service';
import { toMinor } from '@/integrations/payments/payment-provider.adapter';
import { InvoicesService, OPEN_STATUSES } from './invoices.service';
import { ProviderGatewayService } from './provider-gateway.service';
import { CreateCreditNoteDto, CreditNoteQuery, InvoicePaymentDto, PaymentQuery, RecordPaymentDto, RefundDto } from '../dto/billing.schemas';

const M = ModuleKey.FINANCE;
const READ = 'finance.payments.read';
const ALLOCATABLE: InvoiceStatus[] = [...OPEN_STATUSES];

/**
 * 08 "Payments" — manual and provider payments, allocation to invoices (partial and multi-invoice), refunds (through the
 * provider adapter when the payment was online) and credit notes. Every change recalculates the invoices and re-syncs the
 * 09 income records.
 */
@Injectable()
export class PaymentsService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly audit: AuditService,
        private readonly events: EventsService,
        private readonly numbering: NumberingService,
        private readonly approvals: FinanceApprovalsService,
        private readonly invoices: InvoicesService,
        private readonly gateway: ProviderGatewayService,
        private readonly ledger: LedgerSyncService,
    ) { }

    private scope(ctx: OrgContext): Prisma.PaymentWhereInput {
        const s = scopeFilter(ctx, READ, { company: 'company_id' });
        if (!('OR' in s) && !('id' in s)) return {};
        if ('id' in s) return { id: '__none__' };
        return { billing_profile: s as Prisma.BillingProfileWhereInput };
    }

    // --- Payments --------------------------------------------------------------------------------------------

    async findAll(ctx: OrgContext, q: PaymentQuery) {
        const and: Prisma.PaymentWhereInput[] = [this.scope(ctx)];
        if (q.search) and.push({ OR: [{ reference: { contains: q.search, mode: 'insensitive' } }, { provider_payment_id: { contains: q.search, mode: 'insensitive' } }, { billing_profile: { legal_name: { contains: q.search, mode: 'insensitive' } } }] });
        const where: Prisma.PaymentWhereInput = {
            organization_id: ctx.organization_id,
            AND: and,
            ...(q.status?.length && { status: { in: q.status } }),
            ...(q.provider && { provider: q.provider }),
            ...(q.billing_profile_id && { billing_profile_id: q.billing_profile_id }),
            ...(q.company_id && { billing_profile: { company_id: q.company_id } }),
            ...(q.unallocated && { allocations: { none: {} } }),
            ...((q.from || q.to) && { received_at: { ...(q.from && { gte: toDateOnly(q.from) }), ...(q.to && { lte: new Date(toDateOnly(q.to)!.getTime() + 86_399_999) }) } }),
        };
        const [items, total, totals] = await Promise.all([
            this.prisma.payment.findMany({
                where, ...skipTake(q), orderBy: [orderBy(q, ['received_at', 'amount', 'created_at'], 'created_at')],
                include: { billing_profile: { select: { id: true, legal_name: true, company_id: true } }, allocations: { include: { invoice: { select: { id: true, number: true } } } }, provider_connection: { select: { id: true, display_name: true } }, _count: { select: { refunds: true } } },
            }),
            this.prisma.payment.count({ where }),
            this.prisma.payment.aggregate({ where: { ...where, status: { in: [PaymentStatus.SUCCEEDED, PaymentStatus.PARTIALLY_REFUNDED] } }, _sum: { amount: true, fee_amount: true, refunded_amount: true } }),
        ]);
        return { ...paginate(items, total, q), totals: { amount: totals._sum.amount ?? 0, fees: totals._sum.fee_amount ?? 0, refunded: totals._sum.refunded_amount ?? 0 } };
    }

    async findOne(ctx: OrgContext, id: string) {
        const p = await this.prisma.payment.findFirst({
            where: { id, organization_id: ctx.organization_id, AND: [this.scope(ctx)] },
            include: {
                billing_profile: { select: { id: true, legal_name: true, company_id: true, billing_email: true, currency: true } },
                allocations: { include: { invoice: { select: { id: true, number: true, total: true, amount_due: true, status: true, currency: true } } } },
                refunds: { orderBy: { created_at: 'desc' } },
                disputes: { orderBy: { opened_at: 'desc' } },
                provider_connection: { select: { id: true, display_name: true, provider: true, capabilities: true } },
                payment_link: { select: { id: true, title: true } },
                origin_ledger_record: { select: { id: true, number: true } },
            },
        });
        if (!p) throw new NotFoundException({ message: 'Payment not found', code: 'payment_not_found' });
        const allocated = round2(sum(p.allocations.map((a) => a.amount)));
        const timeline = await this.prisma.auditEvent.findMany({ where: { organization_id: ctx.organization_id, resource_type: 'payment', resource_id: id }, orderBy: { created_at: 'desc' }, take: 50, select: { id: true, event_type: true, created_at: true, metadata: true, actor_user: { select: { display_name: true, first_name: true, last_name: true, email: true } } } });
        return { ...p, allocated_amount: allocated, unallocated_amount: round2(max0(dec(p.amount).minus(allocated))), refundable_amount: round2(max0(dec(p.amount).minus(p.refunded_amount))), timeline };
    }

    /** Record a manual / bank payment and allocate it to open invoices of the same customer and currency. */
    async record(ctx: OrgContext, dto: RecordPaymentDto) {
        const allocations = dto.allocations ?? [];
        const invoices = allocations.length ? await this.prisma.invoice.findMany({ where: { id: { in: allocations.map((a) => a.invoice_id) }, organization_id: ctx.organization_id } }) : [];
        if (invoices.length !== new Set(allocations.map((a) => a.invoice_id)).size) throw new NotFoundException({ message: 'Invoice not found', code: 'invoice_not_found' });
        const profileId = dto.billing_profile_id ?? invoices[0]?.billing_profile_id;
        if (!profileId) throw new BadRequestException({ message: 'Choose the customer or an invoice', code: 'payment_no_customer' });
        const profile = await this.prisma.billingProfile.findFirst({ where: { id: profileId, organization_id: ctx.organization_id } });
        if (!profile) throw new NotFoundException({ message: 'Billing profile not found', code: 'billing_profile_not_found' });
        const currency = dto.currency ?? invoices[0]?.currency ?? profile.currency;
        const amount = round2(dto.amount);
        this.validateAllocations(invoices, allocations, profile.id, currency, amount);
        for (const inv of invoices) if (!this.invoices.authorizedFor(ctx, 'finance.payments.record', inv)) throw new ForbiddenException({ message: 'Invoice outside your scope', code: 'out_of_scope' });

        // VAT portion for the ledger: proportional to the allocated invoices' tax.
        const taxAmount = dto.tax_amount ? round2(dto.tax_amount) : round2(sum(allocations.map((a) => {
            const inv = invoices.find((i) => i.id === a.invoice_id)!;
            return dec(inv.total).greaterThan(0) ? dec(inv.tax_total).times(a.amount).dividedBy(inv.total) : dec(0);
        })));
        const payment = await this.prisma.$transaction(async (tx) => {
            const p = await tx.payment.create({
                data: {
                    organization_id: ctx.organization_id, billing_profile_id: profile.id, provider: dto.provider ?? (dto.method_type === PaymentMethodType.BANK_TRANSFER ? PaymentProvider.BANK : PaymentProvider.MANUAL),
                    method_type: dto.method_type ?? PaymentMethodType.BANK_TRANSFER, status: PaymentStatus.SUCCEEDED, currency, amount, fee_amount: dec(dto.fee_amount ?? 0), tax_amount: taxAmount,
                    net_amount: round2(amount.minus(dec(dto.fee_amount ?? 0))), kind: dto.kind ?? (allocations.length ? 'invoice' : 'one_time'), reference: dto.reference ?? null,
                    received_at: dto.received_at ? toDateOnly(dto.received_at) : new Date(), recorded_by_user_id: ctx.user_id, metadata: dto.notes ? { notes: dto.notes } : undefined,
                    allocations: { create: allocations.map((a) => ({ invoice_id: a.invoice_id, amount: round2(a.amount) })) },
                },
            });
            for (const inv of invoices) await this.invoices.recalcPayments(tx, inv.id);
            return p;
        });
        await this.audit.record(ctx, 'finance.payment.recorded', { resource_type: 'payment', resource_id: payment.id, metadata: { amount: amount.toString(), currency, method: payment.method_type, reference: dto.reference, allocations, sensitive: true } });
        for (const inv of invoices) await this.audit.record(ctx, 'finance.invoice.payment_recorded', { resource_type: 'invoice', resource_id: inv.id, metadata: { payment_id: payment.id, amount: allocations.find((a) => a.invoice_id === inv.id)?.amount } });
        this.events.publish(ctx, {
            event_key: 'finance.payment.succeeded', module: M, entity_kind: 'payment', entity_id: payment.id, payload: { amount: amount.toString(), currency, invoice_ids: invoices.map((i) => i.id), provider: payment.provider },
            activity: { summary: `Payment of ${amount.toString()} ${currency} recorded${invoices.length ? ` for ${invoices.map((i) => i.number).join(', ')}` : ''}`, company_id: profile.company_id },
        });
        await this.ledger.syncPaymentSafe(ctx, payment.id);
        return this.findOne(ctx, payment.id);
    }

    /** Shortcut from the invoice: pay the amount due (or part of it). */
    async recordForInvoice(ctx: OrgContext, invoiceId: string, dto: InvoicePaymentDto) {
        const invoice = await this.invoices.getForWrite(ctx, invoiceId, 'finance.payments.record');
        if (!ALLOCATABLE.includes(invoice.status)) throw new ConflictException({ message: invoice.status === 'DRAFT' ? 'Approve or send the invoice before recording a payment' : `A ${invoice.status.toLowerCase()} invoice takes no payments`, code: 'invoice_not_open' });
        return this.record(ctx, {
            billing_profile_id: invoice.billing_profile_id, currency: invoice.currency, amount: dto.amount ?? invoice.amount_due.toString(), method_type: dto.method_type, received_at: dto.received_at,
            reference: dto.reference, fee_amount: dto.fee_amount, kind: 'invoice', allocations: [{ invoice_id: invoiceId, amount: dto.amount ?? invoice.amount_due.toString() }],
        });
    }

    /** Allocate the unallocated rest of a payment to more invoices. */
    async allocate(ctx: OrgContext, paymentId: string, allocations: { invoice_id: string; amount?: string }[]) {
        if (!ctx.can('finance.payments.record')) throw new ForbiddenException({ message: 'You do not have permission to do this (finance.payments.record)', code: 'permission_denied' });
        const p = await this.findOne(ctx, paymentId);
        if (p.status !== PaymentStatus.SUCCEEDED) throw new ConflictException({ message: 'Only successful payments can be allocated', code: 'payment_not_succeeded' });
        const invoices = await this.prisma.invoice.findMany({ where: { id: { in: allocations.map((a) => a.invoice_id) }, organization_id: ctx.organization_id } });
        if (invoices.length !== allocations.length) throw new NotFoundException({ message: 'Invoice not found', code: 'invoice_not_found' });
        if (p.allocations.some((a) => allocations.some((n) => n.invoice_id === a.invoice_id))) throw new ConflictException({ message: 'The payment is already allocated to one of these invoices', code: 'allocation_exists' });
        this.validateAllocations(invoices, allocations, p.billing_profile_id!, p.currency, dec(p.unallocated_amount));
        await this.prisma.$transaction(async (tx) => {
            await tx.paymentAllocation.createMany({ data: allocations.map((a) => ({ payment_id: paymentId, invoice_id: a.invoice_id, amount: round2(a.amount) })) });
            for (const inv of invoices) await this.invoices.recalcPayments(tx, inv.id);
        });
        await this.audit.record(ctx, 'finance.payment.allocated', { resource_type: 'payment', resource_id: paymentId, metadata: { allocations, sensitive: true } });
        this.events.publish(ctx, { event_key: 'finance.payment.allocated', module: M, entity_kind: 'payment', entity_id: paymentId, payload: { invoice_ids: invoices.map((i) => i.id) } });
        await this.ledger.syncPaymentSafe(ctx, paymentId);
        return this.findOne(ctx, paymentId);
    }

    private validateAllocations(invoices: { id: string; number: string; status: InvoiceStatus; billing_profile_id: string; currency: string; amount_due: Prisma.Decimal }[], allocations: { invoice_id: string; amount?: string }[], profileId: string, currency: string, available: Prisma.Decimal) {
        for (const a of allocations) {
            const inv = invoices.find((i) => i.id === a.invoice_id)!;
            if (inv.billing_profile_id !== profileId) throw new BadRequestException({ message: `Invoice ${inv.number} belongs to another customer`, code: 'allocation_customer_mismatch' });
            if (inv.currency !== currency) throw new BadRequestException({ message: `Invoice ${inv.number} is in ${inv.currency}`, code: 'allocation_currency_mismatch' });
            if (!ALLOCATABLE.includes(inv.status)) throw new ConflictException({ message: `Invoice ${inv.number} is ${inv.status.toLowerCase()} and takes no payments`, code: 'invoice_not_open' });
            if (dec(a.amount).greaterThan(dec(inv.amount_due).plus(0.005))) throw new BadRequestException({ message: `More than the ${inv.amount_due} due on ${inv.number}`, code: 'allocation_exceeds_due' });
        }
        if (sum(allocations.map((a) => a.amount)).greaterThan(available.plus(0.005))) throw new BadRequestException({ message: 'Allocations exceed the payment amount', code: 'allocation_exceeds_payment' });
    }

    // --- Refunds -------------------------------------------------------------------------------------------------

    /** Request a refund. With a matching REFUND approval rule it waits for finance.refunds.approve; otherwise it is processed now. */
    async refund(ctx: OrgContext, paymentId: string, dto: RefundDto) {
        const p = await this.findOne(ctx, paymentId);
        if (!([PaymentStatus.SUCCEEDED, PaymentStatus.PARTIALLY_REFUNDED] as PaymentStatus[]).includes(p.status)) throw new ConflictException({ message: 'Only successful payments can be refunded', code: 'payment_not_refundable' });
        const pendingTotal = sum(p.refunds.filter((r) => r.status === RefundStatus.PENDING).map((r) => r.amount));
        const amount = round2(dto.amount);
        if (amount.greaterThan(dec(p.refundable_amount).minus(pendingTotal).plus(0.005))) throw new BadRequestException({ message: `At most ${dec(p.refundable_amount).minus(pendingTotal).toFixed(2)} ${p.currency} can be refunded`, code: 'refund_exceeds_payment' });
        if (p.provider_connection_id && amount.lessThan(p.amount) && (p.provider_connection?.capabilities as Record<string, boolean> | null)?.partial_refunds === false) throw new ConflictException({ message: 'This provider does not support partial refunds', code: 'partial_refund_unsupported' });
        const rule = await this.approvals.matchRule(ctx.organization_id, FinanceApprovalEntityType.REFUND, { amount, currency: p.currency });
        const refund = await this.prisma.refund.create({ data: { payment_id: paymentId, amount, reason: dto.reason, status: RefundStatus.PENDING, requested_by_user_id: ctx.user_id } });
        await this.audit.record(ctx, 'finance.refund.requested', { resource_type: 'payment', resource_id: paymentId, metadata: { refund_id: refund.id, amount: amount.toString(), reason: dto.reason, needs_approval: !!rule, sensitive: true } });
        if (rule) {
            await this.approvals.request(ctx, FinanceApprovalEntityType.REFUND, refund.id, rule, { amount, currency: p.currency });
            this.events.publish(ctx, { event_key: 'finance.refund.approval_requested', module: M, entity_kind: 'refund', entity_id: refund.id, payload: { payment_id: paymentId, amount: amount.toString() } });
            return this.findOne(ctx, paymentId);
        }
        await this.processRefund(ctx, refund.id);
        return this.findOne(ctx, paymentId);
    }

    async approveRefund(ctx: OrgContext, refundId: string, approve: boolean, reason?: string | null) {
        const refund = await this.prisma.refund.findFirst({ where: { id: refundId, payment: { organization_id: ctx.organization_id } } });
        if (!refund) throw new NotFoundException({ message: 'Refund not found', code: 'refund_not_found' });
        if (refund.status !== RefundStatus.PENDING) throw new ConflictException({ message: 'This refund is not waiting for approval', code: 'refund_not_pending' });
        if (refund.requested_by_user_id && refund.requested_by_user_id === ctx.user_id) throw new ForbiddenException({ message: 'You requested this refund; another member has to approve it', code: 'approval_self_not_allowed' });
        const result = await this.approvals.decide(ctx, FinanceApprovalEntityType.REFUND, refundId, { approve, reason, require_distinct: false });
        await this.audit.record(ctx, approve ? 'finance.refund.approved' : 'finance.refund.rejected', { resource_type: 'payment', resource_id: refund.payment_id, metadata: { refund_id: refundId, reason, sensitive: true } });
        if (!approve) await this.prisma.refund.update({ where: { id: refundId }, data: { status: RefundStatus.CANCELLED } });
        else if (result.approved) await this.processRefund(ctx, refundId);
        return this.findOne(ctx, refund.payment_id);
    }

    /** Execute a refund: through the provider adapter for online payments, recorded directly for manual ones. */
    private async processRefund(ctx: OrgContext, refundId: string) {
        const refund = await this.prisma.refund.findUniqueOrThrow({ where: { id: refundId }, include: { payment: { include: { provider_connection: true } } } });
        const p = refund.payment;
        let status: RefundStatus = RefundStatus.SUCCEEDED;
        let providerRefundId: string | null = null;
        if (p.provider_connection && p.provider_payment_id) {
            try {
                const adapter = this.gateway.adapter(p.provider);
                const result = await adapter.refund(await this.gateway.credentials(p.provider_connection), p.provider_payment_id, toMinor(refund.amount.toString(), p.currency), refund.reason);
                providerRefundId = result.id;
                status = result.status === 'SUCCEEDED' ? RefundStatus.SUCCEEDED : result.status === 'FAILED' ? RefundStatus.FAILED : RefundStatus.PENDING;
            } catch (error) {
                await this.prisma.refund.update({ where: { id: refundId }, data: { status: RefundStatus.FAILED } });
                await this.audit.record(ctx, 'finance.refund.failed', { resource_type: 'payment', resource_id: p.id, outcome: 'FAILURE', metadata: { refund_id: refundId, error: (error as Error).message } });
                throw new BadRequestException({ message: `The provider refused the refund: ${(error as Error).message}`, code: 'refund_failed' });
            }
        }
        await this.applyRefund(ctx, refundId, status, providerRefundId);
    }

    /** Book a refund outcome (also used by the provider webhook). */
    async applyRefund(ctx: OrgContext, refundId: string, status: RefundStatus, providerRefundId: string | null) {
        const refund = await this.prisma.$transaction(async (tx) => {
            const r = await tx.refund.update({ where: { id: refundId }, data: { status, provider_refund_id: providerRefundId ?? undefined, processed_at: status === RefundStatus.SUCCEEDED ? new Date() : null } });
            if (status === RefundStatus.SUCCEEDED) {
                const p = await tx.payment.findUniqueOrThrow({ where: { id: r.payment_id }, include: { refunds: { where: { status: RefundStatus.SUCCEEDED } }, allocations: true } });
                const refunded = round2(sum(p.refunds.map((x) => x.amount)));
                await tx.payment.update({ where: { id: p.id }, data: { refunded_amount: refunded, status: refunded.greaterThanOrEqualTo(dec(p.amount).minus(0.005)) ? PaymentStatus.REFUNDED : PaymentStatus.PARTIALLY_REFUNDED } });
                for (const a of p.allocations) await this.invoices.recalcPayments(tx, a.invoice_id);
            }
            return r;
        });
        await this.audit.record(ctx, status === RefundStatus.SUCCEEDED ? 'finance.refund.succeeded' : 'finance.refund.updated', { resource_type: 'payment', resource_id: refund.payment_id, metadata: { refund_id: refundId, amount: refund.amount.toString(), status, sensitive: true } });
        this.events.publish(ctx, { event_key: status === RefundStatus.SUCCEEDED ? 'finance.payment.refunded' : 'finance.refund.updated', module: M, entity_kind: 'payment', entity_id: refund.payment_id, payload: { refund_id: refundId, amount: refund.amount.toString(), status } });
        await this.ledger.syncPaymentSafe(ctx, refund.payment_id);
    }

    async listRefunds(ctx: OrgContext, status?: RefundStatus) {
        return this.prisma.refund.findMany({
            where: { payment: { organization_id: ctx.organization_id, AND: [this.scope(ctx)] }, ...(status && { status }) },
            orderBy: { created_at: 'desc' }, take: 200,
            include: { payment: { select: { id: true, currency: true, amount: true, billing_profile: { select: { legal_name: true } } } } },
        });
    }

    // --- Credit notes ------------------------------------------------------------------------------------------------

    async listCreditNotes(ctx: OrgContext, q: CreditNoteQuery) {
        const where: Prisma.CreditNoteWhereInput = {
            organization_id: ctx.organization_id,
            invoice: { AND: [this.invoices.scope(ctx)] },
            ...(q.status?.length && { status: { in: q.status as CreditNoteStatus[] } }),
            ...(q.invoice_id && { invoice_id: q.invoice_id }),
            ...(q.search && { OR: [{ number: { contains: q.search, mode: 'insensitive' } }, { reason: { contains: q.search, mode: 'insensitive' } }, { billing_profile: { legal_name: { contains: q.search, mode: 'insensitive' } } }] }),
        };
        const [items, total] = await Promise.all([
            this.prisma.creditNote.findMany({ where, ...skipTake(q), orderBy: { created_at: 'desc' }, include: { invoice: { select: { id: true, number: true } }, billing_profile: { select: { id: true, legal_name: true } } } }),
            this.prisma.creditNote.count({ where }),
        ]);
        return paginate(items, total, q);
    }

    async createCreditNote(ctx: OrgContext, dto: CreateCreditNoteDto) {
        const invoice = await this.invoices.getForWrite(ctx, dto.invoice_id, 'finance.credit_notes.manage');
        if (invoice.status === InvoiceStatus.DRAFT || invoice.status === InvoiceStatus.VOID) throw new ConflictException({ message: 'Credit notes are issued against finalized invoices', code: 'invoice_not_final' });
        const lines = dto.lines?.length
            ? dto.lines.map((l) => {
                const v = computeVat({ net_amount: dec(l.quantity ?? 1).times(l.unit_amount), vat_percent: l.tax_percent ?? 0 });
                return { description: l.description, quantity: l.quantity ?? '1', unit_amount: l.unit_amount, tax_percent: v.vat_percent.toString(), net: v.net_amount, tax: v.vat_amount };
            })
            : (await this.prisma.invoiceLineItem.findMany({ where: { invoice_id: invoice.id }, orderBy: { sort_order: 'asc' } })).map((l) => ({ description: l.description, quantity: l.quantity.toString(), unit_amount: l.unit_amount.toString(), tax_percent: (l.tax_percent ?? 0).toString(), net: dec(l.net_amount), tax: dec(l.tax_amount) }));
        const subtotal = round2(sum(lines.map((l) => l.net)));
        const tax = round2(sum(lines.map((l) => l.tax)));
        const total = round2(subtotal.plus(tax));
        const already = sum((await this.prisma.creditNote.findMany({ where: { invoice_id: invoice.id, status: { in: [CreditNoteStatus.ISSUED, CreditNoteStatus.APPLIED, CreditNoteStatus.DRAFT] } }, select: { total: true } })).map((c) => c.total));
        if (total.plus(already).greaterThan(dec(invoice.total).plus(0.005))) throw new BadRequestException({ message: `Credits would exceed the invoice total (${invoice.total} ${invoice.currency})`, code: 'credit_exceeds_invoice' });
        const cn = await this.prisma.creditNote.create({
            data: {
                organization_id: ctx.organization_id, billing_profile_id: invoice.billing_profile_id, invoice_id: invoice.id, number: `DRAFT-CN-${Date.now().toString(36).toUpperCase()}`, currency: invoice.currency,
                subtotal, tax_total: tax, total, reason: dto.reason, created_by_user_id: ctx.user_id,
                lines: lines.map((l) => ({ description: l.description, quantity: l.quantity, unit_amount: l.unit_amount, tax_percent: l.tax_percent, amount: l.net.toString() })) as Prisma.InputJsonValue,
            },
        });
        await this.audit.record(ctx, 'finance.credit_note.created', { resource_type: 'invoice', resource_id: invoice.id, metadata: { credit_note_id: cn.id, total: total.toString(), reason: dto.reason, sensitive: true } });
        this.events.publish(ctx, { event_key: 'finance.credit_note.created', module: M, entity_kind: 'credit_note', entity_id: cn.id, payload: { invoice_id: invoice.id, total: total.toString() } });
        if (dto.issue) return this.creditNoteAction(ctx, cn.id, 'issue');
        return cn;
    }

    /** issue: number it; apply: reduce the invoice balance (and the 09 income); void: cancel. */
    async creditNoteAction(ctx: OrgContext, id: string, action: 'issue' | 'apply' | 'void') {
        const cn = await this.prisma.creditNote.findFirst({ where: { id, organization_id: ctx.organization_id } });
        if (!cn) throw new NotFoundException({ message: 'Credit note not found', code: 'credit_note_not_found' });
        if (cn.invoice_id) await this.invoices.getForWrite(ctx, cn.invoice_id, 'finance.credit_notes.manage');
        let updated;
        if (action === 'issue') {
            if (cn.status !== CreditNoteStatus.DRAFT) throw new ConflictException({ message: 'Only drafts can be issued', code: 'credit_note_not_draft' });
            updated = await this.prisma.$transaction(async (tx) => {
                const number = await this.numbering.next(tx, ctx.organization_id, 'credit_note', { prefix: 'CN' });
                return tx.creditNote.update({ where: { id }, data: { number, status: CreditNoteStatus.ISSUED, issued_at: new Date() } });
            });
        } else if (action === 'apply') {
            if (cn.status === CreditNoteStatus.DRAFT) throw new ConflictException({ message: 'Issue the credit note first', code: 'credit_note_not_issued' });
            if (cn.status !== CreditNoteStatus.ISSUED) throw new ConflictException({ message: 'Only issued credit notes can be applied', code: 'credit_note_not_issued' });
            updated = await this.prisma.$transaction(async (tx) => {
                const r = await tx.creditNote.update({ where: { id }, data: { status: CreditNoteStatus.APPLIED, applied_at: new Date() } });
                if (cn.invoice_id) await this.invoices.recalcPayments(tx, cn.invoice_id);
                return r;
            });
        } else {
            if (cn.status === CreditNoteStatus.VOID) throw new ConflictException({ message: 'Already void', code: 'credit_note_void' });
            updated = await this.prisma.$transaction(async (tx) => {
                const r = await tx.creditNote.update({ where: { id }, data: { status: CreditNoteStatus.VOID, voided_at: new Date() } });
                if (cn.invoice_id && cn.status === CreditNoteStatus.APPLIED) await this.invoices.recalcPayments(tx, cn.invoice_id);
                return r;
            });
        }
        await this.audit.record(ctx, `finance.credit_note.${action === 'issue' ? 'issued' : action === 'apply' ? 'applied' : 'voided'}`, { resource_type: 'invoice', resource_id: cn.invoice_id, metadata: { credit_note_id: id, number: updated.number, total: cn.total.toString(), sensitive: true } });
        this.events.publish(ctx, { event_key: `finance.credit_note.${action === 'issue' ? 'issued' : action === 'apply' ? 'applied' : 'voided'}`, module: M, entity_kind: 'credit_note', entity_id: id, payload: { number: updated.number, invoice_id: cn.invoice_id } });
        if (cn.invoice_id && action !== 'issue') await this.ledger.syncInvoiceSafe(ctx, cn.invoice_id);
        return updated;
    }

    // --- Provider events (webhooks) -----------------------------------------------------------------------------------------

    /** A provider checkout succeeded: create the payment once (idempotent on provider ids) and allocate it to its invoice. */
    async recordProviderPayment(ctx: OrgContext, input: { connection_id: string; provider: PaymentProvider; provider_payment_id: string | null; checkout_id: string | null; amount: Prisma.Decimal; currency: string; fee: Prisma.Decimal; invoice_id?: string | null; payment_link_id?: string | null; method_type?: PaymentMethodType }) {
        const existing = await this.prisma.payment.findFirst({
            where: { organization_id: ctx.organization_id, provider_connection_id: input.connection_id, OR: [...(input.provider_payment_id ? [{ provider_payment_id: input.provider_payment_id }] : []), ...(input.checkout_id ? [{ provider_checkout_id: input.checkout_id }] : [])] },
        });
        if (existing) return existing;
        const invoice = input.invoice_id ? await this.prisma.invoice.findFirst({ where: { id: input.invoice_id, organization_id: ctx.organization_id } }) : null;
        const link = input.payment_link_id ? await this.prisma.paymentLink.findFirst({ where: { id: input.payment_link_id, organization_id: ctx.organization_id } }) : null;
        const allocate = invoice && ALLOCATABLE.includes(invoice.status) ? Prisma.Decimal.min(input.amount, invoice.amount_due) : null;
        const payment = await this.prisma.$transaction(async (tx) => {
            const p = await tx.payment.create({
                data: {
                    organization_id: ctx.organization_id, billing_profile_id: invoice?.billing_profile_id ?? link?.billing_profile_id ?? null, provider: input.provider, provider_connection_id: input.connection_id,
                    provider_payment_id: input.provider_payment_id, provider_checkout_id: input.checkout_id, method_type: input.method_type ?? PaymentMethodType.CARD, status: PaymentStatus.SUCCEEDED,
                    currency: input.currency, amount: input.amount, fee_amount: input.fee, net_amount: round2(input.amount.minus(input.fee)),
                    tax_amount: invoice && dec(invoice.total).greaterThan(0) && allocate ? round2(dec(invoice.tax_total).times(allocate).dividedBy(invoice.total)) : 0,
                    kind: invoice ? 'invoice' : 'one_time', received_at: new Date(), payment_link_id: link?.id ?? null,
                    ...(allocate && allocate.greaterThan(0) && { allocations: { create: [{ invoice_id: invoice!.id, amount: allocate }] } }),
                },
            });
            if (invoice) {
                if (!invoice.provider_connection_id) await tx.invoice.update({ where: { id: invoice.id }, data: { provider_connection_id: input.connection_id } });
                await this.invoices.recalcPayments(tx, invoice.id);
            }
            if (link) {
                const uses = link.uses + 1;
                await tx.paymentLink.update({ where: { id: link.id }, data: { uses, ...((link.max_uses && uses >= link.max_uses) || link.invoice_id ? { status: 'COMPLETED', completed_at: new Date() } : {}) } });
            }
            return p;
        });
        await this.audit.record(ctx, 'finance.payment.recorded', { resource_type: 'payment', resource_id: payment.id, metadata: { amount: input.amount.toString(), currency: input.currency, provider: input.provider, invoice_id: invoice?.id ?? null, channel_source: 'webhook', sensitive: true } });
        this.events.publish(ctx, { event_key: 'finance.payment.succeeded', module: M, entity_kind: 'payment', entity_id: payment.id, payload: { amount: input.amount.toString(), currency: input.currency, invoice_ids: invoice ? [invoice.id] : [], provider: input.provider }, activity: invoice ? { summary: `Online payment received for ${invoice.number}`, company_id: invoice.company_id, customer_visible: true } : undefined });
        await this.ledger.syncPaymentSafe(ctx, payment.id);
        return payment;
    }

    /** Receipt data (printable in the app; the 17 PDF is generated from the same data). */
    async receipt(ctx: OrgContext, id: string) {
        const p = await this.findOne(ctx, id);
        const org = await this.prisma.organization.findUnique({ where: { id: ctx.organization_id }, select: { legal_name: true, display_name: true, logo_url: true, country: true } });
        return { payment: p, seller: org, issued_at: todayUtc() };
    }
}
