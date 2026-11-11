import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, WikiPermissionLevel, WikiPrincipalType, WikiVisibility } from 'generated/prisma';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import { OrgContext } from '@/shared/authorization/interfaces/org-context.interface';

export type DocsLevel = 'NONE' | WikiPermissionLevel;

const RANK: Record<DocsLevel, number> = { NONE: 0, VIEW: 1, COMMENT: 2, EDIT: 3, MANAGE: 4 };

export const maxLevel = (...levels: DocsLevel[]): DocsLevel => levels.reduce((a, b) => (RANK[b] > RANK[a] ? b : a), 'NONE' as DocsLevel);
export const atLeast = (level: DocsLevel, needed: DocsLevel) => RANK[level] >= RANK[needed];

/** The caller's principals used to match space members and page grants (15 §2, §8). */
export interface DocsPrincipals {
    membership_id: string | null;
    team_ids: string[];
    branch_ids: string[];
    role_ids: string[];
}

const READ = 'docs.pages.read';
const MANAGE = 'docs.spaces.manage';

/**
 * Space / page access for Business Docs. Permission keys say WHAT a person may do; space membership,
 * private spaces, page visibility and page grants say WHERE (15 §2, §8). Every docs service goes through here.
 */
@Injectable()
export class DocsAccessService {
    constructor(private readonly prisma: PrismaService) { }

    async principals(ctx: OrgContext): Promise<DocsPrincipals> {
        if (!ctx.membership_id) return { membership_id: null, team_ids: [], branch_ids: [], role_ids: [] };
        const [teams, branches, roles] = await Promise.all([
            this.prisma.teamMembership.findMany({ where: { membership_id: ctx.membership_id, ended_at: null }, select: { team_id: true } }),
            this.prisma.membershipBranch.findMany({ where: { membership_id: ctx.membership_id, ended_at: null }, select: { branch_id: true } }),
            this.prisma.roleAssignment.findMany({
                where: { membership_id: ctx.membership_id, revoked_at: null, OR: [{ valid_until: null }, { valid_until: { gt: new Date() } }] },
                select: { role_id: true },
            }),
        ]);
        return {
            membership_id: ctx.membership_id,
            team_ids: teams.map((t) => t.team_id),
            branch_ids: branches.map((b) => b.branch_id),
            role_ids: roles.map((r) => r.role_id),
        };
    }

    /** Organization-wide space managers see every space, including private ones. */
    isManager(ctx: OrgContext) {
        const scope = ctx.scopeOf(MANAGE);
        return !!scope?.organization;
    }

    /** Branch / team / project scope of `docs.pages.read` narrows which spaces are visible at all. */
    private scopeWhere(ctx: OrgContext): Prisma.WikiSpaceWhereInput {
        const scope = ctx.scopeOf(READ);
        if (!scope || scope.organization) return {};
        return {
            OR: [
                { branch_id: { in: scope.branch_ids } },
                { team_id: { in: scope.team_ids } },
                { department_id: { in: scope.team_ids } },
                { project_id: { in: scope.project_ids } },
                { id: { in: scope.resource_ids } },
            ],
        };
    }

    readableSpaceWhere(ctx: OrgContext, p: DocsPrincipals, opts: { includeDeleted?: boolean } = {}): Prisma.WikiSpaceWhereInput {
        const base: Prisma.WikiSpaceWhereInput = {
            organization_id: ctx.organization_id,
            ...(opts.includeDeleted ? {} : { deleted_at: null }),
        };
        if (this.isManager(ctx)) return base;
        const privacy: Prisma.WikiSpaceWhereInput = {
            OR: [
                { is_private: false },
                ...(p.membership_id ? [{ members: { some: { membership_id: p.membership_id } } }, { owner_membership_id: p.membership_id }] : []),
            ],
        };
        return { ...base, AND: [this.scopeWhere(ctx), privacy] };
    }

    private grantMatch(p: DocsPrincipals): Prisma.WikiPagePermissionWhereInput[] {
        const out: Prisma.WikiPagePermissionWhereInput[] = [];
        if (p.membership_id) out.push({ principal_type: WikiPrincipalType.MEMBERSHIP, principal_id: p.membership_id });
        if (p.team_ids.length) out.push({ principal_type: { in: [WikiPrincipalType.TEAM, WikiPrincipalType.DEPARTMENT] }, principal_id: { in: p.team_ids } });
        if (p.branch_ids.length) out.push({ principal_type: WikiPrincipalType.BRANCH, principal_id: { in: p.branch_ids } });
        if (p.role_ids.length) out.push({ principal_type: WikiPrincipalType.ROLE, principal_id: { in: p.role_ids } });
        return out;
    }

    /** Pages the caller may read: readable space + (organization visibility | own page | matching grant); drafts only for editors and owners. */
    readablePageWhere(ctx: OrgContext, p: DocsPrincipals, opts: { includeDeleted?: boolean } = {}): Prisma.WikiPageWhereInput {
        const where: Prisma.WikiPageWhereInput = {
            organization_id: ctx.organization_id,
            ...(opts.includeDeleted ? {} : { deleted_at: null }),
            space: this.readableSpaceWhere(ctx, p),
        };
        if (this.isManager(ctx)) return where;
        const mine: Prisma.WikiPageWhereInput[] = [
            ...(p.membership_id ? [{ owner_membership_id: p.membership_id }] : []),
            ...(ctx.user_id ? [{ created_by_user_id: ctx.user_id }] : []),
        ];
        const grants = this.grantMatch(p);
        const and: Prisma.WikiPageWhereInput[] = [
            {
                OR: [
                    { visibility: WikiVisibility.ORGANIZATION },
                    ...mine,
                    ...(grants.length ? [{ permissions: { some: { OR: grants } } }] : []),
                ],
            },
        ];
        if (!ctx.can('docs.pages.update')) and.push({ OR: [{ status: { not: 'DRAFT' } }, ...mine] });
        return { ...where, AND: and };
    }

    /** Effective level on a space (members table, privacy, permission keys). */
    async spaceLevel(ctx: OrgContext, space: { id: string; is_private: boolean; owner_membership_id: string | null }, p: DocsPrincipals): Promise<DocsLevel> {
        if (this.isManager(ctx)) return 'MANAGE';
        let level: DocsLevel = space.is_private ? 'NONE' : 'VIEW';
        if (p.membership_id) {
            if (space.owner_membership_id === p.membership_id) level = 'MANAGE';
            const member = await this.prisma.wikiSpaceMember.findUnique({ where: { space_id_membership_id: { space_id: space.id, membership_id: p.membership_id } } });
            if (member) level = maxLevel(level, member.level);
        }
        if (!space.is_private && ctx.can('docs.pages.create')) level = maxLevel(level, 'EDIT');
        if (ctx.can('docs.spaces.manage')) level = maxLevel(level, level === 'NONE' ? 'NONE' : 'MANAGE');
        return level;
    }

    /** Effective level on a page the caller can already read. Without `docs.pages.update` the level is capped at COMMENT. */
    async pageLevel(
        ctx: OrgContext,
        page: { id: string; space_id: string; visibility: WikiVisibility; owner_membership_id: string | null; created_by_user_id: string | null; path: string },
        space: { id: string; is_private: boolean; owner_membership_id: string | null },
        p: DocsPrincipals,
    ): Promise<DocsLevel> {
        if (this.isManager(ctx)) return 'MANAGE';
        let level: DocsLevel = 'VIEW';
        const spaceLevel = await this.spaceLevel(ctx, space, p);
        if (page.visibility === WikiVisibility.ORGANIZATION || spaceLevel === 'MANAGE') level = maxLevel(level, spaceLevel);
        if ((p.membership_id && page.owner_membership_id === p.membership_id) || (ctx.user_id && page.created_by_user_id === ctx.user_id)) level = 'MANAGE';
        const grants = this.grantMatch(p);
        if (grants.length) {
            const ancestors = page.path.split('/').filter(Boolean);
            const rows = await this.prisma.wikiPagePermission.findMany({
                where: { OR: [{ page_id: page.id }, ...(ancestors.length ? [{ page_id: { in: ancestors }, inherit: true }] : [])], AND: [{ OR: grants }] },
                select: { level: true },
            });
            level = maxLevel(level, ...rows.map((r) => r.level));
        }
        if (!ctx.can('docs.pages.update') && atLeast(level, 'EDIT')) level = 'COMMENT';
        return level;
    }

    /** Load a readable page or 404 (never reveal existence). */
    async readablePage(ctx: OrgContext, id: string, p?: DocsPrincipals, opts: { includeDeleted?: boolean } = {}) {
        const principals = p ?? (await this.principals(ctx));
        const page = await this.prisma.wikiPage.findFirst({
            where: { id, ...this.readablePageWhere(ctx, principals, opts) },
            include: { space: { select: { id: true, name: true, slug: true, is_private: true, owner_membership_id: true, allow_customer_visible: true, members_can_publish: true, icon: true, color: true } } },
        });
        if (!page) throw new NotFoundException({ message: 'Page not found', code: 'wiki_page_not_found' });
        const level = await this.pageLevel(ctx, page, page.space, principals);
        return { page, level, principals };
    }

    async readableSpace(ctx: OrgContext, idOrSlug: string, p?: DocsPrincipals) {
        const principals = p ?? (await this.principals(ctx));
        const isUuid = /^[0-9a-f-]{36}$/i.test(idOrSlug);
        const space = await this.prisma.wikiSpace.findFirst({
            where: { ...(isUuid ? { id: idOrSlug } : { slug: idOrSlug }), ...this.readableSpaceWhere(ctx, principals) },
        });
        if (!space) throw new NotFoundException({ message: 'Space not found', code: 'wiki_space_not_found' });
        const level = await this.spaceLevel(ctx, space, principals);
        return { space, level, principals };
    }

    assert(level: DocsLevel, needed: DocsLevel, what = 'this page') {
        if (!atLeast(level, needed)) {
            throw new ForbiddenException({ message: `You need ${needed.toLowerCase()} access to ${what}`, code: 'wiki_access_denied', required_level: needed });
        }
    }
}
