import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { CrmSalesTarget, CrmTargetPeriod, ModuleKey, Prisma } from 'generated/prisma';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import { AuditService } from '@/shared/audit/audit.service';
import { EventsService } from '@/shared/events/events.service';
import { OrgContext } from '@/shared/authorization/interfaces/org-context.interface';
import { CRM_FINANCIALS, MEMBER_SELECT } from '../common/crm.constants';
import { toNumber } from '../common/crm-scope.utils';
import { CrmRefsService } from '../common/crm-refs.service';
import { CreateTargetInput, TargetQuery, UpdateTargetInput } from './dto/rules.dto';

const READ = 'crm.targets.read';
const round2 = (n: number) => Math.round(n * 100) / 100;
const day = (s: string) => new Date(`${s.slice(0, 10)}T00:00:00.000Z`);

/** Snap any date to its period → [start, end] (end inclusive, date-only). */
export function periodBounds(period: CrmTargetPeriod, date: string) {
    const d = day(date);
    const y = d.getUTCFullYear();
    const m = d.getUTCMonth();
    const startMonth = period === 'MONTH' ? m : period === 'QUARTER' ? Math.floor(m / 3) * 3 : 0;
    const months = period === 'MONTH' ? 1 : period === 'QUARTER' ? 3 : 12;
    const start = new Date(Date.UTC(y, startMonth, 1));
    const end = new Date(Date.UTC(y, startMonth + months, 0));
    return { start, end };
}

/**
 * 02 §11, §33 — sales targets per member, team or the whole organization for a month / quarter / year, and
 * attainment computed from deals: won revenue (actual close in the period), deals won, or pipeline created.
 * Reading needs `crm.targets.read` (narrow scope sees own, team-in-scope and organization targets); writing
 * `crm.targets.manage`. Money only with `crm.financials.read`.
 */
@Injectable()
export class CrmTargetsService {
    constructor(private readonly prisma: PrismaService, private readonly audit: AuditService, private readonly events: EventsService, private readonly refs: CrmRefsService) { }

    private visibility(ctx: OrgContext): Prisma.CrmSalesTargetWhereInput {
        const scope = ctx.scopeOf(READ);
        if (!scope) return { id: { in: [] } };
        if (scope.organization) return {};
        return { OR: [{ owner_membership_id: ctx.membership_id ?? '__none__' }, { team_id: { in: scope.team_ids } }, { owner_membership_id: null, team_id: null }] };
    }

    async findAll(ctx: OrgContext, q: TargetQuery) {
        const date = day(q.date ?? new Date().toISOString());
        const targets = await this.prisma.crmSalesTarget.findMany({
            where: {
                organization_id: ctx.organization_id,
                period_start: { lte: date },
                period_end: { gte: date },
                ...this.visibility(ctx),
                ...(q.period && { period: q.period }),
                ...(q.team_id && { team_id: q.team_id }),
                ...(q.owner === 'me' ? { owner_membership_id: ctx.membership_id ?? '__none__' } : q.owner ? { owner_membership_id: q.owner } : {}),
            },
            include: { owner: { select: MEMBER_SELECT }, team: { select: { id: true, name: true } }, pipeline: { select: { id: true, name: true } } },
            orderBy: [{ period: 'asc' }, { created_at: 'asc' }],
        });
        return { date: date.toISOString().slice(0, 10), financials_hidden: !ctx.can(CRM_FINANCIALS), targets: await Promise.all(targets.map((t) => this.withAttainment(ctx, t))) };
    }

    private async withAttainment<T extends CrmSalesTarget>(ctx: OrgContext, t: T) {
        const money = ctx.can(CRM_FINANCIALS);
        const endExclusive = new Date(t.period_end.getTime() + 86400_000);
        const owners = t.owner_membership_id
            ? [t.owner_membership_id]
            : t.team_id ? (await this.prisma.teamMembership.findMany({ where: { team_id: t.team_id, ended_at: null }, select: { membership_id: true } })).map((m) => m.membership_id) : null;
        const base: Prisma.CrmDealWhereInput = {
            organization_id: ctx.organization_id, archived_at: null, merged_into_id: null,
            ...(t.pipeline_id && { pipeline_id: t.pipeline_id }),
            ...(owners && (t.team_id && !t.owner_membership_id ? { OR: [{ team_id: t.team_id }, { owner_membership_id: { in: owners } }] } : { owner_membership_id: { in: owners } })),
        };
        let actual = 0;
        if (t.metric === 'PIPELINE_CREATED') {
            actual = toNumber((await this.prisma.crmDeal.aggregate({ where: { ...base, created_at: { gte: t.period_start, lt: endExclusive } }, _sum: { value: true } }))._sum.value);
        } else {
            const agg = await this.prisma.crmDeal.aggregate({ where: { ...base, status: 'WON', actual_close_date: { gte: t.period_start, lt: endExclusive } }, _sum: { value: true }, _count: { _all: true } });
            actual = t.metric === 'DEALS_WON' ? agg._count._all : toNumber(agg._sum.value);
        }
        const amount = toNumber(t.amount);
        const isMoney = t.metric !== 'DEALS_WON';
        const elapsed = Math.min(1, Math.max(0, (Date.now() - t.period_start.getTime()) / (endExclusive.getTime() - t.period_start.getTime())));
        return {
            ...t,
            amount: isMoney && !money ? null : amount,
            actual: isMoney && !money ? null : round2(actual),
            attainment_percent: amount > 0 ? Math.round((actual / amount) * 1000) / 10 : null,
            /** Share of the period that has passed (pace line). */
            elapsed_percent: Math.round(elapsed * 1000) / 10,
            period_start: t.period_start.toISOString().slice(0, 10),
            period_end: t.period_end.toISOString().slice(0, 10),
        };
    }

    async list(ctx: OrgContext, q: { period?: CrmTargetPeriod; year?: number }) {
        const year = q.year ?? new Date().getUTCFullYear();
        const rows = await this.prisma.crmSalesTarget.findMany({
            where: { organization_id: ctx.organization_id, ...this.visibility(ctx), ...(q.period && { period: q.period }), period_start: { gte: new Date(Date.UTC(year, 0, 1)), lt: new Date(Date.UTC(year + 1, 0, 1)) } },
            include: { owner: { select: MEMBER_SELECT }, team: { select: { id: true, name: true } }, pipeline: { select: { id: true, name: true } } },
            orderBy: [{ period_start: 'asc' }, { period: 'asc' }],
        });
        return Promise.all(rows.map((t) => this.withAttainment(ctx, t)));
    }

    private async check(ctx: OrgContext, dto: Partial<CreateTargetInput>) {
        if (dto.owner_membership_id && dto.team_id) throw new BadRequestException({ message: 'A target is for one member or one team, not both', code: 'target_owner_and_team' });
        await this.refs.assert(ctx, { membership: dto.owner_membership_id, team: dto.team_id, pipeline: dto.pipeline_id });
    }

    async create(ctx: OrgContext, dto: CreateTargetInput) {
        await this.check(ctx, dto);
        const { start, end } = periodBounds(dto.period, dto.period_start);
        const dupe = await this.prisma.crmSalesTarget.findFirst({ where: { organization_id: ctx.organization_id, period: dto.period, period_start: start, metric: dto.metric, owner_membership_id: dto.owner_membership_id ?? null, team_id: dto.team_id ?? null, pipeline_id: dto.pipeline_id ?? null } });
        if (dupe) throw new BadRequestException({ message: 'A target for this person/team, period and metric already exists. Edit it instead.', code: 'target_exists' });
        const target = await this.prisma.crmSalesTarget.create({
            data: {
                organization_id: ctx.organization_id, owner_membership_id: dto.owner_membership_id ?? null, team_id: dto.team_id ?? null, pipeline_id: dto.pipeline_id ?? null,
                period: dto.period, period_start: start, period_end: end, metric: dto.metric, amount: dto.amount,
                currency: (dto.currency ?? (await this.refs.orgCurrency(ctx))).toUpperCase(), created_by_user_id: ctx.user_id,
            },
        });
        await this.audit.record(ctx, 'crm.target.created', { resource_type: 'crm_sales_target', resource_id: target.id, metadata: { after: { ...dto, period_start: start } } });
        this.events.publish(ctx, {
            event_key: 'crm.target.created', module: ModuleKey.CRM, entity_kind: 'crm_sales_target', entity_id: target.id,
            payload: { period: dto.period, metric: dto.metric, ...(dto.owner_membership_id && { recipient_membership_ids: [dto.owner_membership_id], notification_title: 'You have a new sales target' }), link: '/crm' },
        });
        return target;
    }

    async update(ctx: OrgContext, id: string, dto: UpdateTargetInput) {
        const before = await this.prisma.crmSalesTarget.findFirst({ where: { id, organization_id: ctx.organization_id } });
        if (!before) throw new NotFoundException({ message: 'Target not found', code: 'target_not_found' });
        await this.check(ctx, { owner_membership_id: dto.owner_membership_id !== undefined ? dto.owner_membership_id : before.owner_membership_id, team_id: dto.team_id !== undefined ? dto.team_id : before.team_id, pipeline_id: dto.pipeline_id });
        const bounds = dto.period || dto.period_start ? periodBounds(dto.period ?? before.period, dto.period_start ?? before.period_start.toISOString()) : null;
        const target = await this.prisma.crmSalesTarget.update({
            where: { id },
            data: {
                ...(dto.owner_membership_id !== undefined && { owner_membership_id: dto.owner_membership_id }),
                ...(dto.team_id !== undefined && { team_id: dto.team_id }),
                ...(dto.pipeline_id !== undefined && { pipeline_id: dto.pipeline_id }),
                ...(dto.period && { period: dto.period }),
                ...(bounds && { period_start: bounds.start, period_end: bounds.end }),
                ...(dto.metric && { metric: dto.metric }),
                ...(dto.amount !== undefined && { amount: dto.amount }),
                ...(dto.currency && { currency: dto.currency.toUpperCase() }),
            },
        });
        await this.audit.record(ctx, 'crm.target.updated', { resource_type: 'crm_sales_target', resource_id: id, metadata: { before: { amount: before.amount.toString(), metric: before.metric, period: before.period }, after: dto } });
        return target;
    }

    async remove(ctx: OrgContext, id: string) {
        const before = await this.prisma.crmSalesTarget.findFirst({ where: { id, organization_id: ctx.organization_id } });
        if (!before) throw new NotFoundException({ message: 'Target not found', code: 'target_not_found' });
        await this.prisma.crmSalesTarget.delete({ where: { id } });
        await this.audit.record(ctx, 'crm.target.deleted', { resource_type: 'crm_sales_target', resource_id: id, metadata: { before: { amount: before.amount.toString(), metric: before.metric, period: before.period, owner_membership_id: before.owner_membership_id, team_id: before.team_id } } });
        return { success: true };
    }
}
