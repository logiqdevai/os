import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { ModuleKey, Prisma } from 'generated/prisma';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import { AuditService } from '@/shared/audit/audit.service';
import { EventsService } from '@/shared/events/events.service';
import { AuthorizationService } from '@/shared/authorization/authorization.service';
import { OrgContext } from '@/shared/authorization/interfaces/org-context.interface';
import { orderBy, paginate, skipTake } from '@/shared/utils/pagination/pagination.utils';
import { slugify } from '@/modules/auth/services/organization-setup.service';
import { AddTeamMemberDto, CreateTeamDto, UpdateTeamDto } from './dto/create-team.dto';
import { TeamQuery } from './dto/team-query.schema';

const READ = 'organizations.teams.read';

/**
 * REFERENCE MODULE — copy this shape for every feature:
 *  - every method takes the OrgContext and filters by ctx.organization_id (never from the body)
 *  - list queries are narrowed to the caller's scope (branch / team) when the permission is not organization-wide
 *  - every write: transaction where needed → audit (with channel) → event bus publish (automation, notifications, webhooks)
 *  - the REST controller and the MCP tools call these same methods
 */
@Injectable()
export class TeamsService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly audit: AuditService,
        private readonly events: EventsService,
        private readonly authorization: AuthorizationService,
    ) { }

    /** Scope filter: organization-wide sees all; otherwise only teams in the caller's branches or teams. */
    private scopeWhere(ctx: OrgContext): Prisma.TeamWhereInput {
        const scope = ctx.scopeOf(READ);
        if (!scope || scope.organization) return {};
        return { OR: [{ branch_id: { in: scope.branch_ids } }, { id: { in: scope.team_ids } }] };
    }

    async findAll(ctx: OrgContext, query: TeamQuery) {
        const where: Prisma.TeamWhereInput = {
            organization_id: ctx.organization_id,
            ...this.scopeWhere(ctx),
            ...(query.archived ? { archived_at: { not: null } } : { archived_at: null }),
            ...(query.kind && { kind: query.kind }),
            ...(query.branch_id && { branch_id: query.branch_id }),
            ...(query.search && { name: { contains: query.search, mode: 'insensitive' } }),
        };
        const [items, total] = await Promise.all([
            this.prisma.team.findMany({
                where,
                ...skipTake(query),
                orderBy: orderBy(query, ['name', 'created_at'], 'name'),
                include: {
                    branch: { select: { id: true, name: true } },
                    _count: { select: { members: { where: { ended_at: null } } } },
                },
            }),
            this.prisma.team.count({ where }),
        ]);
        return paginate(items, total, query);
    }

    async findOne(ctx: OrgContext, id: string) {
        const team = await this.prisma.team.findFirst({
            where: { id, organization_id: ctx.organization_id, ...this.scopeWhere(ctx) },
            include: {
                branch: { select: { id: true, name: true } },
                parent: { select: { id: true, name: true } },
                members: {
                    where: { ended_at: null },
                    include: { membership: { select: { id: true, job_title: true, user: { select: { id: true, email: true, display_name: true, first_name: true, last_name: true, profile_photo_url: true } } } } },
                    orderBy: { created_at: 'asc' },
                },
            },
        });
        // 404 (not 403) so out-of-scope ids do not leak.
        if (!team) throw new NotFoundException({ message: 'Team not found', code: 'team_not_found' });
        return team;
    }

    async create(ctx: OrgContext, dto: CreateTeamDto) {
        await this.assertRefs(ctx, dto);
        try {
            const team = await this.prisma.team.create({
                data: { ...dto, organization_id: ctx.organization_id, slug: await this.uniqueSlug(ctx, dto.name) },
            });
            await this.audit.record(ctx, 'team.created', { resource_type: 'team', resource_id: team.id, branch_id: team.branch_id, metadata: { after: dto } });
            this.events.publish(ctx, { event_key: 'organizations.team.created', module: ModuleKey.ADMINISTRATION, entity_kind: 'team', entity_id: team.id, payload: { name: team.name } });
            return team;
        } catch (error) {
            this.rethrowUnique(error);
        }
    }

    async update(ctx: OrgContext, id: string, dto: UpdateTeamDto) {
        const before = await this.findOne(ctx, id);
        await this.assertRefs(ctx, dto);
        if (dto.parent_team_id === id) throw new ConflictException({ message: 'A team cannot be its own parent', code: 'team_cycle' });
        try {
            const team = await this.prisma.team.update({ where: { id }, data: dto });
            await this.audit.record(ctx, 'team.updated', {
                resource_type: 'team', resource_id: id, branch_id: team.branch_id,
                metadata: { before: { name: before.name, kind: before.kind, task_key: before.task_key, branch_id: before.branch_id }, after: dto },
            });
            this.events.publish(ctx, { event_key: 'organizations.team.updated', module: ModuleKey.ADMINISTRATION, entity_kind: 'team', entity_id: id, payload: { name: team.name }, changes: dto as Record<string, unknown> });
            return team;
        } catch (error) {
            this.rethrowUnique(error);
        }
    }

    async archive(ctx: OrgContext, id: string) {
        await this.findOne(ctx, id);
        const team = await this.prisma.team.update({ where: { id }, data: { archived_at: new Date() } });
        await this.audit.record(ctx, 'team.archived', { resource_type: 'team', resource_id: id, branch_id: team.branch_id });
        this.events.publish(ctx, { event_key: 'organizations.team.archived', module: ModuleKey.ADMINISTRATION, entity_kind: 'team', entity_id: id, payload: { name: team.name } });
        return team;
    }

    async restore(ctx: OrgContext, id: string) {
        const team = await this.prisma.team.findFirst({ where: { id, organization_id: ctx.organization_id } });
        if (!team) throw new NotFoundException({ message: 'Team not found', code: 'team_not_found' });
        const restored = await this.prisma.team.update({ where: { id }, data: { archived_at: null } });
        await this.audit.record(ctx, 'team.updated', { resource_type: 'team', resource_id: id, metadata: { after: { archived_at: null } } });
        return restored;
    }

    async addMember(ctx: OrgContext, id: string, dto: AddTeamMemberDto) {
        await this.findOne(ctx, id);
        const membership = await this.prisma.membership.findFirst({ where: { id: dto.membership_id, organization_id: ctx.organization_id } });
        if (!membership) throw new NotFoundException({ message: 'Member not found', code: 'membership_not_found' });
        const row = await this.prisma.teamMembership.upsert({
            where: { team_id_membership_id: { team_id: id, membership_id: dto.membership_id } },
            update: { ended_at: null, team_role: dto.team_role },
            create: { team_id: id, membership_id: dto.membership_id, team_role: dto.team_role },
        });
        await this.authorization.invalidate(ctx.organization_id);
        await this.audit.record(ctx, 'membership.team_assigned', { resource_type: 'team', resource_id: id, metadata: { membership_id: dto.membership_id } });
        return row;
    }

    async removeMember(ctx: OrgContext, id: string, membershipId: string) {
        await this.findOne(ctx, id);
        const res = await this.prisma.teamMembership.updateMany({ where: { team_id: id, membership_id: membershipId, ended_at: null }, data: { ended_at: new Date() } });
        if (!res.count) throw new NotFoundException({ message: 'Member is not in this team', code: 'team_member_not_found' });
        await this.authorization.invalidate(ctx.organization_id);
        await this.audit.record(ctx, 'membership.team_removed', { resource_type: 'team', resource_id: id, metadata: { membership_id: membershipId } });
        return { success: true };
    }

    private async assertRefs(ctx: OrgContext, dto: UpdateTeamDto) {
        const checks: Promise<unknown>[] = [];
        if (dto.branch_id) checks.push(this.prisma.branch.findFirstOrThrow({ where: { id: dto.branch_id, organization_id: ctx.organization_id } }));
        if (dto.parent_team_id) checks.push(this.prisma.team.findFirstOrThrow({ where: { id: dto.parent_team_id, organization_id: ctx.organization_id } }));
        try {
            await Promise.all(checks);
        } catch {
            throw new NotFoundException({ message: 'Branch or parent team not found', code: 'reference_not_found' });
        }
    }

    private async uniqueSlug(ctx: OrgContext, name: string) {
        const base = slugify(name);
        let slug = base;
        for (let i = 2; await this.prisma.team.findFirst({ where: { organization_id: ctx.organization_id, slug }, select: { id: true } }); i++) slug = `${base}-${i}`;
        return slug;
    }

    private rethrowUnique(error: unknown): never {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
            throw new ConflictException({ message: 'A team with this task key already exists', code: 'team_conflict' });
        }
        throw error;
    }
}
