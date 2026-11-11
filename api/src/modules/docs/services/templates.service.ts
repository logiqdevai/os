import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ModuleKey, Prisma } from 'generated/prisma';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import { AuditService } from '@/shared/audit/audit.service';
import { EventsService } from '@/shared/events/events.service';
import { OrgContext } from '@/shared/authorization/interfaces/org-context.interface';
import { paginate, skipTake } from '@/shared/utils/pagination/pagination.utils';
import { slugify } from '@/modules/auth/services/organization-setup.service';
import { CreateTemplateDto, TemplateQuery, UpdateTemplateDto } from '../dto/template.dto';

/** Page templates (15 §2, §3). System templates (organization_id null) are read-only; duplicate them to change. */
@Injectable()
export class DocsTemplatesService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly audit: AuditService,
        private readonly events: EventsService,
    ) { }

    async findAll(ctx: OrgContext, query: TemplateQuery) {
        const where: Prisma.WikiPageTemplateWhereInput = {
            AND: [
                { OR: [{ organization_id: ctx.organization_id }, { organization_id: null }] },
                ...(query.space_id ? [{ OR: [{ space_id: query.space_id }, { space_id: null }] }] : []),
            ],
            ...(query.archived ? { archived_at: { not: null } } : { archived_at: null }),
            ...(query.page_type && { page_type: query.page_type }),
            ...(query.search && { name: { contains: query.search, mode: 'insensitive' } }),
        };
        const [items, total] = await Promise.all([
            this.prisma.wikiPageTemplate.findMany({
                where,
                ...skipTake(query),
                orderBy: [{ is_system: 'desc' }, { sort_order: 'asc' }, { name: 'asc' }],
                include: { space: { select: { id: true, name: true } }, _count: { select: { pages: true } } },
            }),
            this.prisma.wikiPageTemplate.count({ where }),
        ]);
        return paginate(items, total, query);
    }

    async findOne(ctx: OrgContext, id: string) {
        const tpl = await this.prisma.wikiPageTemplate.findFirst({
            where: { id, OR: [{ organization_id: ctx.organization_id }, { organization_id: null }] },
            include: { space: { select: { id: true, name: true } }, _count: { select: { pages: true } } },
        });
        if (!tpl) throw new NotFoundException({ message: 'Template not found', code: 'wiki_template_not_found' });
        return tpl;
    }

    async create(ctx: OrgContext, dto: CreateTemplateDto) {
        await this.assertSpace(ctx, dto.space_id);
        const tpl = await this.prisma.wikiPageTemplate.create({
            data: { ...dto, organization_id: ctx.organization_id, slug: await this.uniqueSlug(ctx, dto.name), content: { format: 'markdown' }, created_by_user_id: ctx.user_id },
        });
        await this.audit.record(ctx, 'wiki_template.created', { resource_type: 'wiki_page_template', resource_id: tpl.id, metadata: { after: { name: dto.name, page_type: dto.page_type } } });
        this.events.publish(ctx, { event_key: 'docs.template.created', module: ModuleKey.BUSINESS_DOCS, entity_kind: 'wiki_page_template', entity_id: tpl.id, payload: { name: tpl.name } });
        return tpl;
    }

    async update(ctx: OrgContext, id: string, dto: UpdateTemplateDto) {
        const before = await this.editable(ctx, id);
        await this.assertSpace(ctx, dto.space_id);
        const tpl = await this.prisma.wikiPageTemplate.update({ where: { id }, data: dto });
        await this.audit.record(ctx, 'wiki_template.updated', { resource_type: 'wiki_page_template', resource_id: id, metadata: { before: { name: before.name, page_type: before.page_type }, after: { ...dto, content_markdown: undefined } } });
        this.events.publish(ctx, { event_key: 'docs.template.updated', module: ModuleKey.BUSINESS_DOCS, entity_kind: 'wiki_page_template', entity_id: id, payload: { name: tpl.name } });
        return tpl;
    }

    async duplicate(ctx: OrgContext, id: string) {
        const src = await this.findOne(ctx, id);
        return this.create(ctx, {
            name: `${src.name} (copy)`,
            description: src.description ?? undefined,
            icon: src.icon ?? undefined,
            page_type: src.page_type,
            content_markdown: src.content_markdown ?? undefined,
            default_review_interval_days: src.default_review_interval_days ?? undefined,
        });
    }

    async setArchived(ctx: OrgContext, id: string, archived: boolean) {
        await this.editable(ctx, id);
        const tpl = await this.prisma.wikiPageTemplate.update({ where: { id }, data: { archived_at: archived ? new Date() : null } });
        await this.audit.record(ctx, archived ? 'wiki_template.archived' : 'wiki_template.unarchived', { resource_type: 'wiki_page_template', resource_id: id });
        return tpl;
    }

    private async editable(ctx: OrgContext, id: string) {
        const tpl = await this.findOne(ctx, id);
        if (tpl.is_system || !tpl.organization_id) throw new ForbiddenException({ message: 'System templates are read-only. Duplicate it to make changes.', code: 'wiki_template_system' });
        return tpl;
    }

    private async assertSpace(ctx: OrgContext, spaceId?: string) {
        if (!spaceId) return;
        const n = await this.prisma.wikiSpace.count({ where: { id: spaceId, organization_id: ctx.organization_id, deleted_at: null } });
        if (!n) throw new BadRequestException({ message: 'Space not found', code: 'wiki_space_not_found' });
    }

    private async uniqueSlug(ctx: OrgContext, name: string) {
        const base = slugify(name) || 'template';
        let slug = base;
        for (let i = 2; await this.prisma.wikiPageTemplate.findFirst({ where: { organization_id: ctx.organization_id, slug }, select: { id: true } }); i++) slug = `${base}-${i}`;
        return slug;
    }
}
