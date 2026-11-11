import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { CrmDealStatus, CrmPipelineStage, ModuleKey, Prisma, RecordEntityType } from 'generated/prisma';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import { AuditService } from '@/shared/audit/audit.service';
import { EventsService } from '@/shared/events/events.service';
import { OrgContext } from '@/shared/authorization/interfaces/org-context.interface';
import { orderBy, paginate, skipTake } from '@/shared/utils/pagination/pagination.utils';
import { COMPANY_REF_SELECT, CONTACT_REF_SELECT, CRM_FINANCIALS, MEMBER_SELECT } from '../common/crm.constants';
import { dealScopeWhere, ownerFilter, pick, redactDeal, toNumber } from '../common/crm-scope.utils';
import { CrmRefsService } from '../common/crm-refs.service';
import { CsvExport, memberLabel, toCsv } from '../common/csv.utils';
import { CrmPipelinesService } from '../pipelines/pipelines.service';
import { BoardQuery, ChangeStageDto, CreateDealDto, DealQuery, LineItemInputDto, UpdateDealDto } from './dto/deal.dto';

const READ = 'crm.deals.read';

const CARD_INCLUDE = {
    company: { select: COMPANY_REF_SELECT },
    primary_contact: { select: CONTACT_REF_SELECT },
    owner: { select: MEMBER_SELECT },
    stage: { select: { id: true, name: true, probability: true, is_won: true, is_lost: true, color: true, sort_order: true, stale_after_days: true } },
    pipeline: { select: { id: true, name: true } },
} satisfies Prisma.CrmDealInclude;

const DETAIL_INCLUDE = {
    ...CARD_INCLUDE,
    secondary_owner: { select: MEMBER_SELECT },
    project_manager: { select: MEMBER_SELECT },
    team: { select: { id: true, name: true } },
    branch: { select: { id: true, name: true } },
    lead_source: { select: { id: true, name: true } },
    loss_reason: { select: { id: true, name: true } },
    discount_approved_by: { select: MEMBER_SELECT },
    contacts: { include: { contact: { select: CONTACT_REF_SELECT } }, orderBy: { created_at: 'asc' } },
    line_items: { orderBy: { sort_order: 'asc' } },
    stage_history: {
        orderBy: { changed_at: 'desc' },
        take: 50,
        include: { from_stage: { select: { id: true, name: true } }, to_stage: { select: { id: true, name: true } } },
    },
    converted_from_leads: { select: { id: true, name: true } },
} satisfies Prisma.CrmDealInclude;

const round2 = (n: number) => Math.round(n * 100) / 100;
const dateOnly = (v?: string | null) => (v ? new Date(`${v.slice(0, 10)}T00:00:00.000Z`) : undefined);
const today = () => dateOnly(new Date().toISOString())!;

/** 02 §8–11 — deals, the pipeline board, stage changes with history, won/lost, line items and contacts. */
@Injectable()
export class CrmDealsService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly audit: AuditService,
        private readonly events: EventsService,
        private readonly refs: CrmRefsService,
        private readonly pipelines: CrmPipelinesService,
    ) { }

    private where(ctx: OrgContext, query: Partial<DealQuery>, ids?: string[]): Prisma.CrmDealWhereInput {
        return {
            organization_id: ctx.organization_id,
            merged_into_id: null,
            AND: [
                dealScopeWhere(ctx, READ),
                query.search
                    ? { OR: [{ name: { contains: query.search, mode: 'insensitive' } }, { company: { name: { contains: query.search, mode: 'insensitive' } } }] }
                    : {},
                query.contact_id ? { OR: [{ primary_contact_id: query.contact_id }, { contacts: { some: { contact_id: query.contact_id } } }] } : {},
            ],
            ...(query.archived ? { archived_at: { not: null } } : { archived_at: null }),
            ...(query.pipeline_id && { pipeline_id: query.pipeline_id }),
            ...(query.stage_id && { stage_id: query.stage_id }),
            ...(query.status?.length && { status: { in: query.status } }),
            ...ownerFilter(ctx, query.owner),
            ...(query.company_id && { company_id: query.company_id }),
            ...(query.team_id && { team_id: query.team_id }),
            ...(query.branch_id && { branch_id: query.branch_id }),
            ...((query.close_from || query.close_to) && { expected_close_date: { ...(query.close_from && { gte: dateOnly(query.close_from) }), ...(query.close_to && { lte: dateOnly(query.close_to) }) } }),
            ...(ids && { id: { in: ids } }),
        };
    }

    async findAll(ctx: OrgContext, query: DealQuery) {
        const tagged = await this.refs.idsWithTag(RecordEntityType.CRM_DEAL, query.tag_id);
        const where = this.where(ctx, query, tagged);
        const money = ctx.can(CRM_FINANCIALS);
        const [items, total, sums] = await Promise.all([
            this.prisma.crmDeal.findMany({ where, ...skipTake(query), orderBy: orderBy(query, ['name', 'value', 'expected_close_date', 'created_at', 'updated_at', 'stage_entered_at'], 'created_at'), include: CARD_INCLUDE }),
            this.prisma.crmDeal.count({ where }),
            money ? this.prisma.crmDeal.aggregate({ where, _sum: { value: true } }) : null,
        ]);
        const withTags = await this.refs.withTags(RecordEntityType.CRM_DEAL, items);
        return {
            ...paginate(withTags.map((d) => redactDeal(ctx, { ...d, weighted_value: round2(toNumber(d.value) * (d.probability ?? d.stage.probability) / 100) })), total, query),
            summary: { count: total, total_value: money ? toNumber(sums?._sum.value) : null },
        };
    }

    /** Pipeline board: every stage with its cards, counts, total and weighted value (02 §8). */
    async board(ctx: OrgContext, query: BoardQuery) {
        const pipeline = await this.pipelines.resolve(ctx, query.pipeline_id);
        const money = ctx.can(CRM_FINANCIALS);
        const since = new Date(Date.now() - query.closed_days * 86400_000);
        const base = this.where(ctx, { search: query.search, owner: query.owner, team_id: query.team_id, pipeline_id: pipeline.id });
        const stages = await Promise.all(pipeline.stages.map(async (stage) => {
            const closed = stage.is_won || stage.is_lost;
            const where: Prisma.CrmDealWhereInput = { ...base, stage_id: stage.id, ...(closed && { updated_at: { gte: since } }) };
            const [deals, agg] = await Promise.all([
                this.prisma.crmDeal.findMany({ where, include: CARD_INCLUDE, orderBy: closed ? { updated_at: 'desc' } : [{ expected_close_date: { sort: 'asc', nulls: 'last' } }, { created_at: 'desc' }], take: query.per_stage }),
                this.prisma.crmDeal.aggregate({ where, _count: { _all: true }, _sum: { value: true } }),
            ]);
            const cards = deals.map((d) => redactDeal(ctx, { ...d, weighted_value: round2(toNumber(d.value) * (d.probability ?? stage.probability) / 100), is_stale: !closed && !!stage.stale_after_days && Date.now() - d.stage_entered_at.getTime() > stage.stale_after_days * 86400_000 }));
            const total = toNumber(agg._sum.value);
            // Weighted value of the whole column (not only the visible cards).
            const weighted = money && !closed ? await this.weightedSum(where, stage.probability) : closed && stage.is_won ? total : 0;
            return { ...stage, deals: cards, count: agg._count._all, total_value: money ? total : null, weighted_value: money ? round2(weighted) : null };
        }));
        const open = stages.filter((s) => !s.is_won && !s.is_lost);
        return {
            pipeline: { id: pipeline.id, name: pipeline.name, currency: pipeline.currency, is_default: pipeline.is_default },
            stages,
            totals: {
                open_count: open.reduce((n, s) => n + s.count, 0),
                open_value: money ? round2(open.reduce((n, s) => n + (s.total_value ?? 0), 0)) : null,
                weighted_value: money ? round2(open.reduce((n, s) => n + (s.weighted_value ?? 0), 0)) : null,
            },
            financials_hidden: !money,
        };
    }

    private async weightedSum(where: Prisma.CrmDealWhereInput, stageProbability: number) {
        const rows = await this.prisma.crmDeal.groupBy({ by: ['probability'], where, _sum: { value: true } });
        return rows.reduce((n, r) => n + toNumber(r._sum.value) * (r.probability ?? stageProbability) / 100, 0);
    }

    async findOne(ctx: OrgContext, id: string) {
        const deal = await this.prisma.crmDeal.findFirst({ where: { id, organization_id: ctx.organization_id, ...dealScopeWhere(ctx, READ) }, include: DETAIL_INCLUDE });
        if (!deal) throw new NotFoundException({ message: 'Deal not found', code: 'deal_not_found' });
        const [stages, tags] = await Promise.all([
            this.prisma.crmPipelineStage.findMany({ where: { pipeline_id: deal.pipeline_id }, orderBy: { sort_order: 'asc' }, select: { id: true, name: true, probability: true, is_won: true, is_lost: true, color: true, sort_order: true } }),
            this.refs.tagsFor(RecordEntityType.CRM_DEAL, [id]),
        ]);
        const days_in_stage = Math.floor((Date.now() - deal.stage_entered_at.getTime()) / 86400_000);
        return redactDeal(ctx, {
            ...deal,
            pipeline_stages: stages,
            tags: tags.get(id) ?? [],
            days_in_stage,
            weighted_value: round2(toNumber(deal.value) * (deal.probability ?? deal.stage.probability) / 100),
        });
    }

    async create(ctx: OrgContext, dto: CreateDealDto) {
        const pipeline = await this.pipelines.resolve(ctx, dto.pipeline_id);
        const stage = dto.stage_id ? pipeline.stages.find((s) => s.id === dto.stage_id) : pipeline.stages.find((s) => !s.is_won && !s.is_lost);
        if (!stage) throw new BadRequestException({ message: 'The stage does not belong to the pipeline', code: 'stage_not_in_pipeline' });
        const { contact_ids, ...data } = dto;
        await this.refs.assert(ctx, {
            membership: [data.owner_membership_id, data.secondary_owner_membership_id, data.project_manager_membership_id],
            company: data.company_id, contact: [data.primary_contact_id, ...(contact_ids ?? [])],
            team: data.team_id, branch: data.branch_id, lead_source: data.lead_source_id,
        });
        const assigningOther = [data.owner_membership_id, data.secondary_owner_membership_id, data.project_manager_membership_id].some((m) => m && m !== ctx.membership_id);
        this.refs.assertCanAssign(ctx, 'crm.deals.assign', assigningOther);
        const money = ctx.can(CRM_FINANCIALS);
        const status = stage.is_won ? CrmDealStatus.WON : stage.is_lost ? CrmDealStatus.LOST : CrmDealStatus.OPEN;
        const deal = await this.prisma.$transaction(async (tx) => {
            const d = await tx.crmDeal.create({
                data: {
                    ...data,
                    value: money ? data.value ?? 0 : 0,
                    one_time_value: money ? data.value ?? 0 : 0,
                    currency: (data.currency ?? pipeline.currency ?? (await this.refs.orgCurrency(ctx))).toUpperCase(),
                    expected_close_date: dateOnly(data.expected_close_date),
                    organization_id: ctx.organization_id,
                    pipeline_id: pipeline.id,
                    stage_id: stage.id,
                    status,
                    probability: data.probability ?? stage.probability,
                    forecast_category: stage.forecast_category,
                    owner_membership_id: data.owner_membership_id ?? ctx.membership_id,
                    team_id: data.team_id ?? pipeline.team?.id,
                    created_by_user_id: ctx.user_id,
                    ...(status !== 'OPEN' && { actual_close_date: today() }),
                    ...(contact_ids?.length ? { contacts: { create: [...new Set(contact_ids)].filter((c) => c !== data.primary_contact_id).map((contact_id) => ({ contact_id })) } } : {}),
                },
            });
            await tx.crmDealStageHistory.create({ data: { deal_id: d.id, to_stage_id: stage.id, changed_by_user_id: ctx.user_id } });
            await this.audit.record(ctx, 'crm.deal.created', { resource_type: 'crm_deal', resource_id: d.id, branch_id: d.branch_id, metadata: { after: { name: d.name, stage: stage.name, value: money ? data.value : undefined } } }, tx);
            return d;
        });
        this.events.publish(ctx, {
            event_key: 'crm.deal.created', module: ModuleKey.CRM, entity_type: RecordEntityType.CRM_DEAL, entity_id: deal.id,
            payload: { name: deal.name, stage_id: stage.id, stage: stage.name, pipeline_id: pipeline.id, company_id: deal.company_id, owner_membership_id: deal.owner_membership_id, assignee_membership_ids: this.people(deal) },
            activity: { summary: `created deal ${deal.name}`, entity_label: deal.name, company_id: deal.company_id, branch_id: deal.branch_id },
        });
        return redactDeal(ctx, deal);
    }

    async update(ctx: OrgContext, id: string, dto: UpdateDealDto) {
        const before = await this.getForWrite(ctx, id, 'crm.deals.update');
        const data: UpdateDealDto = { ...dto };
        await this.refs.assert(ctx, {
            membership: [data.owner_membership_id, data.secondary_owner_membership_id, data.project_manager_membership_id],
            company: data.company_id, contact: data.primary_contact_id, team: data.team_id, branch: data.branch_id, lead_source: data.lead_source_id,
        });
        const ownersChanged = (['owner_membership_id', 'secondary_owner_membership_id', 'project_manager_membership_id'] as const).some((k) => data[k] !== undefined && data[k] !== before[k]);
        this.refs.assertCanAssign(ctx, 'crm.deals.assign', ownersChanged);
        if (!ctx.can(CRM_FINANCIALS)) delete data.value;
        if (data.value !== undefined && (await this.prisma.crmDealLineItem.count({ where: { deal_id: id } }))) delete data.value;
        const deal = await this.prisma.$transaction(async (tx) => {
            const d = await tx.crmDeal.update({
                where: { id },
                data: {
                    ...data,
                    ...(data.value !== undefined && { one_time_value: data.value }),
                    ...(data.currency && { currency: data.currency.toUpperCase() }),
                    ...(data.expected_close_date !== undefined && { expected_close_date: dateOnly(data.expected_close_date) ?? null }),
                },
            });
            await this.audit.record(ctx, 'crm.deal.updated', { resource_type: 'crm_deal', resource_id: id, branch_id: d.branch_id, metadata: { before: pick(before, Object.keys(data)), after: data } }, tx);
            return d;
        });
        this.events.publish(ctx, {
            event_key: 'crm.deal.updated', module: ModuleKey.CRM, entity_type: RecordEntityType.CRM_DEAL, entity_id: id,
            payload: { name: deal.name, owner_membership_id: deal.owner_membership_id }, changes: data as Record<string, unknown>,
        });
        if (ownersChanged) this.publishAssigned(ctx, deal);
        return redactDeal(ctx, deal);
    }

    async assign(ctx: OrgContext, id: string, owner_membership_id: string) {
        const before = await this.getForWrite(ctx, id, 'crm.deals.assign');
        await this.refs.assert(ctx, { membership: owner_membership_id });
        const deal = await this.prisma.crmDeal.update({ where: { id }, data: { owner_membership_id } });
        await this.audit.record(ctx, 'crm.deal.assigned', { resource_type: 'crm_deal', resource_id: id, branch_id: deal.branch_id, metadata: { before: { owner_membership_id: before.owner_membership_id }, after: { owner_membership_id } } });
        this.publishAssigned(ctx, deal);
        return redactDeal(ctx, deal);
    }

    private people(d: { owner_membership_id: string | null; secondary_owner_membership_id: string | null; project_manager_membership_id: string | null }) {
        return [...new Set([d.owner_membership_id, d.secondary_owner_membership_id, d.project_manager_membership_id].filter((x): x is string => !!x))];
    }

    private publishAssigned(ctx: OrgContext, deal: { id: string; name: string; company_id: string | null; branch_id: string | null; owner_membership_id: string | null; secondary_owner_membership_id: string | null; project_manager_membership_id: string | null }) {
        this.events.publish(ctx, {
            event_key: 'crm.deal.assigned', module: ModuleKey.CRM, entity_type: RecordEntityType.CRM_DEAL, entity_id: deal.id,
            payload: { name: deal.name, owner_membership_id: deal.owner_membership_id, assignee_membership_ids: this.people(deal) },
            activity: { summary: `assigned deal ${deal.name}`, entity_label: deal.name, company_id: deal.company_id, branch_id: deal.branch_id },
        });
    }

    /**
     * Move a deal to a stage (02 §8): status, probability and forecast category follow the stage; a history row
     * records the time spent in the previous stage. Lost needs a catalogue reason (02 §9).
     */
    async changeStage(ctx: OrgContext, id: string, dto: ChangeStageDto) {
        const before = await this.getForWrite(ctx, id, 'crm.deals.change_stage');
        const stage = await this.prisma.crmPipelineStage.findFirst({ where: { id: dto.stage_id, pipeline: { organization_id: ctx.organization_id } } });
        if (!stage) throw new NotFoundException({ message: 'Stage not found', code: 'stage_not_found' });
        if (stage.id === before.stage_id && dto.probability === undefined) return this.findOne(ctx, id);
        if (stage.is_lost) {
            if (!dto.lost_reason_id) throw new BadRequestException({ message: 'Pick a reason for losing the deal', code: 'lost_reason_required' });
            await this.refs.assert(ctx, { loss_reason: dto.lost_reason_id });
        }
        const now = new Date();
        const status = stage.is_won ? CrmDealStatus.WON : stage.is_lost ? CrmDealStatus.LOST : CrmDealStatus.OPEN;
        const moved = stage.id !== before.stage_id;
        const deal = await this.prisma.$transaction(async (tx) => {
            const d = await tx.crmDeal.update({
                where: { id },
                data: {
                    pipeline_id: stage.pipeline_id,
                    stage_id: stage.id,
                    status,
                    probability: dto.probability ?? stage.probability,
                    forecast_category: stage.forecast_category,
                    ...(moved && { stage_entered_at: now }),
                    actual_close_date: status === 'OPEN' ? null : dateOnly(dto.actual_close_date) ?? today(),
                    ...(stage.is_won && { won_note: dto.won_note ?? before.won_note, lost_reason_id: null, lost_reason: null }),
                    ...(stage.is_lost && { lost_reason_id: dto.lost_reason_id, lost_reason: dto.lost_reason ?? null, competitor: dto.competitor ?? before.competitor }),
                    ...(status === 'OPEN' && { lost_reason_id: null, lost_reason: null }),
                },
            });
            if (moved) {
                await tx.crmDealStageHistory.create({
                    data: { deal_id: id, from_stage_id: before.stage_id, to_stage_id: stage.id, changed_by_user_id: ctx.user_id, duration_seconds: Math.round((now.getTime() - before.stage_entered_at.getTime()) / 1000) },
                });
            }
            if (stage.is_won && dto.set_customer !== false && d.company_id) await this.markCustomer(tx, ctx, d.company_id);
            await this.audit.record(ctx, stage.is_won ? 'crm.deal.won' : stage.is_lost ? 'crm.deal.lost' : 'crm.deal.stage_changed', {
                resource_type: 'crm_deal', resource_id: id, branch_id: d.branch_id,
                metadata: { before: { stage_id: before.stage_id, status: before.status, probability: before.probability }, after: { stage_id: stage.id, status, probability: d.probability, lost_reason_id: d.lost_reason_id } },
            }, tx);
            return d;
        });
        const payload = {
            name: deal.name, from_stage_id: before.stage_id, stage_id: stage.id, stage: stage.name, status, pipeline_id: deal.pipeline_id,
            company_id: deal.company_id, owner_membership_id: deal.owner_membership_id, assignee_membership_ids: this.people(deal),
            ...(ctx.can(CRM_FINANCIALS) && { value: toNumber(deal.value), currency: deal.currency }),
        };
        if (moved) {
            this.events.publish(ctx, {
                event_key: 'crm.deal.stage_changed', module: ModuleKey.CRM, entity_type: RecordEntityType.CRM_DEAL, entity_id: id, payload,
                activity: { summary: `moved deal ${deal.name} to ${stage.name}`, entity_label: deal.name, company_id: deal.company_id, branch_id: deal.branch_id },
            });
        }
        if (status !== before.status && status !== 'OPEN') {
            this.events.publish(ctx, {
                event_key: status === 'WON' ? 'crm.deal.won' : 'crm.deal.lost', module: ModuleKey.CRM, entity_type: RecordEntityType.CRM_DEAL, entity_id: id,
                payload: { ...payload, lost_reason_id: deal.lost_reason_id },
                activity: { summary: `${status === 'WON' ? 'won' : 'lost'} deal ${deal.name}`, entity_label: deal.name, company_id: deal.company_id, branch_id: deal.branch_id },
            });
        }
        return this.findOne(ctx, id);
    }

    async markWon(ctx: OrgContext, id: string, dto: { won_note?: string; actual_close_date?: string; set_customer?: boolean }) {
        const deal = await this.getForWrite(ctx, id, 'crm.deals.change_stage');
        const stage = await this.closedStage(deal.pipeline_id, 'won');
        return this.changeStage(ctx, id, { stage_id: stage.id, ...dto });
    }

    async markLost(ctx: OrgContext, id: string, dto: { lost_reason_id: string; lost_reason?: string; competitor?: string; actual_close_date?: string }) {
        const deal = await this.getForWrite(ctx, id, 'crm.deals.change_stage');
        const stage = await this.closedStage(deal.pipeline_id, 'lost');
        return this.changeStage(ctx, id, { stage_id: stage.id, ...dto });
    }

    async reopen(ctx: OrgContext, id: string, stage_id?: string) {
        const deal = await this.getForWrite(ctx, id, 'crm.deals.update');
        if (deal.status === 'OPEN') throw new ConflictException({ message: 'The deal is already open', code: 'deal_open' });
        let target: CrmPipelineStage | null = null;
        if (stage_id) target = await this.prisma.crmPipelineStage.findFirst({ where: { id: stage_id, pipeline_id: deal.pipeline_id, is_won: false, is_lost: false } });
        else {
            const last = await this.prisma.crmDealStageHistory.findFirst({ where: { deal_id: id, to_stage: { is_won: false, is_lost: false } }, orderBy: { changed_at: 'desc' }, include: { to_stage: true } });
            target = last?.to_stage ?? (await this.prisma.crmPipelineStage.findFirst({ where: { pipeline_id: deal.pipeline_id, is_won: false, is_lost: false }, orderBy: { sort_order: 'asc' } }));
        }
        if (!target) throw new BadRequestException({ message: 'Pick an open stage of this pipeline', code: 'stage_not_in_pipeline' });
        // Reopen is an update (crm.deals.update) — bypass the change_stage key check by calling the shared logic with the reopened target.
        const now = new Date();
        await this.prisma.$transaction(async (tx) => {
            await tx.crmDeal.update({ where: { id }, data: { stage_id: target!.id, status: 'OPEN', probability: target!.probability, forecast_category: target!.forecast_category, actual_close_date: null, lost_reason_id: null, lost_reason: null, stage_entered_at: now } });
            await tx.crmDealStageHistory.create({ data: { deal_id: id, from_stage_id: deal.stage_id, to_stage_id: target!.id, changed_by_user_id: ctx.user_id, duration_seconds: Math.round((now.getTime() - deal.stage_entered_at.getTime()) / 1000) } });
            await this.audit.record(ctx, 'crm.deal.reopened', { resource_type: 'crm_deal', resource_id: id, branch_id: deal.branch_id, metadata: { before: { status: deal.status, stage_id: deal.stage_id }, after: { status: 'OPEN', stage_id: target!.id } } }, tx);
        });
        this.events.publish(ctx, {
            event_key: 'crm.deal.reopened', module: ModuleKey.CRM, entity_type: RecordEntityType.CRM_DEAL, entity_id: id,
            payload: { name: deal.name, stage_id: target.id, owner_membership_id: deal.owner_membership_id, assignee_membership_ids: this.people(deal) },
            activity: { summary: `reopened deal ${deal.name}`, entity_label: deal.name, company_id: deal.company_id },
        });
        return this.findOne(ctx, id);
    }

    private async closedStage(pipeline_id: string, kind: 'won' | 'lost') {
        const stage = await this.prisma.crmPipelineStage.findFirst({ where: { pipeline_id, ...(kind === 'won' ? { is_won: true } : { is_lost: true }) } });
        if (!stage) throw new BadRequestException({ message: `The pipeline has no ${kind} stage`, code: 'invalid_stages' });
        return stage;
    }

    /** Won deal → its prospect company becomes a customer (02 §17 terminology). */
    private async markCustomer(tx: Prisma.TransactionClient, ctx: OrgContext, company_id: string) {
        const company = await tx.crmCompany.findUnique({ where: { id: company_id }, select: { type: true, customer_since: true, lifecycle_stage: { select: { is_customer: true } } } });
        if (!company) return;
        const customerStage = company.lifecycle_stage?.is_customer ? null : await tx.crmLifecycleStage.findFirst({ where: { organization_id: ctx.organization_id, is_customer: true, archived_at: null }, orderBy: { sort_order: 'asc' } });
        await tx.crmCompany.update({
            where: { id: company_id },
            data: {
                ...(company.type === 'PROSPECT' && { type: 'CUSTOMER' }),
                ...(!company.customer_since && { customer_since: new Date() }),
                ...(customerStage && { lifecycle_stage_id: customerStage.id }),
            },
        });
        if (customerStage) await tx.crmLifecycleHistory.create({ data: { company_id, stage_id: customerStage.id, changed_by_user_id: ctx.user_id } });
    }

    /** Replace line items; totals are derived (02 §10). Needs crm.financials.read + crm.deals.update. */
    async replaceLineItems(ctx: OrgContext, id: string, items: LineItemInputDto[], discount_percent?: number) {
        if (!ctx.can(CRM_FINANCIALS)) throw new ForbiddenException({ message: `Missing permission ${CRM_FINANCIALS}`, code: 'permission_denied', permission: CRM_FINANCIALS });
        const before = await this.getForWrite(ctx, id, 'crm.deals.update');
        const orderDiscount = discount_percent ?? toNumber(before.discount_percent);
        const approval = await this.checkDiscount(ctx, orderDiscount, toNumber(before.discount_percent));
        const rows = items.map((it, i) => {
            const gross0 = it.quantity * it.unit_price;
            const lineDiscount = round2(gross0 * (it.discount_percent ?? 0) / 100);
            const net = round2(gross0 - lineDiscount);
            const tax = round2(net * (it.tax_percent ?? 0) / 100);
            return {
                deal_id: id, product_id: it.product_id ?? null, name: it.name, description: it.description ?? null,
                quantity: it.quantity, unit_price: it.unit_price, discount_percent: it.discount_percent ?? null, discount_amount: lineDiscount,
                tax_percent: it.tax_percent ?? null, net_amount: net, tax_amount: tax, gross_amount: round2(net + tax),
                is_recurring: !!it.is_recurring, billing_frequency: it.is_recurring ? it.billing_frequency ?? 'monthly' : null, sort_order: i,
            };
        });
        const factor = 1 - orderDiscount / 100;
        const netSum = rows.reduce((n, r) => n + r.net_amount, 0);
        const recurring = round2(rows.filter((r) => r.is_recurring).reduce((n, r) => n + r.net_amount, 0) * factor);
        const oneTime = round2(rows.filter((r) => !r.is_recurring).reduce((n, r) => n + r.net_amount, 0) * factor);
        const lineDiscounts = rows.reduce((n, r) => n + r.discount_amount, 0);
        const totals = {
            value: rows.length ? round2(netSum * factor) : toNumber(before.value),
            recurring_value: recurring,
            one_time_value: rows.length ? oneTime : toNumber(before.value),
            discount_amount: round2(lineDiscounts + netSum * orderDiscount / 100),
            discount_percent: orderDiscount,
            tax_amount: round2(rows.reduce((n, r) => n + r.tax_amount, 0) * factor),
            ...approval,
        };
        await this.prisma.$transaction(async (tx) => {
            await tx.crmDealLineItem.deleteMany({ where: { deal_id: id } });
            if (rows.length) await tx.crmDealLineItem.createMany({ data: rows });
            await tx.crmDeal.update({ where: { id }, data: totals });
            await this.audit.record(ctx, 'crm.deal.line_items_changed', {
                resource_type: 'crm_deal', resource_id: id, branch_id: before.branch_id,
                metadata: { before: { value: toNumber(before.value), discount_percent: toNumber(before.discount_percent) }, after: { value: totals.value, discount_percent: orderDiscount, items: rows.length } },
            }, tx);
        });
        this.events.publish(ctx, { event_key: 'crm.deal.updated', module: ModuleKey.CRM, entity_type: RecordEntityType.CRM_DEAL, entity_id: id, payload: { name: before.name, value: totals.value, owner_membership_id: before.owner_membership_id }, changes: { value: totals.value } });
        return this.findOne(ctx, id);
    }

    /** Order-level discount above the caller's CrmDiscountPolicy (max across roles) needs crm.deals.approve_discount. */
    private async checkDiscount(ctx: OrgContext, percent: number, previous: number) {
        if (percent <= 0 || percent === previous) return percent <= 0 ? { discount_approved_by_membership_id: null, discount_approved_at: null } : {};
        const policies = await this.prisma.crmDiscountPolicy.findMany({ where: { organization_id: ctx.organization_id, enabled: true } });
        if (!policies.length) return {};
        const roleIds = ctx.membership_id
            ? (await this.prisma.roleAssignment.findMany({ where: { membership_id: ctx.membership_id, revoked_at: null }, select: { role_id: true } })).map((r) => r.role_id)
            : [];
        const limit = Math.max(0, ...policies.filter((p) => roleIds.includes(p.role_id)).map((p) => toNumber(p.max_percent)));
        if (percent <= limit) return {};
        if (!ctx.can('crm.deals.approve_discount')) {
            throw new ForbiddenException({ message: `Discounts above ${limit}% need approval (crm.deals.approve_discount)`, code: 'discount_needs_approval', permission: 'crm.deals.approve_discount', limit });
        }
        return { discount_approved_by_membership_id: ctx.membership_id, discount_approved_at: new Date() };
    }

    async addContact(ctx: OrgContext, id: string, contact_id: string, role?: string) {
        const deal = await this.getForWrite(ctx, id, 'crm.deals.update');
        await this.refs.assert(ctx, { contact: contact_id });
        await this.prisma.crmDealContact.upsert({ where: { deal_id_contact_id: { deal_id: id, contact_id } }, update: { role }, create: { deal_id: id, contact_id, role } });
        await this.audit.record(ctx, 'crm.deal.contact_added', { resource_type: 'crm_deal', resource_id: id, branch_id: deal.branch_id, metadata: { contact_id, role } });
        return { success: true };
    }

    async removeContact(ctx: OrgContext, id: string, contact_id: string) {
        const deal = await this.getForWrite(ctx, id, 'crm.deals.update');
        const res = await this.prisma.crmDealContact.deleteMany({ where: { deal_id: id, contact_id } });
        if (!res.count) throw new NotFoundException({ message: 'Contact is not on this deal', code: 'deal_contact_not_found' });
        await this.audit.record(ctx, 'crm.deal.contact_removed', { resource_type: 'crm_deal', resource_id: id, branch_id: deal.branch_id, metadata: { contact_id } });
        return { success: true };
    }

    async archive(ctx: OrgContext, id: string, archived = true) {
        const deal = await this.getForWrite(ctx, id, 'crm.deals.archive');
        const updated = await this.prisma.crmDeal.update({ where: { id }, data: { archived_at: archived ? new Date() : null } });
        await this.audit.record(ctx, archived ? 'crm.deal.archived' : 'crm.deal.restored', { resource_type: 'crm_deal', resource_id: id, branch_id: deal.branch_id });
        if (archived) this.events.publish(ctx, { event_key: 'crm.deal.archived', module: ModuleKey.CRM, entity_type: RecordEntityType.CRM_DEAL, entity_id: id, payload: { name: deal.name } });
        return redactDeal(ctx, updated);
    }

    async remove(ctx: OrgContext, id: string) {
        const deal = await this.getForWrite(ctx, id, 'crm.deals.delete');
        await this.prisma.$transaction(async (tx) => {
            await tx.tagging.deleteMany({ where: { entity_type: RecordEntityType.CRM_DEAL, entity_id: id } });
            await tx.crmNote.deleteMany({ where: { entity_type: RecordEntityType.CRM_DEAL, entity_id: id, organization_id: ctx.organization_id } });
            await tx.crmDeal.delete({ where: { id } });
            await this.audit.record(ctx, 'crm.deal.deleted', { resource_type: 'crm_deal', resource_id: id, branch_id: deal.branch_id, metadata: { before: { name: deal.name, status: deal.status } } }, tx);
        });
        this.events.publish(ctx, { event_key: 'crm.deal.deleted', module: ModuleKey.CRM, entity_type: RecordEntityType.CRM_DEAL, entity_id: id, payload: { name: deal.name } });
        return { success: true };
    }

    async export(ctx: OrgContext, query: DealQuery): Promise<CsvExport> {
        const tagged = await this.refs.idsWithTag(RecordEntityType.CRM_DEAL, query.tag_id);
        const rows = await this.prisma.crmDeal.findMany({ where: this.where(ctx, query, tagged), include: CARD_INCLUDE, orderBy: { created_at: 'desc' }, take: 10000 });
        const money = ctx.can(CRM_FINANCIALS);
        const headers = ['id', 'name', 'pipeline', 'stage', 'status', 'company', 'primary_contact', 'owner', ...(money ? ['value', 'currency'] : []), 'probability', 'expected_close_date', 'actual_close_date', 'created_at'];
        const content = toCsv(headers, rows.map((d) => [
            d.id, d.name, d.pipeline.name, d.stage.name, d.status, d.company?.name, d.primary_contact ? [d.primary_contact.first_name, d.primary_contact.last_name].filter(Boolean).join(' ') : '',
            memberLabel(d.owner), ...(money ? [d.value.toString(), d.currency] : []), d.probability, d.expected_close_date?.toISOString().slice(0, 10), d.actual_close_date?.toISOString().slice(0, 10), d.created_at,
        ]));
        await this.audit.record(ctx, 'crm.records.exported', { resource_type: 'crm_deal', metadata: { entity: 'deals', count: rows.length, filters: query, financials: money } });
        this.events.publish(ctx, { event_key: 'crm.records.exported', module: ModuleKey.CRM, payload: { entity: 'deals', count: rows.length } });
        return { filename: `deals-${new Date().toISOString().slice(0, 10)}.csv`, content, count: rows.length };
    }

    async getForWrite(ctx: OrgContext, id: string, key: string) {
        const deal = await this.prisma.crmDeal.findFirst({ where: { id, organization_id: ctx.organization_id, ...dealScopeWhere(ctx, key) } });
        if (!deal) throw new NotFoundException({ message: 'Deal not found', code: 'deal_not_found' });
        return deal;
    }
}
