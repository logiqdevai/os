import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { ModuleKey, Prisma } from 'generated/prisma';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import { AuditService } from '@/shared/audit/audit.service';
import { EventsService } from '@/shared/events/events.service';
import { OrgContext } from '@/shared/authorization/interfaces/org-context.interface';
import { slugify } from '@/modules/auth/services/organization-setup.service';
import { ensureTaskStatuses, ensureTaskTypes } from '../utils/task-defaults.utils';
import {
    ArchiveTaskStatusDto,
    CreateTaskLabelDto,
    CreateTaskStatusDto,
    CreateTaskTypeDto,
    ReorderStatusesDto,
    UpdateTaskLabelDto,
    UpdateTaskStatusDto,
    UpdateTaskTypeDto,
} from '../dto/task-config.dto';

/** Workflows (statuses per team), task types and labels (06 §3). Changes need tasks.workflows.manage. */
@Injectable()
export class TaskConfigService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly audit: AuditService,
        private readonly events: EventsService,
    ) { }

    // --- Statuses ---------------------------------------------------------------------------------

    async listStatuses(ctx: OrgContext, teamId: string | null, includeArchived = false) {
        if (teamId) await this.assertTeam(ctx, teamId);
        await ensureTaskStatuses(this.prisma, ctx.organization_id, teamId);
        return this.prisma.taskStatus.findMany({
            where: { organization_id: ctx.organization_id, team_id: teamId, project_type_id: null, ...(includeArchived ? {} : { archived_at: null }) },
            orderBy: [{ sort_order: 'asc' }, { name: 'asc' }],
            include: { _count: { select: { tasks: { where: { archived_at: null } } } } },
        });
    }

    /** Every team with a task key plus its workflow — used by pickers that span teams. */
    async workflows(ctx: OrgContext) {
        const teams = await this.prisma.team.findMany({ where: { organization_id: ctx.organization_id, archived_at: null }, orderBy: { name: 'asc' }, select: { id: true, name: true, task_key: true } });
        const result = [];
        for (const team of teams) result.push({ team, statuses: await ensureTaskStatuses(this.prisma, ctx.organization_id, team.id) });
        result.push({ team: null, statuses: await ensureTaskStatuses(this.prisma, ctx.organization_id, null) });
        return result;
    }

    async createStatus(ctx: OrgContext, dto: CreateTaskStatusDto) {
        const teamId = dto.team_id ?? null;
        if (teamId) await this.assertTeam(ctx, teamId);
        const existing = await ensureTaskStatuses(this.prisma, ctx.organization_id, teamId);
        const slug = this.uniqueIn(slugify(dto.name), existing.map((s) => s.slug));
        const status = await this.prisma.$transaction(async (tx) => {
            if (dto.is_default) await tx.taskStatus.updateMany({ where: { organization_id: ctx.organization_id, team_id: teamId }, data: { is_default: false } });
            return tx.taskStatus.create({
                data: { ...dto, team_id: teamId, slug, organization_id: ctx.organization_id, sort_order: dto.sort_order ?? existing.length },
            });
        });
        await this.audit.record(ctx, 'task_status.created', { resource_type: 'task_status', resource_id: status.id, metadata: { team_id: teamId, after: dto } });
        this.events.publish(ctx, { event_key: 'tasks.workflow.changed', module: ModuleKey.TASKS, entity_kind: 'task_status', entity_id: status.id, payload: { team_id: teamId, change: 'created', name: status.name } });
        return status;
    }

    async updateStatus(ctx: OrgContext, id: string, dto: UpdateTaskStatusDto) {
        const before = await this.getStatus(ctx, id);
        const status = await this.prisma.$transaction(async (tx) => {
            if (dto.is_default) await tx.taskStatus.updateMany({ where: { organization_id: ctx.organization_id, team_id: before.team_id, id: { not: id } }, data: { is_default: false } });
            return tx.taskStatus.update({ where: { id }, data: dto });
        });
        await this.audit.record(ctx, 'task_status.updated', { resource_type: 'task_status', resource_id: id, metadata: { before: { name: before.name, category: before.category, allowed_transitions: before.allowed_transitions }, after: dto } });
        this.events.publish(ctx, { event_key: 'tasks.workflow.changed', module: ModuleKey.TASKS, entity_kind: 'task_status', entity_id: id, payload: { team_id: before.team_id, change: 'updated', name: status.name } });
        return status;
    }

    async reorderStatuses(ctx: OrgContext, dto: ReorderStatusesDto) {
        const rows = await this.prisma.taskStatus.findMany({ where: { id: { in: dto.status_ids }, organization_id: ctx.organization_id }, select: { id: true, team_id: true } });
        if (rows.length !== dto.status_ids.length || new Set(rows.map((r) => r.team_id)).size > 1) {
            throw new BadRequestException({ message: 'Send the statuses of one workflow', code: 'reorder_invalid' });
        }
        await this.prisma.$transaction(dto.status_ids.map((id, i) => this.prisma.taskStatus.update({ where: { id }, data: { sort_order: i } })));
        await this.audit.record(ctx, 'task_status.reordered', { resource_type: 'task_status', metadata: { status_ids: dto.status_ids } });
        return { success: true };
    }

    /** Archiving a status in use moves its tasks to a replacement first (06 §3). */
    async archiveStatus(ctx: OrgContext, id: string, dto: ArchiveTaskStatusDto) {
        const status = await this.getStatus(ctx, id);
        if (status.archived_at) {
            const restored = await this.prisma.taskStatus.update({ where: { id }, data: { archived_at: null } });
            await this.audit.record(ctx, 'task_status.restored', { resource_type: 'task_status', resource_id: id });
            return restored;
        }
        const inUse = await this.prisma.task.count({ where: { status_id: id } });
        if (inUse && !dto.replacement_status_id) {
            throw new ConflictException({ message: `${inUse} tasks use this status. Choose a replacement status.`, code: 'task_status_in_use', count: inUse });
        }
        if (dto.replacement_status_id) {
            const replacement = await this.prisma.taskStatus.findFirst({ where: { id: dto.replacement_status_id, organization_id: ctx.organization_id, team_id: status.team_id, archived_at: null } });
            if (!replacement || replacement.id === id) throw new BadRequestException({ message: 'Choose another status of the same workflow', code: 'task_status_replacement_invalid' });
        }
        const active = await this.prisma.taskStatus.count({ where: { organization_id: ctx.organization_id, team_id: status.team_id, archived_at: null } });
        if (active <= 1) throw new ConflictException({ message: 'A workflow needs at least one status', code: 'task_status_last' });
        const archived = await this.prisma.$transaction(async (tx) => {
            if (dto.replacement_status_id) {
                await tx.task.updateMany({ where: { status_id: id }, data: { status_id: dto.replacement_status_id } });
                if (status.is_default) await tx.taskStatus.update({ where: { id: dto.replacement_status_id }, data: { is_default: true } });
            }
            return tx.taskStatus.update({ where: { id }, data: { archived_at: new Date(), is_default: false } });
        });
        await this.audit.record(ctx, 'task_status.archived', { resource_type: 'task_status', resource_id: id, metadata: { moved_tasks: inUse, replacement_status_id: dto.replacement_status_id ?? null } });
        this.events.publish(ctx, { event_key: 'tasks.workflow.changed', module: ModuleKey.TASKS, entity_kind: 'task_status', entity_id: id, payload: { team_id: status.team_id, change: 'archived', name: status.name } });
        return archived;
    }

    // --- Types ------------------------------------------------------------------------------------

    async listTypes(ctx: OrgContext, includeArchived = false) {
        await ensureTaskTypes(this.prisma, ctx.organization_id);
        return this.prisma.taskType.findMany({
            where: { organization_id: ctx.organization_id, ...(includeArchived ? {} : { archived_at: null }) },
            orderBy: [{ sort_order: 'asc' }, { name: 'asc' }],
            include: { _count: { select: { tasks: true } } },
        });
    }

    async createType(ctx: OrgContext, dto: CreateTaskTypeDto) {
        const slug = await this.uniqueSlug('taskType', ctx.organization_id, dto.name);
        const type = await this.prisma.$transaction(async (tx) => {
            if (dto.is_default) await tx.taskType.updateMany({ where: { organization_id: ctx.organization_id }, data: { is_default: false } });
            const count = await tx.taskType.count({ where: { organization_id: ctx.organization_id } });
            return tx.taskType.create({ data: { ...dto, slug, organization_id: ctx.organization_id, sort_order: count } });
        });
        await this.audit.record(ctx, 'task_type.created', { resource_type: 'task_type', resource_id: type.id, metadata: { after: dto } });
        return type;
    }

    async updateType(ctx: OrgContext, id: string, dto: UpdateTaskTypeDto) {
        const before = await this.prisma.taskType.findFirst({ where: { id, organization_id: ctx.organization_id } });
        if (!before) throw new NotFoundException({ message: 'Task type not found', code: 'task_type_not_found' });
        const type = await this.prisma.$transaction(async (tx) => {
            if (dto.is_default) await tx.taskType.updateMany({ where: { organization_id: ctx.organization_id, id: { not: id } }, data: { is_default: false } });
            return tx.taskType.update({ where: { id }, data: dto });
        });
        await this.audit.record(ctx, 'task_type.updated', { resource_type: 'task_type', resource_id: id, metadata: { before: { name: before.name, is_default: before.is_default }, after: dto } });
        return type;
    }

    async archiveType(ctx: OrgContext, id: string) {
        const type = await this.prisma.taskType.findFirst({ where: { id, organization_id: ctx.organization_id } });
        if (!type) throw new NotFoundException({ message: 'Task type not found', code: 'task_type_not_found' });
        const updated = await this.prisma.taskType.update({ where: { id }, data: { archived_at: type.archived_at ? null : new Date(), is_default: type.archived_at ? type.is_default : false } });
        await this.audit.record(ctx, updated.archived_at ? 'task_type.archived' : 'task_type.restored', { resource_type: 'task_type', resource_id: id });
        return updated;
    }

    // --- Labels -----------------------------------------------------------------------------------

    async listLabels(ctx: OrgContext, includeArchived = false) {
        return this.prisma.taskLabel.findMany({
            where: { organization_id: ctx.organization_id, ...(includeArchived ? {} : { archived_at: null }) },
            orderBy: { name: 'asc' },
            include: { parent: { select: { id: true, name: true } }, _count: { select: { assignments: true } } },
        });
    }

    async createLabel(ctx: OrgContext, dto: CreateTaskLabelDto) {
        if (dto.parent_label_id) await this.assertLabel(ctx, dto.parent_label_id);
        const slug = await this.uniqueSlug('taskLabel', ctx.organization_id, dto.name);
        const label = await this.prisma.taskLabel.create({ data: { ...dto, slug, organization_id: ctx.organization_id } });
        await this.audit.record(ctx, 'task_label.created', { resource_type: 'task_label', resource_id: label.id, metadata: { after: dto } });
        return label;
    }

    async updateLabel(ctx: OrgContext, id: string, dto: UpdateTaskLabelDto) {
        const before = await this.assertLabel(ctx, id);
        if (dto.parent_label_id) {
            if (dto.parent_label_id === id) throw new BadRequestException({ message: 'A label cannot be its own group', code: 'label_cycle' });
            await this.assertLabel(ctx, dto.parent_label_id);
        }
        const label = await this.prisma.taskLabel.update({ where: { id }, data: dto });
        await this.audit.record(ctx, 'task_label.updated', { resource_type: 'task_label', resource_id: id, metadata: { before: { name: before.name, color: before.color }, after: dto } });
        return label;
    }

    async archiveLabel(ctx: OrgContext, id: string) {
        const label = await this.assertLabel(ctx, id);
        const updated = await this.prisma.taskLabel.update({ where: { id }, data: { archived_at: label.archived_at ? null : new Date() } });
        await this.audit.record(ctx, updated.archived_at ? 'task_label.archived' : 'task_label.restored', { resource_type: 'task_label', resource_id: id });
        return updated;
    }

    // --- Helpers ----------------------------------------------------------------------------------

    private async getStatus(ctx: OrgContext, id: string) {
        const status = await this.prisma.taskStatus.findFirst({ where: { id, organization_id: ctx.organization_id } });
        if (!status) throw new NotFoundException({ message: 'Status not found', code: 'task_status_not_found' });
        return status;
    }

    private async assertTeam(ctx: OrgContext, teamId: string) {
        const team = await this.prisma.team.findFirst({ where: { id: teamId, organization_id: ctx.organization_id }, select: { id: true } });
        if (!team) throw new NotFoundException({ message: 'Team not found', code: 'team_not_found' });
    }

    private async assertLabel(ctx: OrgContext, id: string) {
        const label = await this.prisma.taskLabel.findFirst({ where: { id, organization_id: ctx.organization_id } });
        if (!label) throw new NotFoundException({ message: 'Label not found', code: 'task_label_not_found' });
        return label;
    }

    private uniqueIn(base: string, taken: string[]) {
        let slug = base || 'status';
        for (let i = 2; taken.includes(slug); i++) slug = `${base}-${i}`;
        return slug;
    }

    private async uniqueSlug(model: 'taskType' | 'taskLabel', organizationId: string, name: string) {
        const base = slugify(name) || model;
        const delegate = this.prisma[model] as unknown as { findFirst(args: unknown): Promise<unknown> };
        let slug = base;
        for (let i = 2; await delegate.findFirst({ where: { organization_id: organizationId, slug }, select: { id: true } }); i++) slug = `${base}-${i}`;
        return slug;
    }
}

export type TaskStatusRow = Prisma.TaskStatusGetPayload<object>;
