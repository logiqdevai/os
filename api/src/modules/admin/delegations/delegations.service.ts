import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { Delegation, DelegationStatus, MembershipStatus, ModuleKey, Prisma, RoleType, ScopeType } from 'generated/prisma';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import { AuditService } from '@/shared/audit/audit.service';
import { EventsService } from '@/shared/events/events.service';
import { AuthorizationService, NON_DELEGABLE_PERMISSIONS } from '@/shared/authorization/authorization.service';
import { OrgContext, PermissionScope } from '@/shared/authorization/interfaces/org-context.interface';
import { paginate, skipTake } from '@/shared/utils/pagination/pagination.utils';
import { AdminAccessService, USER_SELECT } from '../shared/admin-access.service';
import { CreateDelegationInput, DelegationQuery, RevokeDelegationInput } from './dto/delegation.dto';

const MANAGE = 'users.delegations.manage';
const MAX_DAYS = 366;

const PARTY_SELECT = { id: true, job_title: true, user: { select: USER_SELECT } } as const;

/** Live status from the dates (the status column is kept in sync by the job below, for filters and reports). */
export function delegationStatus(d: Pick<Delegation, 'revoked_at' | 'starts_at' | 'ends_at'>, now = new Date()): DelegationStatus {
    if (d.revoked_at) return DelegationStatus.REVOKED;
    if (d.starts_at > now) return DelegationStatus.SCHEDULED;
    if (d.ends_at <= now) return DelegationStatus.EXPIRED;
    return DelegationStatus.ACTIVE;
}

/**
 * Temporary delegation of selected responsibilities (01 §94, mockup 01-admin `delegations` / `delegationNew`).
 * AuthorizationService honours live delegations (see `delegatedSources`); this service validates them so a delegation can
 * never widen power (01 §63 rule 5): only keys the delegator holds through their OWN roles / grants, never Owner-only
 * keys or delegation management, never a scope wider than the delegator's.
 */
@Injectable()
export class DelegationsService {
    private readonly logger = new Logger(DelegationsService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly audit: AuditService,
        private readonly events: EventsService,
        private readonly authorization: AuthorizationService,
        private readonly access: AdminAccessService,
    ) { }

    private orgWide(ctx: OrgContext) {
        return !!ctx.scopeOf(MANAGE)?.organization;
    }

    async findAll(ctx: OrgContext, query: DelegationQuery) {
        const now = new Date();
        const own = !this.orgWide(ctx) || query.mine;
        const statusWhere: Record<DelegationStatus, Prisma.DelegationWhereInput> = {
            ACTIVE: { revoked_at: null, starts_at: { lte: now }, ends_at: { gt: now } },
            SCHEDULED: { revoked_at: null, starts_at: { gt: now } },
            EXPIRED: { revoked_at: null, ends_at: { lte: now } },
            REVOKED: { revoked_at: { not: null } },
        };
        const and: Prisma.DelegationWhereInput[] = [];
        if (own) {
            // Not organization-wide: only delegations the caller gave or received (never `{}` inside OR).
            if (!ctx.membership_id) return paginate([], 0, query);
            and.push({ OR: [{ delegator_membership_id: ctx.membership_id }, { delegate_membership_id: ctx.membership_id }] });
        }
        if (query.membership_id) and.push({ OR: [{ delegator_membership_id: query.membership_id }, { delegate_membership_id: query.membership_id }] });
        if (query.search) {
            and.push({
                OR: [
                    { reason: { contains: query.search, mode: 'insensitive' } },
                    { delegate: { user: { display_name: { contains: query.search, mode: 'insensitive' } } } },
                    { delegator: { user: { display_name: { contains: query.search, mode: 'insensitive' } } } },
                    { permission_keys: { has: query.search } },
                ],
            });
        }
        const where: Prisma.DelegationWhereInput = { organization_id: ctx.organization_id, ...(query.status && statusWhere[query.status]), ...(and.length && { AND: and }) };
        const [rows, total] = await Promise.all([
            this.prisma.delegation.findMany({ where, ...skipTake(query), orderBy: { starts_at: 'desc' }, include: { delegator: { select: PARTY_SELECT }, delegate: { select: PARTY_SELECT } } }),
            this.prisma.delegation.count({ where }),
        ]);
        const roles = await this.roleNames(ctx, rows.flatMap((r) => r.role_ids));
        return paginate(rows.map((r) => this.present(r, roles, now)), total, query);
    }

    async findOne(ctx: OrgContext, id: string) {
        const row = await this.prisma.delegation.findFirst({ where: { id, organization_id: ctx.organization_id }, include: { delegator: { select: PARTY_SELECT }, delegate: { select: PARTY_SELECT } } });
        const mine = row && ctx.membership_id && (row.delegator_membership_id === ctx.membership_id || row.delegate_membership_id === ctx.membership_id);
        if (!row || (!this.orgWide(ctx) && !mine)) throw new NotFoundException({ message: 'Delegation not found', code: 'delegation_not_found' });
        return row;
    }

    async get(ctx: OrgContext, id: string) {
        const row = await this.findOne(ctx, id);
        return this.present(row, await this.roleNames(ctx, row.role_ids));
    }

    async create(ctx: OrgContext, dto: CreateDelegationInput) {
        const delegatorId = dto.delegator_membership_id ?? ctx.membership_id;
        if (!delegatorId) throw new BadRequestException({ message: 'Pick on whose behalf the delegation is made', code: 'delegator_required' });
        const onBehalf = delegatorId !== ctx.membership_id;
        if (onBehalf && !this.orgWide(ctx)) {
            throw new ForbiddenException({ message: 'Only organization-wide delegation managers can delegate on behalf of someone else', code: 'delegation_on_behalf_denied' });
        }
        if (delegatorId === dto.delegate_membership_id) throw new BadRequestException({ message: 'A member cannot delegate to themselves', code: 'delegation_self' });
        const now = new Date();
        if (dto.ends_at <= now) throw new BadRequestException({ message: 'The end must be in the future', code: 'delegation_ended' });
        if (dto.ends_at.getTime() - Math.max(dto.starts_at.getTime(), now.getTime()) > MAX_DAYS * 86400_000) {
            throw new BadRequestException({ message: 'A delegation can last at most one year', code: 'delegation_too_long' });
        }

        const [delegator, delegate] = await Promise.all([this.access.findMembership(ctx, delegatorId), this.access.findMembership(ctx, dto.delegate_membership_id)]);
        if (delegator.status !== MembershipStatus.ACTIVE || delegate.status !== MembershipStatus.ACTIVE) {
            throw new BadRequestException({ message: 'Both members must be active', code: 'membership_not_active' });
        }
        const scope_id = await this.access.assertScope(ctx, dto.scope_type, dto.scope_id);

        // Keys being delegated: explicit keys + every ALLOW key of the delegated roles.
        const roles = dto.role_ids.length
            ? await this.prisma.role.findMany({
                where: { id: { in: dto.role_ids }, OR: [{ organization_id: null }, { organization_id: ctx.organization_id }] },
                include: { permissions: { where: { effect: 'ALLOW' }, include: { permission: { select: { key: true } } } } },
            })
            : [];
        if (roles.length !== new Set(dto.role_ids).size) throw new NotFoundException({ message: 'Role not found', code: 'role_not_found' });
        if (roles.some((r) => r.type === RoleType.CUSTOMER_PORTAL || r.status !== 'PUBLISHED')) {
            throw new BadRequestException({ message: 'Only published internal roles can be delegated', code: 'role_not_delegable' });
        }
        const permission_keys = [...new Set(dto.permission_keys)];
        const known = await this.prisma.permission.findMany({ where: { key: { in: permission_keys } }, select: { key: true } });
        const unknown = permission_keys.filter((k) => !known.some((p) => p.key === k));
        if (unknown.length) throw new BadRequestException({ message: `Unknown permission: ${unknown.join(', ')}`, code: 'unknown_permission' });

        const keys = [...new Set([...permission_keys, ...roles.flatMap((r) => r.permissions.map((p) => p.permission.key))])];
        const forbidden = permission_keys.filter((k) => NON_DELEGABLE_PERMISSIONS.includes(k));
        if (forbidden.length) {
            throw new BadRequestException({ message: `These cannot be delegated: ${forbidden.join(', ')}`, code: 'permission_not_delegable', permissions: forbidden });
        }
        // Role keys that are not delegable are silently skipped by AuthorizationService; explicit ones are rejected above.
        const effectiveKeys = keys.filter((k) => !NON_DELEGABLE_PERMISSIONS.includes(k));

        // The delegator must hold every key through their own access (not through delegations) and cover the scope.
        const base = await this.authorization.baseEffectiveFor({ organization_id: ctx.organization_id, membership_id: delegatorId });
        const missing = effectiveKeys.filter((k) => !base.permissions[k] || !covers(base.permissions[k], dto.scope_type, scope_id));
        if (missing.length) {
            throw new ForbiddenException({
                message: `${onBehalf ? 'The delegator does' : 'You do'} not hold these in that scope: ${missing.slice(0, 5).join(', ')}${missing.length > 5 ? ` and ${missing.length - 5} more` : ''}`,
                code: 'delegation_not_held',
                permissions: missing,
            });
        }
        // An admin acting on behalf of someone also cannot hand out what they do not hold themselves.
        if (onBehalf) this.access.assertHoldsAll(ctx, effectiveKeys);

        const row = await this.prisma.delegation.create({
            data: {
                organization_id: ctx.organization_id,
                delegator_membership_id: delegatorId,
                delegate_membership_id: dto.delegate_membership_id,
                permission_keys,
                role_ids: [...new Set(dto.role_ids)],
                scope_type: dto.scope_type,
                scope_id,
                starts_at: dto.starts_at,
                ends_at: dto.ends_at,
                reason: dto.reason,
                status: dto.starts_at <= now ? DelegationStatus.ACTIVE : DelegationStatus.SCHEDULED,
            },
            include: { delegator: { select: PARTY_SELECT }, delegate: { select: PARTY_SELECT } },
        });
        await this.authorization.invalidate(ctx.organization_id);
        const metadata = {
            delegator_membership_id: delegatorId, delegate_membership_id: dto.delegate_membership_id, permission_keys, role_ids: row.role_ids,
            scope_type: dto.scope_type, scope_id, starts_at: dto.starts_at, ends_at: dto.ends_at, reason: dto.reason, on_behalf: onBehalf,
        };
        const branch_id = dto.scope_type === ScopeType.BRANCH || dto.scope_type === ScopeType.BRANCH_HIERARCHY ? scope_id : null;
        await this.audit.record(ctx, 'delegation.created', { resource_type: 'delegation', resource_id: row.id, branch_id, metadata });
        this.events.publish(ctx, {
            event_key: 'users.delegation.created',
            module: ModuleKey.ADMINISTRATION,
            entity_kind: 'delegation',
            entity_id: row.id,
            payload: {
                ...metadata,
                recipient_membership_ids: [dto.delegate_membership_id],
                notification_title: 'Responsibilities were delegated to you',
                notification_body: `${dto.reason} · until ${dto.ends_at.toISOString().slice(0, 10)}`,
            },
        });
        return this.present(row, await this.roleNames(ctx, row.role_ids));
    }

    async revoke(ctx: OrgContext, id: string, dto: RevokeDelegationInput = {}) {
        const row = await this.findOne(ctx, id);
        if (row.revoked_at) return this.present(row, await this.roleNames(ctx, row.role_ids));
        // The delegator, or an organization-wide manager, may end it. The delegate can also hand it back.
        const allowed = this.orgWide(ctx) || row.delegator_membership_id === ctx.membership_id || row.delegate_membership_id === ctx.membership_id;
        if (!allowed) throw new ForbiddenException({ message: 'You cannot revoke this delegation', code: 'delegation_revoke_denied' });
        const updated = await this.prisma.delegation.update({
            where: { id },
            data: { revoked_at: new Date(), status: DelegationStatus.REVOKED },
            include: { delegator: { select: PARTY_SELECT }, delegate: { select: PARTY_SELECT } },
        });
        await this.authorization.invalidate(ctx.organization_id);
        await this.audit.record(ctx, 'delegation.revoked', { resource_type: 'delegation', resource_id: id, metadata: { delegate_membership_id: row.delegate_membership_id, reason: dto.reason ?? null, was: delegationStatus(row) } });
        this.events.publish(ctx, {
            event_key: 'users.delegation.revoked',
            module: ModuleKey.ADMINISTRATION,
            entity_kind: 'delegation',
            entity_id: id,
            payload: { recipient_membership_ids: [row.delegate_membership_id], notification_title: 'A delegation to you was revoked' },
        });
        return this.present(updated, await this.roleNames(ctx, updated.role_ids));
    }

    /**
     * Keeps Delegation.status in sync with the dates and drops cached permission sets when a delegation starts or ends,
     * so the change takes effect within a minute (AuthorizationService checks the dates itself; the cache is the only lag).
     */
    @Interval('admin-delegations-status', 60_000)
    async syncStatuses() {
        try {
            const now = new Date();
            const starting = { status: DelegationStatus.SCHEDULED, revoked_at: null, starts_at: { lte: now }, ends_at: { gt: now } };
            const ending = { status: { in: [DelegationStatus.SCHEDULED, DelegationStatus.ACTIVE] }, revoked_at: null, ends_at: { lte: now } };
            const touched = await this.prisma.delegation.findMany({ where: { OR: [starting, ending] }, select: { organization_id: true }, distinct: ['organization_id'] });
            if (!touched.length) return;
            await this.prisma.delegation.updateMany({ where: starting, data: { status: DelegationStatus.ACTIVE } });
            await this.prisma.delegation.updateMany({ where: ending, data: { status: DelegationStatus.EXPIRED } });
            for (const t of touched) await this.authorization.invalidate(t.organization_id);
        } catch (error) {
            this.logger.warn(`delegation status sync failed: ${(error as Error).message}`);
        }
    }

    private async roleNames(ctx: OrgContext, ids: string[]) {
        if (!ids.length) return new Map<string, string>();
        const roles = await this.prisma.role.findMany({ where: { id: { in: [...new Set(ids)] }, OR: [{ organization_id: null }, { organization_id: ctx.organization_id }] }, select: { id: true, name: true } });
        return new Map(roles.map((r) => [r.id, r.name]));
    }

    private present<T extends Delegation>(row: T, roles: Map<string, string>, now = new Date()) {
        return { ...row, status: delegationStatus(row, now), roles: row.role_ids.map((id) => ({ id, name: roles.get(id) ?? 'Role' })) };
    }
}

/** Does the delegator's scope for a key cover the delegation's scope? */
function covers(scope: PermissionScope, type: ScopeType, id: string | null): boolean {
    // ORGANIZATION = "everywhere I hold it": AuthorizationService copies the delegator's own scope.
    if (scope.organization || type === ScopeType.ORGANIZATION) return true;
    if (!id) return false;
    if (type === ScopeType.BRANCH || type === ScopeType.BRANCH_HIERARCHY) return scope.branch_ids.includes(id);
    if (type === ScopeType.TEAM) return scope.team_ids.includes(id);
    if (type === ScopeType.PROJECT) return scope.project_ids.includes(id);
    if (type === ScopeType.CUSTOMER) return scope.customer_ids.includes(id);
    return scope.resource_ids.includes(id);
}
