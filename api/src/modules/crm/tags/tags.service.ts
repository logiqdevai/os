import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ModuleKey, Prisma, RecordEntityType } from 'generated/prisma';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import { AuditService } from '@/shared/audit/audit.service';
import { EventsService } from '@/shared/events/events.service';
import { OrgContext } from '@/shared/authorization/interfaces/org-context.interface';
import { slugify } from '@/modules/auth/services/organization-setup.service';
import { companyScopeWhere, contactScopeWhere, dealScopeWhere, leadScopeWhere } from '../common/crm-scope.utils';
import { CreateTagDto, SetTaggingsDto, TagQuery, UpdateTagDto } from './dto/tag.dto';

/**
 * Applying a tag needs the update key of the record (02 §28). Other modules add their entity type here
 * (one line each) together with an existence + scope check.
 */
const TAGGABLE: Partial<Record<RecordEntityType, { key: string; exists: (prisma: PrismaService, ctx: OrgContext, id: string, key: string) => Promise<unknown> }>> = {
    CRM_COMPANY: { key: 'crm.companies.update', exists: (p, ctx, id, key) => p.crmCompany.findFirst({ where: { id, organization_id: ctx.organization_id, ...companyScopeWhere(ctx, key) }, select: { id: true } }) },
    CRM_CONTACT: { key: 'crm.contacts.update', exists: (p, ctx, id, key) => p.crmContact.findFirst({ where: { id, organization_id: ctx.organization_id, ...contactScopeWhere(ctx, key) }, select: { id: true } }) },
    CRM_LEAD: { key: 'crm.leads.update', exists: (p, ctx, id, key) => p.crmLead.findFirst({ where: { id, organization_id: ctx.organization_id, ...leadScopeWhere(ctx, key) }, select: { id: true } }) },
    CRM_DEAL: { key: 'crm.deals.update', exists: (p, ctx, id, key) => p.crmDeal.findFirst({ where: { id, organization_id: ctx.organization_id, ...dealScopeWhere(ctx, key) }, select: { id: true } }) },
};

/** Platform tags (02 §28): organization vocabulary applied to any record through Tagging. */
@Injectable()
export class TagsService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly audit: AuditService,
        private readonly events: EventsService,
    ) { }

    async findAll(ctx: OrgContext, query: TagQuery) {
        const tags = await this.prisma.tag.findMany({
            where: {
                organization_id: ctx.organization_id,
                ...(query.entity_type && { OR: [{ entity_types: { isEmpty: true } }, { entity_types: { has: query.entity_type } }] }),
                ...(query.search && { name: { contains: query.search, mode: 'insensitive' } }),
            },
            include: { _count: { select: { taggings: true } } },
            orderBy: { name: 'asc' },
            take: 500,
        });
        return tags.map(({ _count, ...t }) => ({ ...t, usage: _count.taggings }));
    }

    async create(ctx: OrgContext, dto: CreateTagDto) {
        const slug = slugify(dto.name) || 'tag';
        const exists = await this.prisma.tag.findFirst({ where: { organization_id: ctx.organization_id, slug } });
        if (exists) throw new ConflictException({ message: 'A tag with this name already exists', code: 'tag_exists', tag: exists });
        const tag = await this.prisma.tag.create({ data: { organization_id: ctx.organization_id, name: dto.name.trim(), slug, color: dto.color ?? 'neutral', entity_types: dto.entity_types ?? [] } });
        await this.audit.record(ctx, 'tag.created', { resource_type: 'tag', resource_id: tag.id, metadata: { after: { name: tag.name } } });
        this.events.publish(ctx, { event_key: 'platform.tag.created', module: ModuleKey.ADMINISTRATION, entity_kind: 'tag', entity_id: tag.id, payload: { name: tag.name } });
        return { ...tag, usage: 0 };
    }

    async update(ctx: OrgContext, id: string, dto: UpdateTagDto) {
        const before = await this.get(ctx, id);
        const slug = dto.name ? slugify(dto.name) || before.slug : undefined;
        if (slug && slug !== before.slug && (await this.prisma.tag.findFirst({ where: { organization_id: ctx.organization_id, slug } }))) {
            throw new ConflictException({ message: 'A tag with this name already exists. Merge them instead.', code: 'tag_exists' });
        }
        const tag = await this.prisma.tag.update({ where: { id }, data: { ...dto, ...(dto.name && { name: dto.name.trim(), slug }) } });
        await this.audit.record(ctx, 'tag.updated', { resource_type: 'tag', resource_id: id, metadata: { before: { name: before.name, color: before.color }, after: dto } });
        return tag;
    }

    async remove(ctx: OrgContext, id: string) {
        const tag = await this.get(ctx, id);
        await this.prisma.tag.delete({ where: { id } });
        await this.audit.record(ctx, 'tag.deleted', { resource_type: 'tag', resource_id: id, metadata: { before: { name: tag.name } } });
        return { success: true };
    }

    async merge(ctx: OrgContext, id: string, into_id: string) {
        if (id === into_id) throw new BadRequestException({ message: 'Pick a different tag to merge into', code: 'tag_merge_self' });
        const [from, into] = await Promise.all([this.get(ctx, id), this.get(ctx, into_id)]);
        await this.prisma.$transaction(async (tx) => {
            const rows = await tx.tagging.findMany({ where: { tag_id: id } });
            if (rows.length) await tx.tagging.createMany({ data: rows.map((r) => ({ tag_id: into_id, entity_type: r.entity_type, entity_id: r.entity_id })), skipDuplicates: true });
            await tx.tag.delete({ where: { id } });
            await this.audit.record(ctx, 'tag.merged', { resource_type: 'tag', resource_id: into_id, metadata: { from: { id, name: from.name }, into: { id: into_id, name: into.name }, moved: rows.length } }, tx);
        });
        return { success: true };
    }

    /** Replace the tag set of one record. */
    async setTaggings(ctx: OrgContext, dto: SetTaggingsDto) {
        const rule = TAGGABLE[dto.entity_type];
        if (!rule) throw new BadRequestException({ message: `Tags are not supported on ${dto.entity_type} yet`, code: 'not_taggable' });
        if (!ctx.can(rule.key)) throw new ForbiddenException({ message: `Missing permission ${rule.key}`, code: 'permission_denied', permission: rule.key });
        if (!(await rule.exists(this.prisma, ctx, dto.entity_id, rule.key))) throw new NotFoundException({ message: 'Record not found', code: 'record_not_found' });
        const ids = [...new Set(dto.tag_ids)];
        const tags = await this.prisma.tag.findMany({ where: { id: { in: ids }, organization_id: ctx.organization_id } });
        if (tags.length !== ids.length) throw new NotFoundException({ message: 'Tag not found', code: 'tag_not_found' });
        const wrong = tags.find((t) => t.entity_types.length && !t.entity_types.includes(dto.entity_type));
        if (wrong) throw new BadRequestException({ message: `The tag ${wrong.name} cannot be used here`, code: 'tag_entity_mismatch' });
        const before = await this.prisma.tagging.findMany({ where: { entity_type: dto.entity_type, entity_id: dto.entity_id, tag: { organization_id: ctx.organization_id } } });
        await this.prisma.$transaction([
            this.prisma.tagging.deleteMany({ where: { entity_type: dto.entity_type, entity_id: dto.entity_id, tag: { organization_id: ctx.organization_id }, tag_id: { notIn: ids } } }),
            this.prisma.tagging.createMany({ data: ids.map((tag_id) => ({ tag_id, entity_type: dto.entity_type, entity_id: dto.entity_id })), skipDuplicates: true }),
        ]);
        const added = ids.filter((i) => !before.some((b) => b.tag_id === i));
        const removed = before.filter((b) => !ids.includes(b.tag_id)).map((b) => b.tag_id);
        if (added.length || removed.length) {
            await this.audit.record(ctx, 'record.tags_changed', { resource_type: dto.entity_type.toLowerCase(), resource_id: dto.entity_id, metadata: { added, removed } });
            this.events.publish(ctx, { event_key: 'platform.record.tagged', module: ModuleKey.CRM, entity_type: dto.entity_type, entity_id: dto.entity_id, payload: { added, removed } as Prisma.JsonObject });
        }
        return tags.map((t) => ({ id: t.id, name: t.name, color: t.color }));
    }

    private async get(ctx: OrgContext, id: string) {
        const tag = await this.prisma.tag.findFirst({ where: { id, organization_id: ctx.organization_id } });
        if (!tag) throw new NotFoundException({ message: 'Tag not found', code: 'tag_not_found' });
        return tag;
    }
}
