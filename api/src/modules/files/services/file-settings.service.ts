import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { ModuleKey, Prisma } from 'generated/prisma';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import { AuditService } from '@/shared/audit/audit.service';
import { EventsService } from '@/shared/events/events.service';
import { OrgContext } from '@/shared/authorization/interfaces/org-context.interface';
import { slugify } from '@/modules/auth/services/organization-setup.service';
import { CreateCategoryDto, UpdateCategoryDto, UpdateDocumentSettingsDto } from '../dto/settings.dto';

/** System categories seeded per organization on first use (17 §4). */
const SYSTEM_CATEGORIES: { name: string; is_sensitive?: boolean; color: string }[] = [
    { name: 'Contract', is_sensitive: true, color: 'violet' },
    { name: 'Proposal', color: 'info' },
    { name: 'Deliverable', color: 'success' },
    { name: 'Design', color: 'warning' },
    { name: 'Specification', color: 'info' },
    { name: 'Invoice', is_sensitive: true, color: 'neutral' },
    { name: 'Receipt', color: 'neutral' },
    { name: 'HR document', is_sensitive: true, color: 'danger' },
    { name: 'Policy', color: 'neutral' },
    { name: 'Other', color: 'neutral' },
];

/** DocumentSettings (one row per organization) and DocumentCategory (17 §4, §5, §8, §9, §13). */
@Injectable()
export class FileSettingsService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly audit: AuditService,
        private readonly events: EventsService,
    ) { }

    /** The organization's settings; created with defaults on first read. */
    async get(organizationId: string) {
        return (
            (await this.prisma.documentSettings.findUnique({ where: { organization_id: organizationId } })) ??
            (await this.prisma.documentSettings.upsert({ where: { organization_id: organizationId }, update: {}, create: { organization_id: organizationId } }))
        );
    }

    async update(ctx: OrgContext, dto: UpdateDocumentSettingsDto) {
        const before = await this.get(ctx.organization_id);
        const data: Prisma.DocumentSettingsUpdateInput = {
            ...dto,
            ...(dto.max_file_size_bytes !== undefined && { max_file_size_bytes: BigInt(dto.max_file_size_bytes) }),
            ...(dto.blocked_extensions && { blocked_extensions: dto.blocked_extensions.map((e) => e.replace(/^\./, '').toLowerCase()) }),
        };
        const after = await this.prisma.documentSettings.update({ where: { organization_id: ctx.organization_id }, data });
        const changed = Object.keys(dto) as (keyof UpdateDocumentSettingsDto)[];
        await this.audit.record(ctx, 'documents.settings_updated', {
            resource_type: 'document_settings',
            resource_id: ctx.organization_id,
            metadata: { before: Object.fromEntries(changed.map((k) => [k, String(before[k])])), after: dto },
        });
        this.events.publish(ctx, { event_key: 'documents.settings.updated', module: ModuleKey.DOCUMENTS, entity_kind: 'document_settings', entity_id: ctx.organization_id, changes: dto as Record<string, unknown> });
        return after;
    }

    async listCategories(ctx: OrgContext, includeArchived = false) {
        const count = await this.prisma.documentCategory.count({ where: { organization_id: ctx.organization_id } });
        if (!count) {
            await this.prisma.documentCategory.createMany({
                data: SYSTEM_CATEGORIES.map((c, i) => ({ organization_id: ctx.organization_id, name: c.name, slug: slugify(c.name), color: c.color, is_sensitive: !!c.is_sensitive, is_system: true, sort_order: i })),
                skipDuplicates: true,
            });
        }
        return this.prisma.documentCategory.findMany({
            where: { organization_id: ctx.organization_id, ...(includeArchived ? {} : { archived_at: null }) },
            orderBy: [{ sort_order: 'asc' }, { name: 'asc' }],
            include: { _count: { select: { documents: { where: { deleted_at: null } } } } },
        });
    }

    async createCategory(ctx: OrgContext, dto: CreateCategoryDto) {
        const max = await this.prisma.documentCategory.aggregate({ where: { organization_id: ctx.organization_id }, _max: { sort_order: true } });
        try {
            const category = await this.prisma.documentCategory.create({
                data: { ...dto, organization_id: ctx.organization_id, slug: slugify(dto.name), sort_order: (max._max.sort_order ?? 0) + 1 },
            });
            await this.audit.record(ctx, 'documents.category_created', { resource_type: 'document_category', resource_id: category.id, metadata: { after: dto } });
            return category;
        } catch (error) {
            if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') throw new ConflictException({ message: 'A category with this name already exists', code: 'category_conflict' });
            throw error;
        }
    }

    async updateCategory(ctx: OrgContext, id: string, dto: UpdateCategoryDto) {
        const before = await this.prisma.documentCategory.findFirst({ where: { id, organization_id: ctx.organization_id } });
        if (!before) throw new NotFoundException({ message: 'Category not found', code: 'category_not_found' });
        const category = await this.prisma.documentCategory.update({ where: { id }, data: dto });
        await this.audit.record(ctx, 'documents.category_updated', { resource_type: 'document_category', resource_id: id, metadata: { before: { name: before.name, is_sensitive: before.is_sensitive }, after: dto } });
        return category;
    }

    async archiveCategory(ctx: OrgContext, id: string) {
        const before = await this.prisma.documentCategory.findFirst({ where: { id, organization_id: ctx.organization_id } });
        if (!before) throw new NotFoundException({ message: 'Category not found', code: 'category_not_found' });
        if (before.is_system) throw new ConflictException({ message: 'System categories cannot be archived', code: 'category_system' });
        const category = await this.prisma.documentCategory.update({ where: { id }, data: { archived_at: new Date() } });
        await this.audit.record(ctx, 'documents.category_archived', { resource_type: 'document_category', resource_id: id });
        return category;
    }
}
