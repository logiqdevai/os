import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ModuleKey, Prisma, RecordEntityType, WikiPermissionLevel, WikiPrincipalType } from 'generated/prisma';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import { AuditService } from '@/shared/audit/audit.service';
import { EventsService } from '@/shared/events/events.service';
import { OrgContext } from '@/shared/authorization/interfaces/org-context.interface';
import { orderBy, paginate, skipTake } from '@/shared/utils/pagination/pagination.utils';
import { slugify } from '@/modules/auth/services/organization-setup.service';
import { DocsAccessService } from '../docs-access.service';
import { CreateSpaceDto, SpaceQuery, UpdateSpaceDto } from '../dto/space.dto';
import { MEMBER_SELECT } from '../utils/docs.utils';

/** Wiki spaces (15 §2, §4): CRUD, members, archive and trash. Managers hold `docs.spaces.manage`. */
@Injectable()
export class DocsSpacesService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly audit: AuditService,
        private readonly events: EventsService,
        private readonly access: DocsAccessService,
    ) { }

    async findAll(ctx: OrgContext, query: SpaceQuery) {
        const p = await this.access.principals(ctx);
        const where: Prisma.WikiSpaceWhereInput = {
            ...this.access.readableSpaceWhere(ctx, p),
            ...(query.archived ? { archived_at: { not: null } } : { archived_at: null }),
            ...(query.kind && { kind: query.kind }),
            ...(query.search && { name: { contains: query.search, mode: 'insensitive' } }),
        };
        const pageWhere = this.access.readablePageWhere(ctx, p);
        const [items, total] = await Promise.all([
            this.prisma.wikiSpace.findMany({
                where,
                ...skipTake(query),
                orderBy: [{ sort_order: 'asc' }, orderBy(query, ['name', 'created_at', 'updated_at'], 'name')],
                include: {
                    owner: { select: MEMBER_SELECT },
                    team: { select: { id: true, name: true } },
                    branch: { select: { id: true, name: true } },
                    project: { select: { id: true, name: true } },
                    _count: { select: { members: true } },
                },
            }),
            this.prisma.wikiSpace.count({ where }),
        ]);
        const counts = items.length
            ? await this.prisma.wikiPage.groupBy({ by: ['space_id'], where: { ...pageWhere, space_id: { in: items.map((s) => s.id) }, archived_at: null }, _count: { _all: true }, _max: { updated_at: true } })
            : [];
        const byId = new Map(counts.map((c) => [c.space_id, c]));
        return paginate(
            items.map((s) => ({ ...s, page_count: byId.get(s.id)?._count._all ?? 0, last_page_update: byId.get(s.id)?._max.updated_at ?? null })),
            total,
            query,
        );
    }

    async findOne(ctx: OrgContext, idOrSlug: string) {
        const { space, level } = await this.access.readableSpace(ctx, idOrSlug);
        const full = await this.prisma.wikiSpace.findUniqueOrThrow({
            where: { id: space.id },
            include: {
                owner: { select: MEMBER_SELECT },
                team: { select: { id: true, name: true } },
                branch: { select: { id: true, name: true } },
                department: { select: { id: true, name: true } },
                project: { select: { id: true, name: true } },
            },
        });
        return { ...full, members: await this.labelledMembers(full.id), my_level: level };
    }

    async create(ctx: OrgContext, dto: CreateSpaceDto) {
        await this.assertRefs(ctx, dto);
        const { members, ...data } = dto;
        const space = await this.prisma.$transaction(async (tx) => {
            const created = await tx.wikiSpace.create({
                data: {
                    ...data,
                    organization_id: ctx.organization_id,
                    slug: await this.uniqueSlug(ctx, dto.name),
                    owner_membership_id: dto.owner_membership_id ?? ctx.membership_id,
                    created_by_user_id: ctx.user_id,
                },
            });
            const rows = [...(members ?? [])];
            if (ctx.membership_id && !rows.some((m) => (m.principal_type ?? 'MEMBERSHIP') === 'MEMBERSHIP' && m.principal_id === ctx.membership_id)) rows.push({ principal_type: WikiPrincipalType.MEMBERSHIP, principal_id: ctx.membership_id, level: WikiPermissionLevel.MANAGE });
            if (rows.length) {
                await tx.wikiSpaceMember.createMany({
                    data: rows.map((m) => ({ space_id: created.id, principal_type: m.principal_type ?? WikiPrincipalType.MEMBERSHIP, principal_id: m.principal_id, level: m.level ?? WikiPermissionLevel.VIEW, added_by_user_id: ctx.user_id })),
                    skipDuplicates: true,
                });
            }
            await this.audit.record(ctx, 'wiki_space.created', { resource_type: 'wiki_space', resource_id: created.id, metadata: { after: data } }, tx);
            return created;
        });
        this.events.publish(ctx, {
            event_key: 'docs.space.created', module: ModuleKey.BUSINESS_DOCS, entity_type: RecordEntityType.WIKI_SPACE, entity_id: space.id,
            payload: { name: space.name, kind: space.kind, is_private: space.is_private },
            activity: { summary: `created the space ${space.name}`, entity_label: space.name },
        });
        return space;
    }

    async update(ctx: OrgContext, id: string, dto: UpdateSpaceDto) {
        const { space, level } = await this.access.readableSpace(ctx, id);
        this.access.assert(level, 'MANAGE', 'this space');
        await this.assertRefs(ctx, dto);
        const { members: _members, ...data } = dto;
        const updated = await this.prisma.wikiSpace.update({ where: { id: space.id }, data });
        await this.audit.record(ctx, 'wiki_space.updated', {
            resource_type: 'wiki_space', resource_id: space.id,
            metadata: { before: { name: space.name, is_private: space.is_private, default_visibility: space.default_visibility }, after: data },
        });
        this.events.publish(ctx, { event_key: 'docs.space.updated', module: ModuleKey.BUSINESS_DOCS, entity_type: RecordEntityType.WIKI_SPACE, entity_id: space.id, payload: { name: updated.name }, changes: data as Record<string, unknown> });
        return updated;
    }

    async setArchived(ctx: OrgContext, id: string, archived: boolean) {
        const { space, level } = await this.access.readableSpace(ctx, id);
        this.access.assert(level, 'MANAGE', 'this space');
        const updated = await this.prisma.wikiSpace.update({ where: { id: space.id }, data: { archived_at: archived ? new Date() : null } });
        await this.audit.record(ctx, archived ? 'wiki_space.archived' : 'wiki_space.unarchived', { resource_type: 'wiki_space', resource_id: space.id });
        this.events.publish(ctx, { event_key: archived ? 'docs.space.archived' : 'docs.space.unarchived', module: ModuleKey.BUSINESS_DOCS, entity_type: RecordEntityType.WIKI_SPACE, entity_id: space.id, payload: { name: space.name } });
        return updated;
    }

    /** Move a space (and its pages) to trash. Restorable for 30 days. */
    async trash(ctx: OrgContext, id: string) {
        const { space, level } = await this.access.readableSpace(ctx, id);
        this.access.assert(level, 'MANAGE', 'this space');
        const now = new Date();
        await this.prisma.$transaction([
            this.prisma.wikiSpace.update({ where: { id: space.id }, data: { deleted_at: now, deleted_by_membership_id: ctx.membership_id } }),
            this.prisma.wikiPage.updateMany({ where: { space_id: space.id, deleted_at: null }, data: { deleted_at: now, deleted_by_membership_id: ctx.membership_id } }),
        ]);
        await this.audit.record(ctx, 'wiki_space.deleted', { resource_type: 'wiki_space', resource_id: space.id, metadata: { name: space.name } });
        this.events.publish(ctx, { event_key: 'docs.space.deleted', module: ModuleKey.BUSINESS_DOCS, entity_type: RecordEntityType.WIKI_SPACE, entity_id: space.id, payload: { name: space.name } });
        return { success: true };
    }

    async restore(ctx: OrgContext, id: string) {
        const space = await this.prisma.wikiSpace.findFirst({ where: { id, organization_id: ctx.organization_id, deleted_at: { not: null } } });
        if (!space) throw new NotFoundException({ message: 'Space not found in trash', code: 'wiki_space_not_found' });
        await this.prisma.$transaction([
            this.prisma.wikiSpace.update({ where: { id }, data: { deleted_at: null, deleted_by_membership_id: null } }),
            this.prisma.wikiPage.updateMany({ where: { space_id: id, deleted_at: space.deleted_at }, data: { deleted_at: null, deleted_by_membership_id: null } }),
        ]);
        await this.audit.record(ctx, 'wiki_space.restored', { resource_type: 'wiki_space', resource_id: id });
        return { success: true };
    }

    /** Lightweight people / team / branch lookup for docs pickers (space members, grants, assignments, run subjects). */
    async directory(ctx: OrgContext, search?: string) {
        const q = search?.trim();
        const [members, teams, branches] = await Promise.all([
            this.prisma.membership.findMany({
                where: {
                    organization_id: ctx.organization_id,
                    status: 'ACTIVE',
                    ...(q && { user: { OR: [{ email: { contains: q, mode: 'insensitive' } }, { display_name: { contains: q, mode: 'insensitive' } }, { first_name: { contains: q, mode: 'insensitive' } }, { last_name: { contains: q, mode: 'insensitive' } }] } }),
                },
                select: MEMBER_SELECT,
                take: 50,
                orderBy: { joined_at: 'asc' },
            }),
            this.prisma.team.findMany({ where: { organization_id: ctx.organization_id, archived_at: null, ...(q && { name: { contains: q, mode: 'insensitive' } }) }, select: { id: true, name: true, kind: true }, take: 50, orderBy: { name: 'asc' } }),
            this.prisma.branch.findMany({ where: { organization_id: ctx.organization_id, ...(q && { name: { contains: q, mode: 'insensitive' } }) }, select: { id: true, name: true }, take: 50, orderBy: { name: 'asc' } }),
        ]);
        return { members, teams, branches };
    }

    // --- Members & access (members, teams, branches, roles, departments) ------------------------

    private async assertPrincipal(org: string, type: WikiPrincipalType, id: string) {
        const where = { id, organization_id: org };
        if (type === WikiPrincipalType.MEMBERSHIP) return this.prisma.membership.findFirstOrThrow({ where });
        if (type === WikiPrincipalType.TEAM || type === WikiPrincipalType.DEPARTMENT) return this.prisma.team.findFirstOrThrow({ where });
        if (type === WikiPrincipalType.BRANCH) return this.prisma.branch.findFirstOrThrow({ where });
        return this.prisma.role.findFirstOrThrow({ where: { id, OR: [{ organization_id: org }, { organization_id: null }] } });
    }

    /** Access rows of a space with a display label (and the member record for people) per principal. */
    private async labelledMembers(spaceId: string) {
        const rows = await this.prisma.wikiSpaceMember.findMany({ where: { space_id: spaceId }, orderBy: { created_at: 'asc' } });
        const ids = (types: WikiPrincipalType[]) => rows.filter((r) => types.includes(r.principal_type)).map((r) => r.principal_id);
        const [members, teams, branches, roles] = await Promise.all([
            this.prisma.membership.findMany({ where: { id: { in: ids([WikiPrincipalType.MEMBERSHIP]) } }, select: MEMBER_SELECT }),
            this.prisma.team.findMany({ where: { id: { in: ids([WikiPrincipalType.TEAM, WikiPrincipalType.DEPARTMENT]) } }, select: { id: true, name: true, _count: { select: { members: true } } } }),
            this.prisma.branch.findMany({ where: { id: { in: ids([WikiPrincipalType.BRANCH]) } }, select: { id: true, name: true } }),
            this.prisma.role.findMany({ where: { id: { in: ids([WikiPrincipalType.ROLE]) } }, select: { id: true, name: true } }),
        ]);
        return rows.map((r) => {
            const m = members.find((x) => x.id === r.principal_id);
            const t = teams.find((x) => x.id === r.principal_id);
            const label = r.principal_type === WikiPrincipalType.MEMBERSHIP
                ? (m ? ((m as any).user?.display_name ?? [(m as any).user?.first_name, (m as any).user?.last_name].filter(Boolean).join(' ') ?? (m as any).user?.email) : 'Unknown member')
                : t?.name ?? branches.find((x) => x.id === r.principal_id)?.name ?? roles.find((x) => x.id === r.principal_id)?.name ?? 'Unknown';
            return { ...r, principal_label: label || 'Member', membership: m ?? null, member_count: t?._count.members ?? null };
        });
    }

    async listMembers(ctx: OrgContext, id: string) {
        const { space } = await this.access.readableSpace(ctx, id);
        return this.labelledMembers(space.id);
    }

    async upsertMember(ctx: OrgContext, id: string, dto: { principal_type: WikiPrincipalType; principal_id: string; level: WikiPermissionLevel }) {
        const { space, level: mine } = await this.access.readableSpace(ctx, id);
        this.access.assert(mine, 'MANAGE', 'this space');
        try { await this.assertPrincipal(ctx.organization_id, dto.principal_type, dto.principal_id); } catch { throw new NotFoundException({ message: 'Member, team, branch or role not found', code: 'principal_not_found' }); }
        const row = await this.prisma.wikiSpaceMember.upsert({
            where: { space_id_principal_type_principal_id: { space_id: space.id, principal_type: dto.principal_type, principal_id: dto.principal_id } },
            update: { level: dto.level },
            create: { space_id: space.id, principal_type: dto.principal_type, principal_id: dto.principal_id, level: dto.level, added_by_user_id: ctx.user_id },
        });
        await this.audit.record(ctx, 'wiki_space.member_set', { resource_type: 'wiki_space', resource_id: space.id, metadata: { principal_type: dto.principal_type, principal_id: dto.principal_id, level: dto.level } });
        this.events.publish(ctx, { event_key: 'docs.space.member_added', module: ModuleKey.BUSINESS_DOCS, entity_type: RecordEntityType.WIKI_SPACE, entity_id: space.id, payload: { principal_type: dto.principal_type, principal_id: dto.principal_id, level: dto.level } });
        return row;
    }

    async removeMember(ctx: OrgContext, id: string, rowId: string) {
        const { space, level } = await this.access.readableSpace(ctx, id);
        this.access.assert(level, 'MANAGE', 'this space');
        const row = await this.prisma.wikiSpaceMember.findFirst({ where: { id: rowId, space_id: space.id } });
        if (!row) throw new NotFoundException({ message: 'Access entry not found', code: 'wiki_space_member_not_found' });
        await this.prisma.wikiSpaceMember.delete({ where: { id: rowId } });
        await this.audit.record(ctx, 'wiki_space.member_removed', { resource_type: 'wiki_space', resource_id: space.id, metadata: { principal_type: row.principal_type, principal_id: row.principal_id } });
        return { success: true };
    }

    private async assertRefs(ctx: OrgContext, dto: UpdateSpaceDto) {
        const org = ctx.organization_id;
        const checks: Promise<unknown>[] = [];
        if (dto.team_id) checks.push(this.prisma.team.findFirstOrThrow({ where: { id: dto.team_id, organization_id: org } }));
        if (dto.department_id) checks.push(this.prisma.team.findFirstOrThrow({ where: { id: dto.department_id, organization_id: org } }));
        if (dto.branch_id) checks.push(this.prisma.branch.findFirstOrThrow({ where: { id: dto.branch_id, organization_id: org } }));
        if (dto.project_id) checks.push(this.prisma.project.findFirstOrThrow({ where: { id: dto.project_id, organization_id: org } }));
        if (dto.owner_membership_id) checks.push(this.prisma.membership.findFirstOrThrow({ where: { id: dto.owner_membership_id, organization_id: org } }));
        for (const m of dto.members ?? []) checks.push(this.assertPrincipal(org, m.principal_type ?? WikiPrincipalType.MEMBERSHIP, m.principal_id));
        try {
            await Promise.all(checks);
        } catch {
            throw new BadRequestException({ message: 'A referenced team, branch, project or member was not found', code: 'reference_not_found' });
        }
    }

    private async uniqueSlug(ctx: OrgContext, name: string) {
        const base = slugify(name) || 'space';
        let slug = base;
        for (let i = 2; await this.prisma.wikiSpace.findFirst({ where: { organization_id: ctx.organization_id, slug }, select: { id: true } }); i++) slug = `${base}-${i}`;
        return slug;
    }
}
