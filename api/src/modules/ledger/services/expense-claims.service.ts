import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ExpenseClaimStatus, FinanceApprovalEntityType, LedgerRecordSource, ModuleKey, PayrollEntryKind, PayrollEntryStatus, Prisma } from 'generated/prisma';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import { AuditService } from '@/shared/audit/audit.service';
import { EventsService } from '@/shared/events/events.service';
import { OrgContext } from '@/shared/authorization/interfaces/org-context.interface';
import { orderBy, paginate, skipTake } from '@/shared/utils/pagination/pagination.utils';
import { NumberingService } from '@/modules/numbering/numbering.service';
import { FinanceApprovalsService } from '@/modules/finance-shared/finance-approvals.service';
import { dec, round2, sum, todayUtc, toDateOnly } from '@/modules/finance-shared/money.utils';
import { LedgerConfigService } from './ledger-config.service';
import { LedgerRecordsService } from './ledger-records.service';
import { ClaimQuery, CreateExpenseClaimDto, UpdateExpenseClaimDto } from '../dto/ledger.schemas';

const READ_ALL = 'finance.expense_claims.read';
const APPROVE = 'finance.expense_claims.approve';
const CREATE_OWN = 'finance.expense_claims.create_own';

const CLAIM_INCLUDE = {
    lines: { orderBy: { sort_order: 'asc' }, include: { category: { select: { id: true, name: true } }, project: { select: { id: true, name: true } } } },
    payroll_entry: { select: { id: true, status: true, ledger_record_id: true } },
} satisfies Prisma.ExpenseClaimInclude;

/**
 * 09 "Employee Payments & Payroll Expenses" — expense claims. Employees file their own (create_own / read_own); finance
 * reads all and approves (finance.expense_claims.approve, never their own). Approval creates the REIMBURSEMENT payroll
 * entry; paying it posts the expense record (source PAYROLL) so it shows up in every report.
 */
@Injectable()
export class ExpenseClaimsService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly audit: AuditService,
        private readonly events: EventsService,
        private readonly numbering: NumberingService,
        private readonly approvals: FinanceApprovalsService,
        private readonly config: LedgerConfigService,
        private readonly records: LedgerRecordsService,
    ) { }

    private async myEmployee(ctx: OrgContext) {
        if (!ctx.membership_id) return null;
        return this.prisma.employee.findFirst({
            where: { organization_id: ctx.organization_id, membership_id: ctx.membership_id },
            select: { id: true, preferred_name: true, legal_first_name: true, legal_last_name: true, membership: { select: { user: { select: { display_name: true, first_name: true, last_name: true, email: true } } } } },
        });
    }

    private employeeName(e: { preferred_name?: string | null; legal_first_name?: string | null; legal_last_name?: string | null; membership?: { user?: { display_name?: string | null; first_name?: string | null; last_name?: string | null; email?: string | null } | null } | null }) {
        const u = e.membership?.user;
        return e.preferred_name || [e.legal_first_name, e.legal_last_name].filter(Boolean).join(' ') || u?.display_name || [u?.first_name, u?.last_name].filter(Boolean).join(' ') || u?.email || null;
    }

    async findAll(ctx: OrgContext, query: ClaimQuery) {
        const all = ctx.can(READ_ALL) && !query.mine;
        const me = await this.myEmployee(ctx);
        if (!all && !me) return { ...paginate([], 0, query), employee_profile: false };
        const where: Prisma.ExpenseClaimWhereInput = {
            organization_id: ctx.organization_id,
            ...(!all && { employee_id: me!.id }),
            ...(query.status?.length && { status: { in: query.status } }),
            ...(query.search && { OR: [{ title: { contains: query.search, mode: 'insensitive' } }, { number: { contains: query.search, mode: 'insensitive' } }, { employee_name_snapshot: { contains: query.search, mode: 'insensitive' } }] }),
        };
        const [items, total] = await Promise.all([
            this.prisma.expenseClaim.findMany({ where, ...skipTake(query), orderBy: orderBy(query, ['created_at', 'submitted_at', 'total_amount', 'number'], 'created_at'), include: { _count: { select: { lines: true } } } }),
            this.prisma.expenseClaim.count({ where }),
        ]);
        return { ...paginate(items, total, query), employee_profile: !!me, my_employee_id: me?.id ?? null };
    }

    async findOne(ctx: OrgContext, id: string) {
        const claim = await this.prisma.expenseClaim.findFirst({ where: { id, organization_id: ctx.organization_id }, include: CLAIM_INCLUDE });
        if (!claim) throw new NotFoundException({ message: 'Expense claim not found', code: 'expense_claim_not_found' });
        if (!ctx.can(READ_ALL)) {
            const me = await this.myEmployee(ctx);
            if (!me || me.id !== claim.employee_id) throw new NotFoundException({ message: 'Expense claim not found', code: 'expense_claim_not_found' });
        }
        const approvals = await this.approvals.history(ctx.organization_id, FinanceApprovalEntityType.EXPENSE_CLAIM, id);
        return { ...claim, approvals };
    }

    async create(ctx: OrgContext, dto: CreateExpenseClaimDto) {
        let employeeId: string;
        let employeeName: string | null;
        if (dto.employee_id) {
            if (!ctx.can(APPROVE)) throw new ForbiddenException({ message: 'Only finance can file a claim for another employee', code: 'permission_denied', permissions: [APPROVE] });
            const e = await this.prisma.employee.findFirst({ where: { id: dto.employee_id, organization_id: ctx.organization_id }, select: { id: true, preferred_name: true, legal_first_name: true, legal_last_name: true, membership: { select: { user: { select: { display_name: true, first_name: true, last_name: true, email: true } } } } } });
            if (!e) throw new NotFoundException({ message: 'Employee not found', code: 'employee_not_found' });
            employeeId = e.id;
            employeeName = this.employeeName(e);
        } else {
            if (!ctx.can(CREATE_OWN) && !ctx.can(APPROVE)) throw new ForbiddenException({ message: `You do not have permission to do this (${CREATE_OWN})`, code: 'permission_denied', permissions: [CREATE_OWN] });
            const me = await this.myEmployee(ctx);
            if (!me) throw new ConflictException({ message: 'You need an employee profile (People) to file expense claims', code: 'employee_profile_required' });
            employeeId = me.id;
            employeeName = this.employeeName(me);
        }
        await this.assertLineRefs(ctx, dto.lines);
        const currency = dto.currency ?? (await this.config.reportingCurrency(ctx.organization_id));
        const claim = await this.prisma.$transaction(async (tx) => {
            const number = await this.numbering.next(tx, ctx.organization_id, 'expense_claim', { prefix: 'CLM' });
            return tx.expenseClaim.create({
                data: {
                    organization_id: ctx.organization_id, number, employee_id: employeeId, employee_name_snapshot: employeeName, title: dto.title, currency, notes: dto.notes ?? null,
                    total_amount: round2(sum(dto.lines.map((l) => l.gross_amount))), vat_total: round2(sum(dto.lines.map((l) => l.vat_amount ?? 0))),
                    lines: { create: dto.lines.map((l, i) => ({ expense_date: toDateOnly(l.expense_date)!, category_id: l.category_id ?? null, project_id: l.project_id ?? null, description: l.description, merchant: l.merchant ?? null, gross_amount: dec(l.gross_amount), vat_amount: dec(l.vat_amount ?? 0), document_id: l.document_id ?? null, sort_order: i })) },
                },
            });
        });
        await this.audit.record(ctx, 'ledger.expense_claim.created', { resource_type: 'expense_claim', resource_id: claim.id, metadata: { number: claim.number, total: claim.total_amount.toString(), employee_id: employeeId } });
        this.events.publish(ctx, { event_key: 'finance.expense_claim.created', module: ModuleKey.INCOME_EXPENSE, entity_kind: 'expense_claim', entity_id: claim.id, payload: { number: claim.number } });
        if (dto.submit) return this.submit(ctx, claim.id);
        return this.findOne(ctx, claim.id);
    }

    async update(ctx: OrgContext, id: string, dto: UpdateExpenseClaimDto) {
        const before = await this.findEditable(ctx, id);
        if (dto.lines) await this.assertLineRefs(ctx, dto.lines);
        await this.prisma.$transaction(async (tx) => {
            if (dto.lines) {
                await tx.expenseClaimLine.deleteMany({ where: { claim_id: id } });
                await tx.expenseClaimLine.createMany({ data: dto.lines.map((l, i) => ({ claim_id: id, expense_date: toDateOnly(l.expense_date)!, category_id: l.category_id ?? null, project_id: l.project_id ?? null, description: l.description, merchant: l.merchant ?? null, gross_amount: dec(l.gross_amount), vat_amount: dec(l.vat_amount ?? 0), document_id: l.document_id ?? null, sort_order: i })) });
            }
            await tx.expenseClaim.update({
                where: { id },
                data: {
                    ...(dto.title && { title: dto.title }), ...(dto.currency && { currency: dto.currency }), ...(dto.notes !== undefined && { notes: dto.notes }),
                    ...(dto.lines && { total_amount: round2(sum(dto.lines.map((l) => l.gross_amount))), vat_total: round2(sum(dto.lines.map((l) => l.vat_amount ?? 0))) }),
                },
            });
        });
        await this.audit.record(ctx, 'ledger.expense_claim.updated', { resource_type: 'expense_claim', resource_id: id, metadata: { before: { title: before.title, total_amount: before.total_amount.toString() }, after: { title: dto.title, lines: dto.lines?.length } } });
        this.events.publish(ctx, { event_key: 'finance.expense_claim.updated', module: ModuleKey.INCOME_EXPENSE, entity_kind: 'expense_claim', entity_id: id });
        if (dto.submit) return this.submit(ctx, id);
        return this.findOne(ctx, id);
    }

    async submit(ctx: OrgContext, id: string) {
        const claim = await this.findEditable(ctx, id);
        const rule = await this.approvals.matchRule(ctx.organization_id, FinanceApprovalEntityType.EXPENSE_CLAIM, { amount: claim.total_amount, currency: claim.currency });
        await this.prisma.$transaction(async (tx) => {
            await tx.expenseClaim.update({ where: { id }, data: { status: ExpenseClaimStatus.SUBMITTED, submitted_at: new Date(), rejection_reason: null, decided_at: null, decided_by_membership_id: null } });
            await this.approvals.request(ctx, FinanceApprovalEntityType.EXPENSE_CLAIM, id, rule, { amount: claim.total_amount, currency: claim.currency }, tx);
        });
        await this.audit.record(ctx, 'ledger.expense_claim.submitted', { resource_type: 'expense_claim', resource_id: id, metadata: { total: claim.total_amount.toString() } });
        this.events.publish(ctx, { event_key: 'finance.expense_claim.submitted', module: ModuleKey.INCOME_EXPENSE, entity_kind: 'expense_claim', entity_id: id, payload: { number: claim.number, total: claim.total_amount.toString(), employee: claim.employee_name_snapshot } });
        return this.findOne(ctx, id);
    }

    async decide(ctx: OrgContext, id: string, approve: boolean, reason?: string | null) {
        const claim = await this.findOne(ctx, id);
        if (claim.status !== ExpenseClaimStatus.SUBMITTED) throw new ConflictException({ message: 'Only submitted claims can be decided', code: 'expense_claim_not_submitted' });
        const me = await this.myEmployee(ctx);
        if (me && me.id === claim.employee_id) throw new ForbiddenException({ message: 'You cannot approve your own expense claim (separation of duties)', code: 'approval_self_not_allowed' });
        const result = await this.approvals.decide(ctx, FinanceApprovalEntityType.EXPENSE_CLAIM, id, { approve, reason, require_distinct: true });
        if (approve && !result.approved) {
            await this.audit.record(ctx, 'ledger.expense_claim.approval_step', { resource_type: 'expense_claim', resource_id: id, metadata: { step: result.step } });
            return this.findOne(ctx, id);
        }
        await this.prisma.$transaction(async (tx) => {
            if (approve) {
                const lastDate = claim.lines.reduce((d, l) => (l.expense_date > d ? l.expense_date : d), claim.lines[0]?.expense_date ?? todayUtc());
                const firstDate = claim.lines.reduce((d, l) => (l.expense_date < d ? l.expense_date : d), lastDate);
                const entry = await tx.payrollEntry.create({
                    data: {
                        organization_id: ctx.organization_id, employee_id: claim.employee_id, employee_name_snapshot: claim.employee_name_snapshot, kind: PayrollEntryKind.REIMBURSEMENT,
                        status: PayrollEntryStatus.APPROVED, currency: claim.currency, base_amount: claim.total_amount, total_amount: claim.total_amount, period_start: firstDate, period_end: lastDate,
                        description: `Expense claim ${claim.number}: ${claim.title}`, created_by_membership_id: ctx.membership_id, approved_by_membership_id: ctx.membership_id, approved_at: new Date(),
                    },
                });
                await tx.expenseClaim.update({ where: { id }, data: { status: ExpenseClaimStatus.APPROVED, decided_at: new Date(), decided_by_membership_id: ctx.membership_id, payroll_entry_id: entry.id } });
            } else {
                await tx.expenseClaim.update({ where: { id }, data: { status: ExpenseClaimStatus.REJECTED, decided_at: new Date(), decided_by_membership_id: ctx.membership_id, rejection_reason: reason ?? null } });
            }
        });
        await this.audit.record(ctx, approve ? 'ledger.expense_claim.approved' : 'ledger.expense_claim.rejected', { resource_type: 'expense_claim', resource_id: id, metadata: { total: claim.total_amount.toString(), reason, sensitive: true } });
        this.events.publish(ctx, { event_key: approve ? 'finance.expense_claim.approved' : 'finance.expense_claim.rejected', module: ModuleKey.INCOME_EXPENSE, entity_kind: 'expense_claim', entity_id: id, payload: { number: claim.number, reason } });
        return this.findOne(ctx, id);
    }

    /** Pay an approved claim: posts the expense record (source PAYROLL, paid) and closes the payroll entry. */
    async pay(ctx: OrgContext, id: string, input: { payment_method_id?: string | null; paid_on?: string; reference?: string | null }) {
        const claim = await this.findOne(ctx, id);
        if (claim.status !== ExpenseClaimStatus.APPROVED || !claim.payroll_entry_id) throw new ConflictException({ message: 'Only approved claims can be paid', code: 'expense_claim_not_approved' });
        const paidOn = input.paid_on ?? todayUtc().toISOString().slice(0, 10);
        const categories = new Set(claim.lines.map((l) => l.category_id).filter(Boolean));
        const projects = new Set(claim.lines.map((l) => l.project_id).filter(Boolean));
        const fallback = await this.config.categoryByKey(ctx.organization_id, 'expense.employees.reimbursements');
        const gross = dec(claim.total_amount);
        const vat = dec(claim.vat_total);
        const record = await this.records.create(
            ctx,
            {
                type: 'EXPENSE', description: `Expense claim ${claim.number}: ${claim.title} (${claim.employee_name_snapshot ?? 'employee'})`,
                category_id: categories.size === 1 ? ([...categories][0] as string) : fallback?.id ?? null,
                project_id: projects.size === 1 ? ([...projects][0] as string) : null,
                employee_id: claim.employee_id, reference_number: input.reference ?? claim.number, transaction_date: paidOn, payment_date: paidOn, currency: claim.currency,
                net_amount: gross.minus(vat).toString(), vat_amount: vat.toString(), amounts_overridden: true, vat_percent: gross.minus(vat).greaterThan(0) ? vat.dividedBy(gross.minus(vat)).times(100).toDecimalPlaces(2).toString() : '0',
                payment_method_id: input.payment_method_id ?? null, status: 'POSTED', mark_paid: true,
                line_items: claim.lines.map((l) => ({ description: `${l.expense_date.toISOString().slice(0, 10)} ${l.merchant ? `${l.merchant} — ` : ''}${l.description}`, gross: l.gross_amount.toString(), vat: l.vat_amount.toString() })),
            },
            { source: LedgerRecordSource.PAYROLL, is_manual: false, skipApproval: true },
        );
        await this.prisma.$transaction([
            this.prisma.payrollEntry.update({ where: { id: claim.payroll_entry_id }, data: { status: PayrollEntryStatus.POSTED, posted_at: new Date(), payment_date: toDateOnly(paidOn), ledger_record_id: record.id, payment_method_id: input.payment_method_id ?? null } }),
            this.prisma.expenseClaim.update({ where: { id }, data: { status: ExpenseClaimStatus.PAID, paid_at: new Date() } }),
        ]);
        await this.audit.record(ctx, 'ledger.expense_claim.paid', { resource_type: 'expense_claim', resource_id: id, metadata: { ledger_record_id: record.id, amount: gross.toString(), sensitive: true } });
        this.events.publish(ctx, { event_key: 'finance.expense_claim.paid', module: ModuleKey.INCOME_EXPENSE, entity_kind: 'expense_claim', entity_id: id, payload: { number: claim.number, record_id: record.id } });
        return this.findOne(ctx, id);
    }

    async pendingForApproval(ctx: OrgContext) {
        if (!ctx.can(APPROVE)) return [];
        return this.prisma.expenseClaim.findMany({ where: { organization_id: ctx.organization_id, status: ExpenseClaimStatus.SUBMITTED }, orderBy: { submitted_at: 'asc' }, take: 200, include: { _count: { select: { lines: true } } } });
    }

    private async findEditable(ctx: OrgContext, id: string) {
        const claim = await this.findOne(ctx, id);
        if (claim.status !== ExpenseClaimStatus.DRAFT && claim.status !== ExpenseClaimStatus.REJECTED) throw new ConflictException({ message: 'Only draft or rejected claims can be changed', code: 'expense_claim_locked' });
        const me = await this.myEmployee(ctx);
        if ((!me || me.id !== claim.employee_id) && !ctx.can(APPROVE)) throw new ForbiddenException({ message: 'You can only change your own claims', code: 'permission_denied' });
        return claim;
    }

    private async assertLineRefs(ctx: OrgContext, lines: CreateExpenseClaimDto['lines']) {
        const cats = [...new Set(lines.map((l) => l.category_id).filter((x): x is string => !!x))];
        const projects = [...new Set(lines.map((l) => l.project_id).filter((x): x is string => !!x))];
        if (cats.length && (await this.prisma.ledgerCategory.count({ where: { id: { in: cats }, organization_id: ctx.organization_id, kind: 'EXPENSE' } })) !== cats.length) throw new NotFoundException({ message: 'Expense category not found', code: 'category_not_found' });
        if (projects.length && (await this.prisma.project.count({ where: { id: { in: projects }, organization_id: ctx.organization_id } })) !== projects.length) throw new NotFoundException({ message: 'Project not found', code: 'project_not_found' });
    }
}
