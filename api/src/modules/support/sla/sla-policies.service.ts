import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { ModuleKey, Prisma } from 'generated/prisma';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import { AuditService } from '@/shared/audit/audit.service';
import { EventsService } from '@/shared/events/events.service';
import { OrgContext } from '@/shared/authorization/interfaces/org-context.interface';
import { SupportSetupService } from '../common/support-setup.service';
import { CreateSlaPolicyDto, SlaTargetDto, UpdateSlaPolicyDto } from './dto/sla-policy.dto';

/** SLA policy configuration (13 §2, §7). Timers are run by SlaService. */
@Injectable()
export class SlaPoliciesService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly audit: AuditService,
        private readonly events: EventsService,
        private readonly setup: SupportSetupService,
    ) { }

    async findAll(ctx: OrgContext, includeArchived = false) {
        await this.setup.ensureDefaults(ctx.organization_id);
        const rows = await this.prisma.slaPolicy.findMany({
            where: { organization_id: ctx.organization_id, ...(includeArchived ? {} : { archived_at: null }) },
            include: { targets: true, _count: { select: { tickets: { where: { closed_at: null, resolved_at: null } } } } },
            orderBy: [{ is_default: 'desc' }, { sort_order: 'asc' }, { name: 'asc' }],
        });
        return rows.map((p) => ({ ...p, targets: this.sortTargets(p.targets) }));
    }

    async findOne(ctx: OrgContext, id: string) {
        const p = await this.prisma.slaPolicy.findFirst({ where: { id, organization_id: ctx.organization_id }, include: { targets: true } });
        if (!p) throw new NotFoundException({ message: 'SLA policy not found', code: 'sla_policy_not_found' });
        return { ...p, targets: this.sortTargets(p.targets) };
    }

    async create(ctx: OrgContext, dto: CreateSlaPolicyDto) {
        this.validateTargets(dto.targets);
        try {
            const policy = await this.prisma.$transaction(async (tx) => {
                if (dto.is_default) await tx.slaPolicy.updateMany({ where: { organization_id: ctx.organization_id }, data: { is_default: false } });
                const created = await tx.slaPolicy.create({
                    data: {
                        organization_id: ctx.organization_id,
                        name: dto.name,
                        description: dto.description,
                        is_default: dto.is_default ?? false,
                        use_business_hours: dto.use_business_hours ?? false,
                        conditions: (dto.conditions ?? undefined) as Prisma.InputJsonValue,
                        at_risk_threshold_percent: dto.at_risk_threshold_percent ?? 80,
                        escalation_rule_ids: dto.escalation_rule_ids ?? [],
                        targets: { create: dto.targets.map((t) => ({ priority: t.priority, first_response_minutes: t.first_response_minutes ?? null, next_response_minutes: t.next_response_minutes ?? null, resolution_minutes: t.resolution_minutes ?? null })) },
                    },
                    include: { targets: true },
                });
                if (dto.is_default) await tx.supportSettings.updateMany({ where: { organization_id: ctx.organization_id }, data: { default_sla_policy_id: created.id } });
                return created;
            });
            await this.audit.record(ctx, 'sla_policy.created', { resource_type: 'sla_policy', resource_id: policy.id, metadata: { after: dto } });
            this.events.publish(ctx, { event_key: 'support.sla_policy.created', module: ModuleKey.SUPPORT, entity_kind: 'sla_policy', entity_id: policy.id, payload: { name: policy.name } });
            return policy;
        } catch (e) {
            this.rethrow(e);
        }
    }

    async update(ctx: OrgContext, id: string, dto: UpdateSlaPolicyDto) {
        const before = await this.findOne(ctx, id);
        if (dto.targets) this.validateTargets(dto.targets);
        try {
            const policy = await this.prisma.$transaction(async (tx) => {
                if (dto.is_default) await tx.slaPolicy.updateMany({ where: { organization_id: ctx.organization_id, id: { not: id } }, data: { is_default: false } });
                const { targets, conditions, ...rest } = dto;
                await tx.slaPolicy.update({
                    where: { id },
                    data: { ...rest, ...(conditions !== undefined && { conditions: conditions as Prisma.InputJsonValue }) },
                });
                if (targets) {
                    await tx.slaPolicyTarget.deleteMany({ where: { policy_id: id } });
                    await tx.slaPolicyTarget.createMany({ data: targets.map((t) => ({ policy_id: id, priority: t.priority, first_response_minutes: t.first_response_minutes ?? null, next_response_minutes: t.next_response_minutes ?? null, resolution_minutes: t.resolution_minutes ?? null })) });
                }
                if (dto.is_default) await tx.supportSettings.updateMany({ where: { organization_id: ctx.organization_id }, data: { default_sla_policy_id: id } });
                return tx.slaPolicy.findUniqueOrThrow({ where: { id }, include: { targets: true } });
            });
            await this.audit.record(ctx, 'sla_policy.updated', { resource_type: 'sla_policy', resource_id: id, metadata: { before: { name: before.name, targets: before.targets }, after: dto } });
            this.events.publish(ctx, { event_key: 'support.sla_policy.updated', module: ModuleKey.SUPPORT, entity_kind: 'sla_policy', entity_id: id, payload: { name: policy.name }, changes: dto as Record<string, unknown> });
            return { ...policy, targets: this.sortTargets(policy.targets) };
        } catch (e) {
            this.rethrow(e);
        }
    }

    async archive(ctx: OrgContext, id: string) {
        const p = await this.findOne(ctx, id);
        if (p.is_default) throw new ConflictException({ message: 'Make another policy the default before archiving this one', code: 'sla_policy_is_default' });
        const row = await this.prisma.slaPolicy.update({ where: { id }, data: { archived_at: new Date() } });
        await this.audit.record(ctx, 'sla_policy.archived', { resource_type: 'sla_policy', resource_id: id });
        this.events.publish(ctx, { event_key: 'support.sla_policy.archived', module: ModuleKey.SUPPORT, entity_kind: 'sla_policy', entity_id: id, payload: { name: p.name } });
        return row;
    }

    async restore(ctx: OrgContext, id: string) {
        await this.findOne(ctx, id);
        const row = await this.prisma.slaPolicy.update({ where: { id }, data: { archived_at: null } });
        await this.audit.record(ctx, 'sla_policy.updated', { resource_type: 'sla_policy', resource_id: id, metadata: { after: { archived_at: null } } });
        return row;
    }

    private validateTargets(targets: SlaTargetDto[]) {
        const seen = new Set<string>();
        for (const t of targets) {
            if (seen.has(t.priority)) throw new BadRequestException({ message: `Priority ${t.priority} is listed twice`, code: 'sla_target_duplicate' });
            seen.add(t.priority);
            if (t.first_response_minutes && t.resolution_minutes && t.resolution_minutes < t.first_response_minutes) {
                throw new BadRequestException({ message: `Resolution time must be at least the first response time (${t.priority})`, code: 'sla_target_invalid' });
            }
        }
    }

    private sortTargets<T extends { priority: string }>(targets: T[]) {
        const order = ['URGENT', 'HIGH', 'NORMAL', 'LOW'];
        return [...targets].sort((a, b) => order.indexOf(a.priority) - order.indexOf(b.priority));
    }

    private rethrow(e: unknown): never {
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') throw new ConflictException({ message: 'A policy with this name already exists', code: 'sla_policy_conflict' });
        throw e;
    }
}
