import { ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import {
    FinancialPeriodStatus, FinancialPeriodType, LedgerBudgetScope, LedgerBudgetStatus, LedgerInsightKind, LedgerInsightStatus, LedgerReportBasis, ModuleKey, Prisma, VatReturnStatus,
} from 'generated/prisma';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import { AuditService } from '@/shared/audit/audit.service';
import { EventsService } from '@/shared/events/events.service';
import { OrgContext } from '@/shared/authorization/interfaces/org-context.interface';
import { paginate, skipTake } from '@/shared/utils/pagination/pagination.utils';
import { dec, todayUtc, toDateOnly } from '@/modules/finance-shared/money.utils';
import { systemContext } from '@/modules/finance-shared/system-context.utils';
import { LedgerConfigService } from './ledger-config.service';
import { LedgerReportsService } from './ledger-reports.service';
import { LedgerRecordsService } from './ledger-records.service';
import { CreateBudgetDto, InsightQuery, UpdateBudgetDto } from '../dto/ledger.schemas';
import { z } from 'zod';
import { CreatePeriodSchema, GeneratePeriodsSchema } from '../dto/ledger.schemas';

type CreatePeriodDto = z.infer<typeof CreatePeriodSchema>;
type GeneratePeriodsDto = z.infer<typeof GeneratePeriodsSchema>;
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const iso = (d: Date) => d.toISOString().slice(0, 10);

/** 09 budgets, financial periods (open → closed → locked), VAT returns and AI/rule-based insights. */
@Injectable()
export class LedgerPlanningService {
    private readonly logger = new Logger(LedgerPlanningService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly audit: AuditService,
        private readonly events: EventsService,
        private readonly config: LedgerConfigService,
        private readonly reports: LedgerReportsService,
        private readonly records: LedgerRecordsService,
    ) { }

    // =============================================================================================
    // Budgets
    // =============================================================================================

    async listBudgets(ctx: OrgContext, year?: number, status?: LedgerBudgetStatus) {
        const budgets = await this.prisma.ledgerBudget.findMany({
            where: { organization_id: ctx.organization_id, ...(year && { fiscal_year: year }), ...(status && { status }) },
            orderBy: [{ fiscal_year: 'desc' }, { name: 'asc' }],
            include: { lines: true },
        });
        const out = [];
        for (const b of budgets) {
            const actuals = await this.actuals(ctx, b);
            const planned = b.lines.reduce((a, l) => a + Number(l.planned_amount), 0);
            const actual = actuals.reduce((a, x) => a + x.actual_total, 0);
            const { lines: _l, ...rest } = b;
            out.push({ ...rest, planned_total: Math.round(planned * 100) / 100, actual_total: Math.round(actual * 100) / 100, used_percent: planned ? Math.round((actual / planned) * 1000) / 10 : null, subjects: actuals.length });
        }
        return out;
    }

    async getBudget(ctx: OrgContext, id: string) {
        const b = await this.prisma.ledgerBudget.findFirst({ where: { id, organization_id: ctx.organization_id }, include: { lines: { include: { category: { select: { id: true, name: true } }, project: { select: { id: true, name: true } }, department: { select: { id: true, name: true } } } } } });
        if (!b) throw new NotFoundException({ message: 'Budget not found', code: 'budget_not_found' });
        const subjects = await this.actuals(ctx, b);
        return { ...b, subjects };
    }

    /** Planned vs actual (expense net) per subject and fiscal month. */
    private async actuals(ctx: OrgContext, b: Prisma.LedgerBudgetGetPayload<{ include: { lines: true } }>) {
        const settings = await this.config.settings(ctx.organization_id);
        const startMonth = settings.fiscal_year_start_month;
        const from = new Date(Date.UTC(b.fiscal_year, startMonth - 1, 1));
        const to = new Date(Date.UTC(b.fiscal_year + 1, startMonth - 1, 0));
        // Subcategory → parent mapping for category budgets.
        const cats = await this.prisma.ledgerCategory.findMany({ where: { organization_id: ctx.organization_id }, select: { id: true, parent_category_id: true, name: true } });
        const parentOf = new Map(cats.map((c) => [c.id, c.parent_category_id]));
        const recs = await this.prisma.ledgerRecord.findMany({
            where: { organization_id: ctx.organization_id, type: 'EXPENSE', status: 'POSTED', deleted_at: null, transaction_date: { gte: from, lte: to } },
            select: { transaction_date: true, net_amount: true, category_id: true, subcategory_id: true, project_id: true, department_id: true },
        });
        const subjectsMap = new Map<string, { subject_key: string; label: string; months: { month: number; planned: number; actual: number }[] }>();
        for (const l of b.lines) {
            const s = subjectsMap.get(l.subject_key) ?? { subject_key: l.subject_key, label: cats.find((c) => `category:${c.id}` === l.subject_key)?.name ?? l.subject_key, months: Array.from({ length: 12 }, (_, i) => ({ month: i + 1, planned: 0, actual: 0 })) };
            s.months[l.month - 1].planned += Number(l.planned_amount);
            subjectsMap.set(l.subject_key, s);
        }
        for (const r of recs) {
            const fm = ((r.transaction_date.getUTCMonth() - (startMonth - 1) + 12) % 12) + 1;
            const keys: string[] = [];
            if (b.scope === LedgerBudgetScope.CATEGORY) {
                if (r.category_id) keys.push(`category:${r.category_id}`);
                if (r.subcategory_id) keys.push(`category:${r.subcategory_id}`);
                if (r.category_id && parentOf.get(r.category_id)) keys.push(`category:${parentOf.get(r.category_id)}`);
            } else if (b.scope === LedgerBudgetScope.PROJECT && r.project_id) keys.push(`project:${r.project_id}`);
            else if (b.scope === LedgerBudgetScope.DEPARTMENT && r.department_id) keys.push(`department:${r.department_id}`);
            for (const k of new Set(keys)) {
                const s = subjectsMap.get(k);
                if (s) s.months[fm - 1].actual += Number(r.net_amount);
            }
        }
        return [...subjectsMap.values()].map((s) => {
            const planned = s.months.reduce((a, m) => a + m.planned, 0);
            const actual = s.months.reduce((a, m) => a + m.actual, 0);
            return { ...s, months: s.months.map((m) => ({ ...m, planned: Math.round(m.planned * 100) / 100, actual: Math.round(m.actual * 100) / 100 })), planned_total: Math.round(planned * 100) / 100, actual_total: Math.round(actual * 100) / 100, used_percent: planned ? Math.round((actual / planned) * 1000) / 10 : null, over_warn: planned > 0 && (actual / planned) * 100 >= b.warn_percent };
        });
    }

    async createBudget(ctx: OrgContext, dto: CreateBudgetDto) {
        const lines = await this.budgetLines(ctx, dto.scope ?? LedgerBudgetScope.CATEGORY, dto.lines ?? []);
        try {
            const b = await this.prisma.ledgerBudget.create({
                data: {
                    organization_id: ctx.organization_id, name: dto.name, fiscal_year: dto.fiscal_year, scope: dto.scope, basis: dto.basis, currency: dto.currency ?? (await this.config.reportingCurrency(ctx.organization_id)),
                    status: dto.status, warn_percent: dto.warn_percent, notes: dto.notes ?? null, owner_membership_id: ctx.membership_id, lines: { create: lines },
                },
            });
            await this.audit.record(ctx, 'ledger.budget.created', { resource_type: 'ledger_budget', resource_id: b.id, metadata: { name: b.name, fiscal_year: b.fiscal_year, lines: lines.length } });
            this.events.publish(ctx, { event_key: 'finance.budget.created', module: ModuleKey.INCOME_EXPENSE, entity_kind: 'ledger_budget', entity_id: b.id, payload: { name: b.name } });
            return this.getBudget(ctx, b.id);
        } catch (e) {
            if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') throw new ConflictException({ message: 'A budget with this name already exists for the year', code: 'budget_conflict' });
            throw e;
        }
    }

    async updateBudget(ctx: OrgContext, id: string, dto: UpdateBudgetDto) {
        const before = await this.getBudget(ctx, id);
        const lines = dto.lines ? await this.budgetLines(ctx, dto.scope ?? before.scope, dto.lines) : null;
        await this.prisma.$transaction(async (tx) => {
            if (lines) {
                await tx.ledgerBudgetLine.deleteMany({ where: { budget_id: id } });
                await tx.ledgerBudgetLine.createMany({ data: lines.map((l) => ({ ...l, budget_id: id })) });
            }
            const { lines: _l, ...rest } = dto;
            await tx.ledgerBudget.update({ where: { id }, data: rest });
        });
        await this.audit.record(ctx, 'ledger.budget.updated', { resource_type: 'ledger_budget', resource_id: id, metadata: { before: { name: before.name, status: before.status, lines: before.lines.length }, after: { ...dto, lines: lines?.length } } });
        this.events.publish(ctx, { event_key: 'finance.budget.updated', module: ModuleKey.INCOME_EXPENSE, entity_kind: 'ledger_budget', entity_id: id });
        return this.getBudget(ctx, id);
    }

    async deleteBudget(ctx: OrgContext, id: string) {
        const b = await this.getBudget(ctx, id);
        await this.prisma.ledgerBudget.delete({ where: { id } });
        await this.audit.record(ctx, 'ledger.budget.deleted', { resource_type: 'ledger_budget', resource_id: id, metadata: { name: b.name, fiscal_year: b.fiscal_year } });
        this.events.publish(ctx, { event_key: 'finance.budget.deleted', module: ModuleKey.INCOME_EXPENSE, entity_kind: 'ledger_budget', entity_id: id });
        return { success: true };
    }

    private async budgetLines(ctx: OrgContext, scope: LedgerBudgetScope, lines: NonNullable<CreateBudgetDto['lines']>) {
        const out: { subject_key: string; category_id: string | null; project_id: string | null; department_id: string | null; month: number; planned_amount: Prisma.Decimal }[] = [];
        for (const l of lines) {
            const id = scope === 'CATEGORY' ? l.category_id : scope === 'PROJECT' ? l.project_id : l.department_id;
            if (!id) throw new ConflictException({ message: `Each line needs a ${scope.toLowerCase()}`, code: 'budget_line_subject' });
            const exists =
                scope === 'CATEGORY' ? await this.prisma.ledgerCategory.findFirst({ where: { id, organization_id: ctx.organization_id } })
                    : scope === 'PROJECT' ? await this.prisma.project.findFirst({ where: { id, organization_id: ctx.organization_id } })
                        : await this.prisma.team.findFirst({ where: { id, organization_id: ctx.organization_id } });
            if (!exists) throw new NotFoundException({ message: `Budget ${scope.toLowerCase()} not found`, code: 'reference_not_found' });
            out.push({ subject_key: `${scope.toLowerCase()}:${id}`, category_id: scope === 'CATEGORY' ? id : null, project_id: scope === 'PROJECT' ? id : null, department_id: scope === 'DEPARTMENT' ? id : null, month: l.month, planned_amount: dec(l.planned_amount) });
        }
        const seen = new Set<string>();
        for (const l of out) {
            const k = `${l.subject_key}:${l.month}`;
            if (seen.has(k)) throw new ConflictException({ message: 'A subject has two amounts for the same month', code: 'budget_line_duplicate' });
            seen.add(k);
        }
        return out;
    }

    // =============================================================================================
    // Financial periods
    // =============================================================================================

    async listPeriods(ctx: OrgContext, q: { year?: number; type?: FinancialPeriodType; status?: FinancialPeriodStatus }) {
        return this.prisma.financialPeriod.findMany({
            where: { organization_id: ctx.organization_id, ...(q.year && { fiscal_year: q.year }), ...(q.type && { type: q.type }), ...(q.status && { status: q.status }) },
            orderBy: [{ start_date: 'desc' }, { type: 'asc' }],
            include: { closed_by: { select: { id: true, user: { select: { display_name: true, first_name: true, last_name: true, email: true } } } }, _count: { select: { records: true } } },
        });
    }

    async getPeriod(ctx: OrgContext, id: string, basis: LedgerReportBasis = 'ACCRUAL') {
        const p = await this.prisma.financialPeriod.findFirst({ where: { id, organization_id: ctx.organization_id }, include: { summaries: { where: { scope_key: 'org' } }, vat_returns: true } });
        if (!p) throw new NotFoundException({ message: 'Period not found', code: 'period_not_found' });
        const stored = p.summaries.find((s) => s.basis === basis && s.is_final);
        const live = stored ? null : await this.reports.dashboard(ctx, { from: iso(p.start_date), to: iso(p.end_date), basis });
        return { ...p, summary: stored ?? (live ? { basis, currency: live.currency, ...live.totals, trend: live.trend, expenses_by_category: live.expenses_by_category, income_by_category: live.income_by_category, is_final: false } : null) };
    }

    async createPeriod(ctx: OrgContext, dto: CreatePeriodDto) {
        const start = toDateOnly(dto.start_date)!;
        const end = toDateOnly(dto.end_date)!;
        if (end < start) throw new ConflictException({ message: 'The end date is before the start date', code: 'period_dates' });
        try {
            const p = await this.prisma.financialPeriod.create({ data: { organization_id: ctx.organization_id, type: dto.type, name: dto.name, fiscal_year: dto.fiscal_year ?? start.getUTCFullYear(), start_date: start, end_date: end, notes: dto.notes ?? null } });
            await this.assignRecords(ctx.organization_id, p.id, start, end, p.type);
            await this.audit.record(ctx, 'ledger.period.created', { resource_type: 'financial_period', resource_id: p.id, metadata: { name: p.name, start: dto.start_date, end: dto.end_date } });
            this.events.publish(ctx, { event_key: 'finance.period.created', module: ModuleKey.INCOME_EXPENSE, entity_kind: 'financial_period', entity_id: p.id, payload: { name: p.name } });
            return p;
        } catch (e) {
            if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') throw new ConflictException({ message: 'This period already exists', code: 'period_conflict' });
            throw e;
        }
    }

    /** Create the 12 months / 4 quarters / 1 year of a fiscal year (skips existing ones). */
    async generatePeriods(ctx: OrgContext, dto: GeneratePeriodsDto) {
        const settings = await this.config.settings(ctx.organization_id);
        const sm = settings.fiscal_year_start_month - 1;
        const type = dto.type ?? 'MONTH';
        const specs: { name: string; start: Date; end: Date }[] = [];
        if (type === 'YEAR') specs.push({ name: `FY ${dto.fiscal_year}`, start: new Date(Date.UTC(dto.fiscal_year, sm, 1)), end: new Date(Date.UTC(dto.fiscal_year + 1, sm, 0)) });
        else {
            const step = type === 'MONTH' ? 1 : 3;
            for (let i = 0; i < 12; i += step) {
                const start = new Date(Date.UTC(dto.fiscal_year, sm + i, 1));
                const end = new Date(Date.UTC(dto.fiscal_year, sm + i + step, 0));
                specs.push({ name: type === 'MONTH' ? `${MONTHS[start.getUTCMonth()]} ${start.getUTCFullYear()}` : `Q${i / 3 + 1} ${dto.fiscal_year}`, start, end });
            }
        }
        let created = 0;
        for (const s of specs) {
            const exists = await this.prisma.financialPeriod.findFirst({ where: { organization_id: ctx.organization_id, type, start_date: s.start, end_date: s.end } });
            if (exists) continue;
            const p = await this.prisma.financialPeriod.create({ data: { organization_id: ctx.organization_id, type, name: s.name, fiscal_year: dto.fiscal_year, start_date: s.start, end_date: s.end } });
            await this.assignRecords(ctx.organization_id, p.id, s.start, s.end, type);
            created++;
        }
        await this.audit.record(ctx, 'ledger.period.generated', { resource_type: 'financial_period', metadata: { fiscal_year: dto.fiscal_year, type, created } });
        this.events.publish(ctx, { event_key: 'finance.period.generated', module: ModuleKey.INCOME_EXPENSE, entity_kind: 'financial_period', payload: { fiscal_year: dto.fiscal_year, type, created } });
        return { created };
    }

    private async assignRecords(organizationId: string, periodId: string, start: Date, end: Date, type: FinancialPeriodType) {
        await this.prisma.ledgerRecord.updateMany({ where: { organization_id: organizationId, transaction_date: { gte: start, lte: end }, ...(type === 'MONTH' ? {} : { period_id: null }) }, data: { period_id: periodId } });
    }

    async setPeriodStatus(ctx: OrgContext, id: string, action: 'close' | 'reopen' | 'lock') {
        const p = await this.prisma.financialPeriod.findFirst({ where: { id, organization_id: ctx.organization_id } });
        if (!p) throw new NotFoundException({ message: 'Period not found', code: 'period_not_found' });
        if (action === 'close' && p.status !== 'OPEN') throw new ConflictException({ message: 'Only open periods can be closed', code: 'period_not_open' });
        if (action === 'reopen' && p.status !== 'CLOSED') throw new ConflictException({ message: 'Only closed periods can be reopened; locked periods stay locked', code: 'period_not_closed' });
        if (action === 'lock' && p.status === 'LOCKED') throw new ConflictException({ message: 'Period is already locked', code: 'period_locked' });
        if (action === 'close') {
            const pending = await this.prisma.ledgerRecord.count({ where: { organization_id: ctx.organization_id, deleted_at: null, status: 'PENDING_REVIEW', transaction_date: { gte: p.start_date, lte: p.end_date } } });
            if (pending) throw new ConflictException({ message: `${pending} record(s) in this period still wait for approval`, code: 'period_pending_records' });
        }
        const status = action === 'close' ? FinancialPeriodStatus.CLOSED : action === 'reopen' ? FinancialPeriodStatus.OPEN : FinancialPeriodStatus.LOCKED;
        const row = await this.prisma.financialPeriod.update({
            where: { id },
            data: { status, ...(action === 'close' && { closed_at: new Date(), closed_by_membership_id: ctx.membership_id }), ...(action === 'lock' && { locked_at: new Date(), ...(p.status === 'OPEN' && { closed_at: new Date(), closed_by_membership_id: ctx.membership_id }) }), ...(action === 'reopen' && { closed_at: null }) },
        });
        if (action === 'close' || action === 'lock') await this.materializeSummaries(ctx, row.id, true);
        if (action === 'reopen') await this.prisma.financialPeriodSummary.updateMany({ where: { period_id: id }, data: { is_final: false } });
        await this.audit.record(ctx, `ledger.period.${action === 'close' ? 'closed' : action === 'reopen' ? 'reopened' : 'locked'}`, { resource_type: 'financial_period', resource_id: id, metadata: { name: p.name, before: { status: p.status }, after: { status }, sensitive: true } });
        this.events.publish(ctx, { event_key: `finance.period.${action === 'close' ? 'closed' : action === 'reopen' ? 'reopened' : 'locked'}`, module: ModuleKey.INCOME_EXPENSE, entity_kind: 'financial_period', entity_id: id, payload: { name: p.name } });
        return row;
    }

    /** Store ACCRUAL and CASH summaries of a period (final when the period closes). */
    async materializeSummaries(ctx: OrgContext, periodId: string, final: boolean) {
        const p = await this.prisma.financialPeriod.findUniqueOrThrow({ where: { id: periodId } });
        for (const basis of [LedgerReportBasis.ACCRUAL, LedgerReportBasis.CASH]) {
            const d = await this.reports.dashboard(systemContext(ctx.organization_id), { from: iso(p.start_date), to: iso(p.end_date), basis });
            const pl = await this.reports.profitLoss(systemContext(ctx.organization_id), { from: iso(p.start_date), to: iso(p.end_date), basis });
            const vat = await this.reports.vat(systemContext(ctx.organization_id), { from: iso(p.start_date), to: iso(p.end_date), basis, group_by: 'category' });
            const data = {
                organization_id: ctx.organization_id, currency: d.currency, total_income: d.totals.total_income, total_expenses: d.totals.total_expenses, net_profit: d.totals.net_profit, gross_income: d.totals.gross_income,
                outstanding_income: d.receivables.amount, outstanding_expenses: d.payables.amount, vat_collected: d.totals.vat_collected, vat_paid: d.totals.vat_paid, net_vat: d.totals.net_vat,
                recurring_expenses: d.totals.recurring_expenses, payroll_expenses: d.totals.payroll_expenses, operating_expenses: d.totals.operating_expenses,
                income_by_category: d.income_by_category as unknown as Prisma.InputJsonValue, expenses_by_category: d.expenses_by_category as unknown as Prisma.InputJsonValue,
                pl_lines: { ...Object.fromEntries(pl.lines.map((l) => [l.line, l.amount])), total_expenses: pl.total_expenses, net_operating_result: pl.net_operating_result } as Prisma.InputJsonValue,
                vat_breakdown: { by_category: vat.groups } as unknown as Prisma.InputJsonValue, trend: d.trend as unknown as Prisma.InputJsonValue, is_final: final, generated_at: new Date(),
            };
            await this.prisma.financialPeriodSummary.upsert({ where: { period_id_basis_scope_key: { period_id: periodId, basis, scope_key: 'org' } }, create: { ...data, period_id: periodId, basis, scope_key: 'org' }, update: data });
        }
    }

    // --- VAT returns -----------------------------------------------------------------------------------

    async createVatReturn(ctx: OrgContext, periodId: string, basis: LedgerReportBasis = 'ACCRUAL') {
        const p = await this.prisma.financialPeriod.findFirst({ where: { id: periodId, organization_id: ctx.organization_id } });
        if (!p) throw new NotFoundException({ message: 'Period not found', code: 'period_not_found' });
        if (p.status === 'OPEN') throw new ConflictException({ message: 'Close the period before preparing its VAT return', code: 'period_not_closed' });
        const v = await this.reports.vat(systemContext(ctx.organization_id), { from: iso(p.start_date), to: iso(p.end_date), basis });
        const row = await this.prisma.vatReturn.upsert({
            where: { period_id_basis: { period_id: periodId, basis } },
            create: { organization_id: ctx.organization_id, period_id: periodId, basis, currency: v.currency, vat_collected: v.vat_collected, vat_paid: v.vat_paid, net_vat: v.net_vat },
            update: { vat_collected: v.vat_collected, vat_paid: v.vat_paid, net_vat: v.net_vat },
        });
        if (row.status !== 'DRAFT') throw new ConflictException({ message: 'This VAT return is already filed', code: 'vat_return_filed' });
        await this.audit.record(ctx, 'ledger.vat_return.prepared', { resource_type: 'vat_return', resource_id: row.id, metadata: { period: p.name, net_vat: row.net_vat.toString(), sensitive: true } });
        this.events.publish(ctx, { event_key: 'finance.vat_return.prepared', module: ModuleKey.INCOME_EXPENSE, entity_kind: 'vat_return', entity_id: row.id, payload: { period: p.name } });
        return row;
    }

    async updateVatReturn(ctx: OrgContext, id: string, action: 'file' | 'paid', input: { authority_reference?: string | null; document_id?: string | null; notes?: string | null }) {
        const r = await this.prisma.vatReturn.findFirst({ where: { id, organization_id: ctx.organization_id } });
        if (!r) throw new NotFoundException({ message: 'VAT return not found', code: 'vat_return_not_found' });
        if (action === 'file' && r.status !== 'DRAFT') throw new ConflictException({ message: 'Already filed', code: 'vat_return_filed' });
        if (action === 'paid' && r.status !== 'FILED') throw new ConflictException({ message: 'File the return first', code: 'vat_return_not_filed' });
        const row = await this.prisma.vatReturn.update({
            where: { id },
            data: action === 'file'
                ? { status: VatReturnStatus.FILED, filed_at: new Date(), filed_by_membership_id: ctx.membership_id, authority_reference: input.authority_reference ?? null, document_id: input.document_id ?? null, notes: input.notes ?? r.notes }
                : { status: VatReturnStatus.PAID, paid_at: new Date() },
        });
        await this.audit.record(ctx, action === 'file' ? 'ledger.vat_return.filed' : 'ledger.vat_return.paid', { resource_type: 'vat_return', resource_id: id, metadata: { authority_reference: input.authority_reference, sensitive: true } });
        this.events.publish(ctx, { event_key: action === 'file' ? 'finance.vat_return.filed' : 'finance.vat_return.paid', module: ModuleKey.INCOME_EXPENSE, entity_kind: 'vat_return', entity_id: id });
        return row;
    }

    // =============================================================================================
    // Insights (rule-based detection; the AI layer adds summaries when an AI connection exists)
    // =============================================================================================

    async listInsights(ctx: OrgContext, q: InsightQuery) {
        const where: Prisma.LedgerInsightWhereInput = { organization_id: ctx.organization_id, status: q.status ?? LedgerInsightStatus.OPEN, ...(q.kind && { kind: q.kind }), OR: [{ record_id: null }, { record: this.records.readWhere(ctx) }] };
        const [items, total] = await Promise.all([
            this.prisma.ledgerInsight.findMany({ where, ...skipTake(q), orderBy: { created_at: 'desc' }, include: { record: { select: { id: true, number: true, description: true, gross_amount: true, currency: true, type: true } } } }),
            this.prisma.ledgerInsight.count({ where }),
        ]);
        return paginate(items, total, q);
    }

    async resolveInsight(ctx: OrgContext, id: string, accept: boolean) {
        const insight = await this.prisma.ledgerInsight.findFirst({ where: { id, organization_id: ctx.organization_id }, include: { record: true } });
        if (!insight) throw new NotFoundException({ message: 'Insight not found', code: 'insight_not_found' });
        if (insight.record) this.records.assertKey(ctx, insight.record.type, 'update');
        if (accept && insight.kind === LedgerInsightKind.CATEGORY_SUGGESTION && insight.record_id) {
            const categoryId = (insight.data as { category_id?: string } | null)?.category_id;
            if (categoryId) await this.records.update(ctx, insight.record_id, { category_id: categoryId });
        }
        const row = await this.prisma.ledgerInsight.update({ where: { id }, data: { status: accept ? LedgerInsightStatus.ACCEPTED : LedgerInsightStatus.DISMISSED, resolved_at: new Date(), resolved_by_membership_id: ctx.membership_id } });
        await this.audit.record(ctx, accept ? 'ledger.insight.accepted' : 'ledger.insight.dismissed', { resource_type: 'ledger_insight', resource_id: id, metadata: { kind: insight.kind, record_id: insight.record_id } });
        return row;
    }

    /** Detect unusual expenses, suspected duplicates and budget overruns (idempotent per record / budget). */
    async detectInsights(ctx: OrgContext) {
        const settings = await this.config.settings(ctx.organization_id);
        if (!settings.ai_enabled && !settings.duplicate_detection_enabled) return { created: 0 };
        const since = new Date(Date.now() - 180 * 86_400_000);
        const recent = await this.prisma.ledgerRecord.findMany({
            where: { organization_id: ctx.organization_id, type: 'EXPENSE', status: { in: ['POSTED', 'PENDING_REVIEW'] }, deleted_at: null, transaction_date: { gte: since } },
            select: { id: true, number: true, category_id: true, company_id: true, gross_amount: true, reference_number: true, transaction_date: true, description: true, currency: true, created_at: true },
        });
        const existing = new Set((await this.prisma.ledgerInsight.findMany({ where: { organization_id: ctx.organization_id, record_id: { in: recent.map((r) => r.id) } }, select: { record_id: true, kind: true } })).map((i) => `${i.kind}:${i.record_id}`));
        const created: Prisma.LedgerInsightCreateManyInput[] = [];
        // Unusual: more than 2× the category average and above 100.
        const byCat = new Map<string, number[]>();
        for (const r of recent) if (r.category_id) byCat.set(r.category_id, [...(byCat.get(r.category_id) ?? []), Number(r.gross_amount)]);
        const fresh = recent.filter((r) => r.created_at > new Date(Date.now() - 45 * 86_400_000));
        for (const r of fresh) {
            const values = r.category_id ? byCat.get(r.category_id) ?? [] : [];
            if (values.length >= 3) {
                const avg = values.reduce((a, v) => a + v, 0) / values.length;
                const amount = Number(r.gross_amount);
                if (amount > 100 && amount > avg * 2 && !existing.has(`UNUSUAL_EXPENSE:${r.id}`)) {
                    created.push({ organization_id: ctx.organization_id, kind: LedgerInsightKind.UNUSUAL_EXPENSE, severity: amount > avg * 4 ? 'high' : 'medium', confidence: 70, title: `${r.number} is ${(amount / avg).toFixed(1)}× the usual amount for its category`, body: `${r.description}: ${amount.toFixed(2)} ${r.currency} vs an average of ${avg.toFixed(2)}.`, record_id: r.id, data: { average: avg } });
                }
            }
            // Duplicates: same supplier, same gross, same reference or within 7 days.
            if (settings.duplicate_detection_enabled && r.company_id && !existing.has(`DUPLICATE_SUSPECTED:${r.id}`)) {
                const twin = recent.find((o) => o.id !== r.id && o.company_id === r.company_id && dec(o.gross_amount).equals(r.gross_amount) && o.created_at < r.created_at && ((r.reference_number && o.reference_number === r.reference_number) || Math.abs(o.transaction_date.getTime() - r.transaction_date.getTime()) < 7 * 86_400_000));
                if (twin) created.push({ organization_id: ctx.organization_id, kind: LedgerInsightKind.DUPLICATE_SUSPECTED, severity: 'high', confidence: twin.reference_number && twin.reference_number === r.reference_number ? 90 : 60, title: `${r.number} may duplicate ${twin.number}`, body: `Same supplier and amount (${Number(r.gross_amount).toFixed(2)} ${r.currency}).`, record_id: r.id, data: { duplicate_of: twin.id } });
            }
        }
        // Budget alerts.
        const budgets = await this.prisma.ledgerBudget.findMany({ where: { organization_id: ctx.organization_id, status: 'ACTIVE', fiscal_year: todayUtc().getUTCFullYear() }, include: { lines: true } });
        for (const b of budgets) {
            const subjects = await this.actuals(systemContext(ctx.organization_id), b);
            for (const s of subjects.filter((x) => x.over_warn)) {
                const exists = await this.prisma.ledgerInsight.findFirst({ where: { organization_id: ctx.organization_id, kind: 'BUDGET_ALERT', status: 'OPEN', data: { path: ['subject_key'], equals: `${b.id}:${s.subject_key}` } } });
                if (!exists) created.push({ organization_id: ctx.organization_id, kind: LedgerInsightKind.BUDGET_ALERT, severity: (s.used_percent ?? 0) >= 100 ? 'high' : 'medium', title: `${s.label} used ${s.used_percent}% of budget "${b.name}"`, body: `Actual ${s.actual_total.toFixed(2)} of planned ${s.planned_total.toFixed(2)} ${b.currency}.`, data: { budget_id: b.id, subject_key: `${b.id}:${s.subject_key}` } });
            }
        }
        if (created.length) await this.prisma.ledgerInsight.createMany({ data: created });
        if (created.length) this.events.publish(ctx, { event_key: 'finance.insights.detected', module: ModuleKey.INCOME_EXPENSE, entity_kind: 'ledger_insight', payload: { count: created.length } });
        return { created: created.length };
    }

    /** Nightly: insights for every organization with ledger records; mark overdue records. */
    @Cron(CronExpression.EVERY_DAY_AT_3AM, { name: 'ledger-nightly' })
    async nightly() {
        const today = todayUtc();
        try {
            await this.prisma.ledgerRecord.updateMany({ where: { status: 'POSTED', deleted_at: null, payment_status: { in: ['UNPAID', 'PARTIALLY_PAID'] }, due_date: { lt: today }, amount_remaining: { gt: 0 } }, data: { payment_status: 'OVERDUE' } });
            const orgs = await this.prisma.ledgerSettings.findMany({ select: { organization_id: true } });
            for (const o of orgs) {
                try {
                    await this.detectInsights(systemContext(o.organization_id));
                } catch (error) {
                    this.logger.warn(`insights failed for ${o.organization_id}: ${(error as Error).message}`);
                }
            }
        } catch (error) {
            this.logger.error(`ledger nightly failed: ${(error as Error).message}`);
        }
    }

}
