import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { ModuleKey, Prisma, PriceType } from 'generated/prisma';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import { AuditService } from '@/shared/audit/audit.service';
import { EventsService } from '@/shared/events/events.service';
import { OrgContext } from '@/shared/authorization/interfaces/org-context.interface';
import { orderBy, paginate, skipTake } from '@/shared/utils/pagination/pagination.utils';
import { slugify } from '@/modules/auth/services/organization-setup.service';
import { dec, toDateOnly } from '@/modules/finance-shared/money.utils';
import { CreateCouponDto, CreateProductDto, CreateTaxRateDto, PriceDto, ProductQuery, UpdateProductDto, UpdateTaxRateDto } from '../dto/billing.schemas';

const M = ModuleKey.FINANCE;

/** 08 "Products & Services" + "Taxes & Discounts" — the platform catalog used by 02 deals, 03 proposals and invoices. */
@Injectable()
export class CatalogService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly audit: AuditService,
        private readonly events: EventsService,
    ) { }

    // --- Products & prices ------------------------------------------------------------------------------

    async listProducts(ctx: OrgContext, q: ProductQuery) {
        const where: Prisma.ProductWhereInput = {
            organization_id: ctx.organization_id,
            ...(q.archived ? { archived_at: { not: null } } : { archived_at: null }),
            ...(q.active !== undefined && { is_active: q.active }),
            ...(q.type && { type: q.type }),
            ...(q.search && { OR: [{ name: { contains: q.search, mode: 'insensitive' } }, { description: { contains: q.search, mode: 'insensitive' } }] }),
        };
        const [items, total] = await Promise.all([
            this.prisma.product.findMany({
                where, ...skipTake(q), orderBy: orderBy(q, ['name', 'created_at', 'type'], 'name'),
                include: { prices: { where: { is_active: true }, orderBy: { created_at: 'asc' } }, default_tax_rate: { select: { id: true, name: true, percentage: true, behavior: true } } },
            }),
            this.prisma.product.count({ where }),
        ]);
        return paginate(items, total, q);
    }

    async getProduct(ctx: OrgContext, id: string) {
        const p = await this.prisma.product.findFirst({ where: { id, organization_id: ctx.organization_id }, include: { prices: { orderBy: { created_at: 'asc' } }, default_tax_rate: true, _count: { select: { invoice_line_items: true, subscription_items: true } } } });
        if (!p) throw new NotFoundException({ message: 'Product not found', code: 'product_not_found' });
        return p;
    }

    async createProduct(ctx: OrgContext, dto: CreateProductDto) {
        await this.assertTaxRate(ctx, dto.default_tax_rate_id);
        const slug = await this.uniqueSlug(ctx.organization_id, dto.name);
        const product = await this.prisma.product.create({
            data: {
                organization_id: ctx.organization_id, slug, name: dto.name, type: dto.type, description: dto.description ?? null, unit: dto.unit ?? null,
                default_tax_rate_id: dto.default_tax_rate_id ?? null, is_active: dto.is_active ?? true,
                prices: { create: (dto.prices ?? []).map((p) => this.priceData(p)) },
            },
            include: { prices: true },
        });
        await this.audit.record(ctx, 'finance.product.created', { resource_type: 'product', resource_id: product.id, metadata: { after: dto } });
        this.events.publish(ctx, { event_key: 'finance.product.created', module: M, entity_kind: 'product', entity_id: product.id, payload: { name: product.name } });
        return product;
    }

    async updateProduct(ctx: OrgContext, id: string, dto: UpdateProductDto) {
        const before = await this.getProduct(ctx, id);
        await this.assertTaxRate(ctx, dto.default_tax_rate_id);
        const product = await this.prisma.product.update({ where: { id }, data: dto, include: { prices: true } });
        await this.audit.record(ctx, 'finance.product.updated', { resource_type: 'product', resource_id: id, metadata: { before: { name: before.name, type: before.type, is_active: before.is_active }, after: dto } });
        this.events.publish(ctx, { event_key: 'finance.product.updated', module: M, entity_kind: 'product', entity_id: id, changes: dto as Record<string, unknown> });
        return product;
    }

    async archiveProduct(ctx: OrgContext, id: string, archive: boolean) {
        await this.getProduct(ctx, id);
        const p = await this.prisma.product.update({ where: { id }, data: { archived_at: archive ? new Date() : null, is_active: !archive } });
        await this.audit.record(ctx, archive ? 'finance.product.archived' : 'finance.product.restored', { resource_type: 'product', resource_id: id });
        this.events.publish(ctx, { event_key: archive ? 'finance.product.archived' : 'finance.product.restored', module: M, entity_kind: 'product', entity_id: id, payload: { name: p.name } });
        return p;
    }

    async addPrice(ctx: OrgContext, productId: string, dto: PriceDto) {
        await this.getProduct(ctx, productId);
        const price = await this.prisma.price.create({ data: { ...this.priceData(dto), product_id: productId } });
        await this.audit.record(ctx, 'finance.price.created', { resource_type: 'price', resource_id: price.id, metadata: { product_id: productId, after: dto, sensitive: true } });
        this.events.publish(ctx, { event_key: 'finance.price.created', module: M, entity_kind: 'price', entity_id: price.id, payload: { product_id: productId } });
        return price;
    }

    /** Prices are immutable once used (history of invoices); changing an amount deactivates the old price and adds a new one. */
    async updatePrice(ctx: OrgContext, priceId: string, dto: Partial<PriceDto>) {
        const before = await this.prisma.price.findFirst({ where: { id: priceId, product: { organization_id: ctx.organization_id } }, include: { _count: { select: { invoice_line_items: true, subscription_items: true } } } });
        if (!before) throw new NotFoundException({ message: 'Price not found', code: 'price_not_found' });
        const used = before._count.invoice_line_items + before._count.subscription_items > 0;
        const amountChanged = (dto.unit_amount !== undefined && !dec(dto.unit_amount).equals(before.unit_amount)) || (dto.currency && dto.currency !== before.currency);
        let price;
        if (used && amountChanged) {
            price = await this.prisma.$transaction(async (tx) => {
                await tx.price.update({ where: { id: priceId }, data: { is_active: false } });
                return tx.price.create({ data: { ...this.priceData({ currency: before.currency, unit_amount: before.unit_amount.toString(), type: before.type, interval: before.interval, interval_count: before.interval_count, trial_days: before.trial_days, setup_fee: before.setup_fee?.toString() ?? null, name: before.name, ...dto } as PriceDto), product_id: before.product_id } });
            });
        } else {
            const data: Prisma.PriceUpdateInput = { ...dto, unit_amount: dto.unit_amount !== undefined ? dec(dto.unit_amount) : undefined, setup_fee: dto.setup_fee === undefined ? undefined : dto.setup_fee === null ? null : dec(dto.setup_fee) };
            price = await this.prisma.price.update({ where: { id: priceId }, data });
        }
        await this.audit.record(ctx, 'finance.price.updated', { resource_type: 'price', resource_id: priceId, metadata: { before: { unit_amount: before.unit_amount.toString(), currency: before.currency, is_active: before.is_active }, after: dto, replaced_by: price.id !== priceId ? price.id : undefined, sensitive: true } });
        this.events.publish(ctx, { event_key: 'finance.price.updated', module: M, entity_kind: 'price', entity_id: price.id, changes: dto as Record<string, unknown> });
        return price;
    }

    private priceData(p: PriceDto) {
        const recurring = p.type === PriceType.RECURRING || !!p.interval;
        return {
            name: p.name ?? null, currency: p.currency, unit_amount: dec(p.unit_amount), type: recurring ? PriceType.RECURRING : PriceType.ONE_TIME,
            interval: recurring ? p.interval ?? 'MONTH' : null, interval_count: recurring ? p.interval_count ?? 1 : null, trial_days: p.trial_days ?? null,
            setup_fee: p.setup_fee ? dec(p.setup_fee) : null, is_active: p.is_active ?? true,
        };
    }

    // --- Tax rates ------------------------------------------------------------------------------------------

    async listTaxRates(ctx: OrgContext, includeInactive = false) {
        return this.prisma.taxRate.findMany({
            where: { organization_id: ctx.organization_id, ...(includeInactive ? {} : { is_active: true }) },
            orderBy: [{ is_default: 'desc' }, { percentage: 'desc' }, { name: 'asc' }],
            include: { _count: { select: { line_items: true, products: true } } },
        });
    }

    async createTaxRate(ctx: OrgContext, dto: CreateTaxRateDto) {
        const rate = await this.prisma.$transaction(async (tx) => {
            if (dto.is_default) await tx.taxRate.updateMany({ where: { organization_id: ctx.organization_id }, data: { is_default: false } });
            return tx.taxRate.create({ data: { ...dto, percentage: dec(dto.percentage), organization_id: ctx.organization_id, ...(dto.is_reverse_charge && { percentage: dec(0) }) } });
        });
        await this.audit.record(ctx, 'finance.tax_rate.created', { resource_type: 'tax_rate', resource_id: rate.id, metadata: { after: dto } });
        this.events.publish(ctx, { event_key: 'finance.tax_rate.created', module: M, entity_kind: 'tax_rate', entity_id: rate.id, payload: { name: rate.name, percentage: rate.percentage.toString() } });
        return rate;
    }

    async updateTaxRate(ctx: OrgContext, id: string, dto: UpdateTaxRateDto) {
        const before = await this.prisma.taxRate.findFirst({ where: { id, organization_id: ctx.organization_id }, include: { _count: { select: { line_items: true } } } });
        if (!before) throw new NotFoundException({ message: 'Tax rate not found', code: 'tax_rate_not_found' });
        if (dto.percentage !== undefined && !dec(dto.percentage).equals(before.percentage) && before._count.line_items > 0) {
            throw new ConflictException({ message: 'This rate is used on invoices; create a new rate instead of changing its percentage', code: 'tax_rate_in_use' });
        }
        const rate = await this.prisma.$transaction(async (tx) => {
            if (dto.is_default) await tx.taxRate.updateMany({ where: { organization_id: ctx.organization_id, id: { not: id } }, data: { is_default: false } });
            return tx.taxRate.update({ where: { id }, data: { ...dto, percentage: dto.percentage !== undefined ? dec(dto.percentage) : undefined } });
        });
        await this.audit.record(ctx, 'finance.tax_rate.updated', { resource_type: 'tax_rate', resource_id: id, metadata: { before: { name: before.name, percentage: before.percentage.toString(), is_active: before.is_active }, after: dto } });
        this.events.publish(ctx, { event_key: 'finance.tax_rate.updated', module: M, entity_kind: 'tax_rate', entity_id: id, changes: dto as Record<string, unknown> });
        return rate;
    }

    // --- Coupons -----------------------------------------------------------------------------------------------

    async listCoupons(ctx: OrgContext, includeInactive = false) {
        return this.prisma.coupon.findMany({ where: { organization_id: ctx.organization_id, ...(includeInactive ? {} : { is_active: true }) }, orderBy: { created_at: 'desc' } });
    }

    async createCoupon(ctx: OrgContext, dto: CreateCouponDto) {
        try {
            const c = await this.prisma.coupon.create({
                data: {
                    organization_id: ctx.organization_id, name: dto.name, code: dto.code ? dto.code.toUpperCase() : null, type: dto.type, value: dec(dto.value), currency: dto.currency ?? null,
                    duration: dto.duration, duration_months: dto.duration_months ?? null, max_redemptions: dto.max_redemptions ?? null,
                    valid_from: toDateOnly(dto.valid_from), valid_until: toDateOnly(dto.valid_until), is_active: dto.is_active ?? true,
                },
            });
            await this.audit.record(ctx, 'finance.coupon.created', { resource_type: 'coupon', resource_id: c.id, metadata: { after: dto } });
            this.events.publish(ctx, { event_key: 'finance.coupon.created', module: M, entity_kind: 'coupon', entity_id: c.id, payload: { name: c.name, code: c.code } });
            return c;
        } catch (e) {
            if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') throw new ConflictException({ message: 'A coupon with this code already exists', code: 'coupon_code_taken' });
            throw e;
        }
    }

    async setCouponActive(ctx: OrgContext, id: string, active: boolean) {
        const before = await this.prisma.coupon.findFirst({ where: { id, organization_id: ctx.organization_id } });
        if (!before) throw new NotFoundException({ message: 'Coupon not found', code: 'coupon_not_found' });
        const c = await this.prisma.coupon.update({ where: { id }, data: { is_active: active } });
        await this.audit.record(ctx, active ? 'finance.coupon.activated' : 'finance.coupon.deactivated', { resource_type: 'coupon', resource_id: id });
        this.events.publish(ctx, { event_key: 'finance.coupon.updated', module: M, entity_kind: 'coupon', entity_id: id, changes: { is_active: active } });
        return c;
    }

    /** Validate a coupon for an amount/currency at a date (used by invoices and subscriptions). */
    async usableCoupon(ctx: OrgContext, id: string | null | undefined, currency: string) {
        if (!id) return null;
        const c = await this.prisma.coupon.findFirst({ where: { id, organization_id: ctx.organization_id } });
        if (!c) throw new NotFoundException({ message: 'Coupon not found', code: 'coupon_not_found' });
        const now = new Date();
        if (!c.is_active || (c.valid_from && c.valid_from > now) || (c.valid_until && c.valid_until < now)) throw new ConflictException({ message: `Coupon ${c.name} is not valid now`, code: 'coupon_invalid' });
        if (c.max_redemptions && c.redemptions >= c.max_redemptions) throw new ConflictException({ message: `Coupon ${c.name} has no redemptions left`, code: 'coupon_exhausted' });
        if (c.type === 'FIXED' && c.currency && c.currency !== currency) throw new ConflictException({ message: `Coupon ${c.name} is in ${c.currency}`, code: 'coupon_currency' });
        return c;
    }

    async assertTaxRate(ctx: OrgContext, id?: string | null) {
        if (!id) return;
        const r = await this.prisma.taxRate.findFirst({ where: { id, organization_id: ctx.organization_id }, select: { id: true } });
        if (!r) throw new NotFoundException({ message: 'Tax rate not found', code: 'tax_rate_not_found' });
    }

    private async uniqueSlug(organizationId: string, name: string) {
        const base = slugify(name) || 'product';
        let slug = base;
        for (let i = 2; await this.prisma.product.findFirst({ where: { organization_id: organizationId, slug }, select: { id: true } }); i++) slug = `${base}-${i}`;
        return slug;
    }
}
