import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InvoiceStatus, ModuleKey, Prisma } from 'generated/prisma';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import { AuditService } from '@/shared/audit/audit.service';
import { EventsService } from '@/shared/events/events.service';
import { OrgContext } from '@/shared/authorization/interfaces/org-context.interface';
import { paginate, skipTake } from '@/shared/utils/pagination/pagination.utils';
import { scopeFilter } from '@/modules/finance-shared/finance-scope.utils';
import { BillingProfileQuery, CreateBillingProfileDto, UpdateBillingProfileDto } from '../dto/billing.schemas';

const READ = 'finance.invoices.read';
const OPEN: InvoiceStatus[] = ['OPEN', 'PENDING', 'PARTIALLY_PAID', 'OVERDUE'];

/** 08 "Customer Billing" — the billing profile of a CRM company (02 owns the company itself). */
@Injectable()
export class BillingProfilesService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly audit: AuditService,
        private readonly events: EventsService,
    ) { }

    scope(ctx: OrgContext): Prisma.BillingProfileWhereInput {
        return scopeFilter(ctx, READ, { company: 'company_id' }) as Prisma.BillingProfileWhereInput;
    }

    async findAll(ctx: OrgContext, q: BillingProfileQuery) {
        const where: Prisma.BillingProfileWhereInput = {
            organization_id: ctx.organization_id,
            AND: [this.scope(ctx), ...(q.search ? [{ OR: [{ legal_name: { contains: q.search, mode: 'insensitive' as const } }, { company: { name: { contains: q.search, mode: 'insensitive' as const } } }, { billing_email: { contains: q.search, mode: 'insensitive' as const } }] }] : [])],
        };
        const [items, total] = await Promise.all([
            this.prisma.billingProfile.findMany({
                where, ...skipTake(q), orderBy: { legal_name: 'asc' },
                include: { company: { select: { id: true, name: true, type: true } }, _count: { select: { invoices: true, subscriptions: { where: { status: { in: ['ACTIVE', 'TRIALING', 'PAST_DUE'] } } } } } },
            }),
            this.prisma.billingProfile.count({ where }),
        ]);
        const ids = items.map((i) => i.id);
        const [balances, paid] = ids.length
            ? await Promise.all([
                this.prisma.invoice.groupBy({ by: ['billing_profile_id'], where: { billing_profile_id: { in: ids }, status: { in: OPEN } }, _sum: { amount_due: true } }),
                this.prisma.invoice.groupBy({ by: ['billing_profile_id'], where: { billing_profile_id: { in: ids }, status: { notIn: ['DRAFT', 'VOID', 'CANCELLED'] } }, _sum: { amount_paid: true } }),
            ])
            : [[], []];
        const showMoney = ctx.can('finance.payments.read');
        return paginate(
            items.map((p) => ({ ...p, outstanding: balances.find((b) => b.billing_profile_id === p.id)?._sum.amount_due ?? 0, lifetime_paid: showMoney ? paid.find((b) => b.billing_profile_id === p.id)?._sum.amount_paid ?? 0 : null })),
            total,
            q,
        );
    }

    async findOne(ctx: OrgContext, idOrCompany: string) {
        const p = await this.prisma.billingProfile.findFirst({
            where: { organization_id: ctx.organization_id, OR: [{ id: idOrCompany }, { company_id: idOrCompany }], AND: [this.scope(ctx)] },
            include: {
                company: { select: { id: true, name: true, type: true, email: true, vat_number: true, country: true } },
                payment_methods: { where: { disabled_at: null }, select: { id: true, type: true, provider: true, brand: true, last4: true, exp_month: true, exp_year: true, is_default: true, created_at: true } },
                dunning_policy: { select: { id: true, name: true } },
                preferred_provider_connection: { select: { id: true, display_name: true, provider: true } },
            },
        });
        if (!p) throw new NotFoundException({ message: 'Billing profile not found', code: 'billing_profile_not_found' });
        const [open, paid, invoices, subscriptions, payments] = await Promise.all([
            this.prisma.invoice.aggregate({ where: { billing_profile_id: p.id, status: { in: OPEN } }, _sum: { amount_due: true }, _count: { _all: true } }),
            this.prisma.invoice.aggregate({ where: { billing_profile_id: p.id, status: { notIn: ['DRAFT', 'VOID', 'CANCELLED'] } }, _sum: { amount_paid: true, total: true } }),
            this.prisma.invoice.findMany({ where: { billing_profile_id: p.id }, orderBy: { created_at: 'desc' }, take: 10, select: { id: true, number: true, status: true, total: true, amount_due: true, currency: true, issue_date: true, due_date: true } }),
            this.prisma.subscription.findMany({ where: { billing_profile_id: p.id }, orderBy: { created_at: 'desc' }, take: 10, select: { id: true, status: true, period_amount: true, currency: true, interval: true, interval_count: true, current_period_end: true } }),
            ctx.can('finance.payments.read') ? this.prisma.payment.findMany({ where: { billing_profile_id: p.id }, orderBy: { created_at: 'desc' }, take: 10, select: { id: true, amount: true, currency: true, status: true, method_type: true, received_at: true, reference: true, provider: true } }) : Promise.resolve([]),
        ]);
        return {
            ...p,
            balance: { outstanding: open._sum.amount_due ?? 0, open_invoices: open._count._all, invoiced: paid._sum.total ?? 0, paid: ctx.can('finance.payments.read') ? paid._sum.amount_paid ?? 0 : null },
            recent_invoices: invoices, subscriptions, recent_payments: payments,
        };
    }

    async create(ctx: OrgContext, dto: CreateBillingProfileDto) {
        const company = await this.prisma.crmCompany.findFirst({ where: { id: dto.company_id, organization_id: ctx.organization_id }, select: { id: true, name: true, currency: true, vat_number: true } });
        if (!company) throw new NotFoundException({ message: 'Company not found', code: 'company_not_found' });
        await this.assertRefs(ctx, dto);
        const org = await this.prisma.organization.findUnique({ where: { id: ctx.organization_id }, select: { default_currency: true } });
        try {
            const p = await this.prisma.billingProfile.create({
                data: {
                    ...this.data(dto),
                    organization_id: ctx.organization_id, company_id: dto.company_id, legal_name: dto.legal_name,
                    currency: dto.currency ?? company.currency ?? org?.default_currency ?? 'EUR', vat_number: dto.vat_number ?? company.vat_number ?? null,
                },
            });
            await this.audit.record(ctx, 'finance.billing_profile.created', { resource_type: 'billing_profile', resource_id: p.id, metadata: { after: dto, sensitive: true } });
            this.events.publish(ctx, { event_key: 'finance.billing_profile.created', module: ModuleKey.FINANCE, entity_kind: 'billing_profile', entity_id: p.id, payload: { company_id: p.company_id, legal_name: p.legal_name }, activity: { summary: `Billing profile created for ${company.name}`, company_id: company.id } });
            return p;
        } catch (e) {
            if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') throw new ConflictException({ message: 'This company already has a billing profile', code: 'billing_profile_exists' });
            throw e;
        }
    }

    async update(ctx: OrgContext, id: string, dto: UpdateBillingProfileDto) {
        const before = await this.findOne(ctx, id);
        await this.assertRefs(ctx, dto);
        const p = await this.prisma.billingProfile.update({ where: { id: before.id }, data: { ...this.data(dto), ...(dto.legal_name && { legal_name: dto.legal_name }), ...(dto.currency && { currency: dto.currency }), ...(dto.vat_number !== undefined && { vat_number: dto.vat_number, vat_validation_status: 'UNKNOWN', vat_validated_at: null }) } });
        await this.audit.record(ctx, 'finance.billing_profile.updated', { resource_type: 'billing_profile', resource_id: before.id, metadata: { before: { legal_name: before.legal_name, billing_email: before.billing_email, vat_number: before.vat_number, currency: before.currency, payment_terms_days: before.payment_terms_days }, after: dto, sensitive: true } });
        this.events.publish(ctx, { event_key: 'finance.billing_profile.updated', module: ModuleKey.FINANCE, entity_kind: 'billing_profile', entity_id: before.id, changes: dto as Record<string, unknown> });
        return p;
    }

    private data(dto: UpdateBillingProfileDto) {
        return {
            ...(dto.billing_email !== undefined && { billing_email: dto.billing_email }),
            ...(dto.billing_contact_ids && { billing_contact_ids: dto.billing_contact_ids }),
            ...(dto.billing_address !== undefined && { billing_address: (dto.billing_address ?? Prisma.DbNull) as Prisma.InputJsonValue }),
            ...(dto.shipping_address !== undefined && { shipping_address: (dto.shipping_address ?? Prisma.DbNull) as Prisma.InputJsonValue }),
            ...(dto.tax_id !== undefined && { tax_id: dto.tax_id }),
            ...(dto.tax_exempt !== undefined && { tax_exempt: dto.tax_exempt }),
            ...(dto.reverse_charge !== undefined && { reverse_charge: dto.reverse_charge }),
            ...(dto.payment_terms_days !== undefined && { payment_terms_days: dto.payment_terms_days }),
            ...(dto.dunning_policy_id !== undefined && { dunning_policy_id: dto.dunning_policy_id }),
            ...(dto.preferred_provider_connection_id !== undefined && { preferred_provider_connection_id: dto.preferred_provider_connection_id }),
            ...(dto.custom_pricing !== undefined && { custom_pricing: (dto.custom_pricing ?? Prisma.DbNull) as Prisma.InputJsonValue }),
            ...(dto.notes !== undefined && { notes: dto.notes }),
        };
    }

    private async assertRefs(ctx: OrgContext, dto: UpdateBillingProfileDto) {
        if (dto.dunning_policy_id && !(await this.prisma.dunningPolicy.findFirst({ where: { id: dto.dunning_policy_id, organization_id: ctx.organization_id } }))) throw new NotFoundException({ message: 'Dunning policy not found', code: 'dunning_policy_not_found' });
        if (dto.preferred_provider_connection_id && !(await this.prisma.paymentProviderConnection.findFirst({ where: { id: dto.preferred_provider_connection_id, organization_id: ctx.organization_id } }))) throw new NotFoundException({ message: 'Payment provider connection not found', code: 'provider_connection_not_found' });
    }
}
