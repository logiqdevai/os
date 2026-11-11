import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { CrmForecastCategory, ModuleKey } from 'generated/prisma';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import { AuditService } from '@/shared/audit/audit.service';
import { EventsService } from '@/shared/events/events.service';
import { OrgContext } from '@/shared/authorization/interfaces/org-context.interface';
import { slugify } from '@/modules/auth/services/organization-setup.service';
import { DEFAULT_PIPELINE_STAGES } from '../common/crm.constants';
import { CrmDefaultsService } from '../common/crm-defaults.service';
import { CrmRefsService } from '../common/crm-refs.service';
import { CreatePipelineDto, PipelineStageInputDto, UpdatePipelineDto } from './dto/pipeline.dto';

const STAGE_ORDER = { orderBy: { sort_order: 'asc' as const } };

/** 02 §8 — pipelines and their ordered stages. A default "Sales" pipeline is created lazily (02 §37). */
@Injectable()
export class CrmPipelinesService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly audit: AuditService,
        private readonly events: EventsService,
        private readonly defaults: CrmDefaultsService,
        private readonly refs: CrmRefsService,
    ) { }

    async findAll(ctx: OrgContext, includeArchived = false) {
        await this.defaults.ensure(ctx.organization_id);
        const pipelines = await this.prisma.crmPipeline.findMany({
            where: { organization_id: ctx.organization_id, ...(includeArchived ? {} : { archived_at: null }) },
            include: { stages: STAGE_ORDER, team: { select: { id: true, name: true } }, _count: { select: { deals: { where: { status: 'OPEN', archived_at: null } } } } },
            orderBy: [{ is_default: 'desc' }, { name: 'asc' }],
        });
        if (!pipelines.length && !includeArchived) {
            this.defaults.forget(ctx.organization_id);
        }
        return pipelines;
    }

    async findOne(ctx: OrgContext, id: string) {
        const pipeline = await this.prisma.crmPipeline.findFirst({
            where: { id, organization_id: ctx.organization_id },
            include: { stages: STAGE_ORDER, team: { select: { id: true, name: true } } },
        });
        if (!pipeline) throw new NotFoundException({ message: 'Pipeline not found', code: 'pipeline_not_found' });
        return pipeline;
    }

    /** The pipeline used when none is given: explicit id → default → first active. */
    async resolve(ctx: OrgContext, id?: string | null) {
        await this.defaults.ensure(ctx.organization_id);
        if (id) return this.findOne(ctx, id);
        const pipeline = await this.prisma.crmPipeline.findFirst({
            where: { organization_id: ctx.organization_id, archived_at: null },
            include: { stages: STAGE_ORDER, team: { select: { id: true, name: true } } },
            orderBy: [{ is_default: 'desc' }, { created_at: 'asc' }],
        });
        if (!pipeline) throw new NotFoundException({ message: 'No pipeline configured', code: 'pipeline_not_found' });
        return pipeline;
    }

    async create(ctx: OrgContext, dto: CreatePipelineDto) {
        await this.defaults.ensure(ctx.organization_id);
        await this.refs.assert(ctx, { team: dto.team_id });
        const stages = dto.stages?.length ? dto.stages : DEFAULT_PIPELINE_STAGES.map((s) => ({ ...s, stale_after_days: undefined }));
        this.validateStages(stages);
        const slug = await this.uniqueSlug(ctx, dto.name);
        const pipeline = await this.prisma.$transaction(async (tx) => {
            if (dto.is_default) await tx.crmPipeline.updateMany({ where: { organization_id: ctx.organization_id }, data: { is_default: false } });
            const p = await tx.crmPipeline.create({
                data: {
                    organization_id: ctx.organization_id,
                    name: dto.name,
                    slug,
                    description: dto.description,
                    currency: dto.currency ?? (await this.refs.orgCurrency(ctx)),
                    team_id: dto.team_id,
                    is_default: !!dto.is_default,
                    stages: { create: stages.map((s, i) => this.stageData(s, i)) },
                },
                include: { stages: STAGE_ORDER },
            });
            await this.audit.record(ctx, 'crm.pipeline.created', { resource_type: 'crm_pipeline', resource_id: p.id, metadata: { after: { name: p.name, stages: stages.map((s) => s.name) } } }, tx);
            return p;
        });
        this.events.publish(ctx, { event_key: 'crm.pipeline.created', module: ModuleKey.CRM, entity_kind: 'crm_pipeline', entity_id: pipeline.id, payload: { name: pipeline.name } });
        return pipeline;
    }

    async update(ctx: OrgContext, id: string, dto: UpdatePipelineDto) {
        const before = await this.findOne(ctx, id);
        await this.refs.assert(ctx, { team: dto.team_id });
        const { stages, ...data } = dto;
        const pipeline = await this.prisma.$transaction(async (tx) => {
            if (data.is_default) await tx.crmPipeline.updateMany({ where: { organization_id: ctx.organization_id, id: { not: id } }, data: { is_default: false } });
            const p = await tx.crmPipeline.update({ where: { id }, data });
            await this.audit.record(ctx, 'crm.pipeline.updated', { resource_type: 'crm_pipeline', resource_id: id, metadata: { before: { name: before.name, is_default: before.is_default, currency: before.currency }, after: data } }, tx);
            return p;
        });
        if (stages) await this.replaceStages(ctx, id, stages);
        this.events.publish(ctx, { event_key: 'crm.pipeline.updated', module: ModuleKey.CRM, entity_kind: 'crm_pipeline', entity_id: id, payload: { name: pipeline.name }, changes: data as Record<string, unknown> });
        return this.findOne(ctx, id);
    }

    async archive(ctx: OrgContext, id: string) {
        const p = await this.findOne(ctx, id);
        if (p.is_default) throw new ConflictException({ message: 'Make another pipeline the default before archiving this one', code: 'pipeline_is_default' });
        const open = await this.prisma.crmDeal.count({ where: { pipeline_id: id, status: 'OPEN', archived_at: null } });
        if (open) throw new ConflictException({ message: `This pipeline has ${open} open deal(s). Move or close them first.`, code: 'pipeline_has_open_deals' });
        const updated = await this.prisma.crmPipeline.update({ where: { id }, data: { archived_at: new Date() } });
        await this.audit.record(ctx, 'crm.pipeline.archived', { resource_type: 'crm_pipeline', resource_id: id });
        this.events.publish(ctx, { event_key: 'crm.pipeline.archived', module: ModuleKey.CRM, entity_kind: 'crm_pipeline', entity_id: id, payload: { name: p.name } });
        return updated;
    }

    /** Replace the ordered stage list. Stages that still hold deals cannot be removed. */
    async replaceStages(ctx: OrgContext, id: string, stages: PipelineStageInputDto[]) {
        const pipeline = await this.findOne(ctx, id);
        this.validateStages(stages);
        const existingIds = new Set(pipeline.stages.map((s) => s.id));
        const unknown = stages.find((s) => s.id && !existingIds.has(s.id));
        if (unknown) throw new BadRequestException({ message: 'A stage does not belong to this pipeline', code: 'stage_not_in_pipeline' });
        const keep = new Set(stages.filter((s) => s.id).map((s) => s.id));
        const removed = pipeline.stages.filter((s) => !keep.has(s.id));
        if (removed.length) {
            const used = await this.prisma.crmDeal.groupBy({ by: ['stage_id'], where: { stage_id: { in: removed.map((s) => s.id) } }, _count: { _all: true } });
            if (used.length) {
                const names = removed.filter((s) => used.some((u) => u.stage_id === s.id)).map((s) => s.name).join(', ');
                throw new ConflictException({ message: `Move the deals out of ${names} before removing it`, code: 'stage_has_deals' });
            }
        }
        await this.prisma.$transaction(async (tx) => {
            if (removed.length) await tx.crmPipelineStage.deleteMany({ where: { id: { in: removed.map((s) => s.id) } } });
            // Temporary slugs first so renames/reorders never collide on (pipeline_id, slug).
            for (const s of stages.filter((x) => x.id)) await tx.crmPipelineStage.update({ where: { id: s.id }, data: { slug: `tmp-${s.id}` } });
            const used = new Set<string>();
            for (const [i, s] of stages.entries()) {
                let slug = slugify(s.name) || `stage-${i + 1}`;
                while (used.has(slug)) slug = `${slug}-${i + 1}`;
                used.add(slug);
                const data = { ...this.stageData(s, i), slug };
                if (s.id) await tx.crmPipelineStage.update({ where: { id: s.id }, data });
                else await tx.crmPipelineStage.create({ data: { ...data, pipeline_id: id } });
            }
            await this.audit.record(ctx, 'crm.pipeline.stages_changed', {
                resource_type: 'crm_pipeline', resource_id: id,
                metadata: { before: pipeline.stages.map((s) => ({ id: s.id, name: s.name, probability: s.probability })), after: stages.map((s) => ({ id: s.id, name: s.name, probability: s.probability })) },
            }, tx);
        });
        this.events.publish(ctx, { event_key: 'crm.pipeline.updated', module: ModuleKey.CRM, entity_kind: 'crm_pipeline', entity_id: id, payload: { name: pipeline.name, stages: stages.length } });
        return this.findOne(ctx, id);
    }

    private validateStages(stages: { name: string; is_won?: boolean; is_lost?: boolean }[]) {
        const won = stages.filter((s) => s.is_won).length;
        const lost = stages.filter((s) => s.is_lost).length;
        if (won !== 1 || lost !== 1) throw new BadRequestException({ message: 'A pipeline needs exactly one won stage and one lost stage', code: 'invalid_stages' });
        if (stages.some((s) => s.is_won && s.is_lost)) throw new BadRequestException({ message: 'A stage cannot be both won and lost', code: 'invalid_stages' });
        if (stages.length - 2 < 1) throw new BadRequestException({ message: 'Add at least one open stage', code: 'invalid_stages' });
    }

    private stageData(s: { name: string; probability: number; forecast_category?: CrmForecastCategory; is_won?: boolean; is_lost?: boolean; stale_after_days?: number; color?: string }, i: number) {
        const forecast = s.is_won ? CrmForecastCategory.CLOSED_WON : s.is_lost ? CrmForecastCategory.CLOSED_LOST : s.forecast_category ?? (s.probability >= 80 ? 'COMMIT' : s.probability >= 40 ? 'BEST_CASE' : 'PIPELINE');
        return {
            name: s.name,
            slug: slugify(s.name) || `stage-${i + 1}`,
            sort_order: i,
            probability: s.is_won ? 100 : s.is_lost ? 0 : s.probability,
            forecast_category: forecast as CrmForecastCategory,
            is_won: !!s.is_won,
            is_lost: !!s.is_lost,
            stale_after_days: s.stale_after_days ?? null,
            color: s.color ?? (s.is_won ? 'success' : s.is_lost ? 'danger' : 'neutral'),
        };
    }

    private async uniqueSlug(ctx: OrgContext, name: string) {
        const base = slugify(name) || 'pipeline';
        let slug = base;
        for (let i = 2; await this.prisma.crmPipeline.findFirst({ where: { organization_id: ctx.organization_id, slug }, select: { id: true } }); i++) slug = `${base}-${i}`;
        return slug;
    }
}
