import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ModuleKey, Prisma, RecordEntityType, WikiPageStatus, WikiSearchMode, WikiVisibility } from 'generated/prisma';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import { AuditService } from '@/shared/audit/audit.service';
import { EventsService } from '@/shared/events/events.service';
import { OrgContext } from '@/shared/authorization/interfaces/org-context.interface';
import { orderBy, paginate, skipTake } from '@/shared/utils/pagination/pagination.utils';
import { slugify } from '@/modules/auth/services/organization-setup.service';
import { atLeast, DocsAccessService, DocsPrincipals } from '../docs-access.service';
import {
    AddPageLinkDto,
    AnalyticsQuery,
    CreateCommentDto,
    CreatePageDto,
    MarkReviewedDto,
    MovePageDto,
    PageQuery,
    RequireAckDto,
    SearchQuery,
    SetPagePermissionsDto,
    TrashQuery,
    UpdatePageDto,
} from '../dto/page.dto';
import { excerptOf, markdownToText, MEMBER_SELECT, parsePageRefs, wordCount } from '../utils/docs.utils';

const LIST_SELECT = {
    id: true,
    space_id: true,
    parent_page_id: true,
    title: true,
    slug: true,
    icon: true,
    page_type: true,
    status: true,
    excerpt: true,
    visibility: true,
    customer_visible: true,
    depth: true,
    sort_order: true,
    current_version_number: true,
    published_version_number: true,
    published_at: true,
    next_review_at: true,
    stale_flagged_at: true,
    requires_acknowledgement: true,
    word_count: true,
    archived_at: true,
    deleted_at: true,
    last_edited_at: true,
    created_at: true,
    updated_at: true,
    owner: { select: MEMBER_SELECT },
    space: { select: { id: true, name: true, slug: true, icon: true, color: true } },
} satisfies Prisma.WikiPageSelect;

const DAY = 86_400_000;

/** Autosave: saves by the same editor within this window share one history entry. */
const VERSION_COALESCE_MS = 10 * 60_000;

/**
 * Wiki pages (15 §2): tree, content + versions, publishing, permissions, comments, favorites,
 * acknowledgements, review cadence, record links / backlinks, search, views, archive and trash.
 */
@Injectable()
export class DocsPagesService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly audit: AuditService,
        private readonly events: EventsService,
        private readonly access: DocsAccessService,
    ) { }

    // ---------------------------------------------------------------------------------------------
    // Reads
    // ---------------------------------------------------------------------------------------------

    async home(ctx: OrgContext) {
        const p = await this.access.principals(ctx);
        const readable = this.access.readablePageWhere(ctx, p);
        const live: Prisma.WikiPageWhereInput = { ...readable, archived_at: null };
        const soon = new Date(Date.now() + 7 * DAY);
        const [favorites, recentViews, updated, requiredReading, needsReview, spaces] = await Promise.all([
            p.membership_id
                ? this.prisma.wikiPage.findMany({ where: { ...live, favorites: { some: { membership_id: p.membership_id } } }, select: LIST_SELECT, orderBy: { title: 'asc' }, take: 20 })
                : [],
            p.membership_id
                ? this.prisma.wikiPageView.findMany({ where: { membership_id: p.membership_id, organization_id: ctx.organization_id }, orderBy: { viewed_at: 'desc' }, take: 60, select: { page_id: true, viewed_at: true } })
                : [],
            this.prisma.wikiPage.findMany({ where: { ...live, status: { not: WikiPageStatus.DRAFT } }, select: LIST_SELECT, orderBy: { updated_at: 'desc' }, take: 8 }),
            p.membership_id
                ? this.prisma.wikiPageAcknowledgement.findMany({
                    where: { membership_id: p.membership_id, acknowledged_at: null, page: live },
                    include: { page: { select: LIST_SELECT } },
                    orderBy: [{ required_by: 'asc' }, { created_at: 'asc' }],
                    take: 10,
                })
                : [],
            p.membership_id
                ? this.prisma.wikiPage.findMany({
                    where: { ...live, next_review_at: { lte: soon }, OR: [{ owner_membership_id: p.membership_id }, { reviewers: { some: { membership_id: p.membership_id } } }] },
                    select: LIST_SELECT,
                    orderBy: { next_review_at: 'asc' },
                    take: 10,
                })
                : [],
            this.prisma.wikiSpace.findMany({ where: { ...this.access.readableSpaceWhere(ctx, p), archived_at: null }, orderBy: [{ sort_order: 'asc' }, { name: 'asc' }], take: 12 }),
        ]);
        const recentIds = [...new Set(recentViews.map((v) => v.page_id))].slice(0, 8);
        const recentPages = recentIds.length ? await this.prisma.wikiPage.findMany({ where: { ...live, id: { in: recentIds } }, select: LIST_SELECT }) : [];
        const recent = recentIds.map((id) => recentPages.find((pg) => pg.id === id)).filter(Boolean);
        const counts = spaces.length
            ? await this.prisma.wikiPage.groupBy({ by: ['space_id'], where: { ...live, space_id: { in: spaces.map((s) => s.id) } }, _count: { _all: true } })
            : [];
        return {
            favorites,
            recent,
            recently_updated: updated,
            required_reading: requiredReading.map((a) => ({ ...a.page, required_by: a.required_by })),
            needs_review: needsReview,
            spaces: spaces.map((s) => ({ ...s, page_count: counts.find((c) => c.space_id === s.id)?._count._all ?? 0 })),
        };
    }

    async findAll(ctx: OrgContext, query: PageQuery) {
        const p = await this.access.principals(ctx);
        const now = new Date();
        const where: Prisma.WikiPageWhereInput = {
            ...this.access.readablePageWhere(ctx, p),
            ...(query.archived ? { archived_at: { not: null } } : { archived_at: null }),
            ...(query.space_id && { space_id: query.space_id }),
            ...(query.parent_page_id && { parent_page_id: query.parent_page_id === 'root' ? null : query.parent_page_id }),
            ...(query.status?.length && { status: { in: query.status } }),
            ...(query.page_type?.length && { page_type: { in: query.page_type } }),
            ...(query.owner_id && { owner_membership_id: query.owner_id }),
            ...(query.review === 'overdue' && { next_review_at: { lt: now } }),
            ...(query.review === 'due_soon' && { next_review_at: { gte: now, lte: new Date(now.getTime() + 14 * DAY) } }),
            ...(query.favorites && p.membership_id && { favorites: { some: { membership_id: p.membership_id } } }),
            ...(query.search && { title: { contains: query.search, mode: 'insensitive' } }),
        };
        const [items, total] = await Promise.all([
            this.prisma.wikiPage.findMany({ where, select: LIST_SELECT, ...skipTake(query), orderBy: orderBy(query, ['title', 'updated_at', 'created_at', 'next_review_at', 'sort_order'], 'updated_at') }),
            this.prisma.wikiPage.count({ where }),
        ]);
        return paginate(items, total, query);
    }

    /** Page tree of one space (readable, non-archived pages), flat with parent ids and sort order. */
    async tree(ctx: OrgContext, spaceIdOrSlug: string) {
        const { space, principals } = await this.access.readableSpace(ctx, spaceIdOrSlug);
        return this.prisma.wikiPage.findMany({
            where: { ...this.access.readablePageWhere(ctx, principals), space_id: space.id, archived_at: null },
            select: { id: true, parent_page_id: true, title: true, slug: true, icon: true, status: true, page_type: true, depth: true, sort_order: true, updated_at: true },
            orderBy: [{ depth: 'asc' }, { sort_order: 'asc' }, { title: 'asc' }],
        });
    }

    async findOne(ctx: OrgContext, id: string) {
        const { page, level, principals } = await this.access.readablePage(ctx, id);
        const ancestorIds = page.path.split('/').filter(Boolean);
        const [full, ancestors, children, favorite, ack, backlinkCount, commentCount, reviewers] = await Promise.all([
            this.prisma.wikiPage.findUniqueOrThrow({
                where: { id },
                include: {
                    owner: { select: MEMBER_SELECT },
                    template: { select: { id: true, name: true } },
                    space: { select: { id: true, name: true, slug: true, icon: true, color: true, allow_customer_visible: true, members_can_publish: true, require_review_before_publish: true } },
                },
            }),
            ancestorIds.length ? this.prisma.wikiPage.findMany({ where: { id: { in: ancestorIds }, organization_id: ctx.organization_id }, select: { id: true, title: true, icon: true } }) : [],
            this.prisma.wikiPage.findMany({
                where: { ...this.access.readablePageWhere(ctx, principals), parent_page_id: id, archived_at: null },
                select: { id: true, title: true, icon: true, status: true, page_type: true, excerpt: true, updated_at: true },
                orderBy: [{ sort_order: 'asc' }, { title: 'asc' }],
            }),
            principals.membership_id ? this.prisma.wikiPageFavorite.findUnique({ where: { page_id_membership_id: { page_id: id, membership_id: principals.membership_id } } }) : null,
            principals.membership_id ? this.prisma.wikiPageAcknowledgement.findUnique({ where: { page_id_membership_id: { page_id: id, membership_id: principals.membership_id } } }) : null,
            this.prisma.wikiPageLink.count({ where: { entity_type: RecordEntityType.WIKI_PAGE, entity_id: id, page: this.access.readablePageWhere(ctx, principals) } }),
            this.prisma.wikiPageComment.count({ where: { page_id: id, deleted_at: null } }),
            this.prisma.wikiPageReviewer.findMany({ where: { page_id: id }, include: { membership: { select: MEMBER_SELECT } } }),
        ]);
        const publishedVersion = full.published_version_number ?? 0;
        return {
            ...full,
            breadcrumbs: ancestorIds.map((aid) => ancestors.find((a) => a.id === aid)).filter(Boolean),
            children,
            reviewers: reviewers.map((r) => r.membership),
            my_level: level,
            can: {
                comment: atLeast(level, 'COMMENT'),
                edit: atLeast(level, 'EDIT'),
                manage: atLeast(level, 'MANAGE'),
                publish: atLeast(level, 'EDIT') && ctx.can('docs.pages.publish'),
                archive: atLeast(level, 'EDIT') && ctx.can('docs.pages.archive'),
                delete: atLeast(level, 'MANAGE') && ctx.can('docs.pages.delete'),
            },
            is_favorite: !!favorite,
            my_acknowledgement: ack
                ? { required_by: ack.required_by, acknowledged_at: ack.acknowledged_at, acknowledged_version_number: ack.acknowledged_version_number, is_current: !!ack.acknowledged_at && (ack.acknowledged_version_number ?? 0) >= publishedVersion }
                : null,
            has_unpublished_changes: full.status === WikiPageStatus.PUBLISHED && (full.published_version_number ?? 0) < full.current_version_number,
            backlink_count: backlinkCount,
            comment_count: commentCount,
        };
    }

    // ---------------------------------------------------------------------------------------------
    // Writes
    // ---------------------------------------------------------------------------------------------

    async create(ctx: OrgContext, dto: CreatePageDto) {
        const p = await this.access.principals(ctx);
        const { space, level: spaceLevel } = await this.access.readableSpace(ctx, dto.space_id, p);
        this.access.assert(spaceLevel, 'EDIT', 'this space');

        let parent: { id: string; path: string; depth: number; visibility: WikiVisibility; space_id: string } | null = null;
        if (dto.parent_page_id) {
            const res = await this.access.readablePage(ctx, dto.parent_page_id, p);
            if (res.page.space_id !== space.id) throw new BadRequestException({ message: 'The parent page is in another space', code: 'wiki_parent_other_space' });
            parent = res.page;
        }
        let templateMd: string | null = null;
        let templatePageType = undefined as CreatePageDto['page_type'];
        let templateReview: number | null = null;
        if (dto.template_id) {
            const tpl = await this.prisma.wikiPageTemplate.findFirst({ where: { id: dto.template_id, archived_at: null, OR: [{ organization_id: ctx.organization_id }, { organization_id: null }] } });
            if (!tpl) throw new NotFoundException({ message: 'Template not found', code: 'wiki_template_not_found' });
            templateMd = tpl.content_markdown;
            templatePageType = tpl.page_type;
            templateReview = tpl.default_review_interval_days;
        }
        if (dto.customer_visible) this.assertCustomerVisible(ctx, space);
        if (dto.publish && !ctx.can('docs.pages.publish')) throw new ForbiddenException({ message: 'You need docs.pages.publish to publish', code: 'permission_denied', permissions: ['docs.pages.publish'] });
        await this.assertMembers(ctx, [dto.owner_membership_id, ...(dto.reviewer_ids ?? [])]);

        const md = dto.content_markdown ?? templateMd ?? '';
        const visibility = dto.visibility ?? parent?.visibility ?? space.default_visibility;
        const reviewInterval = dto.review_interval_days ?? templateReview ?? null;
        const now = new Date();
        const siblings = await this.prisma.wikiPage.aggregate({ where: { space_id: space.id, parent_page_id: parent?.id ?? null }, _max: { sort_order: true } });

        const page = await this.prisma.$transaction(async (tx) => {
            const created = await tx.wikiPage.create({
                data: {
                    organization_id: ctx.organization_id,
                    space_id: space.id,
                    parent_page_id: parent?.id ?? null,
                    template_id: dto.template_id ?? null,
                    title: dto.title,
                    slug: await this.uniqueSlug(space.id, dto.title),
                    icon: dto.icon,
                    page_type: dto.page_type ?? templatePageType ?? 'GENERAL',
                    status: dto.publish ? WikiPageStatus.PUBLISHED : WikiPageStatus.DRAFT,
                    content: { format: 'markdown' },
                    content_markdown: md,
                    excerpt: excerptOf(md),
                    word_count: wordCount(md),
                    path: parent ? `${parent.path}${parent.id}/` : '',
                    depth: parent ? parent.depth + 1 : 0,
                    sort_order: (siblings._max.sort_order ?? -1) + 1,
                    visibility,
                    customer_visible: dto.customer_visible ?? false,
                    owner_membership_id: dto.owner_membership_id ?? ctx.membership_id,
                    review_interval_days: reviewInterval,
                    next_review_at: reviewInterval ? new Date(now.getTime() + reviewInterval * DAY) : null,
                    requires_acknowledgement: dto.requires_acknowledgement ?? false,
                    current_version_number: 1,
                    published_at: dto.publish ? now : null,
                    published_by_membership_id: dto.publish ? ctx.membership_id : null,
                    published_version_number: dto.publish ? 1 : null,
                    last_edited_by_membership_id: ctx.membership_id,
                    last_edited_at: now,
                    created_by_user_id: ctx.user_id,
                },
            });
            await tx.wikiPageVersion.create({
                data: { page_id: created.id, version_number: 1, title: created.title, content: { format: 'markdown' }, content_markdown: md, change_summary: 'Created', is_published_snapshot: !!dto.publish, created_by_membership_id: ctx.membership_id },
            });
            if (dto.reviewer_ids?.length) await tx.wikiPageReviewer.createMany({ data: dto.reviewer_ids.map((m) => ({ page_id: created.id, membership_id: m })), skipDuplicates: true });
            // Restricted children inherit the parent's inheritable grants so the subtree stays readable by the same people.
            if (parent && visibility !== WikiVisibility.ORGANIZATION) {
                const grants = await tx.wikiPagePermission.findMany({ where: { page_id: parent.id, inherit: true } });
                if (grants.length) {
                    await tx.wikiPagePermission.createMany({
                        data: grants.map((g) => ({ page_id: created.id, principal_type: g.principal_type, principal_id: g.principal_id, level: g.level, inherit: true, granted_by_user_id: ctx.user_id })),
                        skipDuplicates: true,
                    });
                }
            }
            await this.syncPageRefs(tx, ctx, created.id, md);
            await this.audit.record(ctx, 'wiki_page.created', { resource_type: 'wiki_page', resource_id: created.id, metadata: { after: { title: created.title, space_id: space.id, parent_page_id: parent?.id, visibility, status: created.status } } }, tx);
            return created;
        });

        this.events.publish(ctx, {
            event_key: 'docs.page.created', module: ModuleKey.BUSINESS_DOCS, entity_type: RecordEntityType.WIKI_PAGE, entity_id: page.id,
            payload: { title: page.title, space_id: space.id, page_type: page.page_type, status: page.status },
            activity: { summary: `created the page ${page.title}`, entity_label: page.title },
        });
        if (dto.publish) this.publishEvent(ctx, page.id, page.title, 1);
        return page;
    }

    async update(ctx: OrgContext, id: string, dto: UpdatePageDto) {
        const { page, level } = await this.access.readablePage(ctx, id);
        this.access.assert(level, 'EDIT');
        if (page.locked_by_membership_id && page.locked_by_membership_id !== ctx.membership_id && page.locked_at && Date.now() - page.locked_at.getTime() < 10 * 60_000) {
            throw new ConflictException({ message: 'Someone else is editing this page right now', code: 'wiki_page_locked' });
        }
        if (dto.customer_visible !== undefined && dto.customer_visible !== page.customer_visible) {
            if (dto.customer_visible) this.assertCustomerVisible(ctx, page.space);
            else if (!ctx.can('docs.pages.publish')) throw new ForbiddenException({ message: 'You need docs.pages.publish to change customer visibility', code: 'permission_denied' });
        }
        if (dto.visibility && dto.visibility !== page.visibility) this.access.assert(level, 'MANAGE');
        await this.assertMembers(ctx, [dto.owner_membership_id, ...(dto.reviewer_ids ?? [])]);

        const { reviewer_ids, change_summary, base_version_number, ...fields } = dto;
        const contentChanged = (dto.content_markdown !== undefined && dto.content_markdown !== page.content_markdown) || (dto.title !== undefined && dto.title !== page.title);
        // Optimistic concurrency (15 §2): an editor that started from an older version must merge first.
        if (contentChanged && base_version_number !== undefined && base_version_number !== page.current_version_number) {
            throw await this.versionConflict(id, base_version_number);
        }
        const now = new Date();
        const data: Prisma.WikiPageUpdateInput = { ...fields, last_edited_at: now, last_edited_by_membership_id: ctx.membership_id };
        if (dto.content_markdown !== undefined) {
            data.excerpt = excerptOf(dto.content_markdown);
            data.word_count = wordCount(dto.content_markdown);
        }
        if (dto.review_interval_days !== undefined && dto.review_interval_days !== page.review_interval_days) {
            const from = page.last_reviewed_at ?? now;
            data.next_review_at = dto.review_interval_days ? new Date(from.getTime() + dto.review_interval_days * DAY) : null;
        }
        if (contentChanged) data.current_version_number = page.current_version_number + 1;

        const updated = await this.prisma.$transaction(async (tx) => {
            // The version guard in the WHERE makes concurrent saves safe: the second writer gets a conflict, not a silent overwrite.
            const row = await tx.wikiPage.update({ where: { id, ...(contentChanged && { current_version_number: page.current_version_number }) }, data }).catch((error) => {
                if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') return null;
                throw error;
            });
            if (!row) throw await this.versionConflict(id, base_version_number ?? page.current_version_number);
            if (contentChanged) {
                // Autosave sends many small saves: consecutive saves by the same editor within a short window update one
                // history entry (renumbered to the new version) instead of creating a version per keystroke pause.
                // The page's version number still increases on every save, so concurrent-edit detection is unchanged.
                const latest = await tx.wikiPageVersion.findFirst({ where: { page_id: id }, orderBy: { version_number: 'desc' } });
                const coalesce = !!latest && !change_summary && !latest.is_published_snapshot && !latest.restored_from_version_id && !latest.ai_suggestion_id
                    && latest.version_number === page.current_version_number && latest.created_by_membership_id === ctx.membership_id
                    && latest.created_at.getTime() > now.getTime() - VERSION_COALESCE_MS;
                if (coalesce) {
                    await tx.wikiPageVersion.update({ where: { id: latest.id }, data: { version_number: row.current_version_number, title: row.title, content_markdown: row.content_markdown } });
                } else {
                    await tx.wikiPageVersion.create({
                    data: { page_id: id, version_number: row.current_version_number, title: row.title, content: { format: 'markdown' }, content_markdown: row.content_markdown, change_summary: change_summary ?? null, created_by_membership_id: ctx.membership_id },
                    });
                }
                if (dto.content_markdown !== undefined) await this.syncPageRefs(tx, ctx, id, row.content_markdown);
            }
            if (reviewer_ids) {
                await tx.wikiPageReviewer.deleteMany({ where: { page_id: id, membership_id: { notIn: reviewer_ids } } });
                await tx.wikiPageReviewer.createMany({ data: reviewer_ids.map((m) => ({ page_id: id, membership_id: m })), skipDuplicates: true });
            }
            await this.audit.record(ctx, 'wiki_page.updated', {
                resource_type: 'wiki_page', resource_id: id,
                metadata: { before: { title: page.title, visibility: page.visibility, customer_visible: page.customer_visible, version: page.current_version_number }, after: { ...fields, content_markdown: undefined, version: row.current_version_number } },
            }, tx);
            return row;
        });
        this.events.publish(ctx, {
            event_key: 'docs.page.updated', module: ModuleKey.BUSINESS_DOCS, entity_type: RecordEntityType.WIKI_PAGE, entity_id: id,
            payload: { title: updated.title, space_id: updated.space_id, version_number: updated.current_version_number },
            changes: { ...fields, content_markdown: dto.content_markdown !== undefined ? '[changed]' : undefined } as Record<string, unknown>,
        });
        return updated;
    }

    async move(ctx: OrgContext, id: string, dto: MovePageDto) {
        const p = await this.access.principals(ctx);
        const { page, level } = await this.access.readablePage(ctx, id, p);
        this.access.assert(level, 'EDIT');
        let targetSpaceId = page.space_id;
        if (dto.space_id && dto.space_id !== page.space_id) {
            const target = await this.access.readableSpace(ctx, dto.space_id, p);
            this.access.assert(target.level, 'EDIT', 'the target space');
            targetSpaceId = target.space.id;
        }
        let newPath = page.path;
        let newDepth = page.depth;
        let newParent: string | null = page.parent_page_id;
        if (dto.parent_page_id !== undefined || targetSpaceId !== page.space_id) {
            newParent = dto.parent_page_id ?? null;
            if (newParent) {
                if (newParent === id) throw new BadRequestException({ message: 'A page cannot be its own parent', code: 'wiki_page_cycle' });
                const parentRes = await this.access.readablePage(ctx, newParent, p);
                if (parentRes.page.path.includes(`/${id}/`) || parentRes.page.path.startsWith(`${id}/`)) throw new BadRequestException({ message: 'Cannot move a page under its own child', code: 'wiki_page_cycle' });
                if (parentRes.page.space_id !== targetSpaceId) throw new BadRequestException({ message: 'The parent page is in another space', code: 'wiki_parent_other_space' });
                this.access.assert(parentRes.level, 'EDIT', 'the new parent page');
                newPath = `${parentRes.page.path}${parentRes.page.id}/`;
                newDepth = parentRes.page.depth + 1;
            } else {
                newPath = '';
                newDepth = 0;
            }
        }
        const oldPrefix = `${page.path}${id}/`;
        const newPrefix = `${newPath}${id}/`;
        await this.prisma.$transaction(async (tx) => {
            await tx.wikiPage.update({
                where: { id },
                data: { parent_page_id: newParent, path: newPath, depth: newDepth, space_id: targetSpaceId, ...(dto.sort_order !== undefined && { sort_order: dto.sort_order }) },
            });
            if (dto.sort_order !== undefined) {
                // Shift following siblings so the order stays dense and stable.
                await tx.wikiPage.updateMany({
                    where: { space_id: targetSpaceId, parent_page_id: newParent, id: { not: id }, sort_order: { gte: dto.sort_order } },
                    data: { sort_order: { increment: 1 } },
                });
            }
            if (oldPrefix !== newPrefix || targetSpaceId !== page.space_id) {
                const descendants = await tx.wikiPage.findMany({ where: { organization_id: ctx.organization_id, path: { startsWith: oldPrefix } }, select: { id: true, path: true } });
                for (const d of descendants) {
                    const path = newPrefix + d.path.slice(oldPrefix.length);
                    await tx.wikiPage.update({ where: { id: d.id }, data: { path, depth: path.split('/').filter(Boolean).length, space_id: targetSpaceId } });
                }
            }
            await this.audit.record(ctx, 'wiki_page.moved', {
                resource_type: 'wiki_page', resource_id: id,
                metadata: { before: { parent_page_id: page.parent_page_id, space_id: page.space_id, sort_order: page.sort_order }, after: { parent_page_id: newParent, space_id: targetSpaceId, sort_order: dto.sort_order } },
            }, tx);
        });
        this.events.publish(ctx, { event_key: 'docs.page.moved', module: ModuleKey.BUSINESS_DOCS, entity_type: RecordEntityType.WIKI_PAGE, entity_id: id, payload: { title: page.title, parent_page_id: newParent, space_id: targetSpaceId } });
        return { success: true };
    }

    async publish(ctx: OrgContext, id: string, changeSummary?: string) {
        const { page, level } = await this.access.readablePage(ctx, id);
        this.access.assert(level, 'EDIT');
        const now = new Date();
        const updated = await this.prisma.$transaction(async (tx) => {
            const row = await tx.wikiPage.update({
                where: { id },
                data: { status: WikiPageStatus.PUBLISHED, published_at: now, published_by_membership_id: ctx.membership_id, published_version_number: page.current_version_number, archived_at: null },
            });
            await tx.wikiPageVersion.updateMany({ where: { page_id: id, version_number: page.current_version_number }, data: { is_published_snapshot: true, ...(changeSummary && { change_summary: changeSummary }) } });
            await this.audit.record(ctx, 'wiki_page.published', { resource_type: 'wiki_page', resource_id: id, metadata: { version_number: page.current_version_number, before: { status: page.status } } }, tx);
            return row;
        });
        this.publishEvent(ctx, id, page.title, page.current_version_number);
        return updated;
    }

    async unpublish(ctx: OrgContext, id: string) {
        const { page, level } = await this.access.readablePage(ctx, id);
        this.access.assert(level, 'EDIT');
        const updated = await this.prisma.wikiPage.update({ where: { id }, data: { status: WikiPageStatus.DRAFT } });
        await this.audit.record(ctx, 'wiki_page.unpublished', { resource_type: 'wiki_page', resource_id: id, metadata: { before: { status: page.status } } });
        this.events.publish(ctx, { event_key: 'docs.page.unpublished', module: ModuleKey.BUSINESS_DOCS, entity_type: RecordEntityType.WIKI_PAGE, entity_id: id, payload: { title: page.title } });
        return updated;
    }

    async setArchived(ctx: OrgContext, id: string, archived: boolean) {
        const { page, level } = await this.access.readablePage(ctx, id);
        this.access.assert(level, 'EDIT');
        const status = archived ? WikiPageStatus.ARCHIVED : page.published_at ? WikiPageStatus.PUBLISHED : WikiPageStatus.DRAFT;
        const updated = await this.prisma.wikiPage.update({ where: { id }, data: { status, archived_at: archived ? new Date() : null } });
        await this.audit.record(ctx, archived ? 'wiki_page.archived' : 'wiki_page.unarchived', { resource_type: 'wiki_page', resource_id: id, metadata: { before: { status: page.status }, after: { status } } });
        this.events.publish(ctx, {
            event_key: archived ? 'docs.page.archived' : 'docs.page.unarchived', module: ModuleKey.BUSINESS_DOCS, entity_type: RecordEntityType.WIKI_PAGE, entity_id: id,
            payload: { title: page.title }, activity: { summary: `${archived ? 'archived' : 'unarchived'} the page ${page.title}`, entity_label: page.title },
        });
        return updated;
    }

    /** Move a page and its subtree to trash (restorable for 30 days). */
    async trash(ctx: OrgContext, id: string) {
        const { page, level } = await this.access.readablePage(ctx, id);
        this.access.assert(level, 'EDIT');
        const now = new Date();
        const res = await this.prisma.wikiPage.updateMany({
            where: { organization_id: ctx.organization_id, deleted_at: null, OR: [{ id }, { path: { startsWith: `${page.path}${id}/` } }] },
            data: { deleted_at: now, deleted_by_membership_id: ctx.membership_id },
        });
        await this.audit.record(ctx, 'wiki_page.trashed', { resource_type: 'wiki_page', resource_id: id, metadata: { title: page.title, pages: res.count } });
        this.events.publish(ctx, { event_key: 'docs.page.deleted', module: ModuleKey.BUSINESS_DOCS, entity_type: RecordEntityType.WIKI_PAGE, entity_id: id, payload: { title: page.title, pages: res.count } });
        return { success: true, pages: res.count };
    }

    async restore(ctx: OrgContext, id: string) {
        const { page, level } = await this.access.readablePage(ctx, id, undefined, { includeDeleted: true });
        if (!page.deleted_at) throw new BadRequestException({ message: 'Page is not in trash', code: 'wiki_page_not_trashed' });
        this.access.assert(level, 'EDIT');
        const space = await this.prisma.wikiSpace.findUnique({ where: { id: page.space_id }, select: { deleted_at: true } });
        if (space?.deleted_at) throw new ConflictException({ message: 'Restore the space first', code: 'wiki_space_trashed' });
        let parentOk = true;
        if (page.parent_page_id) {
            const parent = await this.prisma.wikiPage.findUnique({ where: { id: page.parent_page_id }, select: { deleted_at: true } });
            parentOk = !!parent && !parent.deleted_at;
        }
        const res = await this.prisma.$transaction(async (tx) => {
            const r = await tx.wikiPage.updateMany({
                where: { organization_id: ctx.organization_id, deleted_at: page.deleted_at, OR: [{ id }, { path: { startsWith: `${page.path}${id}/` } }] },
                data: { deleted_at: null, deleted_by_membership_id: null },
            });
            // Parent still in trash → restore to the top level of the space.
            if (!parentOk) await tx.wikiPage.update({ where: { id }, data: { parent_page_id: null, path: '', depth: 0 } });
            return r;
        });
        await this.audit.record(ctx, 'wiki_page.restored', { resource_type: 'wiki_page', resource_id: id, metadata: { pages: res.count } });
        this.events.publish(ctx, { event_key: 'docs.page.restored', module: ModuleKey.BUSINESS_DOCS, entity_type: RecordEntityType.WIKI_PAGE, entity_id: id, payload: { title: page.title } });
        return { success: true, pages: res.count };
    }

    /** Permanent delete of a trashed page and its trashed subtree (sensitive, docs.pages.delete). */
    async purge(ctx: OrgContext, id: string) {
        const { page, level } = await this.access.readablePage(ctx, id, undefined, { includeDeleted: true });
        if (!page.deleted_at) throw new BadRequestException({ message: 'Move the page to trash first', code: 'wiki_page_not_trashed' });
        this.access.assert(level, 'MANAGE');
        const ids = (await this.prisma.wikiPage.findMany({ where: { organization_id: ctx.organization_id, OR: [{ id }, { path: { startsWith: `${page.path}${id}/` } }] }, select: { id: true } })).map((r) => r.id);
        await this.prisma.$transaction(async (tx) => {
            await tx.wikiPage.updateMany({ where: { id: { in: ids } }, data: { parent_page_id: null } });
            await tx.wikiPage.deleteMany({ where: { id: { in: ids } } });
            await this.audit.record(ctx, 'wiki_page.purged', { resource_type: 'wiki_page', resource_id: id, metadata: { title: page.title, pages: ids.length } }, tx);
        });
        return { success: true, pages: ids.length };
    }

    async trashList(ctx: OrgContext, query: TrashQuery) {
        const p = await this.access.principals(ctx);
        const where: Prisma.WikiPageWhereInput = query.tab === 'archived'
            ? { ...this.access.readablePageWhere(ctx, p), archived_at: { not: null } }
            : { ...this.access.readablePageWhere(ctx, p, { includeDeleted: true }), deleted_at: { not: null } };
        if (query.space_id) where.space_id = query.space_id;
        if (query.search) where.title = { contains: query.search, mode: 'insensitive' };
        const [items, total] = await Promise.all([
            this.prisma.wikiPage.findMany({ where, select: { ...LIST_SELECT, deleted_by_membership_id: true }, ...skipTake(query), orderBy: query.tab === 'archived' ? { archived_at: 'desc' } : { deleted_at: 'desc' } }),
            this.prisma.wikiPage.count({ where }),
        ]);
        return paginate(items, total, query);
    }

    // ---------------------------------------------------------------------------------------------
    // Versions
    // ---------------------------------------------------------------------------------------------

    async versions(ctx: OrgContext, id: string) {
        await this.access.readablePage(ctx, id);
        const rows = await this.prisma.wikiPageVersion.findMany({
            where: { page_id: id },
            select: { id: true, version_number: true, title: true, change_summary: true, is_published_snapshot: true, restored_from_version_id: true, created_by_membership_id: true, created_at: true },
            orderBy: { version_number: 'desc' },
        });
        const authors = await this.prisma.membership.findMany({ where: { id: { in: rows.map((r) => r.created_by_membership_id).filter((x): x is string => !!x) } }, select: MEMBER_SELECT });
        return rows.map((r) => ({ ...r, author: authors.find((a) => a.id === r.created_by_membership_id) ?? null }));
    }

    async version(ctx: OrgContext, id: string, n: number) {
        await this.access.readablePage(ctx, id);
        const v = await this.prisma.wikiPageVersion.findUnique({ where: { page_id_version_number: { page_id: id, version_number: n } } });
        if (!v) throw new NotFoundException({ message: 'Version not found', code: 'wiki_version_not_found' });
        return v;
    }

    async restoreVersion(ctx: OrgContext, id: string, n: number, changeSummary?: string) {
        const { page, level } = await this.access.readablePage(ctx, id);
        this.access.assert(level, 'EDIT');
        const v = await this.prisma.wikiPageVersion.findUnique({ where: { page_id_version_number: { page_id: id, version_number: n } } });
        if (!v) throw new NotFoundException({ message: 'Version not found', code: 'wiki_version_not_found' });
        const next = page.current_version_number + 1;
        const now = new Date();
        const updated = await this.prisma.$transaction(async (tx) => {
            const row = await tx.wikiPage.update({
                where: { id },
                data: { title: v.title, content: v.content ?? { format: 'markdown' }, content_markdown: v.content_markdown, excerpt: excerptOf(v.content_markdown), word_count: wordCount(v.content_markdown), current_version_number: next, last_edited_at: now, last_edited_by_membership_id: ctx.membership_id },
            });
            await tx.wikiPageVersion.create({
                data: { page_id: id, version_number: next, title: v.title, content: v.content ?? { format: 'markdown' }, content_markdown: v.content_markdown, change_summary: changeSummary ?? `Restored version ${n}`, restored_from_version_id: v.id, created_by_membership_id: ctx.membership_id },
            });
            await this.syncPageRefs(tx, ctx, id, v.content_markdown);
            await this.audit.record(ctx, 'wiki_page.version_restored', { resource_type: 'wiki_page', resource_id: id, metadata: { restored_version: n, new_version: next } }, tx);
            return row;
        });
        this.events.publish(ctx, { event_key: 'docs.page.updated', module: ModuleKey.BUSINESS_DOCS, entity_type: RecordEntityType.WIKI_PAGE, entity_id: id, payload: { title: updated.title, version_number: next, restored_from: n } });
        return updated;
    }

    // ---------------------------------------------------------------------------------------------
    // Permissions
    // ---------------------------------------------------------------------------------------------

    async permissions(ctx: OrgContext, id: string) {
        const { page, level } = await this.access.readablePage(ctx, id);
        const grants = await this.prisma.wikiPagePermission.findMany({ where: { page_id: id }, orderBy: { created_at: 'asc' } });
        const ids = (t: string) => grants.filter((g) => g.principal_type === t).map((g) => g.principal_id);
        const [members, teams, branches, roles] = await Promise.all([
            this.prisma.membership.findMany({ where: { id: { in: ids('MEMBERSHIP') }, organization_id: ctx.organization_id }, select: MEMBER_SELECT }),
            this.prisma.team.findMany({ where: { id: { in: [...ids('TEAM'), ...ids('DEPARTMENT')] }, organization_id: ctx.organization_id }, select: { id: true, name: true } }),
            this.prisma.branch.findMany({ where: { id: { in: ids('BRANCH') }, organization_id: ctx.organization_id }, select: { id: true, name: true } }),
            this.prisma.role.findMany({ where: { id: { in: ids('ROLE') } }, select: { id: true, name: true } }),
        ]);
        const label = (g: (typeof grants)[number]) => {
            if (g.principal_type === 'MEMBERSHIP') {
                const m = members.find((x) => x.id === g.principal_id);
                return m ? m.user.display_name || [m.user.first_name, m.user.last_name].filter(Boolean).join(' ') || m.user.email : 'Unknown member';
            }
            if (g.principal_type === 'BRANCH') return branches.find((x) => x.id === g.principal_id)?.name ?? 'Unknown branch';
            if (g.principal_type === 'ROLE') return roles.find((x) => x.id === g.principal_id)?.name ?? 'Unknown role';
            return teams.find((x) => x.id === g.principal_id)?.name ?? 'Unknown team';
        };
        return { visibility: page.visibility, customer_visible: page.customer_visible, my_level: level, grants: grants.map((g) => ({ ...g, principal_label: label(g) })) };
    }

    async setPermissions(ctx: OrgContext, id: string, dto: SetPagePermissionsDto) {
        const { page, level } = await this.access.readablePage(ctx, id);
        this.access.assert(level, 'MANAGE');
        await this.assertPrincipals(ctx, dto.grants);
        const before = await this.prisma.wikiPagePermission.findMany({ where: { page_id: id }, select: { principal_type: true, principal_id: true, level: true } });
        await this.prisma.$transaction(async (tx) => {
            await tx.wikiPage.update({ where: { id }, data: { visibility: dto.visibility } });
            await tx.wikiPagePermission.deleteMany({ where: { page_id: id } });
            if (dto.grants.length) {
                await tx.wikiPagePermission.createMany({
                    data: dto.grants.map((g) => ({ page_id: id, principal_type: g.principal_type, principal_id: g.principal_id, level: g.level, inherit: g.inherit ?? true, granted_by_user_id: ctx.user_id })),
                    skipDuplicates: true,
                });
            }
            await this.audit.record(ctx, 'wiki_page.permissions_changed', { resource_type: 'wiki_page', resource_id: id, metadata: { before: { visibility: page.visibility, grants: before }, after: dto } }, tx);
        });
        this.events.publish(ctx, { event_key: 'docs.page.permissions_changed', module: ModuleKey.BUSINESS_DOCS, entity_type: RecordEntityType.WIKI_PAGE, entity_id: id, payload: { title: page.title, visibility: dto.visibility, grants: dto.grants.length } });
        return this.permissions(ctx, id);
    }

    // ---------------------------------------------------------------------------------------------
    // Comments
    // ---------------------------------------------------------------------------------------------

    async comments(ctx: OrgContext, id: string) {
        await this.access.readablePage(ctx, id);
        return this.prisma.wikiPageComment.findMany({
            where: { page_id: id, deleted_at: null },
            include: { author: { select: MEMBER_SELECT } },
            orderBy: { created_at: 'asc' },
        });
    }

    async addComment(ctx: OrgContext, id: string, dto: CreateCommentDto) {
        const { page, level } = await this.access.readablePage(ctx, id);
        this.access.assert(level, 'COMMENT');
        if (dto.parent_comment_id) {
            const parent = await this.prisma.wikiPageComment.findFirst({ where: { id: dto.parent_comment_id, page_id: id, deleted_at: null } });
            if (!parent) throw new NotFoundException({ message: 'Comment not found', code: 'wiki_comment_not_found' });
        }
        const comment = await this.prisma.wikiPageComment.create({
            data: { page_id: id, parent_comment_id: dto.parent_comment_id, block_id: dto.block_id, body: dto.body, mentions: dto.mentions ?? [], author_membership_id: ctx.membership_id },
            include: { author: { select: MEMBER_SELECT } },
        });
        await this.audit.record(ctx, 'wiki_page.comment_added', { resource_type: 'wiki_page', resource_id: id, metadata: { comment_id: comment.id } });
        this.events.publish(ctx, {
            event_key: 'docs.page.commented', module: ModuleKey.BUSINESS_DOCS, entity_type: RecordEntityType.WIKI_PAGE, entity_id: id,
            payload: { title: page.title, comment_id: comment.id, mentions: dto.mentions ?? [], owner_membership_id: page.owner_membership_id },
        });
        return comment;
    }

    async updateComment(ctx: OrgContext, id: string, commentId: string, body: string) {
        await this.access.readablePage(ctx, id);
        const comment = await this.prisma.wikiPageComment.findFirst({ where: { id: commentId, page_id: id, deleted_at: null } });
        if (!comment) throw new NotFoundException({ message: 'Comment not found', code: 'wiki_comment_not_found' });
        if (comment.author_membership_id !== ctx.membership_id) throw new ForbiddenException({ message: 'You can only edit your own comments', code: 'wiki_comment_not_author' });
        const row = await this.prisma.wikiPageComment.update({ where: { id: commentId }, data: { body, edited_at: new Date() }, include: { author: { select: MEMBER_SELECT } } });
        await this.audit.record(ctx, 'wiki_page.comment_edited', { resource_type: 'wiki_page', resource_id: id, metadata: { comment_id: commentId } });
        return row;
    }

    async resolveComment(ctx: OrgContext, id: string, commentId: string, resolved: boolean) {
        const { level } = await this.access.readablePage(ctx, id);
        this.access.assert(level, 'COMMENT');
        const comment = await this.prisma.wikiPageComment.findFirst({ where: { id: commentId, page_id: id, deleted_at: null } });
        if (!comment) throw new NotFoundException({ message: 'Comment not found', code: 'wiki_comment_not_found' });
        const row = await this.prisma.wikiPageComment.update({ where: { id: commentId }, data: resolved ? { resolved_at: new Date(), resolved_by_membership_id: ctx.membership_id } : { resolved_at: null, resolved_by_membership_id: null } });
        await this.audit.record(ctx, resolved ? 'wiki_page.comment_resolved' : 'wiki_page.comment_reopened', { resource_type: 'wiki_page', resource_id: id, metadata: { comment_id: commentId } });
        return row;
    }

    async deleteComment(ctx: OrgContext, id: string, commentId: string) {
        const { level } = await this.access.readablePage(ctx, id);
        const comment = await this.prisma.wikiPageComment.findFirst({ where: { id: commentId, page_id: id, deleted_at: null } });
        if (!comment) throw new NotFoundException({ message: 'Comment not found', code: 'wiki_comment_not_found' });
        if (comment.author_membership_id !== ctx.membership_id) this.access.assert(level, 'MANAGE');
        await this.prisma.wikiPageComment.update({ where: { id: commentId }, data: { deleted_at: new Date() } });
        await this.audit.record(ctx, 'wiki_page.comment_deleted', { resource_type: 'wiki_page', resource_id: id, metadata: { comment_id: commentId } });
        return { success: true };
    }

    // ---------------------------------------------------------------------------------------------
    // Favorites, views, acknowledgements, reviews
    // ---------------------------------------------------------------------------------------------

    async setFavorite(ctx: OrgContext, id: string, favorite: boolean) {
        await this.access.readablePage(ctx, id);
        const membershipId = this.requireMember(ctx);
        if (favorite) {
            await this.prisma.wikiPageFavorite.upsert({ where: { page_id_membership_id: { page_id: id, membership_id: membershipId } }, update: {}, create: { page_id: id, membership_id: membershipId } });
        } else {
            await this.prisma.wikiPageFavorite.deleteMany({ where: { page_id: id, membership_id: membershipId } });
        }
        return { is_favorite: favorite };
    }

    /** Reader analytics (15 §2): one raw view + the daily rollup. */
    async recordView(ctx: OrgContext, id: string, source: 'UI' | 'SEARCH' | 'AI_CITATION' = 'UI') {
        const { page } = await this.access.readablePage(ctx, id);
        if (!ctx.membership_id) return { recorded: false };
        const now = new Date();
        const day = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
        const seenToday = await this.prisma.wikiPageView.findFirst({ where: { page_id: id, membership_id: ctx.membership_id, viewed_at: { gte: day } }, select: { id: true, viewed_at: true }, orderBy: { viewed_at: 'desc' } });
        // Collapse reloads within 5 minutes into one view.
        if (seenToday && now.getTime() - seenToday.viewed_at.getTime() < 5 * 60_000) return { recorded: false };
        await this.prisma.$transaction([
            this.prisma.wikiPageView.create({ data: { organization_id: ctx.organization_id, page_id: id, membership_id: ctx.membership_id, version_number: page.current_version_number, source } }),
            this.prisma.wikiPageViewDaily.upsert({
                where: { page_id_day: { page_id: id, day } },
                update: { view_count: { increment: 1 }, ...(!seenToday && { unique_readers: { increment: 1 } }) },
                create: { page_id: id, day, organization_id: ctx.organization_id, view_count: 1, unique_readers: 1 },
            }),
        ]);
        return { recorded: true };
    }

    async acknowledge(ctx: OrgContext, id: string) {
        const { page } = await this.access.readablePage(ctx, id);
        const membershipId = this.requireMember(ctx);
        const version = page.published_version_number ?? page.current_version_number;
        const now = new Date();
        const row = await this.prisma.wikiPageAcknowledgement.upsert({
            where: { page_id_membership_id: { page_id: id, membership_id: membershipId } },
            update: { acknowledged_at: now, acknowledged_version_number: version },
            create: { page_id: id, membership_id: membershipId, acknowledged_at: now, acknowledged_version_number: version },
        });
        // A checklist run item waiting for this reading completes too.
        if (row.checklist_run_item_id) {
            await this.prisma.wikiChecklistRunItem.updateMany({ where: { id: row.checklist_run_item_id, status: { in: ['PENDING', 'IN_PROGRESS'] } }, data: { status: 'COMPLETED', completed_at: now, completed_by_membership_id: membershipId } });
        }
        await this.audit.record(ctx, 'wiki_page.acknowledged', { resource_type: 'wiki_page', resource_id: id, metadata: { version_number: version } });
        this.events.publish(ctx, { event_key: 'docs.page.acknowledged', module: ModuleKey.BUSINESS_DOCS, entity_type: RecordEntityType.WIKI_PAGE, entity_id: id, payload: { title: page.title, version_number: version, membership_id: membershipId } });
        return row;
    }

    async acknowledgements(ctx: OrgContext, id: string) {
        const { page } = await this.access.readablePage(ctx, id);
        const rows = await this.prisma.wikiPageAcknowledgement.findMany({ where: { page_id: id }, include: { membership: { select: MEMBER_SELECT } }, orderBy: { created_at: 'asc' } });
        const version = page.published_version_number ?? page.current_version_number;
        const out = rows.map((r) => ({ ...r, is_current: !!r.acknowledged_at && (r.acknowledged_version_number ?? 0) >= version }));
        return { total: out.length, acknowledged: out.filter((r) => r.is_current).length, rows: out };
    }

    async requireAcknowledgement(ctx: OrgContext, id: string, dto: RequireAckDto) {
        const { page, level } = await this.access.readablePage(ctx, id);
        this.access.assert(level, 'EDIT');
        await this.assertMembers(ctx, dto.membership_ids);
        const requiredBy = dto.required_by ? new Date(dto.required_by) : null;
        await this.prisma.$transaction([
            this.prisma.wikiPage.update({ where: { id }, data: { requires_acknowledgement: true, ...(requiredBy && { ack_due_at: requiredBy }) } }),
            this.prisma.wikiPageAcknowledgement.createMany({ data: dto.membership_ids.map((m) => ({ page_id: id, membership_id: m, required_by: requiredBy })), skipDuplicates: true }),
        ]);
        await this.audit.record(ctx, 'wiki_page.acknowledgement_requested', { resource_type: 'wiki_page', resource_id: id, metadata: { membership_ids: dto.membership_ids, required_by: dto.required_by } });
        this.events.publish(ctx, { event_key: 'docs.page.acknowledgement_requested', module: ModuleKey.BUSINESS_DOCS, entity_type: RecordEntityType.WIKI_PAGE, entity_id: id, payload: { title: page.title, membership_ids: dto.membership_ids, required_by: dto.required_by } });
        return this.acknowledgements(ctx, id);
    }

    async markReviewed(ctx: OrgContext, id: string, dto: MarkReviewedDto) {
        const { page, level } = await this.access.readablePage(ctx, id);
        const isReviewer = ctx.membership_id
            ? page.owner_membership_id === ctx.membership_id || !!(await this.prisma.wikiPageReviewer.findUnique({ where: { page_id_membership_id: { page_id: id, membership_id: ctx.membership_id } } }))
            : false;
        if (!isReviewer) this.access.assert(level, 'EDIT');
        const now = new Date();
        const updated = await this.prisma.wikiPage.update({
            where: { id },
            data: {
                last_reviewed_at: now,
                last_reviewed_by_membership_id: ctx.membership_id,
                stale_flagged_at: null,
                next_review_at: page.review_interval_days ? new Date(now.getTime() + page.review_interval_days * DAY) : null,
                ...(page.status === WikiPageStatus.NEEDS_REVIEW && { status: WikiPageStatus.PUBLISHED }),
            },
        });
        await this.audit.record(ctx, 'wiki_page.reviewed', { resource_type: 'wiki_page', resource_id: id, metadata: { notes: dto.notes } });
        this.events.publish(ctx, { event_key: 'docs.page.reviewed', module: ModuleKey.BUSINESS_DOCS, entity_type: RecordEntityType.WIKI_PAGE, entity_id: id, payload: { title: page.title, next_review_at: updated.next_review_at } });
        return updated;
    }

    // ---------------------------------------------------------------------------------------------
    // Links & backlinks
    // ---------------------------------------------------------------------------------------------

    async links(ctx: OrgContext, id: string) {
        const p = await this.access.principals(ctx);
        await this.access.readablePage(ctx, id, p);
        const readable = this.access.readablePageWhere(ctx, p);
        const [outgoing, backlinks] = await Promise.all([
            this.prisma.wikiPageLink.findMany({ where: { page_id: id }, orderBy: { created_at: 'asc' } }),
            this.prisma.wikiPageLink.findMany({ where: { entity_type: RecordEntityType.WIKI_PAGE, entity_id: id, page: readable }, include: { page: { select: { id: true, title: true, icon: true, space: { select: { id: true, name: true } } } } } }),
        ]);
        const pageIds = outgoing.filter((l) => l.entity_type === RecordEntityType.WIKI_PAGE).map((l) => l.entity_id);
        const linkedPages = pageIds.length ? await this.prisma.wikiPage.findMany({ where: { ...readable, id: { in: pageIds } }, select: { id: true, title: true, icon: true } }) : [];
        return {
            outgoing: outgoing
                .map((l) => (l.entity_type === RecordEntityType.WIKI_PAGE ? { ...l, page: linkedPages.find((x) => x.id === l.entity_id) ?? null } : { ...l, page: null }))
                // Hide links to pages the caller cannot read.
                .filter((l) => l.entity_type !== RecordEntityType.WIKI_PAGE || l.page),
            backlinks: backlinks.map((b) => ({ id: b.id, page: b.page, created_at: b.created_at })),
        };
    }

    async addLink(ctx: OrgContext, id: string, dto: AddPageLinkDto) {
        const { level } = await this.access.readablePage(ctx, id);
        this.access.assert(level, 'EDIT');
        const row = await this.prisma.wikiPageLink.upsert({
            where: { page_id_entity_type_entity_id: { page_id: id, entity_type: dto.entity_type, entity_id: dto.entity_id } },
            update: { label: dto.label },
            create: { page_id: id, entity_type: dto.entity_type, entity_id: dto.entity_id, label: dto.label, created_by_user_id: ctx.user_id },
        });
        await this.audit.record(ctx, 'wiki_page.link_added', { resource_type: 'wiki_page', resource_id: id, metadata: { entity_type: dto.entity_type, entity_id: dto.entity_id } });
        this.events.publish(ctx, { event_key: 'docs.page.linked', module: ModuleKey.BUSINESS_DOCS, entity_type: RecordEntityType.WIKI_PAGE, entity_id: id, payload: { entity_type: dto.entity_type, entity_id: dto.entity_id } });
        return row;
    }

    async removeLink(ctx: OrgContext, id: string, linkId: string) {
        const { level } = await this.access.readablePage(ctx, id);
        this.access.assert(level, 'EDIT');
        const res = await this.prisma.wikiPageLink.deleteMany({ where: { id: linkId, page_id: id } });
        if (!res.count) throw new NotFoundException({ message: 'Link not found', code: 'wiki_link_not_found' });
        await this.audit.record(ctx, 'wiki_page.link_removed', { resource_type: 'wiki_page', resource_id: id, metadata: { link_id: linkId } });
        return { success: true };
    }

    // ---------------------------------------------------------------------------------------------
    // Search & analytics
    // ---------------------------------------------------------------------------------------------

    /** Keyword search over title + markdown (15 §7), permission-filtered on the server; title hits rank first. */
    async search(ctx: OrgContext, query: SearchQuery) {
        const p = await this.access.principals(ctx);
        const q = query.q;
        const where: Prisma.WikiPageWhereInput = {
            ...this.access.readablePageWhere(ctx, p),
            archived_at: null,
            OR: [{ title: { contains: q, mode: 'insensitive' } }, { content_markdown: { contains: q, mode: 'insensitive' } }],
            ...(query.space_id && { space_id: query.space_id }),
            ...(query.page_type?.length && { page_type: { in: query.page_type } }),
            ...(query.status?.length && { status: { in: query.status } }),
            ...(query.owner_id && { owner_membership_id: query.owner_id }),
            ...(query.updated_after && { updated_at: { gte: new Date(query.updated_after) } }),
        };
        const [rows, total] = await Promise.all([
            this.prisma.wikiPage.findMany({ where, select: { ...LIST_SELECT, content_markdown: true }, ...skipTake(query), orderBy: { updated_at: 'desc' } }),
            this.prisma.wikiPage.count({ where }),
        ]);
        const lower = q.toLowerCase();
        const items = rows
            .map(({ content_markdown, ...r }) => ({ ...r, title_match: r.title.toLowerCase().includes(lower), snippet: this.snippet(content_markdown, q) }))
            .sort((a, b) => Number(b.title_match) - Number(a.title_match));
        if (query.page === 1) {
            this.prisma.wikiSearchQuery
                .create({ data: { organization_id: ctx.organization_id, membership_id: ctx.membership_id, query: q.slice(0, 200), mode: WikiSearchMode.KEYWORD, filters: { space_id: query.space_id, page_type: query.page_type, status: query.status } as Prisma.InputJsonValue, result_count: total } })
                .catch(() => undefined);
        }
        return paginate(items, total, query);
    }

    async analytics(ctx: OrgContext, query: AnalyticsQuery) {
        const p = await this.access.principals(ctx);
        const readable: Prisma.WikiPageWhereInput = { ...this.access.readablePageWhere(ctx, p), archived_at: null, ...(query.space_id && { space_id: query.space_id }) };
        const from = new Date(Date.now() - query.days * DAY);
        const now = new Date();
        const pageIds = (await this.prisma.wikiPage.findMany({ where: readable, select: { id: true } })).map((r) => r.id);
        const [byStatus, overdue, daily, topViews, searches, zeroSearches, ackTotal, ackDone] = await Promise.all([
            this.prisma.wikiPage.groupBy({ by: ['status'], where: readable, _count: { _all: true } }),
            this.prisma.wikiPage.count({ where: { ...readable, next_review_at: { lt: now } } }),
            this.prisma.wikiPageViewDaily.groupBy({ by: ['day'], where: { organization_id: ctx.organization_id, page_id: { in: pageIds }, day: { gte: from } }, _sum: { view_count: true, unique_readers: true }, orderBy: { day: 'asc' } }),
            this.prisma.wikiPageViewDaily.groupBy({ by: ['page_id'], where: { organization_id: ctx.organization_id, page_id: { in: pageIds }, day: { gte: from } }, _sum: { view_count: true }, orderBy: { _sum: { view_count: 'desc' } }, take: 10 }),
            this.prisma.wikiSearchQuery.groupBy({ by: ['query'], where: { organization_id: ctx.organization_id, created_at: { gte: from } }, _count: { _all: true }, orderBy: { _count: { query: 'desc' } }, take: 10 }),
            this.prisma.wikiSearchQuery.groupBy({ by: ['query'], where: { organization_id: ctx.organization_id, created_at: { gte: from }, result_count: 0 }, _count: { _all: true }, orderBy: { _count: { query: 'desc' } }, take: 10 }),
            this.prisma.wikiPageAcknowledgement.count({ where: { page_id: { in: pageIds } } }),
            this.prisma.wikiPageAcknowledgement.count({ where: { page_id: { in: pageIds }, acknowledged_at: { not: null } } }),
        ]);
        const titles = await this.prisma.wikiPage.findMany({ where: { id: { in: topViews.map((t) => t.page_id) } }, select: { id: true, title: true, icon: true } });
        return {
            pages: { total: pageIds.length, by_status: Object.fromEntries(byStatus.map((s) => [s.status, s._count._all])), review_overdue: overdue },
            views: {
                total: daily.reduce((n, d) => n + (d._sum.view_count ?? 0), 0),
                daily: daily.map((d) => ({ day: d.day, views: d._sum.view_count ?? 0, readers: d._sum.unique_readers ?? 0 })),
                top_pages: topViews.map((t) => ({ page: titles.find((x) => x.id === t.page_id) ?? { id: t.page_id, title: 'Untitled', icon: null }, views: t._sum.view_count ?? 0 })),
            },
            search: {
                top: searches.map((s) => ({ query: s.query, count: s._count._all })),
                zero_results: zeroSearches.map((s) => ({ query: s.query, count: s._count._all })),
            },
            acknowledgements: { total: ackTotal, acknowledged: ackDone },
        };
    }

    // ---------------------------------------------------------------------------------------------
    // Helpers
    // ---------------------------------------------------------------------------------------------

    private publishEvent(ctx: OrgContext, id: string, title: string, version: number) {
        this.events.publish(ctx, {
            event_key: 'docs.page.published', module: ModuleKey.BUSINESS_DOCS, entity_type: RecordEntityType.WIKI_PAGE, entity_id: id,
            payload: { title, version_number: version },
            activity: { summary: `published the page ${title}`, entity_label: title },
        });
    }

    private snippet(md: string | null, q: string) {
        const text = markdownToText(md);
        const i = text.toLowerCase().indexOf(q.toLowerCase());
        if (i < 0) return text.slice(0, 180) || null;
        const start = Math.max(0, i - 70);
        return `${start > 0 ? '…' : ''}${text.slice(start, i + q.length + 110)}${i + q.length + 110 < text.length ? '…' : ''}`;
    }

    /** Store page→page references found in the markdown as WikiPageLink rows (backlinks). */
    private async syncPageRefs(tx: Prisma.TransactionClient, ctx: OrgContext, pageId: string, md: string | null) {
        const refs = parsePageRefs(md);
        const byTitle = refs.titles.length
            ? await tx.wikiPage.findMany({ where: { organization_id: ctx.organization_id, deleted_at: null, title: { in: refs.titles, mode: 'insensitive' } }, select: { id: true } })
            : [];
        const byId = refs.ids.length ? await tx.wikiPage.findMany({ where: { organization_id: ctx.organization_id, id: { in: refs.ids } }, select: { id: true } }) : [];
        const targets = [...new Set([...byId, ...byTitle].map((r) => r.id))].filter((t) => t !== pageId);
        await tx.wikiPageLink.deleteMany({ where: { page_id: pageId, entity_type: RecordEntityType.WIKI_PAGE, entity_id: { notIn: targets } } });
        if (targets.length) {
            await tx.wikiPageLink.createMany({ data: targets.map((t) => ({ page_id: pageId, entity_type: RecordEntityType.WIKI_PAGE, entity_id: t, created_by_user_id: ctx.user_id })), skipDuplicates: true });
        }
    }

    /** 409 with what the editor needs to merge: the latest title/content, who saved it and when. */
    private async versionConflict(id: string, baseVersion: number) {
        const latest = await this.prisma.wikiPage.findUnique({
            where: { id },
            select: { title: true, content_markdown: true, current_version_number: true, last_edited_at: true, last_edited_by_membership_id: true },
        });
        const editor = latest?.last_edited_by_membership_id ? await this.prisma.membership.findUnique({ where: { id: latest.last_edited_by_membership_id }, select: MEMBER_SELECT }) : null;
        const base = await this.prisma.wikiPageVersion.findUnique({ where: { page_id_version_number: { page_id: id, version_number: baseVersion } }, select: { title: true, content_markdown: true } }).catch(() => null);
        return new ConflictException({
            message: 'This page changed while you were editing it. Review the newer version and merge your changes.',
            code: 'wiki_page_version_conflict',
            base_version_number: baseVersion,
            current_version_number: latest?.current_version_number ?? null,
            latest: latest ? { title: latest.title, content_markdown: latest.content_markdown, edited_at: latest.last_edited_at, edited_by: editor } : null,
            base: base ?? null,
        });
    }

    private assertCustomerVisible(ctx: OrgContext, space: { allow_customer_visible: boolean }) {
        if (!ctx.can('docs.pages.publish')) throw new ForbiddenException({ message: 'You need docs.pages.publish to expose a page to customers', code: 'permission_denied', permissions: ['docs.pages.publish'] });
        if (!space.allow_customer_visible) throw new BadRequestException({ message: 'This space does not allow customer-visible pages', code: 'wiki_customer_visible_not_allowed' });
    }

    private async assertMembers(ctx: OrgContext, ids: (string | undefined | null)[]) {
        const list = [...new Set(ids.filter((x): x is string => !!x))];
        if (!list.length) return;
        const n = await this.prisma.membership.count({ where: { id: { in: list }, organization_id: ctx.organization_id } });
        if (n !== list.length) throw new BadRequestException({ message: 'A referenced member was not found', code: 'membership_not_found' });
    }

    private async assertPrincipals(ctx: OrgContext, grants: { principal_type: string; principal_id: string }[]) {
        const org = ctx.organization_id;
        for (const g of grants) {
            let ok = 0;
            if (g.principal_type === 'MEMBERSHIP') ok = await this.prisma.membership.count({ where: { id: g.principal_id, organization_id: org } });
            else if (g.principal_type === 'TEAM' || g.principal_type === 'DEPARTMENT') ok = await this.prisma.team.count({ where: { id: g.principal_id, organization_id: org } });
            else if (g.principal_type === 'BRANCH') ok = await this.prisma.branch.count({ where: { id: g.principal_id, organization_id: org } });
            else if (g.principal_type === 'ROLE') ok = await this.prisma.role.count({ where: { id: g.principal_id, OR: [{ organization_id: org }, { organization_id: null }] } });
            if (!ok) throw new BadRequestException({ message: `${g.principal_type.toLowerCase()} ${g.principal_id} was not found`, code: 'reference_not_found' });
        }
    }

    private requireMember(ctx: OrgContext) {
        if (!ctx.membership_id) throw new BadRequestException({ message: 'This action needs a member identity', code: 'membership_required' });
        return ctx.membership_id;
    }

    private async uniqueSlug(spaceId: string, title: string) {
        const base = slugify(title) || 'page';
        let slug = base;
        for (let i = 2; await this.prisma.wikiPage.findFirst({ where: { space_id: spaceId, slug }, select: { id: true } }); i++) slug = `${base}-${i}`;
        return slug;
    }
}
