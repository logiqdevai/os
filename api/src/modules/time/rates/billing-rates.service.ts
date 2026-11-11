import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { BillingRateScope, ModuleKey, Prisma, TimeRateKind } from 'generated/prisma';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import { AuditService } from '@/shared/audit/audit.service';
import { EventsService } from '@/shared/events/events.service';
import { OrgContext } from '@/shared/authorization/interfaces/org-context.interface';
import { orderBy, paginate, skipTake } from '@/shared/utils/pagination/pagination.utils';
import { MEMBER_SELECT, TimeAccessService } from '../common/time-access.service';
import { isoDate, toDateOnly, todayUtc } from '../common/time-dates';
import { BillingRateQuery, CreateBillingRateDto, ResolveRateQuery, UpdateBillingRateDto } from './dto/billing-rate.dto';

const RATE_INCLUDE = {
    project: { select: { id: true, name: true, code: true } },
    membership: { select: MEMBER_SELECT },
    activity_type: { select: { id: true, name: true } },
    product: { select: { id: true, name: true } },
    _count: { select: { billed_entries: true, costed_entries: true } },
} satisfies Prisma.BillingRateInclude;

/**
 * 18 §2, §6 — rate cards with effective dates. Used rates are immutable except for name, notes and end date: to change
 * a price, end-date the rate and create a new one so snapshotted entries stay consistent.
 */
@Injectable()
export class BillingRatesService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly audit: AuditService,
        private readonly events: EventsService,
        private readonly access: TimeAccessService,
    ) { }

    async findAll(ctx: OrgContext, query: BillingRateQuery) {
        const today = todayUtc();
        const status = query.status ?? 'active';
        const statusWhere: Prisma.BillingRateWhereInput =
            status === 'archived' ? { archived_at: { not: null } }
                : status === 'expired' ? { archived_at: null, effective_to: { lt: today } }
                    : status === 'scheduled' ? { archived_at: null, effective_from: { gt: today } }
                        : status === 'all' ? {}
                            : { archived_at: null, effective_from: { lte: today }, OR: [{ effective_to: null }, { effective_to: { gte: today } }] };
        const where: Prisma.BillingRateWhereInput = {
            organization_id: ctx.organization_id,
            ...statusWhere,
            ...(query.kind && { kind: query.kind }),
            ...(query.scope && { scope: query.scope }),
            ...(query.project_id && { project_id: query.project_id }),
            ...(query.membership_id && { membership_id: query.membership_id }),
            ...(query.activity_type_id && { activity_type_id: query.activity_type_id }),
            ...(query.search && { OR: [{ name: { contains: query.search, mode: 'insensitive' } }, { project: { name: { contains: query.search, mode: 'insensitive' } } }] }),
        };
        const [items, total] = await Promise.all([
            this.prisma.billingRate.findMany({ where, ...skipTake(query), orderBy: [{ kind: 'asc' }, { scope: 'asc' }, orderBy(query, ['effective_from', 'hourly_rate', 'created_at'], 'effective_from')], include: RATE_INCLUDE }),
            this.prisma.billingRate.count({ where }),
        ]);
        return paginate(items, total, query);
    }

    async findOne(ctx: OrgContext, id: string) {
        const rate = await this.prisma.billingRate.findFirst({ where: { id, organization_id: ctx.organization_id }, include: RATE_INCLUDE });
        if (!rate) throw new NotFoundException({ message: 'Rate not found', code: 'rate_not_found' });
        return rate;
    }

    async resolve(ctx: OrgContext, query: ResolveRateQuery) {
        const date = query.date ? toDateOnly(query.date) : todayUtc();
        const input = { membership_id: query.membership_id, project_id: query.project_id ?? null, activity_type_id: query.activity_type_id ?? null, date };
        const [billing, cost] = await Promise.all([this.access.resolveRate(ctx.organization_id, TimeRateKind.BILLING, input), this.access.resolveRate(ctx.organization_id, TimeRateKind.COST, input)]);
        return { date: isoDate(date), billing, cost };
    }

    async create(ctx: OrgContext, dto: CreateBillingRateDto) {
        const data = await this.validate(ctx, dto);
        const rate = await this.prisma.billingRate.create({ data: { ...data, organization_id: ctx.organization_id, created_by_membership_id: ctx.membership_id }, include: RATE_INCLUDE });
        await this.audit.record(ctx, 'time.rate.created', { resource_type: 'billing_rate', resource_id: rate.id, metadata: { after: dto } });
        this.events.publish(ctx, { event_key: 'time.rate.created', module: ModuleKey.TIME_TRACKING, entity_kind: 'billing_rate', entity_id: rate.id, payload: { kind: rate.kind, scope: rate.scope, project_id: rate.project_id, membership_id: rate.membership_id } });
        return rate;
    }

    async update(ctx: OrgContext, id: string, dto: UpdateBillingRateDto) {
        const before = await this.findOne(ctx, id);
        const used = before._count.billed_entries + before._count.costed_entries > 0;
        if (used && (dto.hourly_rate !== undefined || dto.currency !== undefined || dto.effective_from !== undefined)) {
            throw new ConflictException({ message: 'This rate is already used by time entries. End-date it and create a new rate instead.', code: 'rate_in_use' });
        }
        const data = await this.validate(ctx, {
            kind: before.kind, scope: before.scope, product_id: before.product_id ?? undefined, project_id: before.project_id ?? undefined, membership_id: before.membership_id ?? undefined,
            activity_type_id: before.activity_type_id ?? undefined, currency: dto.currency ?? before.currency, hourly_rate: dto.hourly_rate ?? Number(before.hourly_rate),
            effective_from: dto.effective_from ?? isoDate(before.effective_from), effective_to: dto.effective_to !== undefined ? dto.effective_to : before.effective_to ? isoDate(before.effective_to) : null,
            name: dto.name ?? before.name ?? undefined, notes: dto.notes ?? before.notes ?? undefined,
        }, id);
        const rate = await this.prisma.billingRate.update({ where: { id }, data: { name: data.name, notes: data.notes, effective_to: data.effective_to, hourly_rate: data.hourly_rate, currency: data.currency, effective_from: data.effective_from }, include: RATE_INCLUDE });
        await this.audit.record(ctx, 'time.rate.updated', { resource_type: 'billing_rate', resource_id: id, metadata: { before: { hourly_rate: Number(before.hourly_rate), currency: before.currency, effective_from: isoDate(before.effective_from), effective_to: before.effective_to && isoDate(before.effective_to) }, after: dto } });
        this.events.publish(ctx, { event_key: 'time.rate.updated', module: ModuleKey.TIME_TRACKING, entity_kind: 'billing_rate', entity_id: id, changes: dto as Record<string, unknown> });
        return rate;
    }

    async archive(ctx: OrgContext, id: string) {
        await this.findOne(ctx, id);
        const rate = await this.prisma.billingRate.update({ where: { id }, data: { archived_at: new Date() }, include: RATE_INCLUDE });
        await this.audit.record(ctx, 'time.rate.archived', { resource_type: 'billing_rate', resource_id: id });
        this.events.publish(ctx, { event_key: 'time.rate.archived', module: ModuleKey.TIME_TRACKING, entity_kind: 'billing_rate', entity_id: id });
        return rate;
    }

    private async validate(ctx: OrgContext, dto: CreateBillingRateDto, excludeId?: string) {
        const kind = dto.kind ?? TimeRateKind.BILLING;
        const needs: Record<BillingRateScope, ('project_id' | 'membership_id' | 'product_id')[]> = {
            ORGANIZATION: [], PRODUCT: ['product_id'], PROJECT: ['project_id'], MEMBER: ['membership_id'], PROJECT_MEMBER: ['project_id', 'membership_id'],
        };
        for (const f of needs[dto.scope]) if (!dto[f]) throw new BadRequestException({ message: `${dto.scope.replace('_', ' ').toLowerCase()} rates need ${f.replace('_id', '')}`, code: 'scope_target_required', field: f });
        if (kind === TimeRateKind.COST && !(['ORGANIZATION', 'MEMBER'] as BillingRateScope[]).includes(dto.scope)) {
            throw new BadRequestException({ message: 'Cost rates are set for the organization or a member', code: 'invalid_cost_scope', field: 'scope' });
        }
        const keep = (f: 'project_id' | 'membership_id' | 'product_id') => (needs[dto.scope].includes(f) ? dto[f] ?? null : null);
        const target = { project_id: keep('project_id'), membership_id: keep('membership_id'), product_id: keep('product_id') };
        const checks: Promise<unknown>[] = [];
        if (target.project_id) checks.push(this.prisma.project.findFirstOrThrow({ where: { id: target.project_id, organization_id: ctx.organization_id } }));
        if (target.membership_id) checks.push(this.prisma.membership.findFirstOrThrow({ where: { id: target.membership_id, organization_id: ctx.organization_id } }));
        if (target.product_id) checks.push(this.prisma.product.findFirstOrThrow({ where: { id: target.product_id, organization_id: ctx.organization_id } }));
        if (dto.activity_type_id) checks.push(this.prisma.timeActivityType.findFirstOrThrow({ where: { id: dto.activity_type_id, organization_id: ctx.organization_id } }));
        try {
            await Promise.all(checks);
        } catch {
            throw new NotFoundException({ message: 'Project, member, product or activity type not found', code: 'reference_not_found' });
        }
        const from = toDateOnly(dto.effective_from);
        const to = dto.effective_to ? toDateOnly(dto.effective_to) : null;
        if (to && to < from) throw new BadRequestException({ message: 'The end date must be on or after the start date', code: 'invalid_range', field: 'effective_to' });

        const overlap = await this.prisma.billingRate.findFirst({
            where: {
                organization_id: ctx.organization_id, kind, scope: dto.scope, archived_at: null, ...target, activity_type_id: dto.activity_type_id ?? null,
                ...(excludeId && { id: { not: excludeId } }),
                AND: [{ OR: [{ effective_to: null }, { effective_to: { gte: from } }] }, ...(to ? [{ effective_from: { lte: to } }] : [])],
            },
        });
        if (overlap) {
            throw new ConflictException({
                message: `Another ${kind.toLowerCase()} rate for this target is valid from ${isoDate(overlap.effective_from)}${overlap.effective_to ? ` to ${isoDate(overlap.effective_to)}` : ''}. End-date it first.`,
                code: 'rate_overlap', rate_id: overlap.id,
            });
        }
        return {
            kind, scope: dto.scope, ...target, activity_type_id: dto.activity_type_id ?? null, name: dto.name ?? null, currency: dto.currency,
            hourly_rate: dto.hourly_rate, effective_from: from, effective_to: to, notes: dto.notes ?? null,
        };
    }
}
