import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { ModuleKey, Prisma } from 'generated/prisma';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import { AuditService } from '@/shared/audit/audit.service';
import { EventsService } from '@/shared/events/events.service';
import { OrgContext } from '@/shared/authorization/interfaces/org-context.interface';
import { slugify } from '@/modules/auth/services/organization-setup.service';
import { SupportSetupService } from '../common/support-setup.service';
import { ArchiveTicketStatusDto, CreateTicketCategoryDto, CreateTicketStatusDto, UpdateTicketCategoryDto, UpdateTicketStatusDto } from './dto/ticket-config.dto';

/** Configurable ticket statuses (with categories and transitions) and hierarchical categories (13 §2, §13). */
@Injectable()
export class TicketConfigService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly audit: AuditService,
        private readonly events: EventsService,
        private readonly setup: SupportSetupService,
    ) { }

    // --- Statuses --------------------------------------------------------------------------------

    async statuses(ctx: OrgContext, includeArchived = false) {
        await this.setup.ensureDefaults(ctx.organization_id);
        return this.prisma.ticketStatus.findMany({
            where: { organization_id: ctx.organization_id, ...(includeArchived ? {} : { archived_at: null }) },
            include: { _count: { select: { tickets: true } } },
            orderBy: [{ sort_order: 'asc' }, { name: 'asc' }],
        });
    }

    async createStatus(ctx: OrgContext, dto: CreateTicketStatusDto) {
        await this.setup.ensureDefaults(ctx.organization_id);
        const count = await this.prisma.ticketStatus.count({ where: { organization_id: ctx.organization_id } });
        const row = await this.prisma.$transaction(async (tx) => {
            if (dto.is_default) await tx.ticketStatus.updateMany({ where: { organization_id: ctx.organization_id }, data: { is_default: false } });
            return tx.ticketStatus.create({ data: { ...dto, organization_id: ctx.organization_id, slug: await this.uniqueSlug(ctx, 'status', dto.name), sort_order: count } });
        });
        await this.audit.record(ctx, 'ticket_status.created', { resource_type: 'ticket_status', resource_id: row.id, metadata: { after: dto } });
        this.events.publish(ctx, { event_key: 'support.ticket_status.created', module: ModuleKey.SUPPORT, entity_kind: 'ticket_status', entity_id: row.id, payload: { name: row.name } });
        return row;
    }

    async updateStatus(ctx: OrgContext, id: string, dto: UpdateTicketStatusDto) {
        const before = await this.status(ctx, id);
        const row = await this.prisma.$transaction(async (tx) => {
            if (dto.is_default) await tx.ticketStatus.updateMany({ where: { organization_id: ctx.organization_id, id: { not: id } }, data: { is_default: false } });
            return tx.ticketStatus.update({ where: { id }, data: dto });
        });
        await this.audit.record(ctx, 'ticket_status.updated', { resource_type: 'ticket_status', resource_id: id, metadata: { before: { name: before.name, category: before.category, pauses_sla: before.pauses_sla }, after: dto } });
        this.events.publish(ctx, { event_key: 'support.ticket_status.updated', module: ModuleKey.SUPPORT, entity_kind: 'ticket_status', entity_id: id, changes: dto as Record<string, unknown> });
        return row;
    }

    /** Archive a status; tickets in it move to the replacement (required when the status is in use). */
    async archiveStatus(ctx: OrgContext, id: string, dto: ArchiveTicketStatusDto) {
        const status = await this.status(ctx, id);
        if (status.is_default) throw new ConflictException({ message: 'Make another status the default first', code: 'ticket_status_is_default' });
        const inUse = await this.prisma.ticket.count({ where: { status_id: id } });
        if (inUse && !dto.replacement_status_id) {
            throw new ConflictException({ message: `${inUse} ticket${inUse === 1 ? ' uses' : 's use'} this status. Pick a replacement`, code: 'ticket_status_in_use', count: inUse });
        }
        if (dto.replacement_status_id) {
            if (dto.replacement_status_id === id) throw new BadRequestException({ message: 'Pick a different replacement', code: 'ticket_status_replacement_same' });
            await this.status(ctx, dto.replacement_status_id);
        }
        await this.prisma.$transaction(async (tx) => {
            if (dto.replacement_status_id && inUse) await tx.ticket.updateMany({ where: { status_id: id }, data: { status_id: dto.replacement_status_id } });
            await tx.ticketStatus.update({ where: { id }, data: { archived_at: new Date() } });
        });
        await this.audit.record(ctx, 'ticket_status.archived', { resource_type: 'ticket_status', resource_id: id, metadata: { moved_tickets: inUse, replacement_status_id: dto.replacement_status_id } });
        return { success: true, moved: inUse };
    }

    async reorderStatuses(ctx: OrgContext, ids: string[]) {
        const rows = await this.prisma.ticketStatus.findMany({ where: { id: { in: ids }, organization_id: ctx.organization_id }, select: { id: true } });
        if (rows.length !== ids.length) throw new NotFoundException({ message: 'Status not found', code: 'ticket_status_not_found' });
        await this.prisma.$transaction(ids.map((id, i) => this.prisma.ticketStatus.update({ where: { id }, data: { sort_order: i } })));
        await this.audit.record(ctx, 'ticket_status.reordered', { resource_type: 'ticket_status', metadata: { ids } });
        return this.statuses(ctx);
    }

    private async status(ctx: OrgContext, id: string) {
        const s = await this.prisma.ticketStatus.findFirst({ where: { id, organization_id: ctx.organization_id } });
        if (!s) throw new NotFoundException({ message: 'Status not found', code: 'ticket_status_not_found' });
        return s;
    }

    // --- Categories ------------------------------------------------------------------------------

    async categories(ctx: OrgContext, includeArchived = false) {
        return this.prisma.ticketCategory.findMany({
            where: { organization_id: ctx.organization_id, ...(includeArchived ? {} : { archived_at: null }) },
            include: { parent: { select: { id: true, name: true } }, _count: { select: { tickets: true } } },
            orderBy: [{ sort_order: 'asc' }, { name: 'asc' }],
        });
    }

    async createCategory(ctx: OrgContext, dto: CreateTicketCategoryDto) {
        await this.assertCategoryRefs(ctx, dto);
        const count = await this.prisma.ticketCategory.count({ where: { organization_id: ctx.organization_id } });
        try {
            const row = await this.prisma.ticketCategory.create({ data: { ...dto, organization_id: ctx.organization_id, slug: await this.uniqueSlug(ctx, 'category', dto.name), sort_order: count } });
            await this.audit.record(ctx, 'ticket_category.created', { resource_type: 'ticket_category', resource_id: row.id, metadata: { after: dto } });
            this.events.publish(ctx, { event_key: 'support.ticket_category.created', module: ModuleKey.SUPPORT, entity_kind: 'ticket_category', entity_id: row.id, payload: { name: row.name } });
            return row;
        } catch (e) {
            if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') throw new ConflictException({ message: 'A category with this name already exists', code: 'ticket_category_conflict' });
            throw e;
        }
    }

    async updateCategory(ctx: OrgContext, id: string, dto: UpdateTicketCategoryDto) {
        const before = await this.category(ctx, id);
        if (dto.parent_category_id === id) throw new BadRequestException({ message: 'A category cannot be its own parent', code: 'ticket_category_cycle' });
        await this.assertCategoryRefs(ctx, dto);
        const row = await this.prisma.ticketCategory.update({ where: { id }, data: dto });
        await this.audit.record(ctx, 'ticket_category.updated', { resource_type: 'ticket_category', resource_id: id, metadata: { before: { name: before.name }, after: dto } });
        this.events.publish(ctx, { event_key: 'support.ticket_category.updated', module: ModuleKey.SUPPORT, entity_kind: 'ticket_category', entity_id: id, changes: dto as Record<string, unknown> });
        return row;
    }

    async archiveCategory(ctx: OrgContext, id: string) {
        await this.category(ctx, id);
        const row = await this.prisma.ticketCategory.update({ where: { id }, data: { archived_at: new Date() } });
        await this.audit.record(ctx, 'ticket_category.archived', { resource_type: 'ticket_category', resource_id: id });
        return row;
    }

    private async category(ctx: OrgContext, id: string) {
        const c = await this.prisma.ticketCategory.findFirst({ where: { id, organization_id: ctx.organization_id } });
        if (!c) throw new NotFoundException({ message: 'Category not found', code: 'ticket_category_not_found' });
        return c;
    }

    private async assertCategoryRefs(ctx: OrgContext, dto: UpdateTicketCategoryDto) {
        const org = ctx.organization_id;
        const checks: Promise<unknown>[] = [];
        if (dto.parent_category_id) checks.push(this.prisma.ticketCategory.findFirstOrThrow({ where: { id: dto.parent_category_id, organization_id: org } }));
        if (dto.default_team_id) checks.push(this.prisma.team.findFirstOrThrow({ where: { id: dto.default_team_id, organization_id: org } }));
        if (dto.default_inbox_id) checks.push(this.prisma.supportInbox.findFirstOrThrow({ where: { id: dto.default_inbox_id, organization_id: org } }));
        if (dto.default_sla_policy_id) checks.push(this.prisma.slaPolicy.findFirstOrThrow({ where: { id: dto.default_sla_policy_id, organization_id: org } }));
        if (dto.default_project_id) checks.push(this.prisma.project.findFirstOrThrow({ where: { id: dto.default_project_id, organization_id: org } }));
        try {
            await Promise.all(checks);
        } catch {
            throw new NotFoundException({ message: 'Parent, team, inbox, SLA policy or project not found', code: 'reference_not_found' });
        }
    }

    private async uniqueSlug(ctx: OrgContext, kind: 'status' | 'category', name: string) {
        const base = slugify(name) || kind;
        let slug = base;
        const exists = (s: string) =>
            kind === 'status'
                ? this.prisma.ticketStatus.findFirst({ where: { organization_id: ctx.organization_id, slug: s }, select: { id: true } })
                : this.prisma.ticketCategory.findFirst({ where: { organization_id: ctx.organization_id, slug: s }, select: { id: true } });
        for (let i = 2; await exists(slug); i++) slug = `${base}-${i}`;
        return slug;
    }
}
