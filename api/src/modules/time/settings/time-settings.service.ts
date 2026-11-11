import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { ModuleKey, Prisma } from 'generated/prisma';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import { AuditService } from '@/shared/audit/audit.service';
import { EventsService } from '@/shared/events/events.service';
import { OrgContext } from '@/shared/authorization/interfaces/org-context.interface';
import { slugify } from '@/modules/auth/services/organization-setup.service';
import { TimeAccessService } from '../common/time-access.service';
import { toDateOnly } from '../common/time-dates';
import { CreateActivityTypeDto, UpdateActivityTypeDto, UpdateProjectTimeSettingsDto, UpdateTimeSettingsDto } from './dto/time-settings.dto';

/** 18 §4–§6 — organization time settings (one row, created lazily), activity types and per-project overrides. */
@Injectable()
export class TimeSettingsService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly audit: AuditService,
        private readonly events: EventsService,
        private readonly access: TimeAccessService,
    ) { }

    get(ctx: OrgContext) {
        return this.access.settings(ctx.organization_id);
    }

    async update(ctx: OrgContext, dto: UpdateTimeSettingsDto) {
        const before = await this.access.settings(ctx.organization_id);
        if (dto.default_approver_membership_id) await this.assertMember(ctx, dto.default_approver_membership_id);
        const data: Prisma.TimeTrackingSettingsUncheckedUpdateInput = { ...dto, locked_before_date: undefined };
        if (dto.locked_before_date !== undefined) {
            data.locked_before_date = dto.locked_before_date ? toDateOnly(dto.locked_before_date) : null;
            data.locked_before_set_at = new Date();
            data.locked_before_set_by_membership_id = ctx.membership_id;
        }
        const after = await this.prisma.timeTrackingSettings.update({ where: { organization_id: ctx.organization_id }, data });
        const changed = Object.fromEntries(Object.keys(dto).map((k) => [k, { from: (before as Record<string, unknown>)[k], to: (dto as Record<string, unknown>)[k] }]));
        await this.audit.record(ctx, 'time.settings.updated', { resource_type: 'time_tracking_settings', resource_id: ctx.organization_id, metadata: { changes: changed } });
        this.events.publish(ctx, { event_key: 'time.settings.updated', module: ModuleKey.TIME_TRACKING, entity_kind: 'time_tracking_settings', entity_id: ctx.organization_id, changes: dto as Record<string, unknown> });
        return after;
    }

    async listActivityTypes(ctx: OrgContext, includeArchived = false) {
        await this.access.ensureActivityTypes(ctx.organization_id);
        return this.prisma.timeActivityType.findMany({
            where: { organization_id: ctx.organization_id, ...(includeArchived ? {} : { archived_at: null }) },
            orderBy: [{ sort_order: 'asc' }, { name: 'asc' }],
        });
    }

    async createActivityType(ctx: OrgContext, dto: CreateActivityTypeDto) {
        await this.access.ensureActivityTypes(ctx.organization_id);
        const slug = slugify(dto.name);
        if (await this.prisma.timeActivityType.findFirst({ where: { organization_id: ctx.organization_id, slug } })) {
            throw new ConflictException({ message: 'An activity type with this name already exists', code: 'activity_type_exists' });
        }
        const row = await this.prisma.$transaction(async (tx) => {
            if (dto.is_default) await tx.timeActivityType.updateMany({ where: { organization_id: ctx.organization_id }, data: { is_default: false } });
            return tx.timeActivityType.create({ data: { ...dto, slug, organization_id: ctx.organization_id } });
        });
        await this.audit.record(ctx, 'time.activity_type.created', { resource_type: 'time_activity_type', resource_id: row.id, metadata: { after: dto } });
        this.events.publish(ctx, { event_key: 'time.activity_type.created', module: ModuleKey.TIME_TRACKING, entity_kind: 'time_activity_type', entity_id: row.id, payload: { name: row.name } });
        return row;
    }

    async updateActivityType(ctx: OrgContext, id: string, dto: UpdateActivityTypeDto) {
        const before = await this.findActivityType(ctx, id);
        const row = await this.prisma.$transaction(async (tx) => {
            if (dto.is_default) await tx.timeActivityType.updateMany({ where: { organization_id: ctx.organization_id, id: { not: id } }, data: { is_default: false } });
            return tx.timeActivityType.update({ where: { id }, data: dto });
        });
        await this.audit.record(ctx, 'time.activity_type.updated', { resource_type: 'time_activity_type', resource_id: id, metadata: { before: { name: before.name, default_billable: before.default_billable }, after: dto } });
        this.events.publish(ctx, { event_key: 'time.activity_type.updated', module: ModuleKey.TIME_TRACKING, entity_kind: 'time_activity_type', entity_id: id, changes: dto as Record<string, unknown> });
        return row;
    }

    async archiveActivityType(ctx: OrgContext, id: string, restore = false) {
        await this.findActivityType(ctx, id);
        const row = await this.prisma.timeActivityType.update({ where: { id }, data: { archived_at: restore ? null : new Date(), ...(restore ? {} : { is_default: false }) } });
        await this.audit.record(ctx, restore ? 'time.activity_type.restored' : 'time.activity_type.archived', { resource_type: 'time_activity_type', resource_id: id });
        this.events.publish(ctx, { event_key: restore ? 'time.activity_type.restored' : 'time.activity_type.archived', module: ModuleKey.TIME_TRACKING, entity_kind: 'time_activity_type', entity_id: id, payload: { name: row.name } });
        return row;
    }

    async getProjectSettings(ctx: OrgContext, projectId: string) {
        const project = await this.prisma.project.findFirst({ where: { id: projectId, organization_id: ctx.organization_id }, select: { id: true, name: true, code: true, budget_hours: true } });
        if (!project) throw new NotFoundException({ message: 'Project not found', code: 'project_not_found' });
        const settings = await this.prisma.timeProjectSettings.findUnique({ where: { project_id: projectId } });
        const org = await this.access.settings(ctx.organization_id);
        return {
            project,
            settings,
            resolved_default_billable: settings?.default_billable ?? org.default_billable,
            resolved_from: settings?.default_billable !== null && settings?.default_billable !== undefined ? 'project' : 'organization',
        };
    }

    async updateProjectSettings(ctx: OrgContext, projectId: string, dto: UpdateProjectTimeSettingsDto) {
        const { settings: before } = await this.getProjectSettings(ctx, projectId);
        if (dto.approver_membership_id) await this.assertMember(ctx, dto.approver_membership_id);
        if (dto.default_activity_type_id) await this.findActivityType(ctx, dto.default_activity_type_id);
        const row = await this.prisma.timeProjectSettings.upsert({ where: { project_id: projectId }, update: dto, create: { ...dto, project_id: projectId } });
        await this.audit.record(ctx, 'time.project_settings.updated', { resource_type: 'project', resource_id: projectId, metadata: { before, after: dto } });
        this.events.publish(ctx, { event_key: 'time.project_settings.updated', module: ModuleKey.TIME_TRACKING, entity_type: 'PROJECT', entity_id: projectId, changes: dto as Record<string, unknown> });
        return row;
    }

    private async findActivityType(ctx: OrgContext, id: string) {
        const row = await this.prisma.timeActivityType.findFirst({ where: { id, organization_id: ctx.organization_id } });
        if (!row) throw new NotFoundException({ message: 'Activity type not found', code: 'activity_type_not_found' });
        return row;
    }

    private async assertMember(ctx: OrgContext, membershipId: string) {
        const m = await this.prisma.membership.findFirst({ where: { id: membershipId, organization_id: ctx.organization_id } });
        if (!m) throw new NotFoundException({ message: 'Member not found', code: 'membership_not_found' });
    }
}
