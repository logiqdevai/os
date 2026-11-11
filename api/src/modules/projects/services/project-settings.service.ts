import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { ModuleKey, Prisma, ProjectStatusCategory } from 'generated/prisma';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import { AuditService } from '@/shared/audit/audit.service';
import { EventsService } from '@/shared/events/events.service';
import { OrgContext } from '@/shared/authorization/interfaces/org-context.interface';
import { slugify } from '@/modules/auth/services/organization-setup.service';
import {
    CreateProjectStatusDto,
    CreateProjectTemplateDto,
    CreateProjectTypeDto,
    PublishTemplateVersionDto,
    UpdateProjectStatusDto,
    UpdateProjectTemplateDto,
    UpdateProjectTypeDto,
} from '../dto/project-settings.dto';

/** Default lifecycle created lazily for every organization (05 §4). Codes rely on the category, not the name. */
const DEFAULT_STATUSES: { name: string; slug: string; category: ProjectStatusCategory; color: string; is_default?: boolean }[] = [
    { name: 'Planned', slug: 'planned', category: ProjectStatusCategory.PLANNED, color: 'neutral', is_default: true },
    { name: 'In progress', slug: 'in-progress', category: ProjectStatusCategory.IN_PROGRESS, color: 'info' },
    { name: 'On hold', slug: 'on-hold', category: ProjectStatusCategory.ON_HOLD, color: 'warning' },
    { name: 'Blocked', slug: 'blocked', category: ProjectStatusCategory.BLOCKED, color: 'danger' },
    { name: 'Ready for completion', slug: 'ready-for-completion', category: ProjectStatusCategory.READY_FOR_COMPLETION, color: 'violet' },
    { name: 'Completed', slug: 'completed', category: ProjectStatusCategory.COMPLETED, color: 'success' },
    { name: 'Cancelled', slug: 'cancelled', category: ProjectStatusCategory.CANCELLED, color: 'neutral' },
];

const DEFAULT_TYPES = [
    { name: 'Website', slug: 'website', is_default: true },
    { name: 'Web application', slug: 'web-application' },
    { name: 'Mobile app', slug: 'mobile-app' },
    { name: 'Maintenance & support', slug: 'maintenance' },
    { name: 'Internal', slug: 'internal' },
];

/** Starter template so "create from template" works on day one (05 §36). */
const DEFAULT_TEMPLATE_STRUCTURE = {
    milestones: [
        { key: 'kickoff', name: 'Kickoff', offset_days: 0, customer_visible: true },
        { key: 'design', name: 'Design sign-off', offset_days: 14, customer_visible: true, is_billing_milestone: true },
        { key: 'build', name: 'Development complete', offset_days: 35, customer_visible: true },
        { key: 'launch', name: 'Launch', offset_days: 42, customer_visible: true, is_billing_milestone: true },
    ],
    workstreams: [{ name: 'Design' }, { name: 'Development' }, { name: 'QA' }],
    deliverables: [
        { name: 'Sitemap & wireframes', milestone_key: 'design', customer_visible: true },
        { name: 'Visual design', milestone_key: 'design', customer_visible: true },
        { name: 'Production website', milestone_key: 'launch', customer_visible: true },
    ],
    tasks: [
        { title: 'Kickoff meeting with the customer', milestone_key: 'kickoff', priority: 'HIGH' },
        { title: 'Collect content and brand assets', milestone_key: 'design', priority: 'MEDIUM' },
        { title: 'Wireframes for key pages', milestone_key: 'design', priority: 'MEDIUM', estimate_points: 3 },
        { title: 'Set up repository and CI', milestone_key: 'build', priority: 'MEDIUM', estimate_points: 2 },
        { title: 'Cross-browser QA', milestone_key: 'launch', priority: 'HIGH', estimate_points: 3 },
    ],
    checklists: [{ name: 'Launch checklist', phase: 'launch', items: ['DNS and SSL ready', 'Analytics installed', 'Backups configured', 'Customer sign-off received'] }],
};

/** Project types, statuses and templates (05 §2, §4, §36–37). Permission: projects.settings.manage. */
@Injectable()
export class ProjectSettingsService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly audit: AuditService,
        private readonly events: EventsService,
    ) { }

    /** Create the default statuses, types and starter template the first time an organization uses Projects. */
    async ensureDefaults(organizationId: string) {
        const [statusCount, typeCount, templateCount] = await Promise.all([
            this.prisma.projectStatus.count({ where: { organization_id: organizationId } }),
            this.prisma.projectType.count({ where: { organization_id: organizationId } }),
            this.prisma.projectTemplate.count({ where: { organization_id: organizationId } }),
        ]);
        if (!statusCount) {
            await this.prisma.projectStatus.createMany({
                data: DEFAULT_STATUSES.map((s, i) => ({ ...s, organization_id: organizationId, sort_order: i, is_default: !!s.is_default })),
                skipDuplicates: true,
            });
        }
        if (!typeCount) {
            await this.prisma.projectType.createMany({
                data: DEFAULT_TYPES.map((t, i) => ({ ...t, organization_id: organizationId, sort_order: i, is_default: !!t.is_default })),
                skipDuplicates: true,
            });
        }
        if (!templateCount) {
            try {
                await this.prisma.$transaction(async (tx) => {
                    const template = await tx.projectTemplate.create({
                        data: { organization_id: organizationId, name: 'Website build (6 weeks)', slug: 'website-build', description: 'Kickoff, design, build and launch with customer sign-offs.' },
                    });
                    const version = await tx.projectTemplateVersion.create({
                        data: { template_id: template.id, version_number: 1, structure: DEFAULT_TEMPLATE_STRUCTURE, change_summary: 'Starter template' },
                    });
                    await tx.projectTemplate.update({ where: { id: template.id }, data: { current_version_id: version.id } });
                });
            } catch (error) {
                if (!(error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002')) throw error;
            }
        }
    }

    // --- Types -----------------------------------------------------------------------------------

    async listTypes(ctx: OrgContext, includeArchived = false) {
        await this.ensureDefaults(ctx.organization_id);
        return this.prisma.projectType.findMany({
            where: { organization_id: ctx.organization_id, ...(includeArchived ? {} : { archived_at: null }) },
            orderBy: [{ sort_order: 'asc' }, { name: 'asc' }],
            include: { _count: { select: { projects: true } } },
        });
    }

    async createType(ctx: OrgContext, dto: CreateProjectTypeDto) {
        const slug = await this.uniqueSlug('projectType', ctx.organization_id, dto.name);
        const type = await this.prisma.$transaction(async (tx) => {
            if (dto.is_default) await tx.projectType.updateMany({ where: { organization_id: ctx.organization_id }, data: { is_default: false } });
            return tx.projectType.create({ data: { ...dto, slug, organization_id: ctx.organization_id } });
        });
        await this.audit.record(ctx, 'project_type.created', { resource_type: 'project_type', resource_id: type.id, metadata: { after: dto } });
        this.events.publish(ctx, { event_key: 'projects.type.created', module: ModuleKey.PROJECTS, entity_kind: 'project_type', entity_id: type.id, payload: { name: type.name } });
        return type;
    }

    async updateType(ctx: OrgContext, id: string, dto: UpdateProjectTypeDto) {
        const before = await this.prisma.projectType.findFirst({ where: { id, organization_id: ctx.organization_id } });
        if (!before) throw new NotFoundException({ message: 'Project type not found', code: 'project_type_not_found' });
        const type = await this.prisma.$transaction(async (tx) => {
            if (dto.is_default) await tx.projectType.updateMany({ where: { organization_id: ctx.organization_id, id: { not: id } }, data: { is_default: false } });
            return tx.projectType.update({ where: { id }, data: dto });
        });
        await this.audit.record(ctx, 'project_type.updated', { resource_type: 'project_type', resource_id: id, metadata: { before: { name: before.name, is_default: before.is_default }, after: dto } });
        return type;
    }

    async archiveType(ctx: OrgContext, id: string) {
        const type = await this.prisma.projectType.findFirst({ where: { id, organization_id: ctx.organization_id } });
        if (!type) throw new NotFoundException({ message: 'Project type not found', code: 'project_type_not_found' });
        const updated = await this.prisma.projectType.update({ where: { id }, data: { archived_at: type.archived_at ? null : new Date(), is_default: false } });
        await this.audit.record(ctx, updated.archived_at ? 'project_type.archived' : 'project_type.restored', { resource_type: 'project_type', resource_id: id });
        return updated;
    }

    // --- Statuses --------------------------------------------------------------------------------

    async listStatuses(ctx: OrgContext, includeArchived = false) {
        await this.ensureDefaults(ctx.organization_id);
        return this.prisma.projectStatus.findMany({
            where: { organization_id: ctx.organization_id, ...(includeArchived ? {} : { archived_at: null }) },
            orderBy: [{ sort_order: 'asc' }, { name: 'asc' }],
            include: { _count: { select: { projects: true } } },
        });
    }

    async createStatus(ctx: OrgContext, dto: CreateProjectStatusDto) {
        const slug = await this.uniqueSlug('projectStatus', ctx.organization_id, dto.name);
        const status = await this.prisma.$transaction(async (tx) => {
            if (dto.is_default) await tx.projectStatus.updateMany({ where: { organization_id: ctx.organization_id }, data: { is_default: false } });
            return tx.projectStatus.create({ data: { ...dto, slug, organization_id: ctx.organization_id } });
        });
        await this.audit.record(ctx, 'project_status.created', { resource_type: 'project_status', resource_id: status.id, metadata: { after: dto } });
        return status;
    }

    async updateStatus(ctx: OrgContext, id: string, dto: UpdateProjectStatusDto) {
        const before = await this.prisma.projectStatus.findFirst({ where: { id, organization_id: ctx.organization_id } });
        if (!before) throw new NotFoundException({ message: 'Project status not found', code: 'project_status_not_found' });
        const status = await this.prisma.$transaction(async (tx) => {
            if (dto.is_default) await tx.projectStatus.updateMany({ where: { organization_id: ctx.organization_id, id: { not: id } }, data: { is_default: false } });
            return tx.projectStatus.update({ where: { id }, data: dto });
        });
        await this.audit.record(ctx, 'project_status.updated', {
            resource_type: 'project_status', resource_id: id,
            metadata: { before: { name: before.name, category: before.category, allowed_transitions: before.allowed_transitions }, after: dto },
        });
        return status;
    }

    async archiveStatus(ctx: OrgContext, id: string) {
        const status = await this.prisma.projectStatus.findFirst({ where: { id, organization_id: ctx.organization_id }, include: { _count: { select: { projects: true } } } });
        if (!status) throw new NotFoundException({ message: 'Project status not found', code: 'project_status_not_found' });
        if (!status.archived_at && status.is_default) throw new ConflictException({ message: 'Choose another default status before archiving this one', code: 'project_status_is_default' });
        const updated = await this.prisma.projectStatus.update({ where: { id }, data: { archived_at: status.archived_at ? null : new Date() } });
        await this.audit.record(ctx, updated.archived_at ? 'project_status.archived' : 'project_status.restored', { resource_type: 'project_status', resource_id: id });
        return updated;
    }

    // --- Templates -------------------------------------------------------------------------------

    async listTemplates(ctx: OrgContext, includeInactive = false) {
        await this.ensureDefaults(ctx.organization_id);
        return this.prisma.projectTemplate.findMany({
            where: { organization_id: ctx.organization_id, ...(includeInactive ? {} : { is_active: true }) },
            orderBy: { name: 'asc' },
            include: {
                type: { select: { id: true, name: true } },
                current_version: { select: { id: true, version_number: true, structure: true, created_at: true } },
                _count: { select: { projects: true, versions: true } },
            },
        });
    }

    async getTemplate(ctx: OrgContext, id: string) {
        const template = await this.prisma.projectTemplate.findFirst({
            where: { id, organization_id: ctx.organization_id },
            include: {
                type: { select: { id: true, name: true } },
                current_version: true,
                versions: { orderBy: { version_number: 'desc' }, select: { id: true, version_number: true, change_summary: true, created_at: true } },
            },
        });
        if (!template) throw new NotFoundException({ message: 'Template not found', code: 'project_template_not_found' });
        return template;
    }

    async createTemplate(ctx: OrgContext, dto: CreateProjectTemplateDto) {
        if (dto.type_id) await this.assertType(ctx, dto.type_id);
        const slug = await this.uniqueSlug('projectTemplate', ctx.organization_id, dto.name);
        const template = await this.prisma.$transaction(async (tx) => {
            const t = await tx.projectTemplate.create({
                data: { organization_id: ctx.organization_id, name: dto.name, slug, description: dto.description, type_id: dto.type_id, created_by_user_id: ctx.user_id },
            });
            const v = await tx.projectTemplateVersion.create({
                data: { template_id: t.id, version_number: 1, structure: (dto.structure ?? {}) as Prisma.InputJsonValue, created_by_user_id: ctx.user_id, change_summary: 'Initial version' },
            });
            return tx.projectTemplate.update({ where: { id: t.id }, data: { current_version_id: v.id } });
        });
        await this.audit.record(ctx, 'project_template.created', { resource_type: 'project_template', resource_id: template.id, metadata: { name: dto.name } });
        this.events.publish(ctx, { event_key: 'projects.template.created', module: ModuleKey.PROJECTS, entity_kind: 'project_template', entity_id: template.id, payload: { name: template.name } });
        return template;
    }

    async updateTemplate(ctx: OrgContext, id: string, dto: UpdateProjectTemplateDto) {
        const before = await this.getTemplate(ctx, id);
        if (dto.type_id) await this.assertType(ctx, dto.type_id);
        const template = await this.prisma.projectTemplate.update({
            where: { id },
            data: { ...dto, ...(dto.is_active === false ? { deprecated_at: new Date() } : dto.is_active === true ? { deprecated_at: null } : {}) },
        });
        await this.audit.record(ctx, 'project_template.updated', { resource_type: 'project_template', resource_id: id, metadata: { before: { name: before.name, is_active: before.is_active }, after: dto } });
        return template;
    }

    /** Publishing creates a new immutable version; existing projects keep the version they were created from. */
    async publishVersion(ctx: OrgContext, id: string, dto: PublishTemplateVersionDto) {
        await this.getTemplate(ctx, id);
        const version = await this.prisma.$transaction(async (tx) => {
            const last = await tx.projectTemplateVersion.aggregate({ where: { template_id: id }, _max: { version_number: true } });
            const v = await tx.projectTemplateVersion.create({
                data: { template_id: id, version_number: (last._max.version_number ?? 0) + 1, structure: dto.structure as Prisma.InputJsonValue, change_summary: dto.change_summary, created_by_user_id: ctx.user_id },
            });
            await tx.projectTemplate.update({ where: { id }, data: { current_version_id: v.id } });
            return v;
        });
        await this.audit.record(ctx, 'project_template.version_published', { resource_type: 'project_template', resource_id: id, metadata: { version_number: version.version_number, change_summary: dto.change_summary } });
        this.events.publish(ctx, { event_key: 'projects.template.version_published', module: ModuleKey.PROJECTS, entity_kind: 'project_template', entity_id: id, payload: { version_number: version.version_number } });
        return version;
    }

    private async assertType(ctx: OrgContext, typeId: string) {
        const type = await this.prisma.projectType.findFirst({ where: { id: typeId, organization_id: ctx.organization_id }, select: { id: true } });
        if (!type) throw new BadRequestException({ message: 'Project type not found', code: 'project_type_not_found' });
    }

    private async uniqueSlug(model: 'projectType' | 'projectStatus' | 'projectTemplate', organizationId: string, name: string) {
        const base = slugify(name);
        const delegate = this.prisma[model] as unknown as { findFirst(args: unknown): Promise<unknown> };
        let slug = base;
        for (let i = 2; await delegate.findFirst({ where: { organization_id: organizationId, slug }, select: { id: true } }); i++) slug = `${base}-${i}`;
        return slug;
    }
}
