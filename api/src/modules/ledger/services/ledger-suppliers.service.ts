import { Injectable, NotFoundException } from '@nestjs/common';
import { CrmCompanyType, LedgerRecordStatus, LedgerRecordType, ModuleKey, Prisma } from 'generated/prisma';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import { AuditService } from '@/shared/audit/audit.service';
import { EventsService } from '@/shared/events/events.service';
import { OrgContext } from '@/shared/authorization/interfaces/org-context.interface';
import { paginate, skipTake } from '@/shared/utils/pagination/pagination.utils';
import { encryptJson, decryptJson } from '@/shared/utils/crypto/secret-box.utils';
import { SupplierProfileDto, SupplierQuery } from '../dto/ledger.schemas';

const mask = (iban?: string) => (iban ? `•••• ${iban.replace(/\s/g, '').slice(-4)}` : undefined);

/**
 * 09 "Expense Management" — suppliers ARE CRM companies of type VENDOR (02 §2a); this service only adds the ledger
 * profile (defaults for auto-categorization, payment terms, bank details) and spend figures. Bank details are stored
 * encrypted and only returned (masked) to callers holding finance.expenses.update.
 */
@Injectable()
export class LedgerSuppliersService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly audit: AuditService,
        private readonly events: EventsService,
    ) { }

    async findAll(ctx: OrgContext, query: SupplierQuery) {
        const where: Prisma.CrmCompanyWhereInput = {
            organization_id: ctx.organization_id,
            OR: [{ type: CrmCompanyType.VENDOR }, { ledger_supplier_profile: { isNot: null } }],
            ...(query.search && { name: { contains: query.search, mode: 'insensitive' } }),
            ...(query.category_id && { ledger_supplier_profile: { default_category_id: query.category_id } }),
        };
        const [items, total] = await Promise.all([
            this.prisma.crmCompany.findMany({
                where,
                ...skipTake(query),
                orderBy: { name: 'asc' },
                select: {
                    id: true, name: true, type: true, email: true, vat_number: true, country: true,
                    ledger_supplier_profile: { select: { id: true, payment_terms_days: true, default_category: { select: { id: true, name: true } }, default_tax_rate: { select: { id: true, name: true, percentage: true } }, vat_number: true } },
                },
            }),
            this.prisma.crmCompany.count({ where }),
        ]);
        const ids = items.map((c) => c.id);
        const yearStart = new Date(Date.UTC(new Date().getUTCFullYear(), 0, 1));
        const spend = ids.length
            ? await this.prisma.ledgerRecord.groupBy({
                by: ['company_id'],
                where: { organization_id: ctx.organization_id, company_id: { in: ids }, type: LedgerRecordType.EXPENSE, status: LedgerRecordStatus.POSTED, deleted_at: null, transaction_date: { gte: yearStart } },
                _sum: { gross_amount: true, amount_remaining: true },
                _count: { _all: true },
                _max: { transaction_date: true },
            })
            : [];
        return paginate(
            items.map((c) => {
                const s = spend.find((x) => x.company_id === c.id);
                return { ...c, spend_ytd: s?._sum.gross_amount ?? 0, outstanding: s?._sum.amount_remaining ?? 0, records_ytd: s?._count._all ?? 0, last_expense_at: s?._max.transaction_date ?? null };
            }),
            total,
            query,
        );
    }

    async findOne(ctx: OrgContext, companyId: string) {
        const company = await this.prisma.crmCompany.findFirst({
            where: { id: companyId, organization_id: ctx.organization_id },
            select: { id: true, name: true, legal_name: true, type: true, email: true, phone: true, website: true, vat_number: true, tax_id: true, country: true, address: true, ledger_supplier_profile: { include: { default_category: { select: { id: true, name: true } }, default_tax_rate: { select: { id: true, name: true, percentage: true } } } } },
        });
        if (!company) throw new NotFoundException({ message: 'Supplier not found', code: 'supplier_not_found' });
        const profile = company.ledger_supplier_profile;
        let bank: Record<string, string> | null = null;
        if (profile?.bank_details && ctx.can('finance.expenses.update')) {
            try {
                const raw = (profile.bank_details as { ciphertext?: string }).ciphertext;
                const plain = raw ? decryptJson(raw) : null;
                bank = plain ? { ...plain, iban: mask(plain.iban) ?? '' } : null;
            } catch {
                bank = null;
            }
        }
        const [totals, byMonth] = await Promise.all([
            this.prisma.ledgerRecord.aggregate({ where: { organization_id: ctx.organization_id, company_id: companyId, type: 'EXPENSE', status: 'POSTED', deleted_at: null }, _sum: { gross_amount: true, amount_remaining: true, vat_amount: true }, _count: { _all: true } }),
            this.prisma.ledgerRecord.findMany({ where: { organization_id: ctx.organization_id, company_id: companyId, type: 'EXPENSE', status: 'POSTED', deleted_at: null, transaction_date: { gte: new Date(Date.now() - 365 * 86_400_000) } }, select: { transaction_date: true, gross_amount: true } }),
        ]);
        const months: Record<string, number> = {};
        for (const r of byMonth) {
            const k = r.transaction_date.toISOString().slice(0, 7);
            months[k] = (months[k] ?? 0) + Number(r.gross_amount);
        }
        return {
            ...company,
            ledger_supplier_profile: profile ? { ...profile, bank_details: bank } : null,
            totals: { spend: totals._sum.gross_amount ?? 0, outstanding: totals._sum.amount_remaining ?? 0, vat: totals._sum.vat_amount ?? 0, records: totals._count._all },
            spend_by_month: Object.entries(months).sort(([a], [b]) => a.localeCompare(b)).map(([month, amount]) => ({ month, amount: Math.round(amount * 100) / 100 })),
        };
    }

    async upsertProfile(ctx: OrgContext, companyId: string, dto: SupplierProfileDto) {
        const company = await this.prisma.crmCompany.findFirst({ where: { id: companyId, organization_id: ctx.organization_id }, select: { id: true, name: true, ledger_supplier_profile: true } });
        if (!company) throw new NotFoundException({ message: 'Supplier not found', code: 'supplier_not_found' });
        if (dto.default_category_id) {
            const c = await this.prisma.ledgerCategory.findFirst({ where: { id: dto.default_category_id, organization_id: ctx.organization_id, kind: 'EXPENSE' } });
            if (!c) throw new NotFoundException({ message: 'Expense category not found', code: 'category_not_found' });
        }
        if (dto.default_tax_rate_id) {
            const t = await this.prisma.taxRate.findFirst({ where: { id: dto.default_tax_rate_id, organization_id: ctx.organization_id } });
            if (!t) throw new NotFoundException({ message: 'Tax rate not found', code: 'tax_rate_not_found' });
        }
        const { bank_details, ...rest } = dto;
        const bankJson = bank_details === undefined ? undefined : bank_details === null ? Prisma.DbNull : ({ ciphertext: encryptJson(Object.fromEntries(Object.entries(bank_details).filter(([, v]) => !!v)) as Record<string, string>), iban_hint: mask(bank_details.iban) ?? null } as Prisma.InputJsonValue);
        const row = await this.prisma.ledgerSupplierProfile.upsert({
            where: { company_id: companyId },
            create: { ...rest, organization_id: ctx.organization_id, company_id: companyId, ...(bankJson !== undefined && { bank_details: bankJson }) },
            update: { ...rest, ...(bankJson !== undefined && { bank_details: bankJson }) },
        });
        await this.audit.record(ctx, company.ledger_supplier_profile ? 'ledger.supplier_profile.updated' : 'ledger.supplier_profile.created', {
            resource_type: 'ledger_supplier_profile', resource_id: row.id,
            metadata: { company_id: companyId, after: { ...rest, bank_details: bank_details === undefined ? undefined : bank_details ? '[changed]' : null }, sensitive: bank_details !== undefined },
        });
        this.events.publish(ctx, { event_key: 'finance.supplier.updated', module: ModuleKey.INCOME_EXPENSE, entity_kind: 'ledger_supplier_profile', entity_id: row.id, payload: { company_id: companyId, name: company.name } });
        const { bank_details: _b, ...safe } = row;
        return safe;
    }
}
