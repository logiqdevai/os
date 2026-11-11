import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import {
    FinanceApprovalEntityType, FinancialPeriodStatus, LedgerPaymentStatus, LedgerRecord, LedgerRecordSource, LedgerRecordStatus, LedgerRecordType,
    LedgerSettlementKind, LedgerVatTreatment, ModuleKey, Prisma, TaxBehavior,
} from 'generated/prisma';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import { AuditService } from '@/shared/audit/audit.service';
import { EventsService } from '@/shared/events/events.service';
import { OrgContext } from '@/shared/authorization/interfaces/org-context.interface';
import { orderBy, paginate, skipTake } from '@/shared/utils/pagination/pagination.utils';
import { NumberingService } from '@/modules/numbering/numbering.service';
import { FinanceApprovalsService } from '@/modules/finance-shared/finance-approvals.service';
import { computeVat, dec, isZero, max0, round2, todayUtc, toDateOnly } from '@/modules/finance-shared/money.utils';
import { scopeFilter } from '@/modules/finance-shared/finance-scope.utils';
import { LedgerConfigService } from './ledger-config.service';
import {
    CreateAttachmentDto, CreateLedgerRecordDto, CreateSettlementDto, LedgerRecordQuery, UpdateLedgerRecordDto,
} from '../dto/ledger.schemas';

export type RecordAction = 'read' | 'create' | 'update' | 'delete' | 'export';

/** Permission key of an action on a record type: INCOME → finance.income.*, EXPENSE → finance.expenses.* (09 permissions). */
export const recordKey = (type: LedgerRecordType, action: RecordAction) => `finance.${type === LedgerRecordType.INCOME ? 'income' : 'expenses'}.${action}`;
export const APPROVE_KEY = 'finance.expenses.approve';

/** Sources whose amounts are owned by 08 Billing: only classification fields can be edited here. */
const SYNCED_SOURCES: LedgerRecordSource[] = [LedgerRecordSource.INVOICE_SYNC, LedgerRecordSource.PAYMENT_SYNC, LedgerRecordSource.SUBSCRIPTION_SYNC];

export const RECORD_LIST_INCLUDE = {
    category: { select: { id: true, name: true, color: true } },
    subcategory: { select: { id: true, name: true } },
    company: { select: { id: true, name: true } },
    project: { select: { id: true, name: true } },
    payment_method: { select: { id: true, name: true, type: true } },
    _count: { select: { attachments: true, settlements: true } },
} satisfies Prisma.LedgerRecordInclude;

/**
 * 09 ledger records — the standardized income / expense record. Every write: org + scope check → period check →
 * VAT computation (Decimal) → approval policy → audit (before/after) → event. Records are never hard-deleted.
 */
@Injectable()
export class LedgerRecordsService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly audit: AuditService,
        private readonly events: EventsService,
        private readonly numbering: NumberingService,
        private readonly approvals: FinanceApprovalsService,
        private readonly config: LedgerConfigService,
    ) { }

    // --- Access helpers -----------------------------------------------------------------------------

    assertKey(ctx: OrgContext, type: LedgerRecordType, action: RecordAction) {
        const key = recordKey(type, action);
        if (!ctx.can(key)) throw new ForbiddenException({ message: `You do not have permission to do this (${key})`, code: 'permission_denied', permissions: [key] });
    }

    /** Where clause limited to the record types (and scope) the caller can read. */
    readWhere(ctx: OrgContext, action: RecordAction = 'read'): Prisma.LedgerRecordWhereInput {
        const parts: Prisma.LedgerRecordWhereInput[] = [];
        for (const type of [LedgerRecordType.INCOME, LedgerRecordType.EXPENSE]) {
            const key = recordKey(type, action);
            if (!ctx.can(key)) continue;
            parts.push({ type, ...(scopeFilter(ctx, key, { branch: 'branch_id', company: 'company_id', project: 'project_id' }) as Prisma.LedgerRecordWhereInput) });
        }
        if (!parts.length) return { id: '__none__' };
        return parts.length === 1 ? parts[0] : { OR: parts };
    }

    async findAll(ctx: OrgContext, query: LedgerRecordQuery) {
        const and: Prisma.LedgerRecordWhereInput[] = [this.readWhere(ctx)];
        if (query.search) {
            and.push({
                OR: [
                    { description: { contains: query.search, mode: 'insensitive' } },
                    { number: { contains: query.search, mode: 'insensitive' } },
                    { reference_number: { contains: query.search, mode: 'insensitive' } },
                    { counterparty_name: { contains: query.search, mode: 'insensitive' } },
                ],
            });
        }
        if (query.category_id) and.push({ OR: [{ category_id: query.category_id }, { subcategory_id: query.category_id }] });
        const where: Prisma.LedgerRecordWhereInput = {
            organization_id: ctx.organization_id,
            deleted_at: null,
            AND: and,
            ...(query.type && { type: query.type }),
            ...(query.status?.length ? { status: { in: query.status } } : query.include_voided ? {} : { status: { not: LedgerRecordStatus.VOIDED } }),
            ...(query.payment_status?.length && { payment_status: { in: query.payment_status } }),
            ...(query.source?.length && { source: { in: query.source } }),
            ...(query.company_id && { company_id: query.company_id }),
            ...(query.project_id && { project_id: query.project_id }),
            ...(query.branch_id && { branch_id: query.branch_id }),
            ...(query.recurring_expense_id && { recurring_expense_id: query.recurring_expense_id }),
            ...(query.manual !== undefined && { is_manual: query.manual }),
            ...((query.from || query.to) && { transaction_date: { ...(query.from && { gte: toDateOnly(query.from) }), ...(query.to && { lte: toDateOnly(query.to) }) } }),
        };
        const [items, total, totals] = await Promise.all([
            this.prisma.ledgerRecord.findMany({
                where,
                ...skipTake(query),
                orderBy: [orderBy(query, ['transaction_date', 'gross_amount', 'created_at', 'number', 'due_date'], 'transaction_date'), { created_at: 'desc' }],
                include: RECORD_LIST_INCLUDE,
            }),
            this.prisma.ledgerRecord.count({ where }),
            this.prisma.ledgerRecord.groupBy({ by: ['type'], where, _sum: { gross_amount: true, net_amount: true, vat_amount: true, amount_remaining: true } }),
        ]);
        return {
            ...paginate(items, total, query),
            totals: totals.map((t) => ({ type: t.type, gross: t._sum.gross_amount ?? 0, net: t._sum.net_amount ?? 0, vat: t._sum.vat_amount ?? 0, remaining: t._sum.amount_remaining ?? 0 })),
        };
    }

    /** All rows of a filtered list for export (max 10 000), limited to types the caller may export; audited. */
    async exportRows(ctx: OrgContext, query: LedgerRecordQuery) {
        const types = [LedgerRecordType.INCOME, LedgerRecordType.EXPENSE].filter((t) => ctx.can(recordKey(t, 'export')) && (!query.type || query.type === t));
        const rows: Awaited<ReturnType<LedgerRecordsService['findAll']>>['data'] = [];
        for (let page = 1; page <= 50; page++) {
            const res = await this.findAll(ctx, { ...query, page, limit: 200 });
            rows.push(...res.data.filter((r) => types.includes(r.type)));
            if (!res.pagination.has_next) break;
        }
        await this.audit.record(ctx, 'ledger.records.exported', { resource_type: 'ledger_record', metadata: { count: rows.length, filters: query, sensitive: true } });
        return rows;
    }

    async findOne(ctx: OrgContext, idOrNumber: string) {
        const isUuid = /^[0-9a-f-]{36}$/i.test(idOrNumber);
        const record = await this.prisma.ledgerRecord.findFirst({
            where: { organization_id: ctx.organization_id, deleted_at: null, ...(isUuid ? { id: idOrNumber } : { number: idOrNumber }), AND: [this.readWhere(ctx)] },
            include: {
                ...RECORD_LIST_INCLUDE,
                tax_rate: { select: { id: true, name: true, percentage: true } },
                invoice: { select: { id: true, number: true, status: true } },
                subscription: { select: { id: true, status: true } },
                recurring_expense: { select: { id: true, name: true } },
                branch: { select: { id: true, name: true } },
                created_by: { select: { id: true, user: { select: { id: true, email: true, display_name: true, first_name: true, last_name: true } } } },
                approved_by: { select: { id: true, user: { select: { id: true, email: true, display_name: true, first_name: true, last_name: true } } } },
                period: { select: { id: true, name: true, status: true } },
                settlements: { orderBy: { settled_on: 'asc' }, include: { payment_method: { select: { id: true, name: true } } } },
                attachments: { orderBy: { created_at: 'asc' } },
            },
        });
        if (!record) throw new NotFoundException({ message: 'Record not found', code: 'ledger_record_not_found' });
        const [history, approvals] = await Promise.all([
            this.prisma.auditEvent.findMany({
                where: { organization_id: ctx.organization_id, resource_type: 'ledger_record', resource_id: record.id },
                orderBy: { created_at: 'desc' },
                take: 100,
                select: { id: true, event_type: true, created_at: true, metadata: true, actor_type: true, actor_user: { select: { id: true, email: true, display_name: true, first_name: true, last_name: true } } },
            }),
            this.approvals.history(ctx.organization_id, FinanceApprovalEntityType.LEDGER_RECORD, record.id),
        ]);
        return { ...record, history, approvals, can_edit_amounts: !SYNCED_SOURCES.includes(record.source) };
    }

    // --- Create / update ----------------------------------------------------------------------------------

    async create(ctx: OrgContext, dto: CreateLedgerRecordDto, opts: { source?: LedgerRecordSource; recurring_expense_id?: string; recurrence_sequence?: number; is_manual?: boolean; skipApproval?: boolean } = {}) {
        this.assertKey(ctx, dto.type, 'create');
        await this.config.ensureDefaults(ctx.organization_id);
        const prepared = await this.prepare(ctx, dto.type, dto);
        const settings = await this.config.settings(ctx.organization_id);
        const requested = dto.status ?? 'POSTED';
        if (requested === 'POSTED') await this.assertPeriodOpen(ctx.organization_id, prepared.transaction_date);

        const needsApproval = requested === 'POSTED' && !opts.skipApproval ? await this.approvalNeeded(ctx, dto.type, prepared.gross_amount, prepared.currency, prepared.branch_id, settings.approval_threshold_amount) : null;
        const status = requested === 'DRAFT' ? LedgerRecordStatus.DRAFT : needsApproval ? LedgerRecordStatus.PENDING_REVIEW : LedgerRecordStatus.POSTED;

        const record = await this.prisma.$transaction(async (tx) => {
            const number = await this.numbering.next(tx, ctx.organization_id, dto.type === LedgerRecordType.INCOME ? 'ledger_income' : 'ledger_expense', { prefix: dto.type === LedgerRecordType.INCOME ? 'INC' : 'EXP' });
            const created = await tx.ledgerRecord.create({
                data: {
                    ...prepared,
                    organization_id: ctx.organization_id,
                    number,
                    type: dto.type,
                    status,
                    source: opts.source ?? (ctx.channel === 'ui' ? LedgerRecordSource.MANUAL : ctx.channel === 'automation' ? LedgerRecordSource.MANUAL : LedgerRecordSource.API),
                    is_manual: opts.is_manual ?? true,
                    recurring_expense_id: opts.recurring_expense_id ?? null,
                    recurrence_sequence: opts.recurrence_sequence ?? null,
                    created_by_membership_id: ctx.membership_id,
                    posted_at: status === LedgerRecordStatus.POSTED ? new Date() : null,
                    period_id: await this.periodIdFor(ctx.organization_id, prepared.transaction_date, tx),
                    amount_paid: 0,
                    amount_remaining: prepared.gross_amount,
                },
            });
            if (dto.mark_paid && !isZero(prepared.gross_amount)) {
                await tx.ledgerSettlement.create({
                    data: {
                        record_id: created.id, kind: LedgerSettlementKind.PAYMENT, amount: prepared.gross_amount, currency: prepared.currency,
                        settled_on: prepared.payment_date ?? prepared.transaction_date, payment_method_id: prepared.payment_method_id, recorded_by_membership_id: ctx.membership_id,
                    },
                });
            }
            if (needsApproval) await this.approvals.request(ctx, FinanceApprovalEntityType.LEDGER_RECORD, created.id, needsApproval.rule, { amount: prepared.gross_amount, currency: prepared.currency, branch_id: prepared.branch_id, record_type: dto.type }, tx);
            return this.recomputePayment(tx, created.id);
        });

        await this.audit.record(ctx, 'ledger.record.created', { resource_type: 'ledger_record', resource_id: record.id, branch_id: record.branch_id, metadata: { after: this.snapshot(record), sensitive: true } });
        this.events.publish(ctx, {
            event_key: `finance.${dto.type === LedgerRecordType.INCOME ? 'income' : 'expense'}.created`,
            module: ModuleKey.INCOME_EXPENSE, entity_kind: 'ledger_record', entity_id: record.id,
            payload: { number: record.number, type: record.type, status: record.status, gross_amount: record.gross_amount.toString(), currency: record.currency },
            activity: { summary: `${record.type === 'INCOME' ? 'Income' : 'Expense'} ${record.number} recorded: ${record.description}`, entity_label: record.number, project_id: record.project_id, company_id: record.company_id, branch_id: record.branch_id },
        });
        if (status === LedgerRecordStatus.PENDING_REVIEW) {
            this.events.publish(ctx, { event_key: 'finance.record.approval_requested', module: ModuleKey.INCOME_EXPENSE, entity_kind: 'ledger_record', entity_id: record.id, payload: { number: record.number, gross_amount: record.gross_amount.toString() } });
        }
        return record;
    }

    async update(ctx: OrgContext, id: string, dto: UpdateLedgerRecordDto) {
        const before = await this.getForWrite(ctx, id, 'update');
        if (before.status === LedgerRecordStatus.VOIDED) throw new ConflictException({ message: 'A voided record cannot be edited', code: 'ledger_record_voided' });
        await this.assertPeriodEditable(ctx.organization_id, before.transaction_date, before.status);
        const synced = SYNCED_SOURCES.includes(before.source);
        const amountFields: (keyof UpdateLedgerRecordDto)[] = ['net_amount', 'gross_amount', 'vat_percent', 'vat_amount', 'currency', 'pricing_mode', 'tax_rate_id', 'transaction_date', 'company_id', 'amounts_overridden'];
        if (synced && amountFields.some((f) => dto[f] !== undefined)) {
            throw new ConflictException({ message: 'Amounts, dates and counterparty of a record synced from Billing are changed on the invoice', code: 'ledger_record_synced' });
        }
        const merged: CreateLedgerRecordDto = {
            type: before.type,
            description: dto.description ?? before.description,
            transaction_date: dto.transaction_date ?? before.transaction_date.toISOString().slice(0, 10),
            category_id: dto.category_id !== undefined ? dto.category_id : before.category_id,
            subcategory_id: dto.subcategory_id !== undefined ? dto.subcategory_id : before.subcategory_id,
            reference_number: dto.reference_number !== undefined ? dto.reference_number : before.reference_number,
            due_date: dto.due_date !== undefined ? dto.due_date : before.due_date?.toISOString().slice(0, 10) ?? null,
            payment_date: dto.payment_date !== undefined ? dto.payment_date : before.payment_date?.toISOString().slice(0, 10) ?? null,
            currency: dto.currency ?? before.currency,
            fx_rate: dto.fx_rate !== undefined ? dto.fx_rate : before.fx_rate?.toString() ?? null,
            pricing_mode: dto.pricing_mode ?? before.pricing_mode,
            net_amount: dto.net_amount ?? (dto.gross_amount ? undefined : (dto.pricing_mode ?? before.pricing_mode) === TaxBehavior.INCLUSIVE ? undefined : before.net_amount.toString()),
            gross_amount: dto.gross_amount ?? (dto.net_amount ? undefined : before.gross_amount.toString()),
            vat_percent: dto.vat_percent ?? before.vat_percent.toString(),
            vat_amount: dto.vat_amount ?? (before.amounts_overridden ? before.vat_amount.toString() : undefined),
            amounts_overridden: dto.amounts_overridden ?? before.amounts_overridden,
            tax_rate_id: dto.tax_rate_id !== undefined ? dto.tax_rate_id : before.tax_rate_id,
            vat_treatment: dto.vat_treatment ?? before.vat_treatment,
            payment_method_id: dto.payment_method_id !== undefined ? dto.payment_method_id : before.payment_method_id,
            company_id: dto.company_id !== undefined ? dto.company_id : before.company_id,
            counterparty_name: dto.counterparty_name !== undefined ? dto.counterparty_name : before.counterparty_name,
            project_id: dto.project_id !== undefined ? dto.project_id : before.project_id,
            contract_id: dto.contract_id !== undefined ? dto.contract_id : before.contract_id,
            employee_id: dto.employee_id !== undefined ? dto.employee_id : before.employee_id,
            department_id: dto.department_id !== undefined ? dto.department_id : before.department_id,
            branch_id: dto.branch_id !== undefined ? dto.branch_id : before.branch_id,
            notes: dto.notes !== undefined ? dto.notes : before.notes,
            line_items: dto.line_items !== undefined ? dto.line_items : (before.line_items as CreateLedgerRecordDto['line_items']),
        };
        const prepared = synced ? null : await this.prepare(ctx, before.type, merged, before);
        const data: Prisma.LedgerRecordUncheckedUpdateInput = prepared
            ? { ...prepared, period_id: await this.periodIdFor(ctx.organization_id, prepared.transaction_date) }
            : {
                description: merged.description, category_id: merged.category_id, subcategory_id: merged.subcategory_id, reference_number: merged.reference_number,
                project_id: merged.project_id, notes: merged.notes, payment_method_id: merged.payment_method_id, department_id: merged.department_id, branch_id: merged.branch_id,
                category_path_snapshot: await this.categoryPath(ctx.organization_id, merged.category_id, merged.subcategory_id),
            };
        if (prepared && before.status !== LedgerRecordStatus.DRAFT) await this.assertPeriodOpen(ctx.organization_id, prepared.transaction_date);

        // Changing the amount of a posted record above the threshold sends it back to review (09 "Audit Trail").
        let reReview = false;
        if (prepared && before.status === LedgerRecordStatus.POSTED && !dec(prepared.gross_amount).equals(before.gross_amount)) {
            const settings = await this.config.settings(ctx.organization_id);
            const needs = await this.approvalNeeded(ctx, before.type, prepared.gross_amount, prepared.currency, prepared.branch_id, settings.approval_threshold_amount);
            if (needs) {
                reReview = true;
                data.status = LedgerRecordStatus.PENDING_REVIEW;
                data.approved_at = null;
                data.approved_by_membership_id = null;
                await this.approvals.request(ctx, FinanceApprovalEntityType.LEDGER_RECORD, id, needs.rule, { amount: prepared.gross_amount, currency: prepared.currency, branch_id: prepared.branch_id, record_type: before.type });
            }
        }
        const record = await this.prisma.$transaction(async (tx) => {
            await tx.ledgerRecord.update({ where: { id }, data });
            return this.recomputePayment(tx, id);
        });
        const changed = Object.fromEntries(Object.keys(dto).map((k) => [k, (before as Record<string, unknown>)[k]]));
        await this.audit.record(ctx, 'ledger.record.updated', { resource_type: 'ledger_record', resource_id: id, branch_id: record.branch_id, metadata: { before: changed, after: dto, re_review: reReview, sensitive: !!(dto.net_amount || dto.gross_amount || dto.vat_amount) } });
        this.events.publish(ctx, { event_key: `finance.${record.type === 'INCOME' ? 'income' : 'expense'}.updated`, module: ModuleKey.INCOME_EXPENSE, entity_kind: 'ledger_record', entity_id: id, changes: dto as Record<string, unknown>, payload: { number: record.number } });
        return record;
    }

    /** DRAFT → POSTED (or PENDING_REVIEW when the approval policy applies). */
    async post(ctx: OrgContext, id: string) {
        const before = await this.getForWrite(ctx, id, 'update');
        if (before.status !== LedgerRecordStatus.DRAFT) throw new ConflictException({ message: 'Only draft records can be posted', code: 'ledger_record_not_draft' });
        await this.assertPeriodOpen(ctx.organization_id, before.transaction_date);
        const settings = await this.config.settings(ctx.organization_id);
        const needs = await this.approvalNeeded(ctx, before.type, before.gross_amount, before.currency, before.branch_id, settings.approval_threshold_amount);
        const status = needs ? LedgerRecordStatus.PENDING_REVIEW : LedgerRecordStatus.POSTED;
        const record = await this.prisma.ledgerRecord.update({ where: { id }, data: { status, posted_at: status === 'POSTED' ? new Date() : null } });
        if (needs) await this.approvals.request(ctx, FinanceApprovalEntityType.LEDGER_RECORD, id, needs.rule, { amount: before.gross_amount, currency: before.currency, branch_id: before.branch_id, record_type: before.type });
        await this.audit.record(ctx, status === 'POSTED' ? 'ledger.record.posted' : 'ledger.record.submitted', { resource_type: 'ledger_record', resource_id: id, metadata: { before: { status: before.status }, after: { status } } });
        this.events.publish(ctx, { event_key: status === 'POSTED' ? 'finance.record.posted' : 'finance.record.approval_requested', module: ModuleKey.INCOME_EXPENSE, entity_kind: 'ledger_record', entity_id: id, payload: { number: record.number } });
        return record;
    }

    async approve(ctx: OrgContext, id: string, comment?: string | null) {
        const before = await this.getForWrite(ctx, id, 'read');
        if (!ctx.can(APPROVE_KEY)) throw new ForbiddenException({ message: `You do not have permission to do this (${APPROVE_KEY})`, code: 'permission_denied', permissions: [APPROVE_KEY] });
        if (before.status !== LedgerRecordStatus.PENDING_REVIEW) throw new ConflictException({ message: 'Only records waiting for review can be approved', code: 'ledger_record_not_pending' });
        await this.assertPeriodOpen(ctx.organization_id, before.transaction_date);
        const result = await this.approvals.decide(ctx, FinanceApprovalEntityType.LEDGER_RECORD, id, { approve: true, comment, requester_membership_id: before.created_by_membership_id, require_distinct: true });
        const record = result.approved
            ? await this.prisma.ledgerRecord.update({ where: { id }, data: { status: LedgerRecordStatus.POSTED, posted_at: new Date(), approved_at: new Date(), approved_by_membership_id: ctx.membership_id } })
            : before;
        await this.audit.record(ctx, result.approved ? 'ledger.record.approved' : 'ledger.record.approval_step', { resource_type: 'ledger_record', resource_id: id, branch_id: before.branch_id, metadata: { step: result.step, comment, gross_amount: before.gross_amount.toString(), sensitive: true } });
        this.events.publish(ctx, { event_key: 'finance.record.approved', module: ModuleKey.INCOME_EXPENSE, entity_kind: 'ledger_record', entity_id: id, payload: { number: before.number, final: result.approved } });
        return record;
    }

    async reject(ctx: OrgContext, id: string, reason: string) {
        const before = await this.getForWrite(ctx, id, 'read');
        if (!ctx.can(APPROVE_KEY)) throw new ForbiddenException({ message: `You do not have permission to do this (${APPROVE_KEY})`, code: 'permission_denied', permissions: [APPROVE_KEY] });
        if (before.status !== LedgerRecordStatus.PENDING_REVIEW) throw new ConflictException({ message: 'Only records waiting for review can be rejected', code: 'ledger_record_not_pending' });
        await this.approvals.decide(ctx, FinanceApprovalEntityType.LEDGER_RECORD, id, { approve: false, reason, requester_membership_id: before.created_by_membership_id, require_distinct: true });
        const record = await this.prisma.ledgerRecord.update({ where: { id }, data: { status: LedgerRecordStatus.DRAFT } });
        await this.audit.record(ctx, 'ledger.record.rejected', { resource_type: 'ledger_record', resource_id: id, metadata: { reason, sensitive: true } });
        this.events.publish(ctx, { event_key: 'finance.record.rejected', module: ModuleKey.INCOME_EXPENSE, entity_kind: 'ledger_record', entity_id: id, payload: { number: record.number, reason } });
        return record;
    }

    async void(ctx: OrgContext, id: string, reason: string) {
        const before = await this.getForWrite(ctx, id, 'update');
        if (before.status === LedgerRecordStatus.VOIDED) throw new ConflictException({ message: 'Record is already voided', code: 'ledger_record_voided' });
        if (before.source === LedgerRecordSource.INVOICE_SYNC) throw new ConflictException({ message: 'Void the invoice in Billing; its income record follows', code: 'ledger_record_synced' });
        await this.assertPeriodEditable(ctx.organization_id, before.transaction_date, before.status);
        await this.approvals.cancel(ctx.organization_id, FinanceApprovalEntityType.LEDGER_RECORD, id);
        const record = await this.prisma.ledgerRecord.update({ where: { id }, data: { status: LedgerRecordStatus.VOIDED, voided_at: new Date(), void_reason: reason, payment_status: LedgerPaymentStatus.CANCELLED } });
        await this.audit.record(ctx, 'ledger.record.voided', { resource_type: 'ledger_record', resource_id: id, branch_id: before.branch_id, metadata: { reason, before: { status: before.status, gross_amount: before.gross_amount.toString() }, sensitive: true } });
        this.events.publish(ctx, { event_key: 'finance.record.voided', module: ModuleKey.INCOME_EXPENSE, entity_kind: 'ledger_record', entity_id: id, payload: { number: record.number, reason } });
        return record;
    }

    /** Only drafts can be deleted (soft delete, audit kept). Posted records are voided instead. */
    async remove(ctx: OrgContext, id: string) {
        const before = await this.getForWrite(ctx, id, 'delete');
        if (before.status !== LedgerRecordStatus.DRAFT) throw new ConflictException({ message: 'Only draft records can be deleted; void posted records instead', code: 'ledger_record_not_draft' });
        await this.prisma.ledgerRecord.update({ where: { id }, data: { deleted_at: new Date() } });
        await this.audit.record(ctx, 'ledger.record.deleted', { resource_type: 'ledger_record', resource_id: id, metadata: { before: this.snapshot(before), sensitive: true } });
        this.events.publish(ctx, { event_key: 'finance.record.deleted', module: ModuleKey.INCOME_EXPENSE, entity_kind: 'ledger_record', entity_id: id, payload: { number: before.number } });
        return { success: true };
    }

    // --- Settlements & attachments ---------------------------------------------------------------------

    async addSettlement(ctx: OrgContext, id: string, dto: CreateSettlementDto) {
        const before = await this.getForWrite(ctx, id, 'update');
        if (before.status === LedgerRecordStatus.VOIDED || before.status === LedgerRecordStatus.DRAFT) throw new ConflictException({ message: 'Payments can only be recorded on posted records', code: 'ledger_record_not_posted' });
        if (SYNCED_SOURCES.includes(before.source)) throw new ConflictException({ message: 'Record payments for invoices in Billing', code: 'ledger_record_synced' });
        const kind = dto.kind ?? LedgerSettlementKind.PAYMENT;
        const amount = round2(dto.amount);
        if (kind === LedgerSettlementKind.PAYMENT && amount.greaterThan(dec(before.amount_remaining).plus(0.005))) {
            throw new BadRequestException({ message: `The amount is more than the remaining balance (${before.amount_remaining} ${before.currency})`, code: 'settlement_exceeds_balance' });
        }
        await this.assertPaymentMethod(ctx, dto.payment_method_id);
        const record = await this.prisma.$transaction(async (tx) => {
            await tx.ledgerSettlement.create({
                data: { record_id: id, kind, amount, currency: before.currency, settled_on: toDateOnly(dto.settled_on)!, payment_method_id: dto.payment_method_id ?? before.payment_method_id, reference: dto.reference ?? null, document_id: dto.document_id ?? null, notes: dto.notes ?? null, recorded_by_membership_id: ctx.membership_id },
            });
            return this.recomputePayment(tx, id);
        });
        await this.audit.record(ctx, 'ledger.settlement.created', { resource_type: 'ledger_record', resource_id: id, metadata: { kind, amount: amount.toString(), reference: dto.reference, sensitive: true } });
        this.events.publish(ctx, { event_key: 'finance.record.payment_recorded', module: ModuleKey.INCOME_EXPENSE, entity_kind: 'ledger_record', entity_id: id, payload: { number: record.number, kind, amount: amount.toString(), payment_status: record.payment_status } });
        return record;
    }

    async addAttachment(ctx: OrgContext, id: string, dto: CreateAttachmentDto) {
        const before = await this.getForWrite(ctx, id, 'update');
        const doc = await this.prisma.document.findFirst({ where: { id: dto.document_id, organization_id: ctx.organization_id }, select: { id: true, filename: true } });
        if (!doc) throw new NotFoundException({ message: 'Document not found', code: 'document_not_found' });
        const row = await this.prisma.ledgerAttachment.upsert({
            where: { record_id_document_id: { record_id: id, document_id: dto.document_id } },
            create: { record_id: id, document_id: dto.document_id, kind: dto.kind, title: dto.title ?? doc.filename, is_original: !!dto.is_original, added_by_membership_id: ctx.membership_id },
            update: { kind: dto.kind, title: dto.title ?? undefined },
        });
        await this.audit.record(ctx, 'ledger.attachment.added', { resource_type: 'ledger_record', resource_id: before.id, metadata: { document_id: dto.document_id, kind: dto.kind } });
        this.events.publish(ctx, { event_key: 'finance.record.attachment_added', module: ModuleKey.INCOME_EXPENSE, entity_kind: 'ledger_record', entity_id: id, payload: { document_id: dto.document_id } });
        return row;
    }

    async removeAttachment(ctx: OrgContext, id: string, attachmentId: string) {
        await this.getForWrite(ctx, id, 'update');
        const res = await this.prisma.ledgerAttachment.deleteMany({ where: { id: attachmentId, record_id: id } });
        if (!res.count) throw new NotFoundException({ message: 'Attachment not found', code: 'attachment_not_found' });
        await this.audit.record(ctx, 'ledger.attachment.removed', { resource_type: 'ledger_record', resource_id: id, metadata: { attachment_id: attachmentId } });
        return { success: true };
    }

    /** Pending approvals visible to an approver (records only; claims have their own list). */
    async pendingApprovals(ctx: OrgContext) {
        return this.prisma.ledgerRecord.findMany({
            where: { organization_id: ctx.organization_id, deleted_at: null, status: LedgerRecordStatus.PENDING_REVIEW, AND: [this.readWhere(ctx)] },
            orderBy: { created_at: 'asc' },
            take: 200,
            include: { ...RECORD_LIST_INCLUDE, created_by: { select: { id: true, user: { select: { display_name: true, first_name: true, last_name: true, email: true } } } } },
        });
    }

    // --- Internals ---------------------------------------------------------------------------------------

    async getForWrite(ctx: OrgContext, id: string, action: RecordAction): Promise<LedgerRecord> {
        const record = await this.prisma.ledgerRecord.findFirst({ where: { id, organization_id: ctx.organization_id, deleted_at: null, AND: [this.readWhere(ctx)] } });
        if (!record) throw new NotFoundException({ message: 'Record not found', code: 'ledger_record_not_found' });
        this.assertKey(ctx, record.type, action);
        return record;
    }

    /** Validate references, apply category / supplier defaults, compute VAT. */
    private async prepare(ctx: OrgContext, type: LedgerRecordType, dto: CreateLedgerRecordDto, before?: LedgerRecord) {
        const org = ctx.organization_id;
        const [category, subcategory, company, project, taxRate] = await Promise.all([
            dto.category_id ? this.prisma.ledgerCategory.findFirst({ where: { id: dto.category_id, organization_id: org } }) : null,
            dto.subcategory_id ? this.prisma.ledgerCategory.findFirst({ where: { id: dto.subcategory_id, organization_id: org } }) : null,
            dto.company_id ? this.prisma.crmCompany.findFirst({ where: { id: dto.company_id, organization_id: org }, select: { id: true, name: true, ledger_supplier_profile: true } }) : null,
            dto.project_id ? this.prisma.project.findFirst({ where: { id: dto.project_id, organization_id: org }, select: { id: true } }) : null,
            dto.tax_rate_id ? this.prisma.taxRate.findFirst({ where: { id: dto.tax_rate_id, organization_id: org } }) : null,
        ]);
        if (dto.category_id && !category) throw new NotFoundException({ message: 'Category not found', code: 'category_not_found' });
        if (dto.subcategory_id && !subcategory) throw new NotFoundException({ message: 'Subcategory not found', code: 'category_not_found' });
        if (category && category.kind !== type) throw new BadRequestException({ message: `Category "${category.name}" is not an ${type.toLowerCase()} category`, code: 'category_kind_mismatch' });
        if (subcategory && subcategory.parent_category_id !== (category?.id ?? subcategory.parent_category_id)) throw new BadRequestException({ message: 'Subcategory does not belong to the category', code: 'subcategory_mismatch' });
        if (dto.company_id && !company) throw new NotFoundException({ message: 'Customer or supplier not found', code: 'company_not_found' });
        if (dto.project_id && !project) throw new NotFoundException({ message: 'Project not found', code: 'project_not_found' });
        if (dto.tax_rate_id && !taxRate) throw new NotFoundException({ message: 'Tax rate not found', code: 'tax_rate_not_found' });
        await this.assertPaymentMethod(ctx, dto.payment_method_id);
        if (dto.branch_id) {
            const b = await this.prisma.branch.findFirst({ where: { id: dto.branch_id, organization_id: org }, select: { id: true } });
            if (!b) throw new NotFoundException({ message: 'Branch not found', code: 'branch_not_found' });
        }

        // Supplier defaults (09 "Automation": auto-categorize known suppliers).
        const supplier = type === LedgerRecordType.EXPENSE ? company?.ledger_supplier_profile : null;
        let categoryId = dto.category_id ?? (before ? null : supplier?.default_category_id ?? null);
        let subcategoryId = dto.subcategory_id ?? null;
        if (!dto.category_id && subcategory?.parent_category_id) categoryId = subcategory.parent_category_id;
        if (categoryId && !subcategoryId) {
            const c = category ?? (await this.prisma.ledgerCategory.findFirst({ where: { id: categoryId, organization_id: org } }));
            if (c?.parent_category_id) {
                subcategoryId = c.id;
                categoryId = c.parent_category_id;
            }
        }
        const catForDefaults = subcategory ?? category ?? (categoryId ? await this.prisma.ledgerCategory.findFirst({ where: { id: categoryId } }) : null);

        // VAT percentage: explicit → tax rate → supplier default → category default → settings default.
        let vatPercent = dto.vat_percent;
        let taxRateId = dto.tax_rate_id ?? null;
        if (vatPercent === undefined) {
            const settings = await this.config.settings(org);
            const fallbackRateId = taxRate?.id ?? supplier?.default_tax_rate_id ?? catForDefaults?.default_tax_rate_id ?? (type === 'INCOME' ? settings.default_income_tax_rate_id : settings.default_expense_tax_rate_id);
            const rate = taxRate ?? (fallbackRateId ? await this.prisma.taxRate.findFirst({ where: { id: fallbackRateId, organization_id: org } }) : null);
            vatPercent = rate ? rate.percentage.toString() : '0';
            taxRateId = rate?.id ?? null;
        }
        const vatTreatment = dto.vat_treatment ?? supplier?.default_vat_treatment ?? catForDefaults?.default_vat_treatment ?? (dec(vatPercent).isZero() ? LedgerVatTreatment.ZERO_RATED : LedgerVatTreatment.STANDARD);
        if (([LedgerVatTreatment.EXEMPT, LedgerVatTreatment.REVERSE_CHARGE, LedgerVatTreatment.OUT_OF_SCOPE, LedgerVatTreatment.ZERO_RATED] as LedgerVatTreatment[]).includes(vatTreatment)) vatPercent = '0';
        const pricingMode = dto.pricing_mode ?? supplier?.default_pricing_mode ?? TaxBehavior.EXCLUSIVE;

        let amounts = computeVat({ net_amount: dto.net_amount, gross_amount: dto.gross_amount, vat_percent: vatPercent, pricing_mode: dto.net_amount !== undefined && dto.gross_amount === undefined ? TaxBehavior.EXCLUSIVE : dto.gross_amount !== undefined && dto.net_amount === undefined ? TaxBehavior.INCLUSIVE : pricingMode });
        if (dto.amounts_overridden && dto.vat_amount !== undefined && dto.net_amount !== undefined) {
            const vat = round2(dto.vat_amount);
            amounts = { net_amount: round2(dto.net_amount), vat_amount: vat, gross_amount: round2(dec(dto.net_amount).plus(vat)), vat_percent: dec(vatPercent) };
        }

        const currency = dto.currency ?? before?.currency ?? (await this.config.reportingCurrency(org));
        const reportingCurrency = await this.config.reportingCurrency(org);
        const fx = dto.fx_rate ? dec(dto.fx_rate) : currency === reportingCurrency ? dec(1) : null;
        const termsDays = supplier?.payment_terms_days;
        const transactionDate = toDateOnly(dto.transaction_date)!;
        const dueDate = dto.due_date !== undefined ? toDateOnly(dto.due_date) : termsDays != null && !before ? new Date(transactionDate.getTime() + termsDays * 86_400_000) : null;

        return {
            description: dto.description,
            category_id: categoryId,
            subcategory_id: subcategoryId,
            category_path_snapshot: await this.categoryPath(org, categoryId, subcategoryId),
            reference_number: dto.reference_number ?? null,
            transaction_date: transactionDate,
            due_date: dueDate,
            payment_date: toDateOnly(dto.payment_date),
            currency,
            fx_rate: fx,
            net_amount: amounts.net_amount,
            vat_percent: amounts.vat_percent,
            vat_amount: amounts.vat_amount,
            gross_amount: amounts.gross_amount,
            reporting_gross_amount: fx ? round2(amounts.gross_amount.times(fx)) : null,
            tax_rate_id: taxRateId,
            vat_treatment: vatTreatment,
            pricing_mode: pricingMode,
            amounts_overridden: !!dto.amounts_overridden,
            payment_method_id: dto.payment_method_id ?? null,
            company_id: dto.company_id ?? null,
            counterparty_name: dto.counterparty_name ?? company?.name ?? null,
            project_id: dto.project_id ?? null,
            contract_id: dto.contract_id ?? null,
            employee_id: dto.employee_id ?? null,
            department_id: dto.department_id ?? null,
            branch_id: dto.branch_id ?? null,
            notes: dto.notes ?? null,
            line_items: (dto.line_items ?? undefined) as Prisma.InputJsonValue | undefined,
        };
    }

    async categoryPath(organizationId: string, categoryId?: string | null, subcategoryId?: string | null) {
        const ids = [categoryId, subcategoryId].filter((x): x is string => !!x);
        if (!ids.length) return null;
        const rows = await this.prisma.ledgerCategory.findMany({ where: { id: { in: ids }, organization_id: organizationId }, select: { id: true, name: true } });
        const name = (id?: string | null) => rows.find((r) => r.id === id)?.name;
        return [name(categoryId), name(subcategoryId)].filter(Boolean).join(' / ') || null;
    }

    private async assertPaymentMethod(ctx: OrgContext, id?: string | null) {
        if (!id) return;
        const m = await this.prisma.ledgerPaymentMethod.findFirst({ where: { id, organization_id: ctx.organization_id }, select: { id: true } });
        if (!m) throw new NotFoundException({ message: 'Payment method not found', code: 'payment_method_not_found' });
    }

    /** Approval needed? First a FinanceApprovalRule (LEDGER_RECORD), then the simple settings threshold. */
    async approvalNeeded(ctx: OrgContext, type: LedgerRecordType, gross: Prisma.Decimal, currency: string, branchId: string | null, threshold: Prisma.Decimal | null) {
        const rule = await this.approvals.matchRule(ctx.organization_id, FinanceApprovalEntityType.LEDGER_RECORD, { amount: gross, currency, branch_id: branchId, record_type: type });
        if (rule) return { rule };
        if (threshold && dec(gross).greaterThan(threshold)) return { rule: null };
        return null;
    }

    /** Closed and locked periods reject postings (09 "Financial Periods"). */
    async assertPeriodOpen(organizationId: string, date: Date) {
        const p = await this.prisma.financialPeriod.findFirst({
            where: { organization_id: organizationId, start_date: { lte: date }, end_date: { gte: date }, status: { in: [FinancialPeriodStatus.CLOSED, FinancialPeriodStatus.LOCKED] } },
            select: { name: true, status: true },
        });
        if (p) throw new ConflictException({ message: `Period ${p.name} is ${p.status.toLowerCase()}; reopen it or pick another date`, code: 'period_closed' });
    }

    private async assertPeriodEditable(organizationId: string, date: Date, status: LedgerRecordStatus) {
        if (status === LedgerRecordStatus.DRAFT) return;
        await this.assertPeriodOpen(organizationId, date);
    }

    /** Prefer the MONTH period that contains the date, else any period that contains it. */
    async periodIdFor(organizationId: string, date: Date, tx?: Prisma.TransactionClient) {
        const rows = await (tx ?? this.prisma).financialPeriod.findMany({ where: { organization_id: organizationId, start_date: { lte: date }, end_date: { gte: date } }, select: { id: true, type: true } });
        return (rows.find((r) => r.type === 'MONTH') ?? rows[0])?.id ?? null;
    }

    /** amount_paid / amount_remaining / payment_status from settlements (09 "Payment & Settlement Tracking"). */
    async recomputePayment(tx: Prisma.TransactionClient, id: string) {
        const record = await tx.ledgerRecord.findUniqueOrThrow({ where: { id }, include: { settlements: true } });
        let paid = dec(0);
        let writtenOff = dec(0);
        let refunded = dec(0);
        let lastPaid: Date | null = null;
        for (const s of record.settlements) {
            if (s.kind === LedgerSettlementKind.PAYMENT || s.kind === LedgerSettlementKind.ADJUSTMENT) {
                paid = paid.plus(s.amount);
                if (!lastPaid || s.settled_on > lastPaid) lastPaid = s.settled_on;
            } else if (s.kind === LedgerSettlementKind.REFUND) {
                paid = paid.minus(s.amount);
                refunded = refunded.plus(s.amount);
            } else if (s.kind === LedgerSettlementKind.WRITE_OFF) writtenOff = writtenOff.plus(s.amount);
        }
        const gross = dec(record.gross_amount);
        const remaining = max0(gross.minus(paid).minus(writtenOff));
        let status: LedgerPaymentStatus;
        if (record.status === LedgerRecordStatus.VOIDED) status = LedgerPaymentStatus.CANCELLED;
        else if (refunded.greaterThan(0) && paid.lessThanOrEqualTo(0.005)) status = LedgerPaymentStatus.REFUNDED;
        else if (gross.greaterThan(0) && remaining.lessThanOrEqualTo(0.005)) status = paid.greaterThan(0) || writtenOff.greaterThan(0) ? LedgerPaymentStatus.PAID : LedgerPaymentStatus.UNPAID;
        else if (record.due_date && record.due_date < todayUtc()) status = LedgerPaymentStatus.OVERDUE;
        else if (paid.greaterThan(0)) status = LedgerPaymentStatus.PARTIALLY_PAID;
        else status = LedgerPaymentStatus.UNPAID;
        if (isZero(gross) && record.status !== 'VOIDED') status = LedgerPaymentStatus.PAID;
        return tx.ledgerRecord.update({
            where: { id },
            data: { amount_paid: round2(max0(paid)), amount_remaining: round2(remaining), payment_status: status, payment_date: status === LedgerPaymentStatus.PAID ? lastPaid ?? record.payment_date ?? record.transaction_date : record.payment_date },
            include: RECORD_LIST_INCLUDE,
        });
    }

    private snapshot(r: LedgerRecord) {
        return { number: r.number, type: r.type, status: r.status, description: r.description, net_amount: r.net_amount.toString(), vat_amount: r.vat_amount.toString(), gross_amount: r.gross_amount.toString(), currency: r.currency, category_id: r.category_id, company_id: r.company_id, project_id: r.project_id };
    }
}
