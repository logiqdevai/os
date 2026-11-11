import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ModuleKey, Prisma, ScopeType } from 'generated/prisma';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import { AuditService } from '@/shared/audit/audit.service';
import { EventsService } from '@/shared/events/events.service';
import { AuthorizationService } from '@/shared/authorization/authorization.service';
import { OrgContext } from '@/shared/authorization/interfaces/org-context.interface';
import { orderBy, paginate, skipTake } from '@/shared/utils/pagination/pagination.utils';
import { AdminAccessService, OWNER_PERMISSION, USER_SELECT } from '../shared/admin-access.service';
import { CreateGrantDto, GrantQuery, PermissionQuery, SimulateDto } from './dto/permission.dto';

const MODULE = ModuleKey.ADMINISTRATION;

const activeWindow = () => {
    const now = new Date();
    return { revoked_at: null, valid_from: { lte: now }, OR: [{ valid_until: null }, { valid_until: { gt: now } }] };
};

/**
 * Permission catalog (read-only, seeded from code), explicit per-member grants and denies (01 §49, §53),
 * and the "simulate access" explainer built on AuthorizationService.explain (01 §136).
 */
@Injectable()
export class PermissionsService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly audit: AuditService,
        private readonly events: EventsService,
        private readonly authorization: AuthorizationService,
        private readonly access: AdminAccessService,
    ) { }

    async catalog(ctx: OrgContext, query: PermissionQuery) {
        const where: Prisma.PermissionWhereInput = {
            ...(query.module && { module: query.module }),
            ...(query.sensitive !== undefined && { is_sensitive: query.sensitive }),
            ...(query.search && { OR: [{ key: { contains: query.search, mode: 'insensitive' } }, { description: { contains: query.search, mode: 'insensitive' } }] }),
        };
        const [items, total] = await Promise.all([
            this.prisma.permission.findMany({
                where,
                ...skipTake(query),
                orderBy: [{ module: 'asc' }, { key: 'asc' }],
                select: {
                    id: true, key: true, module: true, resource: true, action: true, description: true, is_sensitive: true, is_field_level: true,
                    _count: { select: { roles: { where: { effect: 'ALLOW', role: { OR: [{ organization_id: null }, { organization_id: ctx.organization_id }] } } } } },
                },
            }),
            this.prisma.permission.count({ where }),
        ]);
        return paginate(items.map(({ _count, ...p }) => ({ ...p, roles_using: _count.roles, held: ctx.can(p.key) })), total, query);
    }

    // ---------------------------------------------------------------------------------------------
    // Grants
    // ---------------------------------------------------------------------------------------------

    async grants(ctx: OrgContext, query: GrantQuery) {
        const where: Prisma.PermissionGrantWhereInput = {
            revoked_at: null,
            membership: { organization_id: ctx.organization_id },
            ...(query.membership_id && { membership_id: query.membership_id }),
            ...(query.effect && { effect: query.effect }),
            ...(query.search && { permission: { key: { contains: query.search, mode: 'insensitive' } } }),
        };
        const [items, total] = await Promise.all([
            this.prisma.permissionGrant.findMany({
                where,
                ...skipTake(query),
                orderBy: orderBy(query, ['created_at', 'valid_until'], 'created_at'),
                include: {
                    permission: { select: { key: true, module: true, is_sensitive: true, description: true } },
                    membership: { select: { id: true, user: { select: USER_SELECT } } },
                },
            }),
            this.prisma.permissionGrant.count({ where }),
        ]);
        return paginate(items, total, query);
    }

    async createGrant(ctx: OrgContext, dto: CreateGrantDto) {
        const membership = await this.access.findMembership(ctx, dto.membership_id);
        const permission = await this.prisma.permission.findUnique({ where: { key: dto.permission_key } });
        if (!permission) throw new BadRequestException({ message: 'Unknown permission key', code: 'unknown_permission' });
        if (dto.effect === 'ALLOW') this.access.assertHoldsAll(ctx, [permission.key]);
        if (dto.effect === 'DENY' && permission.key === OWNER_PERMISSION) await this.access.assertNotLastOwner(ctx, membership.id);
        if (dto.effect === 'DENY' && membership.id === ctx.membership_id && ['users.permissions.grant', 'users.roles.assign'].includes(permission.key)) {
            throw new BadRequestException({ message: 'You cannot remove your own ability to manage access', code: 'self_lockout' });
        }
        const scope_type = dto.scope_type ?? ScopeType.ORGANIZATION;
        const scope_id = await this.access.assertScope(ctx, scope_type, dto.scope_id);
        if (dto.valid_until && new Date(dto.valid_until) <= new Date()) throw new BadRequestException({ message: 'The end date must be in the future', code: 'invalid_valid_until' });

        const grant = await this.prisma.permissionGrant.create({
            data: {
                membership_id: membership.id, permission_id: permission.id, effect: dto.effect, scope_type, scope_id,
                valid_until: dto.valid_until ? new Date(dto.valid_until) : null, reason: dto.reason ?? null, granted_by_user_id: ctx.user_id,
            },
            include: { permission: { select: { key: true, module: true, is_sensitive: true, description: true } } },
        });
        await this.authorization.invalidate(ctx.organization_id);
        const metadata = { membership_id: membership.id, permission_key: permission.key, effect: dto.effect, scope_type, scope_id, valid_until: dto.valid_until ?? null, reason: dto.reason ?? null };
        await this.audit.record(ctx, 'membership.permission_granted', { resource_type: 'permission_grant', resource_id: grant.id, branch_id: scope_type === 'BRANCH' ? scope_id : null, metadata });
        this.events.publish(ctx, { event_key: 'users.permission.granted', module: MODULE, entity_type: 'MEMBERSHIP', entity_id: membership.id, payload: metadata });
        return grant;
    }

    async revokeGrant(ctx: OrgContext, id: string) {
        const grant = await this.prisma.permissionGrant.findFirst({
            where: { id, revoked_at: null, membership: { organization_id: ctx.organization_id } },
            include: { permission: { select: { key: true } } },
        });
        if (!grant) throw new NotFoundException({ message: 'Grant not found', code: 'grant_not_found' });
        await this.prisma.permissionGrant.update({ where: { id }, data: { revoked_at: new Date() } });
        await this.authorization.invalidate(ctx.organization_id);
        const metadata = { membership_id: grant.membership_id, permission_key: grant.permission.key, effect: grant.effect, scope_type: grant.scope_type, scope_id: grant.scope_id };
        await this.audit.record(ctx, 'membership.permission_revoked', { resource_type: 'permission_grant', resource_id: id, metadata });
        this.events.publish(ctx, { event_key: 'users.permission.revoked', module: MODULE, entity_type: 'MEMBERSHIP', entity_id: grant.membership_id, payload: metadata });
        return { success: true };
    }

    // ---------------------------------------------------------------------------------------------
    // Simulate (read-only: never changes data)
    // ---------------------------------------------------------------------------------------------

    async simulate(ctx: OrgContext, dto: SimulateDto) {
        const membership = await this.access.findMembership(ctx, dto.membership_id);
        const permission = await this.prisma.permission.findUnique({ where: { key: dto.permission_key }, select: { id: true, key: true, module: true, is_sensitive: true, description: true } });
        if (!permission) throw new BadRequestException({ message: 'Unknown permission key', code: 'unknown_permission' });

        const steps: { check: string; passed: boolean; detail: string }[] = [];
        const active = membership.status === 'ACTIVE';
        steps.push({ check: 'membership_active', passed: active, detail: `Membership is ${membership.status.toLowerCase()}` });

        const [assignments, grants] = await Promise.all([
            this.prisma.roleAssignment.findMany({
                where: { membership_id: membership.id, ...activeWindow(), role: { permissions: { some: { permission_id: permission.id } } } },
                select: {
                    id: true, scope_type: true, scope_id: true, valid_until: true,
                    role: { select: { id: true, name: true, status: true, permissions: { where: { permission_id: permission.id }, select: { effect: true } } } },
                },
            }),
            this.prisma.permissionGrant.findMany({ where: { membership_id: membership.id, permission_id: permission.id, ...activeWindow() }, select: { id: true, effect: true, scope_type: true, scope_id: true, valid_until: true, reason: true } }),
        ]);
        const sources = [
            ...assignments.map((a) => ({ kind: 'role' as const, id: a.id, name: a.role.name, effect: a.role.permissions[0]?.effect ?? 'ALLOW', scope_type: a.scope_type, scope_id: a.scope_id, valid_until: a.valid_until, draft: a.role.status === 'DRAFT' })),
            ...grants.map((g) => ({ kind: 'grant' as const, id: g.id, name: g.reason || 'Direct grant', effect: g.effect, scope_type: g.scope_type, scope_id: g.scope_id, valid_until: g.valid_until, draft: false })),
        ];

        if (!active) return { allowed: false, reason: 'membership_inactive', permission, steps, sources, scope: null, in_scope: null };

        const target = await this.authorization.contextFor({ organization_id: ctx.organization_id, membership_id: membership.id, channel: 'ui' });
        const explained = await this.authorization.explain(target, permission.key);
        const moduleOn = target.effective.modules.includes(permission.module);
        steps.push({ check: 'module_enabled', passed: moduleOn, detail: `${permission.module} is ${moduleOn ? 'enabled' : 'disabled'} for this member` });
        steps.push({ check: 'allow_source', passed: sources.some((s) => s.effect === 'ALLOW' && !s.draft), detail: sources.filter((s) => s.effect === 'ALLOW').length ? `Allowed by ${sources.filter((s) => s.effect === 'ALLOW').map((s) => s.name).join(', ')}` : 'No role or grant allows this permission' });
        const denies = sources.filter((s) => s.effect === 'DENY');
        steps.push({ check: 'no_deny', passed: !denies.length, detail: denies.length ? `Denied by ${denies.map((s) => s.name).join(', ')} (deny wins)` : 'No deny rule' });

        let in_scope: boolean | null = null;
        if (explained.allowed && (dto.branch_id || dto.team_id || dto.project_id)) {
            in_scope = this.authorization.inScope(target, permission.key, { branch_id: dto.branch_id, team_id: dto.team_id, project_id: dto.project_id });
            steps.push({ check: 'record_in_scope', passed: in_scope, detail: in_scope ? 'The record is inside the member\'s scope' : 'The record is outside the member\'s scope' });
        }
        const allowed = explained.allowed && in_scope !== false;
        return {
            allowed,
            reason: explained.allowed ? (in_scope === false ? 'out_of_scope' : 'allowed') : explained.reason,
            permission,
            scope: 'scope' in explained ? explained.scope : null,
            in_scope,
            steps,
            sources,
        };
    }
}
