import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { KnowledgeVisibility, ModuleKey, Prisma } from 'generated/prisma';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import { AuditService } from '@/shared/audit/audit.service';
import { EventsService } from '@/shared/events/events.service';
import { OrgContext } from '@/shared/authorization/interfaces/org-context.interface';
import { orderBy, paginate, skipTake } from '@/shared/utils/pagination/pagination.utils';
import { slugify } from '@/modules/auth/services/organization-setup.service';
import { MEMBER_SELECT, SUPPORT_PERMS } from '../common/support.constants';
import { ArticleFeedbackDto, ArticleQuery, CreateArticleDto, CreateKnowledgeCategoryDto, PublicArticleQuery, UpdateArticleDto, UpdateKnowledgeCategoryDto } from './dto/knowledge.dto';

const PUBLIC_ARTICLE_SELECT = {
    id: true, title: true, slug: true, summary: true, is_faq: true, locale: true, published_at: true, updated_at: true, keywords: true,
    helpful_count: true, not_helpful_count: true, view_count: true,
    category: { select: { id: true, name: true, slug: true } },
} as const;

/** Autosave: edits by the same author within this window share one article version. */
const VERSION_COALESCE_MS = 10 * 60_000;

/**
 * Customer-facing knowledge base and help center (13 §6). Every content change writes an immutable version.
 * PUBLIC articles are served without login per organization slug; CUSTOMERS articles only in the portal;
 * INTERNAL ones only to agents.
 */
@Injectable()
export class KnowledgeService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly audit: AuditService,
        private readonly events: EventsService,
    ) { }

    // --- Categories ------------------------------------------------------------------------------

    async categories(ctx: OrgContext) {
        return this.prisma.knowledgeCategory.findMany({
            where: { organization_id: ctx.organization_id, archived_at: null },
            include: { parent: { select: { id: true, name: true } }, _count: { select: { articles: { where: { archived_at: null } } } } },
            orderBy: [{ sort_order: 'asc' }, { name: 'asc' }],
        });
    }

    async createCategory(ctx: OrgContext, dto: CreateKnowledgeCategoryDto) {
        if (dto.parent_category_id) await this.category(ctx, dto.parent_category_id);
        const count = await this.prisma.knowledgeCategory.count({ where: { organization_id: ctx.organization_id } });
        const row = await this.prisma.knowledgeCategory.create({ data: { ...dto, organization_id: ctx.organization_id, slug: await this.uniqueCategorySlug(ctx, dto.name), sort_order: count } });
        await this.audit.record(ctx, 'knowledge_category.created', { resource_type: 'knowledge_category', resource_id: row.id, metadata: { after: dto } });
        return row;
    }

    async updateCategory(ctx: OrgContext, id: string, dto: UpdateKnowledgeCategoryDto) {
        await this.category(ctx, id);
        if (dto.parent_category_id === id) throw new BadRequestException({ message: 'A category cannot be its own parent', code: 'knowledge_category_cycle' });
        if (dto.parent_category_id) await this.category(ctx, dto.parent_category_id);
        const row = await this.prisma.knowledgeCategory.update({ where: { id }, data: dto });
        await this.audit.record(ctx, 'knowledge_category.updated', { resource_type: 'knowledge_category', resource_id: id, metadata: { after: dto } });
        return row;
    }

    async archiveCategory(ctx: OrgContext, id: string) {
        await this.category(ctx, id);
        const inUse = await this.prisma.knowledgeArticle.count({ where: { category_id: id, archived_at: null } });
        if (inUse) throw new ConflictException({ message: `${inUse} article${inUse === 1 ? ' is' : 's are'} in this category. Move them first`, code: 'knowledge_category_in_use', count: inUse });
        const row = await this.prisma.knowledgeCategory.update({ where: { id }, data: { archived_at: new Date() } });
        await this.audit.record(ctx, 'knowledge_category.archived', { resource_type: 'knowledge_category', resource_id: id });
        return row;
    }

    async reorderCategories(ctx: OrgContext, ids: string[]) {
        const rows = await this.prisma.knowledgeCategory.findMany({ where: { id: { in: ids }, organization_id: ctx.organization_id }, select: { id: true } });
        if (rows.length !== ids.length) throw new NotFoundException({ message: 'Category not found', code: 'knowledge_category_not_found' });
        await this.prisma.$transaction(ids.map((id, i) => this.prisma.knowledgeCategory.update({ where: { id }, data: { sort_order: i } })));
        await this.audit.record(ctx, 'knowledge_category.reordered', { resource_type: 'knowledge_category', resource_id: ids[0] ?? null, metadata: { order: ids } });
        return this.categories(ctx);
    }

    private async category(ctx: OrgContext, id: string) {
        const c = await this.prisma.knowledgeCategory.findFirst({ where: { id, organization_id: ctx.organization_id } });
        if (!c) throw new NotFoundException({ message: 'Category not found', code: 'knowledge_category_not_found' });
        return c;
    }

    // --- Articles --------------------------------------------------------------------------------

    async findAll(ctx: OrgContext, q: ArticleQuery) {
        const where: Prisma.KnowledgeArticleWhereInput = {
            organization_id: ctx.organization_id,
            archived_at: q.archived ? { not: null } : null,
            ...(q.status && { status: q.status }),
            ...(q.visibility && { visibility: q.visibility }),
            ...(q.category_id && { category_id: q.category_id }),
            ...(q.locale && { locale: q.locale }),
            ...(q.is_faq !== undefined && { is_faq: q.is_faq }),
            ...(q.search && { OR: [{ title: { contains: q.search, mode: 'insensitive' } }, { summary: { contains: q.search, mode: 'insensitive' } }, { body: { contains: q.search, mode: 'insensitive' } }, { keywords: { has: q.search.toLowerCase() } }] }),
        };
        const [rows, total, counts] = await Promise.all([
            this.prisma.knowledgeArticle.findMany({
                where,
                ...skipTake(q),
                orderBy: orderBy(q, ['updated_at', 'created_at', 'title', 'view_count', 'published_at'], 'updated_at'),
                select: {
                    id: true, title: true, slug: true, summary: true, status: true, visibility: true, is_faq: true, locale: true, current_version: true,
                    view_count: true, helpful_count: true, not_helpful_count: true, published_at: true, updated_at: true, created_at: true, ai_generated: true,
                    category: { select: { id: true, name: true } },
                    author: { select: MEMBER_SELECT },
                },
            }),
            this.prisma.knowledgeArticle.count({ where }),
            this.prisma.knowledgeArticle.groupBy({ by: ['status'], where: { organization_id: ctx.organization_id, archived_at: null }, _count: { _all: true } }),
        ]);
        return { ...paginate(rows, total, q), status_counts: Object.fromEntries(counts.map((c) => [c.status, c._count._all])) };
    }

    async findOne(ctx: OrgContext, id: string) {
        const a = await this.prisma.knowledgeArticle.findFirst({
            where: { id, organization_id: ctx.organization_id },
            include: {
                category: { select: { id: true, name: true, slug: true } },
                author: { select: MEMBER_SELECT },
                source_ticket: { select: { id: true, reference: true, subject: true } },
                versions: { orderBy: { version: 'desc' }, take: 50, select: { id: true, version: true, title: true, change_note: true, author_membership_id: true, ai_generated: true, created_at: true } },
                feedback: { orderBy: { created_at: 'desc' }, take: 20, select: { id: true, is_helpful: true, comment: true, created_at: true } },
            },
        });
        if (!a) throw new NotFoundException({ message: 'Article not found', code: 'knowledge_article_not_found' });
        const org = await this.prisma.organization.findUnique({ where: { id: ctx.organization_id }, select: { slug: true } });
        return { ...a, help_center_path: a.visibility === 'PUBLIC' && a.status === 'PUBLISHED' && org ? `/help/${org.slug}/${a.slug}` : null };
    }

    async create(ctx: OrgContext, dto: CreateArticleDto) {
        if (dto.category_id) await this.category(ctx, dto.category_id);
        if (dto.source_ticket_id) await this.prisma.ticket.findFirstOrThrow({ where: { id: dto.source_ticket_id, organization_id: ctx.organization_id } }).catch(() => { throw new NotFoundException({ message: 'Ticket not found', code: 'ticket_not_found' }); });
        const locale = dto.locale ?? 'en';
        const slug = dto.slug ?? (await this.uniqueArticleSlug(ctx, dto.title, locale));
        try {
            const article = await this.prisma.knowledgeArticle.create({
                data: {
                    organization_id: ctx.organization_id,
                    title: dto.title,
                    slug,
                    summary: dto.summary,
                    body: dto.body,
                    category_id: dto.category_id ?? null,
                    visibility: dto.visibility ?? 'PUBLIC',
                    is_faq: dto.is_faq ?? false,
                    locale,
                    keywords: (dto.keywords ?? []).map((k) => k.toLowerCase()),
                    related_article_ids: dto.related_article_ids ?? [],
                    seo: (dto.seo ?? undefined) as Prisma.InputJsonValue,
                    source_ticket_id: dto.source_ticket_id ?? null,
                    sort_order: dto.sort_order ?? 0,
                    author_membership_id: ctx.membership_id,
                    current_version: 1,
                    versions: { create: { version: 1, title: dto.title, summary: dto.summary, body: dto.body, author_membership_id: ctx.membership_id, change_note: 'Created' } },
                },
            });
            await this.audit.record(ctx, 'knowledge_article.created', { resource_type: 'knowledge_article', resource_id: article.id, metadata: { title: article.title, visibility: article.visibility } });
            this.events.publish(ctx, { event_key: 'support.knowledge_article.created', module: ModuleKey.SUPPORT, entity_type: 'KNOWLEDGE_ARTICLE', entity_id: article.id, payload: { title: article.title } });
            return article;
        } catch (e) {
            this.rethrow(e);
        }
    }

    async update(ctx: OrgContext, id: string, dto: UpdateArticleDto) {
        const before = await this.findOne(ctx, id);
        if (dto.category_id) await this.category(ctx, dto.category_id);
        // Changing a published article's visibility is publishing-level control.
        if (before.status === 'PUBLISHED' && dto.visibility && dto.visibility !== before.visibility && !ctx.can(SUPPORT_PERMS.knowledgePublish)) {
            throw new ForbiddenException({ message: 'Changing the visibility of a published article needs support.knowledge.publish', code: 'permission_denied', permissions: [SUPPORT_PERMS.knowledgePublish] });
        }
        const contentChanged = (dto.title !== undefined && dto.title !== before.title) || (dto.body !== undefined && dto.body !== before.body) || (dto.summary !== undefined && dto.summary !== before.summary);
        const { change_note, seo, keywords, ...rest } = dto;
        try {
            const article = await this.prisma.$transaction(async (tx) => {
                // Autosaved drafts: consecutive edits by the same author within a short window update the latest version
                // instead of adding one per pause in typing (an explicit change note always starts a new version).
                const latest = contentChanged ? await tx.knowledgeArticleVersion.findFirst({ where: { article_id: id }, orderBy: { version: 'desc' } }) : null;
                const coalesce = !!latest && !change_note && !latest.change_note && !latest.ai_generated && latest.version === before.current_version
                    && latest.author_membership_id === ctx.membership_id && latest.created_at.getTime() > Date.now() - VERSION_COALESCE_MS
                    && before.status !== 'PUBLISHED';
                const version = contentChanged && !coalesce ? before.current_version + 1 : before.current_version;
                if (contentChanged) {
                    const content = { title: dto.title ?? before.title, summary: dto.summary ?? before.summary, body: dto.body ?? before.body };
                    if (coalesce) await tx.knowledgeArticleVersion.update({ where: { id: latest.id }, data: content });
                    else await tx.knowledgeArticleVersion.create({ data: { article_id: id, version, ...content, change_note: change_note ?? null, author_membership_id: ctx.membership_id } });
                }
                return tx.knowledgeArticle.update({
                    where: { id },
                    data: {
                        ...rest,
                        ...(keywords && { keywords: keywords.map((k) => k.toLowerCase()) }),
                        ...(seo !== undefined && { seo: seo as Prisma.InputJsonValue }),
                        current_version: version,
                    },
                });
            });
            await this.audit.record(ctx, 'knowledge_article.updated', { resource_type: 'knowledge_article', resource_id: id, metadata: { version: article.current_version, content_changed: contentChanged, fields: Object.keys(dto) } });
            this.events.publish(ctx, { event_key: 'support.knowledge_article.updated', module: ModuleKey.SUPPORT, entity_type: 'KNOWLEDGE_ARTICLE', entity_id: id, payload: { title: article.title, version: article.current_version } });
            return this.findOne(ctx, id);
        } catch (e) {
            this.rethrow(e);
        }
    }

    async submitReview(ctx: OrgContext, id: string) {
        const a = await this.findOne(ctx, id);
        if (a.status === 'PUBLISHED') throw new BadRequestException({ message: 'The article is already published', code: 'knowledge_article_published' });
        await this.prisma.knowledgeArticle.update({ where: { id }, data: { status: 'IN_REVIEW' } });
        await this.audit.record(ctx, 'knowledge_article.review_requested', { resource_type: 'knowledge_article', resource_id: id });
        this.events.publish(ctx, { event_key: 'support.knowledge_article.review_requested', module: ModuleKey.SUPPORT, entity_type: 'KNOWLEDGE_ARTICLE', entity_id: id, payload: { title: a.title } });
        return this.findOne(ctx, id);
    }

    async publish(ctx: OrgContext, id: string) {
        const a = await this.findOne(ctx, id);
        if (!a.body.trim()) throw new BadRequestException({ message: 'Write the article before publishing', code: 'knowledge_article_empty' });
        await this.prisma.knowledgeArticle.update({ where: { id }, data: { status: 'PUBLISHED', published_at: new Date(), archived_at: null, reviewer_membership_id: ctx.membership_id, last_reviewed_at: new Date() } });
        await this.audit.record(ctx, 'knowledge_article.published', { resource_type: 'knowledge_article', resource_id: id, metadata: { version: a.current_version, visibility: a.visibility } });
        this.events.publish(ctx, { event_key: 'support.knowledge_article.published', module: ModuleKey.SUPPORT, entity_type: 'KNOWLEDGE_ARTICLE', entity_id: id, payload: { title: a.title, visibility: a.visibility }, activity: { summary: `Help article published: ${a.title}`, customer_visible: a.visibility !== 'INTERNAL' } });
        return this.findOne(ctx, id);
    }

    async unpublish(ctx: OrgContext, id: string) {
        const a = await this.findOne(ctx, id);
        await this.prisma.knowledgeArticle.update({ where: { id }, data: { status: 'DRAFT' } });
        await this.audit.record(ctx, 'knowledge_article.unpublished', { resource_type: 'knowledge_article', resource_id: id });
        this.events.publish(ctx, { event_key: 'support.knowledge_article.unpublished', module: ModuleKey.SUPPORT, entity_type: 'KNOWLEDGE_ARTICLE', entity_id: id, payload: { title: a.title } });
        return this.findOne(ctx, id);
    }

    async archive(ctx: OrgContext, id: string) {
        await this.findOne(ctx, id);
        await this.prisma.knowledgeArticle.update({ where: { id }, data: { status: 'ARCHIVED', archived_at: new Date() } });
        await this.audit.record(ctx, 'knowledge_article.archived', { resource_type: 'knowledge_article', resource_id: id });
        return { success: true };
    }

    async remove(ctx: OrgContext, id: string) {
        const a = await this.findOne(ctx, id);
        await this.prisma.knowledgeArticle.delete({ where: { id } });
        await this.audit.record(ctx, 'knowledge_article.deleted', { resource_type: 'knowledge_article', resource_id: id, metadata: { title: a.title } });
        this.events.publish(ctx, { event_key: 'support.knowledge_article.deleted', module: ModuleKey.SUPPORT, entity_type: 'KNOWLEDGE_ARTICLE', entity_id: id, payload: { title: a.title } });
        return { success: true };
    }

    async version(ctx: OrgContext, id: string, version: number) {
        await this.findOne(ctx, id);
        const v = await this.prisma.knowledgeArticleVersion.findUnique({ where: { article_id_version: { article_id: id, version } } });
        if (!v) throw new NotFoundException({ message: 'Version not found', code: 'knowledge_version_not_found' });
        return v;
    }

    async restoreVersion(ctx: OrgContext, id: string, version: number) {
        const v = await this.version(ctx, id, version);
        return this.update(ctx, id, { title: v.title, summary: v.summary ?? undefined, body: v.body, change_note: `Restored version ${version}` });
    }

    // --- Public help center (no login) ---------------------------------------------------------

    private async orgBySlug(slug: string) {
        const org = await this.prisma.organization.findFirst({ where: { slug, deleted_at: null }, select: { id: true, display_name: true, slug: true, logo_url: true, branding: true } });
        if (!org) throw new NotFoundException({ message: 'Help center not found', code: 'help_center_not_found' });
        return org;
    }

    /** Visibilities a reader may see: anonymous → PUBLIC; portal users → PUBLIC + CUSTOMERS. */
    private readable(customers: boolean): KnowledgeVisibility[] {
        return customers ? ['PUBLIC', 'CUSTOMERS'] : ['PUBLIC'];
    }

    async helpCenter(orgSlug: string, customers = false) {
        const org = await this.orgBySlug(orgSlug);
        return this.helpCenterFor(org, customers);
    }

    async helpCenterFor(org: { id: string; display_name: string; slug: string; logo_url: string | null; branding?: unknown }, customers: boolean) {
        const visible = this.readable(customers);
        const [categories, faqs, popular] = await Promise.all([
            this.prisma.knowledgeCategory.findMany({
                where: { organization_id: org.id, archived_at: null, visibility: { in: visible } },
                select: { id: true, name: true, slug: true, description: true, icon: true, _count: { select: { articles: { where: { status: 'PUBLISHED', archived_at: null, visibility: { in: visible } } } } } },
                orderBy: [{ sort_order: 'asc' }, { name: 'asc' }],
            }),
            this.prisma.knowledgeArticle.findMany({ where: { organization_id: org.id, status: 'PUBLISHED', archived_at: null, visibility: { in: visible }, is_faq: true }, select: PUBLIC_ARTICLE_SELECT, orderBy: { sort_order: 'asc' }, take: 10 }),
            this.prisma.knowledgeArticle.findMany({ where: { organization_id: org.id, status: 'PUBLISHED', archived_at: null, visibility: { in: visible } }, select: PUBLIC_ARTICLE_SELECT, orderBy: { view_count: 'desc' }, take: 8 }),
        ]);
        return { organization: { display_name: org.display_name, slug: org.slug, logo_url: org.logo_url }, categories: categories.filter((c) => c._count.articles > 0), faqs, popular };
    }

    async publicArticles(orgSlug: string, q: PublicArticleQuery, customers = false, orgId?: string) {
        const org = orgId ? { id: orgId } : await this.orgBySlug(orgSlug);
        const visible = this.readable(customers);
        const where: Prisma.KnowledgeArticleWhereInput = {
            organization_id: org.id,
            status: 'PUBLISHED',
            archived_at: null,
            visibility: { in: visible },
            ...(q.category && { category: { slug: q.category, visibility: { in: visible } } }),
            ...(q.locale && { locale: q.locale }),
            ...(q.faq !== undefined && { is_faq: q.faq }),
            ...(q.search && { OR: [{ title: { contains: q.search, mode: 'insensitive' } }, { summary: { contains: q.search, mode: 'insensitive' } }, { body: { contains: q.search, mode: 'insensitive' } }, { keywords: { has: q.search.toLowerCase() } }] }),
        };
        const [rows, total] = await Promise.all([
            this.prisma.knowledgeArticle.findMany({ where, ...skipTake(q), select: PUBLIC_ARTICLE_SELECT, orderBy: [{ sort_order: 'asc' }, { published_at: 'desc' }] }),
            this.prisma.knowledgeArticle.count({ where }),
        ]);
        return paginate(rows, total, q);
    }

    async publicArticle(orgSlug: string, slug: string, customers = false, orgId?: string) {
        const org = orgId ? { id: orgId } : await this.orgBySlug(orgSlug);
        const visible = this.readable(customers);
        const a = await this.prisma.knowledgeArticle.findFirst({
            where: { organization_id: org.id, slug, status: 'PUBLISHED', archived_at: null, visibility: { in: visible } },
            select: { ...PUBLIC_ARTICLE_SELECT, body: true, seo: true, related_article_ids: true },
        });
        if (!a) throw new NotFoundException({ message: 'Article not found', code: 'knowledge_article_not_found' });
        await this.prisma.knowledgeArticle.update({ where: { id: a.id }, data: { view_count: { increment: 1 } } });
        const related = a.related_article_ids.length
            ? await this.prisma.knowledgeArticle.findMany({ where: { id: { in: a.related_article_ids }, status: 'PUBLISHED', archived_at: null, visibility: { in: visible } }, select: { id: true, title: true, slug: true } })
            : [];
        const { related_article_ids, ...rest } = a;
        void related_article_ids;
        return { ...rest, related };
    }

    async feedback(orgSlug: string, slug: string, dto: ArticleFeedbackDto, userId?: string | null, customers = false, orgId?: string) {
        const org = orgId ? { id: orgId } : await this.orgBySlug(orgSlug);
        const a = await this.prisma.knowledgeArticle.findFirst({ where: { organization_id: org.id, slug, status: 'PUBLISHED', archived_at: null, visibility: { in: this.readable(customers) } }, select: { id: true } });
        if (!a) throw new NotFoundException({ message: 'Article not found', code: 'knowledge_article_not_found' });
        if (dto.visitor_key || userId) {
            const dup = await this.prisma.knowledgeArticleFeedback.findFirst({ where: { article_id: a.id, ...(userId ? { user_id: userId } : { visitor_key: dto.visitor_key }) } });
            if (dup) return { success: true, duplicate: true };
        }
        await this.prisma.$transaction([
            this.prisma.knowledgeArticleFeedback.create({ data: { article_id: a.id, is_helpful: dto.is_helpful, comment: dto.comment, visitor_key: dto.visitor_key, user_id: userId ?? null } }),
            this.prisma.knowledgeArticle.update({ where: { id: a.id }, data: dto.is_helpful ? { helpful_count: { increment: 1 } } : { not_helpful_count: { increment: 1 } } }),
        ]);
        return { success: true };
    }

    // ---------------------------------------------------------------------------------------------

    private async uniqueArticleSlug(ctx: OrgContext, title: string, locale: string) {
        const base = slugify(title) || 'article';
        let slug = base;
        for (let i = 2; await this.prisma.knowledgeArticle.findFirst({ where: { organization_id: ctx.organization_id, slug, locale }, select: { id: true } }); i++) slug = `${base}-${i}`;
        return slug;
    }

    private async uniqueCategorySlug(ctx: OrgContext, name: string) {
        const base = slugify(name) || 'category';
        let slug = base;
        for (let i = 2; await this.prisma.knowledgeCategory.findFirst({ where: { organization_id: ctx.organization_id, slug }, select: { id: true } }); i++) slug = `${base}-${i}`;
        return slug;
    }

    private rethrow(e: unknown): never {
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') throw new ConflictException({ message: 'Another article already uses this slug in this language', code: 'knowledge_slug_taken' });
        throw e;
    }
}
