import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { LedgerCategoryKind, LedgerPlLine, ModuleKey, PaymentMethodType, Prisma } from 'generated/prisma';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import { AuditService } from '@/shared/audit/audit.service';
import { EventsService } from '@/shared/events/events.service';
import { OrgContext } from '@/shared/authorization/interfaces/org-context.interface';
import { slugify } from '@/modules/auth/services/organization-setup.service';
import { dec, toDateOnly } from '@/modules/finance-shared/money.utils';
import {
    CreateLedgerCategoryDto, CreateLedgerPaymentMethodDto, LedgerCategoryQuery, UpdateLedgerCategoryDto, UpdateLedgerPaymentMethodDto, UpdateLedgerSettingsDto,
} from '../dto/ledger.schemas';

interface SeedCategory {
    key: string;
    name: string;
    pl: LedgerPlLine;
    operating?: boolean;
    children?: { key: string; name: string }[];
}

/** 09 "Financial Categories" — the default tree from the spec; created lazily the first time an organization opens the ledger. */
const DEFAULT_INCOME: SeedCategory[] = [
    { key: 'income.development', name: 'Software Development', pl: 'REVENUE' },
    { key: 'income.maintenance', name: 'Maintenance', pl: 'REVENUE' },
    { key: 'income.support', name: 'Support', pl: 'REVENUE' },
    { key: 'income.consulting', name: 'Consulting', pl: 'REVENUE' },
    { key: 'income.subscriptions', name: 'Subscriptions', pl: 'REVENUE' },
    { key: 'income.other', name: 'Other Income', pl: 'REVENUE' },
];
const DEFAULT_EXPENSE: SeedCategory[] = [
    { key: 'expense.employees', name: 'Employees', pl: 'EMPLOYEE_EXPENSES', children: [{ key: 'expense.employees.salaries', name: 'Salaries' }, { key: 'expense.employees.reimbursements', name: 'Reimbursements' }, { key: 'expense.employees.training', name: 'Training' }] },
    { key: 'expense.office', name: 'Office', pl: 'OFFICE_EXPENSES', children: [{ key: 'expense.office.rent', name: 'Rent' }, { key: 'expense.office.electricity', name: 'Electricity' }, { key: 'expense.office.water', name: 'Water' }, { key: 'expense.office.internet', name: 'Internet' }, { key: 'expense.office.supplies', name: 'Office supplies' }] },
    { key: 'expense.software', name: 'Software', pl: 'SOFTWARE_EXPENSES' },
    { key: 'expense.hosting', name: 'Hosting', pl: 'COST_OF_OPERATIONS', children: [{ key: 'expense.hosting.cloud', name: 'Cloud hosting' }, { key: 'expense.hosting.domains', name: 'Domains' }] },
    { key: 'expense.marketing', name: 'Marketing', pl: 'MARKETING_EXPENSES', children: [{ key: 'expense.marketing.advertising', name: 'Advertising' }] },
    { key: 'expense.equipment', name: 'Equipment', pl: 'OTHER_OPERATING_EXPENSES', children: [{ key: 'expense.equipment.hardware', name: 'Hardware' }] },
    { key: 'expense.professional', name: 'Professional Services', pl: 'PROFESSIONAL_EXPENSES', children: [{ key: 'expense.professional.accounting', name: 'Accounting fees' }, { key: 'expense.professional.legal', name: 'Legal fees' }] },
    { key: 'expense.travel', name: 'Travel', pl: 'OTHER_OPERATING_EXPENSES' },
    { key: 'expense.fees', name: 'Bank & payment fees', pl: 'COST_OF_OPERATIONS' },
    { key: 'expense.taxes', name: 'Taxes & government fees', pl: 'OTHER_OPERATING_EXPENSES', operating: false },
    { key: 'expense.insurance', name: 'Insurance', pl: 'OTHER_OPERATING_EXPENSES' },
    { key: 'expense.other', name: 'Other Expenses', pl: 'OTHER_OPERATING_EXPENSES' },
];

const DEFAULT_METHODS: { name: string; type: PaymentMethodType; track: boolean; is_default?: boolean }[] = [
    { name: 'Business bank account', type: PaymentMethodType.BANK_TRANSFER, track: true, is_default: true },
    { name: 'Company card', type: PaymentMethodType.CARD, track: false },
    { name: 'Cash', type: PaymentMethodType.CASH, track: true },
];

@Injectable()
export class LedgerConfigService {
    private seeded = new Set<string>();

    constructor(
        private readonly prisma: PrismaService,
        private readonly audit: AuditService,
        private readonly events: EventsService,
    ) { }

    // --- Settings -------------------------------------------------------------------------------------

    async settings(organizationId: string) {
        const existing = await this.prisma.ledgerSettings.findUnique({ where: { organization_id: organizationId } });
        if (existing) return existing;
        return this.prisma.ledgerSettings.upsert({ where: { organization_id: organizationId }, create: { organization_id: organizationId }, update: {} });
    }

    /** Reporting currency: ledger setting, else the organization default (01 §14). */
    async reportingCurrency(organizationId: string): Promise<string> {
        const [s, org] = await Promise.all([
            this.prisma.ledgerSettings.findUnique({ where: { organization_id: organizationId }, select: { reporting_currency: true } }),
            this.prisma.organization.findUnique({ where: { id: organizationId }, select: { default_currency: true } }),
        ]);
        return s?.reporting_currency ?? org?.default_currency ?? 'EUR';
    }

    async getSettings(ctx: OrgContext) {
        await this.ensureDefaults(ctx.organization_id);
        const settings = await this.settings(ctx.organization_id);
        return { ...settings, effective_reporting_currency: await this.reportingCurrency(ctx.organization_id) };
    }

    async updateSettings(ctx: OrgContext, dto: UpdateLedgerSettingsDto) {
        const before = await this.settings(ctx.organization_id);
        await this.assertTaxRates(ctx, [dto.default_income_tax_rate_id, dto.default_expense_tax_rate_id]);
        const data: Prisma.LedgerSettingsUncheckedUpdateInput = {
            ...dto,
            approval_threshold_amount: dto.approval_threshold_amount === undefined ? undefined : dto.approval_threshold_amount === null ? null : dec(dto.approval_threshold_amount),
        };
        const settings = await this.prisma.ledgerSettings.update({ where: { organization_id: ctx.organization_id }, data });
        await this.audit.record(ctx, 'ledger.settings.updated', { resource_type: 'ledger_settings', resource_id: ctx.organization_id, metadata: { before, after: dto, sensitive: true } });
        this.events.publish(ctx, { event_key: 'finance.ledger_settings.updated', module: ModuleKey.INCOME_EXPENSE, entity_kind: 'ledger_settings', entity_id: ctx.organization_id, changes: dto as Record<string, unknown> });
        return settings;
    }

    // --- Defaults ---------------------------------------------------------------------------------------

    /** Lazily create the default category tree and payment methods (idempotent by system_key / slug). */
    async ensureDefaults(organizationId: string) {
        if (this.seeded.has(organizationId)) return;
        const count = await this.prisma.ledgerCategory.count({ where: { organization_id: organizationId } });
        if (count === 0) {
            const create = async (kind: LedgerCategoryKind, list: SeedCategory[]) => {
                let order = 0;
                for (const c of list) {
                    const parent = await this.prisma.ledgerCategory.upsert({
                        where: { organization_id_slug: { organization_id: organizationId, slug: slugify(c.key) } },
                        create: { organization_id: organizationId, kind, name: c.name, slug: slugify(c.key), system_key: c.key, pl_line: c.pl, is_operating: c.operating ?? true, sort_order: order++ },
                        update: {},
                    });
                    let childOrder = 0;
                    for (const ch of c.children ?? []) {
                        await this.prisma.ledgerCategory.upsert({
                            where: { organization_id_slug: { organization_id: organizationId, slug: slugify(ch.key) } },
                            create: { organization_id: organizationId, kind, name: ch.name, slug: slugify(ch.key), system_key: ch.key, parent_category_id: parent.id, sort_order: childOrder++ },
                            update: {},
                        });
                    }
                }
            };
            await create(LedgerCategoryKind.INCOME, DEFAULT_INCOME);
            await create(LedgerCategoryKind.EXPENSE, DEFAULT_EXPENSE);
        }
        const methods = await this.prisma.ledgerPaymentMethod.count({ where: { organization_id: organizationId } });
        if (methods === 0) {
            const currency = await this.reportingCurrency(organizationId);
            for (const [i, m] of DEFAULT_METHODS.entries()) {
                await this.prisma.ledgerPaymentMethod.upsert({
                    where: { organization_id_slug: { organization_id: organizationId, slug: slugify(m.name) } },
                    create: { organization_id: organizationId, name: m.name, slug: slugify(m.name), type: m.type, track_balance: m.track, is_default: !!m.is_default, currency, sort_order: i },
                    update: {},
                });
            }
        }
        await this.settings(organizationId);
        this.seeded.add(organizationId);
    }

    /** Category id by system key (used by billing sync and payroll). */
    async categoryByKey(organizationId: string, systemKey: string) {
        await this.ensureDefaults(organizationId);
        return this.prisma.ledgerCategory.findFirst({ where: { organization_id: organizationId, system_key: systemKey, archived_at: null }, select: { id: true, name: true } });
    }

    // --- Categories ----------------------------------------------------------------------------------------

    async listCategories(ctx: OrgContext, query: LedgerCategoryQuery) {
        await this.ensureDefaults(ctx.organization_id);
        const rows = await this.prisma.ledgerCategory.findMany({
            where: { organization_id: ctx.organization_id, ...(query.kind && { kind: query.kind }), ...(query.archived ? {} : { archived_at: null }) },
            orderBy: [{ kind: 'asc' }, { sort_order: 'asc' }, { name: 'asc' }],
            include: { default_tax_rate: { select: { id: true, name: true, percentage: true } }, _count: { select: { records: { where: { deleted_at: null } } } } },
        });
        return rows;
    }

    async createCategory(ctx: OrgContext, dto: CreateLedgerCategoryDto) {
        if (dto.parent_category_id) {
            const parent = await this.prisma.ledgerCategory.findFirst({ where: { id: dto.parent_category_id, organization_id: ctx.organization_id } });
            if (!parent) throw new NotFoundException({ message: 'Parent category not found', code: 'category_not_found' });
            if (parent.kind !== dto.kind) throw new ConflictException({ message: 'A subcategory must have the same kind as its parent', code: 'category_kind_mismatch' });
            if (parent.parent_category_id) throw new ConflictException({ message: 'Only two levels are supported (category / subcategory)', code: 'category_depth' });
        }
        await this.assertTaxRates(ctx, [dto.default_tax_rate_id]);
        const slug = await this.uniqueSlug(ctx.organization_id, `${dto.kind}-${dto.name}`, 'category');
        const row = await this.prisma.ledgerCategory.create({ data: { ...dto, organization_id: ctx.organization_id, slug } });
        await this.audit.record(ctx, 'ledger.category.created', { resource_type: 'ledger_category', resource_id: row.id, metadata: { after: dto } });
        this.events.publish(ctx, { event_key: 'finance.category.created', module: ModuleKey.INCOME_EXPENSE, entity_kind: 'ledger_category', entity_id: row.id, payload: { name: row.name, kind: row.kind } });
        return row;
    }

    async updateCategory(ctx: OrgContext, id: string, dto: UpdateLedgerCategoryDto) {
        const before = await this.prisma.ledgerCategory.findFirst({ where: { id, organization_id: ctx.organization_id } });
        if (!before) throw new NotFoundException({ message: 'Category not found', code: 'category_not_found' });
        if (dto.parent_category_id === id) throw new ConflictException({ message: 'A category cannot be its own parent', code: 'category_cycle' });
        await this.assertTaxRates(ctx, [dto.default_tax_rate_id]);
        const row = await this.prisma.ledgerCategory.update({ where: { id }, data: dto });
        await this.audit.record(ctx, 'ledger.category.updated', { resource_type: 'ledger_category', resource_id: id, metadata: { before: { name: before.name, pl_line: before.pl_line, default_tax_rate_id: before.default_tax_rate_id }, after: dto } });
        this.events.publish(ctx, { event_key: 'finance.category.updated', module: ModuleKey.INCOME_EXPENSE, entity_kind: 'ledger_category', entity_id: id, changes: dto as Record<string, unknown> });
        return row;
    }

    async archiveCategory(ctx: OrgContext, id: string, archived = true) {
        const before = await this.prisma.ledgerCategory.findFirst({ where: { id, organization_id: ctx.organization_id } });
        if (!before) throw new NotFoundException({ message: 'Category not found', code: 'category_not_found' });
        const row = await this.prisma.ledgerCategory.update({ where: { id }, data: { archived_at: archived ? new Date() : null } });
        await this.audit.record(ctx, archived ? 'ledger.category.archived' : 'ledger.category.restored', { resource_type: 'ledger_category', resource_id: id });
        this.events.publish(ctx, { event_key: archived ? 'finance.category.archived' : 'finance.category.restored', module: ModuleKey.INCOME_EXPENSE, entity_kind: 'ledger_category', entity_id: id, payload: { name: row.name } });
        return row;
    }

    // --- Payment methods -------------------------------------------------------------------------------------

    async listPaymentMethods(ctx: OrgContext, includeArchived = false) {
        await this.ensureDefaults(ctx.organization_id);
        return this.prisma.ledgerPaymentMethod.findMany({
            where: { organization_id: ctx.organization_id, ...(includeArchived ? {} : { archived_at: null }) },
            orderBy: [{ sort_order: 'asc' }, { name: 'asc' }],
            select: { id: true, name: true, slug: true, type: true, track_balance: true, currency: true, iban_last4: true, opening_balance: true, opening_date: true, is_default: true, archived_at: true, created_at: true },
        });
    }

    async createPaymentMethod(ctx: OrgContext, dto: CreateLedgerPaymentMethodDto) {
        const slug = await this.uniqueSlug(ctx.organization_id, dto.name, 'method');
        const row = await this.prisma.$transaction(async (tx) => {
            if (dto.is_default) await tx.ledgerPaymentMethod.updateMany({ where: { organization_id: ctx.organization_id }, data: { is_default: false } });
            return tx.ledgerPaymentMethod.create({
                data: {
                    organization_id: ctx.organization_id, slug, name: dto.name, type: dto.type, track_balance: dto.track_balance ?? false, currency: dto.currency ?? null, iban_last4: dto.iban_last4 ?? null,
                    opening_balance: dto.opening_balance ? dec(dto.opening_balance) : null, opening_date: toDateOnly(dto.opening_date), is_default: !!dto.is_default,
                },
            });
        });
        await this.audit.record(ctx, 'ledger.payment_method.created', { resource_type: 'ledger_payment_method', resource_id: row.id, metadata: { after: { name: dto.name, type: dto.type } } });
        this.events.publish(ctx, { event_key: 'finance.payment_method.created', module: ModuleKey.INCOME_EXPENSE, entity_kind: 'ledger_payment_method', entity_id: row.id, payload: { name: row.name } });
        return row;
    }

    async updatePaymentMethod(ctx: OrgContext, id: string, dto: UpdateLedgerPaymentMethodDto, archive?: boolean) {
        const before = await this.prisma.ledgerPaymentMethod.findFirst({ where: { id, organization_id: ctx.organization_id } });
        if (!before) throw new NotFoundException({ message: 'Payment method not found', code: 'payment_method_not_found' });
        const row = await this.prisma.$transaction(async (tx) => {
            if (dto.is_default) await tx.ledgerPaymentMethod.updateMany({ where: { organization_id: ctx.organization_id, id: { not: id } }, data: { is_default: false } });
            return tx.ledgerPaymentMethod.update({
                where: { id },
                data: {
                    ...dto,
                    opening_balance: dto.opening_balance === undefined ? undefined : dto.opening_balance === null ? null : dec(dto.opening_balance),
                    opening_date: dto.opening_date === undefined ? undefined : toDateOnly(dto.opening_date),
                    ...(archive !== undefined && { archived_at: archive ? new Date() : null }),
                },
            });
        });
        await this.audit.record(ctx, archive ? 'ledger.payment_method.archived' : 'ledger.payment_method.updated', { resource_type: 'ledger_payment_method', resource_id: id, metadata: { before: { name: before.name, opening_balance: before.opening_balance }, after: dto } });
        this.events.publish(ctx, { event_key: 'finance.payment_method.updated', module: ModuleKey.INCOME_EXPENSE, entity_kind: 'ledger_payment_method', entity_id: id, changes: dto as Record<string, unknown> });
        return row;
    }

    // --- helpers -----------------------------------------------------------------------------------------------

    async assertTaxRates(ctx: OrgContext, ids: (string | null | undefined)[]) {
        const list = ids.filter((x): x is string => !!x);
        if (!list.length) return;
        const n = await this.prisma.taxRate.count({ where: { id: { in: list }, organization_id: ctx.organization_id } });
        if (n !== new Set(list).size) throw new NotFoundException({ message: 'Tax rate not found', code: 'tax_rate_not_found' });
    }

    private async uniqueSlug(organizationId: string, name: string, kind: 'category' | 'method') {
        const base = slugify(name) || kind;
        let slug = base;
        const exists = (s: string) =>
            kind === 'category'
                ? this.prisma.ledgerCategory.findFirst({ where: { organization_id: organizationId, slug: s }, select: { id: true } })
                : this.prisma.ledgerPaymentMethod.findFirst({ where: { organization_id: organizationId, slug: s }, select: { id: true } });
        for (let i = 2; await exists(slug); i++) slug = `${base}-${i}`;
        return slug;
    }
}
