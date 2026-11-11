import { ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { LedgerRecordSource, LedgerRecordType, ModuleKey, Prisma, RecurringExpense, RecurringExpenseStatus } from 'generated/prisma';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import { AuditService } from '@/shared/audit/audit.service';
import { EventsService } from '@/shared/events/events.service';
import { OrgContext } from '@/shared/authorization/interfaces/org-context.interface';
import { orderBy, paginate, skipTake } from '@/shared/utils/pagination/pagination.utils';
import { addDays, addInterval, computeVat, dec, todayUtc, toDateOnly } from '@/modules/finance-shared/money.utils';
import { scopeFilter } from '@/modules/finance-shared/finance-scope.utils';
import { systemContext } from '@/modules/finance-shared/system-context.utils';
import { LedgerConfigService } from './ledger-config.service';
import { LedgerRecordsService } from './ledger-records.service';
import { CreateRecurringExpenseDto, RecurringQuery, UpdateRecurringExpenseDto } from '../dto/ledger.schemas';

const READ = 'finance.recurring_expenses.read';
const iso = (d: Date | null | undefined) => (d ? d.toISOString().slice(0, 10) : null);

/**
 * 09 "Recurring Expenses" — templates that generate expense records on a schedule. The daily job (below) generates every
 * due occurrence; editing a template only affects future records.
 */
@Injectable()
export class RecurringExpensesService {
    private readonly logger = new Logger(RecurringExpensesService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly audit: AuditService,
        private readonly events: EventsService,
        private readonly config: LedgerConfigService,
        private readonly records: LedgerRecordsService,
    ) { }

    async findAll(ctx: OrgContext, query: RecurringQuery) {
        const where: Prisma.RecurringExpenseWhereInput = {
            organization_id: ctx.organization_id,
            AND: [
                scopeFilter(ctx, READ, { branch: 'branch_id', company: 'company_id', project: 'project_id' }) as Prisma.RecurringExpenseWhereInput,
                ...(query.search ? [{ OR: [{ name: { contains: query.search, mode: 'insensitive' as const } }, { company: { name: { contains: query.search, mode: 'insensitive' as const } } }] }] : []),
            ],
            ...(query.status?.length && { status: { in: query.status } }),
        };
        const [items, total, monthly] = await Promise.all([
            this.prisma.recurringExpense.findMany({
                where,
                ...skipTake(query),
                orderBy: orderBy(query, ['name', 'next_occurrence_date', 'expected_gross_amount', 'created_at'], 'next_occurrence_date'),
                include: { category: { select: { id: true, name: true } }, company: { select: { id: true, name: true } }, project: { select: { id: true, name: true } }, payment_method: { select: { id: true, name: true } } },
            }),
            this.prisma.recurringExpense.count({ where }),
            this.prisma.recurringExpense.findMany({ where: { organization_id: ctx.organization_id, status: RecurringExpenseStatus.ACTIVE }, select: { expected_gross_amount: true, interval: true, interval_count: true } }),
        ]);
        const perMonth: Record<string, number> = { DAY: 30.4375, WEEK: 4.348125, MONTH: 1, QUARTER: 1 / 3, YEAR: 1 / 12 };
        const monthlyTotal = monthly.reduce((acc, r) => acc.plus(dec(r.expected_gross_amount).times(perMonth[r.interval]).dividedBy(r.interval_count || 1)), dec(0));
        return { ...paginate(items, total, query), monthly_total: monthlyTotal.toDecimalPlaces(2).toString() };
    }

    async findOne(ctx: OrgContext, id: string) {
        const row = await this.prisma.recurringExpense.findFirst({
            where: { id, organization_id: ctx.organization_id, AND: [scopeFilter(ctx, READ, { branch: 'branch_id', company: 'company_id', project: 'project_id' }) as Prisma.RecurringExpenseWhereInput] },
            include: {
                category: { select: { id: true, name: true } }, subcategory: { select: { id: true, name: true } }, company: { select: { id: true, name: true } }, project: { select: { id: true, name: true } },
                payment_method: { select: { id: true, name: true } }, tax_rate: { select: { id: true, name: true, percentage: true } },
                records: { where: { deleted_at: null }, orderBy: { transaction_date: 'desc' }, take: 24, select: { id: true, number: true, transaction_date: true, gross_amount: true, status: true, payment_status: true, currency: true } },
            },
        });
        if (!row) throw new NotFoundException({ message: 'Recurring expense not found', code: 'recurring_expense_not_found' });
        return { ...row, preview: this.preview(row, 6) };
    }

    async create(ctx: OrgContext, dto: CreateRecurringExpenseDto) {
        await this.assertRefs(ctx, dto);
        const data = await this.toData(ctx, dto);
        const row = await this.prisma.recurringExpense.create({ data: { ...data, organization_id: ctx.organization_id, created_by_membership_id: ctx.membership_id } as Prisma.RecurringExpenseUncheckedCreateInput });
        await this.audit.record(ctx, 'ledger.recurring_expense.created', { resource_type: 'recurring_expense', resource_id: row.id, metadata: { after: dto } });
        this.events.publish(ctx, { event_key: 'finance.recurring_expense.created', module: ModuleKey.INCOME_EXPENSE, entity_kind: 'recurring_expense', entity_id: row.id, payload: { name: row.name, gross: row.expected_gross_amount.toString() } });
        return row;
    }

    async update(ctx: OrgContext, id: string, dto: UpdateRecurringExpenseDto) {
        const before = await this.findOne(ctx, id);
        await this.assertRefs(ctx, dto);
        const merged: CreateRecurringExpenseDto = {
            name: dto.name ?? before.name,
            expected_net_amount: dto.expected_net_amount ?? before.expected_net_amount.toString(),
            vat_percent: dto.vat_percent ?? before.vat_percent.toString(),
            pricing_mode: dto.pricing_mode ?? before.pricing_mode,
            start_date: dto.start_date ?? iso(before.start_date)!,
            interval: dto.interval ?? before.interval,
            interval_count: dto.interval_count ?? before.interval_count,
            day_of_month: dto.day_of_month !== undefined ? dto.day_of_month : before.day_of_month,
            end_date: dto.end_date !== undefined ? dto.end_date : iso(before.end_date),
            currency: dto.currency ?? before.currency,
        };
        const data = await this.toData(ctx, { ...dto, ...merged } as CreateRecurringExpenseDto, before);
        const row = await this.prisma.recurringExpense.update({ where: { id }, data: data as Prisma.RecurringExpenseUncheckedUpdateInput });
        await this.audit.record(ctx, 'ledger.recurring_expense.updated', { resource_type: 'recurring_expense', resource_id: id, metadata: { before: { name: before.name, expected_net_amount: before.expected_net_amount.toString(), interval: before.interval }, after: dto } });
        this.events.publish(ctx, { event_key: 'finance.recurring_expense.updated', module: ModuleKey.INCOME_EXPENSE, entity_kind: 'recurring_expense', entity_id: id, changes: dto as Record<string, unknown> });
        return row;
    }

    async setStatus(ctx: OrgContext, id: string, action: 'pause' | 'resume' | 'end') {
        const before = await this.findOne(ctx, id);
        const map = { pause: RecurringExpenseStatus.PAUSED, resume: RecurringExpenseStatus.ACTIVE, end: RecurringExpenseStatus.ENDED };
        if (before.status === RecurringExpenseStatus.ENDED || before.status === RecurringExpenseStatus.CANCELLED) throw new ConflictException({ message: 'This recurring expense has ended', code: 'recurring_expense_ended' });
        const data: Prisma.RecurringExpenseUpdateInput = { status: map[action] };
        if (action === 'pause') data.paused_at = new Date();
        if (action === 'end') data.ended_at = new Date();
        if (action === 'resume') {
            data.paused_at = null;
            // Skip occurrences that fell while paused.
            let next = before.next_occurrence_date ?? before.start_date;
            while (next < todayUtc()) next = addInterval(next, before.interval, before.interval_count, before.day_of_month);
            data.next_occurrence_date = next;
        }
        const row = await this.prisma.recurringExpense.update({ where: { id }, data });
        await this.audit.record(ctx, `ledger.recurring_expense.${action === 'end' ? 'ended' : action === 'pause' ? 'paused' : 'resumed'}`, { resource_type: 'recurring_expense', resource_id: id });
        this.events.publish(ctx, { event_key: `finance.recurring_expense.${action === 'end' ? 'ended' : action === 'pause' ? 'paused' : 'resumed'}`, module: ModuleKey.INCOME_EXPENSE, entity_kind: 'recurring_expense', entity_id: id, payload: { name: row.name } });
        return row;
    }

    /** Generate the next occurrence now (or the occurrence of `date`). */
    async generateNow(ctx: OrgContext, id: string) {
        const row = await this.findOne(ctx, id);
        if (row.status !== RecurringExpenseStatus.ACTIVE) throw new ConflictException({ message: 'Resume the recurring expense first', code: 'recurring_expense_not_active' });
        const record = await this.generateOccurrence(ctx, row);
        return record;
    }

    /** Upcoming occurrences of all active templates within `days` (for the calendar and reminders). */
    async upcoming(ctx: OrgContext, days = 30) {
        const until = addDays(todayUtc(), days);
        const rows = await this.prisma.recurringExpense.findMany({
            where: { organization_id: ctx.organization_id, status: RecurringExpenseStatus.ACTIVE, next_occurrence_date: { lte: until }, AND: [scopeFilter(ctx, READ, { branch: 'branch_id', company: 'company_id', project: 'project_id' }) as Prisma.RecurringExpenseWhereInput] },
            include: { company: { select: { id: true, name: true } }, category: { select: { id: true, name: true } } },
            orderBy: { next_occurrence_date: 'asc' },
        });
        const out: { recurring_expense_id: string; name: string; date: string; gross: string; currency: string; company?: string | null; category?: string | null }[] = [];
        for (const r of rows) {
            let d = r.next_occurrence_date!;
            while (d <= until && (!r.end_date || d <= r.end_date)) {
                out.push({ recurring_expense_id: r.id, name: r.name, date: iso(d)!, gross: r.expected_gross_amount.toString(), currency: r.currency, company: r.company?.name, category: r.category?.name });
                d = addInterval(d, r.interval, r.interval_count, r.day_of_month);
            }
        }
        return out.sort((a, b) => a.date.localeCompare(b.date));
    }

    // --- Daily job (registered with 20 as a scheduled job; runs in-process until 20 exists) ---------------------------------

    @Cron(CronExpression.EVERY_DAY_AT_2AM, { name: 'ledger-recurring-expenses' })
    async runDaily() {
        const today = todayUtc();
        const due = await this.prisma.recurringExpense.findMany({ where: { status: RecurringExpenseStatus.ACTIVE, auto_generate: true, next_occurrence_date: { lte: today } }, take: 500 });
        for (const r of due) {
            try {
                const ctx = systemContext(r.organization_id);
                // Catch up on missed occurrences (max 12 per run).
                let guard = 0;
                let current: RecurringExpense | null = r;
                while (current && current.status === RecurringExpenseStatus.ACTIVE && current.next_occurrence_date && current.next_occurrence_date <= today && guard++ < 12) {
                    await this.generateOccurrence(ctx, current);
                    current = await this.prisma.recurringExpense.findUnique({ where: { id: r.id } });
                }
            } catch (error) {
                this.logger.error(`recurring expense ${r.id} failed: ${(error as Error).message}`);
            }
        }
    }

    private async generateOccurrence(ctx: OrgContext, r: RecurringExpense) {
        const date = r.next_occurrence_date ?? r.start_date;
        const sequence = r.occurrences_generated + 1;
        const record = await this.records.create(
            ctx,
            {
                type: LedgerRecordType.EXPENSE,
                description: r.description ? `${r.name} — ${r.description}` : r.name,
                category_id: r.category_id, subcategory_id: r.subcategory_id, company_id: r.company_id, project_id: r.project_id, department_id: r.department_id,
                branch_id: r.branch_id, payment_method_id: r.payment_method_id, tax_rate_id: r.tax_rate_id, vat_treatment: r.vat_treatment,
                pricing_mode: 'EXCLUSIVE', net_amount: r.expected_net_amount.toString(), vat_percent: r.vat_percent.toString(), currency: r.currency,
                transaction_date: iso(date)!, due_date: r.due_days != null ? iso(addDays(date, r.due_days)) : null, status: 'POSTED',
            },
            { source: LedgerRecordSource.RECURRING_EXPENSE, recurring_expense_id: r.id, recurrence_sequence: sequence, is_manual: false },
        );
        const next = addInterval(date, r.interval, r.interval_count, r.day_of_month);
        const ended = r.end_date && next > r.end_date;
        await this.prisma.recurringExpense.update({
            where: { id: r.id },
            data: { occurrences_generated: sequence, last_generated_at: new Date(), next_occurrence_date: ended ? null : next, ...(ended && { status: RecurringExpenseStatus.ENDED, ended_at: new Date() }) },
        });
        this.events.publish(ctx, { event_key: 'finance.recurring_expense.generated', module: ModuleKey.INCOME_EXPENSE, entity_kind: 'recurring_expense', entity_id: r.id, payload: { record_id: record.id, number: record.number, sequence } });
        return record;
    }

    private preview(r: RecurringExpense, count: number) {
        const out: { date: string; gross: string }[] = [];
        let d = r.next_occurrence_date ?? r.start_date;
        for (let i = 0; i < count && (!r.end_date || d <= r.end_date); i++) {
            out.push({ date: iso(d)!, gross: r.expected_gross_amount.toString() });
            d = addInterval(d, r.interval, r.interval_count, r.day_of_month);
        }
        return out;
    }

    private async toData(ctx: OrgContext, dto: CreateRecurringExpenseDto, before?: RecurringExpense) {
        let vatPercent = dto.vat_percent;
        if (vatPercent === undefined && dto.tax_rate_id) {
            const rate = await this.prisma.taxRate.findFirst({ where: { id: dto.tax_rate_id, organization_id: ctx.organization_id } });
            vatPercent = rate?.percentage.toString();
        }
        const amounts = computeVat({ net_amount: dto.expected_net_amount, gross_amount: dto.expected_net_amount, vat_percent: vatPercent ?? '0', pricing_mode: dto.pricing_mode ?? 'EXCLUSIVE' });
        const start = toDateOnly(dto.start_date)!;
        const scheduleChanged = !before || dto.start_date !== iso(before.start_date) || dto.interval !== before.interval || dto.interval_count !== before.interval_count || dto.day_of_month !== before.day_of_month;
        let next = before?.next_occurrence_date ?? start;
        if (scheduleChanged) {
            next = start;
            if (before) while (next < todayUtc()) next = addInterval(next, dto.interval ?? 'MONTH', dto.interval_count ?? 1, dto.day_of_month);
        }
        const { expected_net_amount: _n, vat_percent: _v, start_date: _s, end_date: _e, ...rest } = dto;
        return {
            ...rest,
            currency: dto.currency ?? (await this.config.reportingCurrency(ctx.organization_id)),
            expected_net_amount: amounts.net_amount,
            vat_percent: amounts.vat_percent,
            expected_vat_amount: amounts.vat_amount,
            expected_gross_amount: amounts.gross_amount,
            start_date: start,
            end_date: dto.end_date ? toDateOnly(dto.end_date) : null,
            next_occurrence_date: next,
        };
    }

    private async assertRefs(ctx: OrgContext, dto: UpdateRecurringExpenseDto) {
        const org = ctx.organization_id;
        const checks: [string | null | undefined, () => Promise<unknown>, string][] = [
            [dto.category_id, () => this.prisma.ledgerCategory.findFirst({ where: { id: dto.category_id!, organization_id: org, kind: 'EXPENSE' } }), 'Expense category'],
            [dto.subcategory_id, () => this.prisma.ledgerCategory.findFirst({ where: { id: dto.subcategory_id!, organization_id: org } }), 'Subcategory'],
            [dto.company_id, () => this.prisma.crmCompany.findFirst({ where: { id: dto.company_id!, organization_id: org } }), 'Supplier'],
            [dto.project_id, () => this.prisma.project.findFirst({ where: { id: dto.project_id!, organization_id: org } }), 'Project'],
            [dto.payment_method_id, () => this.prisma.ledgerPaymentMethod.findFirst({ where: { id: dto.payment_method_id!, organization_id: org } }), 'Payment method'],
            [dto.tax_rate_id, () => this.prisma.taxRate.findFirst({ where: { id: dto.tax_rate_id!, organization_id: org } }), 'Tax rate'],
        ];
        for (const [id, find, label] of checks) {
            if (id && !(await find())) throw new NotFoundException({ message: `${label} not found`, code: 'reference_not_found' });
        }
    }
}
