import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { randomBytes } from 'crypto';
import {
    CreditNoteStatus, DunningAction, FinanceApprovalEntityType, Invoice, InvoiceStatus, ModuleKey, PaymentStatus, Prisma, RefundStatus, TaxBehavior,
} from 'generated/prisma';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import { AuditService } from '@/shared/audit/audit.service';
import { EventsService } from '@/shared/events/events.service';
import { OrgContext } from '@/shared/authorization/interfaces/org-context.interface';
import { orderBy, paginate, skipTake } from '@/shared/utils/pagination/pagination.utils';
import { NumberingService } from '@/modules/numbering/numbering.service';
import { FinanceApprovalsService } from '@/modules/finance-shared/finance-approvals.service';
import { addDays, computeInvoiceTotals, computeLine, dec, max0, round2, sum, todayUtc, toDateOnly } from '@/modules/finance-shared/money.utils';
import { scopeFilter } from '@/modules/finance-shared/finance-scope.utils';
import { LedgerSyncService } from '@/modules/ledger/services/ledger-sync.service';
import { CatalogService } from './catalog.service';
import { CreateInvoiceDto, InvoiceLineDto, InvoiceQuery, SendInvoiceDto, UpdateInvoiceDto } from '../dto/billing.schemas';

const READ = 'finance.invoices.read';
const M = ModuleKey.FINANCE;
export const OPEN_STATUSES: InvoiceStatus[] = [InvoiceStatus.OPEN, InvoiceStatus.PENDING, InvoiceStatus.PARTIALLY_PAID, InvoiceStatus.OVERDUE];

export const INVOICE_LIST_INCLUDE = {
    company: { select: { id: true, name: true } },
    billing_profile: { select: { id: true, legal_name: true, billing_email: true } },
    project: { select: { id: true, name: true } },
    _count: { select: { line_items: true } },
} satisfies Prisma.InvoiceInclude;

/**
 * 08 "Invoicing" — draft → approve (separation of duties when a FinanceApprovalRule applies) → send → paid / partially paid /
 * overdue / void. Numbers are allocated gap-free when the invoice is finalized (approve or send), drafts carry a DRAFT-… id.
 * Every state change re-derives the 09 income record through LedgerSyncService (one source of truth).
 */
@Injectable()
export class InvoicesService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly audit: AuditService,
        private readonly events: EventsService,
        private readonly numbering: NumberingService,
        private readonly approvals: FinanceApprovalsService,
        private readonly catalog: CatalogService,
        private readonly ledger: LedgerSyncService,
    ) { }

    scope(ctx: OrgContext, key = READ): Prisma.InvoiceWhereInput {
        return scopeFilter(ctx, key, { branch: 'branch_id', company: 'company_id', project: 'project_id' }) as Prisma.InvoiceWhereInput;
    }

    // --- Queries ---------------------------------------------------------------------------------------------

    async findAll(ctx: OrgContext, q: InvoiceQuery) {
        const and: Prisma.InvoiceWhereInput[] = [this.scope(ctx)];
        if (q.search) and.push({ OR: [{ number: { contains: q.search, mode: 'insensitive' } }, { company: { name: { contains: q.search, mode: 'insensitive' } } }, { billing_profile: { legal_name: { contains: q.search, mode: 'insensitive' } } }] });
        const where: Prisma.InvoiceWhereInput = {
            organization_id: ctx.organization_id,
            AND: and,
            ...(q.status?.length && { status: { in: q.status } }),
            ...(q.overdue && { status: InvoiceStatus.OVERDUE }),
            ...(q.company_id && { company_id: q.company_id }),
            ...(q.billing_profile_id && { billing_profile_id: q.billing_profile_id }),
            ...(q.project_id && { project_id: q.project_id }),
            ...(q.subscription_id && { subscription_id: q.subscription_id }),
            ...(q.needs_approval && { status: InvoiceStatus.DRAFT, approved_at: null }),
            ...((q.from || q.to) && { issue_date: { ...(q.from && { gte: toDateOnly(q.from) }), ...(q.to && { lte: toDateOnly(q.to) }) } }),
        };
        const [items, total, summary] = await Promise.all([
            this.prisma.invoice.findMany({ where, ...skipTake(q), orderBy: [orderBy(q, ['created_at', 'issue_date', 'due_date', 'total', 'amount_due', 'number'], 'created_at'), { created_at: 'desc' }], include: INVOICE_LIST_INCLUDE }),
            this.prisma.invoice.count({ where }),
            this.prisma.invoice.groupBy({ by: ['status'], where: { organization_id: ctx.organization_id, AND: [this.scope(ctx)] }, _sum: { amount_due: true, total: true }, _count: { _all: true } }),
        ]);
        return { ...paginate(items, total, q), summary: summary.map((s) => ({ status: s.status, count: s._count._all, amount_due: s._sum.amount_due ?? 0, total: s._sum.total ?? 0 })) };
    }

    async findOne(ctx: OrgContext, idOrNumber: string) {
        const isUuid = /^[0-9a-f-]{36}$/i.test(idOrNumber);
        const invoice = await this.prisma.invoice.findFirst({
            where: { organization_id: ctx.organization_id, ...(isUuid ? { id: idOrNumber } : { number: idOrNumber }), AND: [this.scope(ctx)] },
            include: {
                ...INVOICE_LIST_INCLUDE,
                billing_profile: { select: { id: true, legal_name: true, billing_email: true, billing_address: true, vat_number: true, tax_id: true, payment_terms_days: true, reverse_charge: true, currency: true } },
                line_items: { orderBy: { sort_order: 'asc' }, include: { tax_rate: { select: { id: true, name: true, percentage: true, behavior: true, invoice_note: true } }, product: { select: { id: true, name: true, type: true } } } },
                allocations: { include: { payment: { select: { id: true, amount: true, currency: true, status: true, method_type: true, provider: true, reference: true, received_at: true, refunded_amount: true } } }, orderBy: { created_at: 'asc' } },
                credit_notes: { orderBy: { created_at: 'asc' }, select: { id: true, number: true, status: true, total: true, currency: true, reason: true, issued_at: true, applied_at: true } },
                reminders: { orderBy: { sent_at: 'desc' } },
                payment_links: { where: { status: 'ACTIVE' }, select: { id: true, url: true, title: true, status: true, provider_connection_id: true, created_at: true } },
                coupon: { select: { id: true, name: true, code: true, type: true, value: true } },
                subscription: { select: { id: true, status: true } },
                contract: { select: { id: true, title: true } },
                branch: { select: { id: true, name: true } },
                provider_connection: { select: { id: true, display_name: true, provider: true } },
                revises: { select: { id: true, number: true } },
                revised_by: { select: { id: true, number: true } },
                ledger_record: { select: { id: true, number: true, payment_status: true } },
            },
        });
        if (!invoice) throw new NotFoundException({ message: 'Invoice not found', code: 'invoice_not_found' });
        const [timeline, approvals, rule, org, creator, approver] = await Promise.all([
            this.prisma.auditEvent.findMany({
                where: { organization_id: ctx.organization_id, resource_type: 'invoice', resource_id: invoice.id },
                orderBy: { created_at: 'desc' }, take: 100,
                select: { id: true, event_type: true, created_at: true, metadata: true, actor_type: true, actor_user: { select: { id: true, email: true, display_name: true, first_name: true, last_name: true } } },
            }),
            this.approvals.history(ctx.organization_id, FinanceApprovalEntityType.INVOICE, invoice.id),
            invoice.status === InvoiceStatus.DRAFT ? this.approvals.matchRule(ctx.organization_id, FinanceApprovalEntityType.INVOICE, { amount: invoice.total, currency: invoice.currency, branch_id: invoice.branch_id }) : null,
            this.prisma.organization.findUnique({ where: { id: ctx.organization_id }, select: { legal_name: true, display_name: true, logo_url: true, country: true, default_currency: true } }),
            invoice.created_by_user_id ? this.prisma.user.findUnique({ where: { id: invoice.created_by_user_id }, select: { id: true, email: true, display_name: true, first_name: true, last_name: true } }) : null,
            invoice.approved_by_user_id ? this.prisma.user.findUnique({ where: { id: invoice.approved_by_user_id }, select: { id: true, email: true, display_name: true, first_name: true, last_name: true } }) : null,
        ]);
        const credited = sum(invoice.credit_notes.filter((c) => c.status === CreditNoteStatus.APPLIED).map((c) => c.total));
        return {
            ...invoice,
            credited_amount: round2(credited),
            created_by: creator,
            approved_by: approver,
            approval: { required: !!rule || approvals.some((a) => a.decision === 'PENDING'), rule: rule ? { id: rule.id, name: rule.name, require_distinct_user: rule.require_distinct_user } : null, history: approvals, approved: !!invoice.approved_at },
            seller: org,
            timeline,
        };
    }

    // --- Draft editing ---------------------------------------------------------------------------------------------

    async create(ctx: OrgContext, dto: CreateInvoiceDto, opts: { tx?: Prisma.TransactionClient } = {}) {
        const profile = await this.prisma.billingProfile.findFirst({ where: { id: dto.billing_profile_id, organization_id: ctx.organization_id }, include: { company: { select: { id: true, name: true } } } });
        if (!profile) throw new NotFoundException({ message: 'Billing profile not found', code: 'billing_profile_not_found' });
        if (!this.authorizedFor(ctx, 'finance.invoices.create', { company_id: profile.company_id, project_id: dto.project_id, branch_id: dto.branch_id })) throw new ForbiddenException({ message: 'This customer or project is outside your scope', code: 'out_of_scope' });
        await this.assertRefs(ctx, dto);
        const currency = dto.currency ?? profile.currency;
        const template = dto.template_id ? await this.prisma.invoiceTemplate.findFirst({ where: { id: dto.template_id, organization_id: ctx.organization_id } }) : await this.prisma.invoiceTemplate.findFirst({ where: { organization_id: ctx.organization_id, is_default: true, archived_at: null } });
        const issue = toDateOnly(dto.issue_date);
        const terms = template?.payment_terms_days ?? profile.payment_terms_days;
        const priced = await this.priceLines(ctx, dto.lines, profile.reverse_charge || profile.tax_exempt);
        const coupon = await this.catalog.usableCoupon(ctx, dto.coupon_id, currency);
        const totals = computeInvoiceTotals(priced.map((l) => ({ ...l.amounts, tax_percent: l.tax_percent })), coupon ? { type: coupon.type, value: coupon.value } : null);

        const run = async (tx: Prisma.TransactionClient) =>
            tx.invoice.create({
                data: {
                    organization_id: ctx.organization_id, number: `DRAFT-${randomBytes(4).toString('hex').toUpperCase()}`, status: InvoiceStatus.DRAFT,
                    billing_profile_id: profile.id, company_id: profile.company_id, project_id: dto.project_id ?? null, contract_id: dto.contract_id ?? null, subscription_id: dto.subscription_id ?? null,
                    branch_id: dto.branch_id ?? null, billing_model: dto.billing_model ?? null, currency, issue_date: issue,
                    due_date: dto.due_date ? toDateOnly(dto.due_date) : issue ? addDays(issue, terms) : null,
                    period_start: toDateOnly(dto.period_start), period_end: toDateOnly(dto.period_end), coupon_id: coupon?.id ?? null,
                    collection_method: dto.collection_method, accepted_methods: dto.accepted_methods, notes: dto.notes ?? template?.default_notes ?? null,
                    payment_instructions: dto.payment_instructions ?? template?.payment_instructions ?? null, footer: dto.footer ?? template?.default_footer ?? null,
                    template_id: template?.id ?? null, provider_connection_id: dto.provider_connection_id ?? null, scheduled_send_at: dto.scheduled_send_at ? new Date(dto.scheduled_send_at) : null,
                    is_recurring: !!dto.subscription_id, created_by_user_id: ctx.user_id,
                    ...totals, amount_paid: 0, amount_due: totals.total,
                    line_items: { create: priced.map((l, i) => ({ ...l.data, sort_order: i })) },
                },
            });
        const invoice = opts.tx ? await run(opts.tx) : await this.prisma.$transaction(run);
        await this.audit.record(ctx, 'finance.invoice.created', { resource_type: 'invoice', resource_id: invoice.id, branch_id: invoice.branch_id, metadata: { total: invoice.total.toString(), currency, lines: dto.lines.length, company_id: profile.company_id } });
        this.events.publish(ctx, {
            event_key: 'finance.invoice.created', module: M, entity_kind: 'invoice', entity_id: invoice.id, payload: { number: invoice.number, total: invoice.total.toString(), currency, company_id: invoice.company_id },
            activity: { summary: `Draft invoice created for ${profile.company?.name ?? profile.legal_name}`, entity_label: invoice.number, company_id: invoice.company_id, project_id: invoice.project_id, branch_id: invoice.branch_id },
        });
        return invoice;
    }

    async update(ctx: OrgContext, id: string, dto: UpdateInvoiceDto) {
        const before = await this.getForWrite(ctx, id, 'finance.invoices.update');
        if (before.status !== InvoiceStatus.DRAFT) throw new ConflictException({ message: 'Only draft invoices can be edited; create a credit note or a revision instead', code: 'invoice_not_draft' });
        await this.assertRefs(ctx, dto);
        const profile = await this.prisma.billingProfile.findUniqueOrThrow({ where: { id: before.billing_profile_id } });
        const currency = dto.currency ?? before.currency;
        const data: Prisma.InvoiceUncheckedUpdateInput = {
            ...(dto.project_id !== undefined && { project_id: dto.project_id }),
            ...(dto.contract_id !== undefined && { contract_id: dto.contract_id }),
            ...(dto.branch_id !== undefined && { branch_id: dto.branch_id }),
            ...(dto.billing_model !== undefined && { billing_model: dto.billing_model }),
            ...(dto.currency && { currency }),
            ...(dto.issue_date !== undefined && { issue_date: toDateOnly(dto.issue_date) }),
            ...(dto.due_date !== undefined && { due_date: toDateOnly(dto.due_date) }),
            ...(dto.period_start !== undefined && { period_start: toDateOnly(dto.period_start) }),
            ...(dto.period_end !== undefined && { period_end: toDateOnly(dto.period_end) }),
            ...(dto.collection_method && { collection_method: dto.collection_method }),
            ...(dto.accepted_methods && { accepted_methods: dto.accepted_methods }),
            ...(dto.notes !== undefined && { notes: dto.notes }),
            ...(dto.payment_instructions !== undefined && { payment_instructions: dto.payment_instructions }),
            ...(dto.footer !== undefined && { footer: dto.footer }),
            ...(dto.template_id !== undefined && { template_id: dto.template_id }),
            ...(dto.provider_connection_id !== undefined && { provider_connection_id: dto.provider_connection_id }),
            ...(dto.scheduled_send_at !== undefined && { scheduled_send_at: dto.scheduled_send_at ? new Date(dto.scheduled_send_at) : null }),
            ...(dto.coupon_id !== undefined && { coupon_id: dto.coupon_id }),
            // Any change invalidates an earlier approval.
            approved_at: null,
            approved_by_user_id: null,
        };
        if (dto.issue_date && dto.due_date === undefined && !before.due_date) data.due_date = addDays(toDateOnly(dto.issue_date)!, profile.payment_terms_days);
        const invoice = await this.prisma.$transaction(async (tx) => {
            if (dto.lines) {
                const priced = await this.priceLines(ctx, dto.lines, profile.reverse_charge || profile.tax_exempt);
                await tx.invoiceLineItem.deleteMany({ where: { invoice_id: id } });
                await tx.invoiceLineItem.createMany({ data: priced.map((l, i) => ({ ...l.data, invoice_id: id, sort_order: i })) });
            }
            await tx.invoice.update({ where: { id }, data });
            return this.retotal(ctx, tx, id);
        });
        await this.approvals.cancel(ctx.organization_id, FinanceApprovalEntityType.INVOICE, id);
        await this.audit.record(ctx, 'finance.invoice.updated', { resource_type: 'invoice', resource_id: id, branch_id: invoice.branch_id, metadata: { before: { total: before.total.toString(), due_date: before.due_date, currency: before.currency }, after: { ...dto, lines: dto.lines?.length, total: invoice.total.toString() }, sensitive: true } });
        this.events.publish(ctx, { event_key: 'finance.invoice.updated', module: M, entity_kind: 'invoice', entity_id: id, payload: { number: invoice.number, total: invoice.total.toString() } });
        return invoice;
    }

    async remove(ctx: OrgContext, id: string) {
        const before = await this.getForWrite(ctx, id, 'finance.invoices.delete');
        if (before.status !== InvoiceStatus.DRAFT) throw new ConflictException({ message: 'Only drafts can be deleted; void a finalized invoice instead', code: 'invoice_not_draft' });
        await this.approvals.cancel(ctx.organization_id, FinanceApprovalEntityType.INVOICE, id);
        await this.prisma.invoice.delete({ where: { id } });
        await this.audit.record(ctx, 'finance.invoice.deleted', { resource_type: 'invoice', resource_id: id, metadata: { number: before.number, total: before.total.toString(), sensitive: true } });
        this.events.publish(ctx, { event_key: 'finance.invoice.deleted', module: M, entity_kind: 'invoice', entity_id: id, payload: { number: before.number } });
        return { success: true };
    }

    /** Copy an invoice (any status) into a new draft. `revise` links it as a revision and voids the original on finalize. */
    async duplicate(ctx: OrgContext, id: string) {
        const src = await this.findOne(ctx, id);
        return this.create(ctx, {
            billing_profile_id: src.billing_profile_id, project_id: src.project_id, contract_id: src.contract_id, branch_id: src.branch_id, billing_model: src.billing_model, currency: src.currency,
            coupon_id: null, collection_method: src.collection_method, accepted_methods: src.accepted_methods, notes: src.notes, payment_instructions: src.payment_instructions, footer: src.footer, template_id: src.template_id,
            lines: src.line_items.map((l) => ({
                product_id: l.product_id, price_id: l.price_id, description: l.description, quantity: l.quantity.toString(), unit: l.unit, unit_amount: l.unit_amount.toString(),
                discount_amount: l.discount_amount.toString(), tax_rate_id: l.tax_rate_id, tax_percent: l.tax_rate_id ? null : l.tax_percent?.toString() ?? null,
            })),
        });
    }

    // --- Lifecycle -------------------------------------------------------------------------------------------------

    async approve(ctx: OrgContext, id: string, comment?: string | null) {
        const invoice = await this.getForWrite(ctx, id, 'finance.invoices.approve');
        if (invoice.status !== InvoiceStatus.DRAFT) throw new ConflictException({ message: 'Only draft invoices are approved', code: 'invoice_not_draft' });
        if (dec(invoice.total).lessThan(0)) throw new BadRequestException({ message: 'The invoice total cannot be negative', code: 'invoice_negative' });
        const rule = await this.approvals.matchRule(ctx.organization_id, FinanceApprovalEntityType.INVOICE, { amount: invoice.total, currency: invoice.currency, branch_id: invoice.branch_id });
        // Separation of duties (01 §96): when the organization's rule requires it, the approver is not the creator.
        if ((rule?.require_distinct_user ?? false) && invoice.created_by_user_id && invoice.created_by_user_id === ctx.user_id) {
            throw new ForbiddenException({ message: 'You created this invoice; another member has to approve it (separation of duties)', code: 'approval_self_not_allowed' });
        }
        const pending = await this.approvals.pending(ctx.organization_id, FinanceApprovalEntityType.INVOICE, id);
        if (!pending.length) await this.approvals.request(ctx, FinanceApprovalEntityType.INVOICE, id, rule, { amount: invoice.total, currency: invoice.currency, branch_id: invoice.branch_id });
        const result = await this.approvals.decide(ctx, FinanceApprovalEntityType.INVOICE, id, { approve: true, comment, require_distinct: false });
        if (!result.approved) {
            await this.audit.record(ctx, 'finance.invoice.approval_step', { resource_type: 'invoice', resource_id: id, metadata: { step: result.step, comment, sensitive: true } });
            return this.findOne(ctx, id);
        }
        const updated = await this.prisma.$transaction(async (tx) => {
            await tx.invoice.update({ where: { id }, data: { approved_by_user_id: ctx.user_id, approved_at: new Date() } });
            return this.finalize(ctx, tx, id);
        });
        await this.audit.record(ctx, 'finance.invoice.approved', { resource_type: 'invoice', resource_id: id, branch_id: updated.branch_id, metadata: { number: updated.number, total: updated.total.toString(), comment, rule_id: rule?.id ?? null, sensitive: true } });
        this.events.publish(ctx, { event_key: 'finance.invoice.approved', module: M, entity_kind: 'invoice', entity_id: id, payload: { number: updated.number, total: updated.total.toString() }, activity: { summary: `Invoice ${updated.number} approved`, entity_label: updated.number, company_id: updated.company_id, project_id: updated.project_id } });
        await this.ledger.syncInvoiceSafe(ctx, id);
        return this.findOne(ctx, id);
    }

    async reject(ctx: OrgContext, id: string, reason: string) {
        const invoice = await this.getForWrite(ctx, id, 'finance.invoices.approve');
        if (invoice.status !== InvoiceStatus.DRAFT) throw new ConflictException({ message: 'Only draft invoices can be rejected', code: 'invoice_not_draft' });
        await this.approvals.decide(ctx, FinanceApprovalEntityType.INVOICE, id, { approve: false, reason, require_distinct: false });
        await this.audit.record(ctx, 'finance.invoice.rejected', { resource_type: 'invoice', resource_id: id, metadata: { reason, sensitive: true } });
        this.events.publish(ctx, { event_key: 'finance.invoice.rejected', module: M, entity_kind: 'invoice', entity_id: id, payload: { number: invoice.number, reason } });
        return this.findOne(ctx, id);
    }

    /** Send (and finalize a draft that needs no approval). Delivery itself is 11 Communications, triggered by the event. */
    async send(ctx: OrgContext, id: string, dto: SendInvoiceDto = {}) {
        let invoice = await this.getForWrite(ctx, id, 'finance.invoices.send');
        if (invoice.status === InvoiceStatus.VOID || invoice.status === InvoiceStatus.CANCELLED) throw new ConflictException({ message: 'A voided invoice cannot be sent', code: 'invoice_void' });
        if (invoice.status === InvoiceStatus.DRAFT) {
            const rule = await this.approvals.matchRule(ctx.organization_id, FinanceApprovalEntityType.INVOICE, { amount: invoice.total, currency: invoice.currency, branch_id: invoice.branch_id });
            if (rule && !invoice.approved_at) throw new ConflictException({ message: `This invoice needs approval first (${rule.name})`, code: 'invoice_needs_approval' });
            invoice = await this.prisma.$transaction((tx) => this.finalize(ctx, tx, id));
        }
        const profile = await this.prisma.billingProfile.findUniqueOrThrow({ where: { id: invoice.billing_profile_id }, select: { billing_email: true, legal_name: true } });
        const to = dto.to?.length ? dto.to : profile.billing_email ? [profile.billing_email] : [];
        if (!to.length) throw new BadRequestException({ message: 'Add a billing e-mail to the customer or enter a recipient', code: 'invoice_no_recipient' });
        const updated = await this.prisma.invoice.update({ where: { id }, data: { sent_at: new Date(), ...(invoice.status === InvoiceStatus.SCHEDULED && { status: InvoiceStatus.OPEN }) } });
        await this.audit.record(ctx, 'finance.invoice.sent', { resource_type: 'invoice', resource_id: id, branch_id: updated.branch_id, metadata: { number: updated.number, to, sensitive: true } });
        this.events.publish(ctx, {
            event_key: 'finance.invoice.sent', module: M, entity_kind: 'invoice', entity_id: id,
            payload: { number: updated.number, to, message: dto.message ?? null, total: updated.total.toString(), currency: updated.currency, due_date: updated.due_date, hosted_invoice_url: updated.hosted_invoice_url },
            activity: { summary: `Invoice ${updated.number} sent to ${to.join(', ')}`, entity_label: updated.number, company_id: updated.company_id, project_id: updated.project_id, customer_visible: true },
        });
        await this.ledger.syncInvoiceSafe(ctx, id);
        return this.findOne(ctx, id);
    }

    async void(ctx: OrgContext, id: string, reason: string) {
        const invoice = await this.getForWrite(ctx, id, 'finance.invoices.void');
        if (invoice.status === InvoiceStatus.VOID) throw new ConflictException({ message: 'Invoice is already void', code: 'invoice_void' });
        if (invoice.status === InvoiceStatus.DRAFT) throw new ConflictException({ message: 'Delete the draft instead of voiding it', code: 'invoice_is_draft' });
        if (dec(invoice.amount_paid).greaterThan(0)) throw new ConflictException({ message: 'This invoice has payments; refund them or issue a credit note first', code: 'invoice_has_payments' });
        const updated = await this.prisma.invoice.update({ where: { id }, data: { status: InvoiceStatus.VOID, voided_at: new Date(), amount_due: 0 } });
        await this.prisma.paymentLink.updateMany({ where: { invoice_id: id, status: 'ACTIVE' }, data: { status: 'DISABLED' } });
        await this.audit.record(ctx, 'finance.invoice.voided', { resource_type: 'invoice', resource_id: id, branch_id: updated.branch_id, metadata: { number: invoice.number, reason, before: { status: invoice.status, total: invoice.total.toString() }, sensitive: true } });
        this.events.publish(ctx, { event_key: 'finance.invoice.voided', module: M, entity_kind: 'invoice', entity_id: id, payload: { number: invoice.number, reason }, activity: { summary: `Invoice ${invoice.number} voided: ${reason}`, entity_label: invoice.number, company_id: invoice.company_id } });
        await this.ledger.syncInvoiceSafe(ctx, id);
        return this.findOne(ctx, id);
    }

    /** MARK_UNCOLLECTIBLE: write off the unpaid rest (status stays OVERDUE for reporting). */
    async writeOff(ctx: OrgContext, id: string, reason: string) {
        const invoice = await this.getForWrite(ctx, id, 'finance.adjustments.manage');
        if (!OPEN_STATUSES.includes(invoice.status)) throw new ConflictException({ message: 'Only unpaid invoices can be written off', code: 'invoice_not_open' });
        const amount = dec(invoice.amount_due);
        await this.prisma.invoice.update({ where: { id }, data: { uncollectible_at: new Date(), uncollectible_reason: reason, written_off_amount: amount, amount_due: 0, status: InvoiceStatus.OVERDUE } });
        await this.prisma.paymentLink.updateMany({ where: { invoice_id: id, status: 'ACTIVE' }, data: { status: 'DISABLED' } });
        await this.audit.record(ctx, 'finance.invoice.written_off', { resource_type: 'invoice', resource_id: id, metadata: { number: invoice.number, amount: amount.toString(), reason, sensitive: true } });
        this.events.publish(ctx, { event_key: 'finance.invoice.written_off', module: M, entity_kind: 'invoice', entity_id: id, payload: { number: invoice.number, amount: amount.toString(), reason } });
        await this.ledger.syncInvoiceSafe(ctx, id);
        return this.findOne(ctx, id);
    }

    async remind(ctx: OrgContext, id: string, message?: string | null, action: DunningAction = DunningAction.REMINDER, automated = false) {
        const invoice = automated ? await this.prisma.invoice.findUniqueOrThrow({ where: { id } }) : await this.getForWrite(ctx, id, 'finance.invoices.send');
        if (!OPEN_STATUSES.includes(invoice.status) || dec(invoice.amount_due).lessThanOrEqualTo(0)) throw new ConflictException({ message: 'Only unpaid invoices get reminders', code: 'invoice_not_open' });
        const offset = invoice.due_date ? Math.round((todayUtc().getTime() - invoice.due_date.getTime()) / 86_400_000) : null;
        const reminder = await this.prisma.invoiceReminder.create({ data: { invoice_id: id, action, offset_days: offset } });
        await this.prisma.invoice.update({ where: { id }, data: { last_reminder_at: new Date(), reminder_count: { increment: 1 } } });
        await this.audit.record(ctx, 'finance.invoice.reminder_sent', { resource_type: 'invoice', resource_id: id, metadata: { number: invoice.number, action, offset_days: offset, automated } });
        this.events.publish(ctx, { event_key: 'finance.invoice.reminder_due', module: M, entity_kind: 'invoice', entity_id: id, payload: { number: invoice.number, amount_due: invoice.amount_due.toString(), currency: invoice.currency, days_overdue: offset, message: message ?? null, action } });
        return reminder;
    }

    // --- Internals shared with payments / subscriptions / credit notes ------------------------------------------------

    /** Give the draft its number, dates and OPEN (or SCHEDULED) status. Must run inside the caller's transaction. */
    async finalize(ctx: OrgContext, tx: Prisma.TransactionClient, id: string) {
        const invoice = await tx.invoice.findUniqueOrThrow({ where: { id }, include: { billing_profile: { select: { payment_terms_days: true } } } });
        if (invoice.status !== InvoiceStatus.DRAFT) return invoice;
        const issue = invoice.issue_date ?? todayUtc();
        const number = await this.numbering.next(tx, ctx.organization_id, 'invoice', { prefix: 'INV', date: issue });
        if (invoice.coupon_id) await tx.coupon.update({ where: { id: invoice.coupon_id }, data: { redemptions: { increment: 1 } } });
        const scheduled = invoice.scheduled_send_at && invoice.scheduled_send_at > new Date();
        const updated = await tx.invoice.update({
            where: { id },
            data: { number, status: scheduled ? InvoiceStatus.SCHEDULED : InvoiceStatus.OPEN, issue_date: issue, due_date: invoice.due_date ?? addDays(issue, invoice.billing_profile.payment_terms_days) },
        });
        // Invoice revisions: finalizing the new row voids the one it revises.
        if (invoice.revises_invoice_id) await tx.invoice.update({ where: { id: invoice.revises_invoice_id }, data: { status: InvoiceStatus.VOID, voided_at: new Date(), amount_due: 0 } });
        return this.recalcPayments(tx, updated.id);
    }

    /** Re-total from line items + coupon (drafts). */
    async retotal(ctx: OrgContext, tx: Prisma.TransactionClient, id: string) {
        const invoice = await tx.invoice.findUniqueOrThrow({ where: { id }, include: { line_items: true, coupon: true } });
        const totals = computeInvoiceTotals(
            invoice.line_items.map((l) => ({ net_amount: l.net_amount, tax_amount: l.tax_amount, gross_amount: l.gross_amount, tax_percent: l.tax_percent })),
            invoice.coupon ? { type: invoice.coupon.type, value: invoice.coupon.value } : null,
        );
        await tx.invoice.update({ where: { id }, data: { ...totals } });
        return this.recalcPayments(tx, id);
    }

    /**
     * amount_paid / amount_due / status from successful allocations, refunds (pro rata), applied credit notes and write-offs.
     * Status rules: PAID when nothing is due; REFUNDED when everything paid was refunded; OVERDUE past the due date; else
     * PARTIALLY_PAID / OPEN. Drafts, scheduled and void invoices keep their status.
     */
    async recalcPayments(tx: Prisma.TransactionClient, id: string): Promise<Invoice> {
        const invoice = await tx.invoice.findUniqueOrThrow({
            where: { id },
            include: {
                allocations: { include: { payment: { include: { refunds: { where: { status: RefundStatus.SUCCEEDED } }, allocations: { select: { amount: true } } } } } },
                credit_notes: { where: { status: CreditNoteStatus.APPLIED }, select: { total: true } },
            },
        });
        let paid = dec(0);
        let refunded = dec(0);
        let lastPaid: Date | null = null;
        for (const a of invoice.allocations) {
            const p = a.payment;
            if (!([PaymentStatus.SUCCEEDED, PaymentStatus.PARTIALLY_REFUNDED, PaymentStatus.REFUNDED] as PaymentStatus[]).includes(p.status)) continue;
            paid = paid.plus(a.amount);
            const allocatedTotal = sum(p.allocations.map((x) => x.amount));
            for (const r of p.refunds) {
                const share = allocatedTotal.greaterThan(0) ? dec(r.amount).times(a.amount).dividedBy(allocatedTotal) : dec(0);
                refunded = refunded.plus(share);
            }
            const when = p.received_at ?? a.created_at;
            if (!lastPaid || when > lastPaid) lastPaid = when;
        }
        const credited = sum(invoice.credit_notes.map((c) => c.total));
        const netPaid = round2(max0(paid.minus(refunded)));
        const due = round2(max0(dec(invoice.total).minus(netPaid).minus(credited).minus(invoice.written_off_amount)));
        let status = invoice.status;
        const terminal: InvoiceStatus[] = [InvoiceStatus.DRAFT, InvoiceStatus.SCHEDULED, InvoiceStatus.VOID, InvoiceStatus.CANCELLED];
        if (!terminal.includes(invoice.status)) {
            if (invoice.uncollectible_at) status = InvoiceStatus.OVERDUE;
            else if (due.lessThanOrEqualTo(0.005) && refunded.greaterThan(0) && netPaid.lessThanOrEqualTo(0.005) && credited.lessThanOrEqualTo(0.005)) status = InvoiceStatus.REFUNDED;
            else if (due.lessThanOrEqualTo(0.005)) status = InvoiceStatus.PAID;
            else if (refunded.greaterThan(0) && netPaid.lessThanOrEqualTo(0.005)) status = InvoiceStatus.REFUNDED;
            else if (invoice.due_date && invoice.due_date < todayUtc()) status = InvoiceStatus.OVERDUE;
            else if (netPaid.greaterThan(0)) status = InvoiceStatus.PARTIALLY_PAID;
            else status = invoice.status === InvoiceStatus.PENDING ? InvoiceStatus.PENDING : InvoiceStatus.OPEN;
        }
        return tx.invoice.update({
            where: { id },
            data: { amount_paid: netPaid, amount_due: terminal.includes(status) && status !== 'DRAFT' && status !== 'SCHEDULED' ? 0 : due, status, paid_at: status === InvoiceStatus.PAID ? invoice.paid_at ?? lastPaid ?? new Date() : null },
        });
    }

    async getForWrite(ctx: OrgContext, id: string, key: string) {
        const invoice = await this.prisma.invoice.findFirst({ where: { id, organization_id: ctx.organization_id, AND: [this.scope(ctx, READ)] } });
        if (!invoice) throw new NotFoundException({ message: 'Invoice not found', code: 'invoice_not_found' });
        if (!this.authorizedFor(ctx, key, invoice)) throw new ForbiddenException({ message: `You do not have permission to do this (${key})`, code: 'permission_denied', permissions: [key] });
        return invoice;
    }

    authorizedFor(ctx: OrgContext, key: string, rec: { company_id?: string | null; project_id?: string | null; branch_id?: string | null }) {
        const scope = ctx.scopeOf(key);
        if (!scope) return false;
        if (scope.organization) return true;
        return (!!rec.branch_id && scope.branch_ids.includes(rec.branch_id)) || (!!rec.company_id && scope.customer_ids.includes(rec.company_id)) || (!!rec.project_id && scope.project_ids.includes(rec.project_id));
    }

    /** Resolve catalog prices, tax rates and compute each line (Decimal). Reverse charge / tax-exempt customers get 0%. */
    async priceLines(ctx: OrgContext, lines: InvoiceLineDto[], zeroTax = false) {
        const productIds = [...new Set(lines.map((l) => l.product_id).filter((x): x is string => !!x))];
        const rateIds = [...new Set(lines.map((l) => l.tax_rate_id).filter((x): x is string => !!x))];
        const [products, rates] = await Promise.all([
            productIds.length ? this.prisma.product.findMany({ where: { id: { in: productIds }, organization_id: ctx.organization_id }, include: { default_tax_rate: true } }) : [],
            rateIds.length ? this.prisma.taxRate.findMany({ where: { id: { in: rateIds }, organization_id: ctx.organization_id } }) : [],
        ]);
        if (products.length !== productIds.length) throw new NotFoundException({ message: 'Product not found', code: 'product_not_found' });
        if (rates.length !== rateIds.length) throw new NotFoundException({ message: 'Tax rate not found', code: 'tax_rate_not_found' });
        const priceIds = [...new Set(lines.map((l) => l.price_id).filter((x): x is string => !!x))];
        const prices = priceIds.length ? await this.prisma.price.findMany({ where: { id: { in: priceIds }, product: { organization_id: ctx.organization_id } } }) : [];
        if (prices.length !== priceIds.length) throw new NotFoundException({ message: 'Price not found', code: 'price_not_found' });
        const milestoneIds = [...new Set(lines.map((l) => l.milestone_id).filter((x): x is string => !!x))];
        if (milestoneIds.length && (await this.prisma.projectMilestone.count({ where: { id: { in: milestoneIds }, project: { organization_id: ctx.organization_id } } })) !== milestoneIds.length) throw new NotFoundException({ message: 'Milestone not found', code: 'milestone_not_found' });
        if (lines.some((l) => l.adjustment_amount && !dec(l.adjustment_amount).isZero()) && !ctx.can('finance.adjustments.manage')) throw new ForbiddenException({ message: 'Write-offs and write-ups need finance.adjustments.manage', code: 'permission_denied', permissions: ['finance.adjustments.manage'] });

        return lines.map((l) => {
            const product = products.find((p) => p.id === l.product_id);
            const rate = (l.tax_rate_id ? rates.find((r) => r.id === l.tax_rate_id) : null) ?? (l.tax_percent == null ? product?.default_tax_rate ?? null : null);
            const pct = zeroTax ? dec(0) : rate ? dec(rate.percentage) : dec(l.tax_percent ?? 0);
            const behavior = rate?.behavior ?? TaxBehavior.EXCLUSIVE;
            const amounts = computeLine({ quantity: l.quantity, unit_amount: l.unit_amount, discount_amount: l.discount_amount, adjustment_amount: l.adjustment_amount, tax_percent: pct, tax_behavior: behavior });
            return {
                amounts,
                tax_percent: pct,
                data: {
                    product_id: l.product_id ?? null, price_id: l.price_id ?? null, description: l.description, quantity: dec(l.quantity), unit: l.unit ?? product?.unit ?? null,
                    unit_amount: dec(l.unit_amount), discount_amount: dec(l.discount_amount ?? 0), tax_rate_id: rate?.id ?? null, tax_percent: pct,
                    net_amount: amounts.net_amount, tax_amount: amounts.tax_amount, gross_amount: amounts.gross_amount, milestone_id: l.milestone_id ?? null,
                    adjustment_amount: dec(l.adjustment_amount ?? 0), adjustment_reason: l.adjustment_reason ?? null, period_start: toDateOnly(l.period_start), period_end: toDateOnly(l.period_end),
                },
            };
        });
    }

    private async assertRefs(ctx: OrgContext, dto: UpdateInvoiceDto) {
        const org = ctx.organization_id;
        const checks: [string | null | undefined, () => Promise<unknown>, string][] = [
            [dto.project_id, () => this.prisma.project.findFirst({ where: { id: dto.project_id!, organization_id: org } }), 'Project'],
            [dto.contract_id, () => this.prisma.contract.findFirst({ where: { id: dto.contract_id!, organization_id: org } }), 'Contract'],
            [dto.subscription_id, () => this.prisma.subscription.findFirst({ where: { id: dto.subscription_id!, organization_id: org } }), 'Subscription'],
            [dto.branch_id, () => this.prisma.branch.findFirst({ where: { id: dto.branch_id!, organization_id: org } }), 'Branch'],
            [dto.template_id, () => this.prisma.invoiceTemplate.findFirst({ where: { id: dto.template_id!, organization_id: org } }), 'Invoice template'],
            [dto.provider_connection_id, () => this.prisma.paymentProviderConnection.findFirst({ where: { id: dto.provider_connection_id!, organization_id: org } }), 'Payment provider'],
        ];
        for (const [id, find, label] of checks) if (id && !(await find())) throw new NotFoundException({ message: `${label} not found`, code: 'reference_not_found' });
    }
}
