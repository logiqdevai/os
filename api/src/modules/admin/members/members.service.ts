import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { MembershipStatus, ModuleKey, Prisma, ScopeType } from 'generated/prisma';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import { AuditService } from '@/shared/audit/audit.service';
import { EventsService } from '@/shared/events/events.service';
import { AuthorizationService } from '@/shared/authorization/authorization.service';
import { OrgContext } from '@/shared/authorization/interfaces/org-context.interface';
import { orderBy, paginate, skipTake } from '@/shared/utils/pagination/pagination.utils';
import { AdminAccessService, USER_SELECT } from '../shared/admin-access.service';
import { MfaService } from '../../auth/mfa/mfa.service';
import { AssignRoleDto, MemberBranchDto, OffboardMemberDto, UpdateMemberDto } from './dto/member.dto';
import { MemberQuery } from './dto/member-query.schema';

const READ = 'users.members.read';
const MODULE = ModuleKey.ADMINISTRATION;

const activeWindow = () => {
    const now = new Date();
    return { revoked_at: null, valid_from: { lte: now }, OR: [{ valid_until: null }, { valid_until: { gt: now } }] };
};

/**
 * Members (01 §24, §106–108, §131): list, detail, access (roles with scope + expiry, branches, module access),
 * suspend / reactivate / offboard. Teams are managed through the Teams service.
 */
@Injectable()
export class MembersService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly audit: AuditService,
        private readonly events: EventsService,
        private readonly authorization: AuthorizationService,
        private readonly access: AdminAccessService,
        private readonly mfa: MfaService,
    ) { }

    /** Branch- or team-scoped readers only see members of their branches / teams. */
    private scopeWhere(ctx: OrgContext): Prisma.MembershipWhereInput {
        const scope = ctx.scopeOf(READ);
        if (!scope || scope.organization) return {};
        return {
            OR: [
                { branches: { some: { branch_id: { in: scope.branch_ids }, ended_at: null } } },
                { teams: { some: { team_id: { in: scope.team_ids }, ended_at: null } } },
                ...(ctx.membership_id ? [{ id: ctx.membership_id }] : []),
            ],
        };
    }

    async findAll(ctx: OrgContext, query: MemberQuery) {
        const where: Prisma.MembershipWhereInput = {
            organization_id: ctx.organization_id,
            AND: [
                this.scopeWhere(ctx),
                query.search
                    ? {
                        OR: [
                            { user: { email: { contains: query.search, mode: 'insensitive' } } },
                            { user: { display_name: { contains: query.search, mode: 'insensitive' } } },
                            { user: { first_name: { contains: query.search, mode: 'insensitive' } } },
                            { user: { last_name: { contains: query.search, mode: 'insensitive' } } },
                            { job_title: { contains: query.search, mode: 'insensitive' } },
                        ],
                    }
                    : {},
            ],
            ...(query.status && { status: query.status }),
            ...(query.type && { type: query.type }),
            ...(query.branch_id && { branches: { some: { branch_id: query.branch_id, ended_at: null } } }),
            ...(query.team_id && { teams: { some: { team_id: query.team_id, ended_at: null } } }),
            ...(query.role_id && { role_assignments: { some: { role_id: query.role_id, ...activeWindow() } } }),
        };
        const [items, total] = await Promise.all([
            this.prisma.membership.findMany({
                where,
                ...skipTake(query),
                orderBy: orderBy(query, ['joined_at', 'last_active_at', 'created_at'], 'joined_at'),
                include: {
                    user: { select: { ...USER_SELECT, mfa_enabled: true, last_login_at: true } },
                    branches: { where: { ended_at: null }, select: { is_primary: true, branch: { select: { id: true, name: true } } } },
                    teams: { where: { ended_at: null }, select: { team: { select: { id: true, name: true } } } },
                    role_assignments: { where: activeWindow(), select: { id: true, scope_type: true, role: { select: { id: true, name: true } } } },
                },
            }),
            this.prisma.membership.count({ where }),
        ]);
        return paginate(items, total, query);
    }

    async findOne(ctx: OrgContext, id: string) {
        const member = await this.prisma.membership.findFirst({
            where: { id, organization_id: ctx.organization_id, ...this.scopeWhere(ctx) },
            include: {
                user: { select: { ...USER_SELECT, status: true, mfa_enabled: true, last_login_at: true, timezone: true, locale: true, password_changed_at: true } },
                branches: { where: { ended_at: null }, include: { branch: { select: { id: true, name: true, is_headquarters: true } } }, orderBy: { started_at: 'asc' } },
                teams: { where: { ended_at: null }, include: { team: { select: { id: true, name: true, kind: true } } }, orderBy: { started_at: 'asc' } },
                role_assignments: {
                    where: { revoked_at: null },
                    include: { role: { select: { id: true, name: true, slug: true, type: true, organization_id: true } } },
                    orderBy: { created_at: 'asc' },
                },
                module_access: { orderBy: { module: 'asc' } },
                managed_branches: { include: { branch: { select: { id: true, name: true } } } },
            },
        });
        if (!member) throw new NotFoundException({ message: 'Member not found', code: 'membership_not_found' });
        const [owners, factors] = await Promise.all([
            this.access.ownerMembershipIds(ctx.organization_id),
            // Sign-in methods card: types and dates only, never secrets.
            this.prisma.userAuthMethod.findMany({ where: { user_id: member.user_id, type: { in: ['TOTP', 'RECOVERY_CODES'] } }, select: { type: true, verified_at: true, last_used_at: true, disabled_at: true } }),
        ]);
        const totp = factors.find((f) => f.type === 'TOTP' && f.verified_at && !f.disabled_at);
        const codes = factors.filter((f) => f.type === 'RECOVERY_CODES');
        return {
            ...member,
            is_owner: owners.includes(member.id),
            is_self: member.id === ctx.membership_id,
            mfa_factors: {
                totp: totp ? { verified_at: totp.verified_at, last_used_at: totp.last_used_at } : null,
                recovery_codes: { total: codes.length, remaining: codes.filter((c) => !c.disabled_at).length },
            },
        };
    }

    /** 01-admin member detail "Reset MFA": removes the member's factors so they enrol again (audited, member notified). */
    async resetMfa(ctx: OrgContext, id: string) {
        const member = await this.findOne(ctx, id);
        if (member.is_self) throw new BadRequestException({ message: 'Manage your own two-step verification in Settings → Security', code: 'cannot_reset_own_mfa' });
        if (member.is_owner) {
            const owners = await this.access.ownerMembershipIds(ctx.organization_id);
            if (!ctx.membership_id || !owners.includes(ctx.membership_id)) {
                throw new ForbiddenException({ message: 'Only an owner can reset the two-step verification of an owner', code: 'owner_mfa_reset_forbidden' });
            }
        }
        return this.mfa.adminReset(ctx, member.user_id, id);
    }

    async update(ctx: OrgContext, id: string, dto: UpdateMemberDto) {
        const before = await this.findOne(ctx, id);
        if (dto.default_branch_id) await this.access.assertScope(ctx, ScopeType.BRANCH, dto.default_branch_id);
        if (dto.default_team_id) await this.access.assertScope(ctx, ScopeType.TEAM, dto.default_team_id);
        const member = await this.prisma.membership.update({ where: { id }, data: dto });
        await this.audit.record(ctx, 'membership.updated', {
            resource_type: 'membership', resource_id: id,
            metadata: { before: { job_title: before.job_title, type: before.type, default_branch_id: before.default_branch_id, default_team_id: before.default_team_id }, after: dto },
        });
        this.events.publish(ctx, { event_key: 'users.member.updated', module: MODULE, entity_type: 'MEMBERSHIP', entity_id: id, changes: dto as Record<string, unknown> });
        return member;
    }

    // ---------------------------------------------------------------------------------------------
    // Lifecycle
    // ---------------------------------------------------------------------------------------------

    async suspend(ctx: OrgContext, id: string) {
        const member = await this.findOne(ctx, id);
        if (member.is_self) throw new BadRequestException({ message: 'You cannot suspend yourself', code: 'cannot_suspend_self' });
        if (member.status !== MembershipStatus.ACTIVE) throw new ConflictException({ message: `Member is ${member.status.toLowerCase()}`, code: 'membership_not_active' });
        await this.access.assertNotLastOwner(ctx, id);
        const updated = await this.prisma.membership.update({ where: { id }, data: { status: MembershipStatus.SUSPENDED, suspended_at: new Date() } });
        await this.authorization.invalidate(ctx.organization_id);
        await this.audit.record(ctx, 'membership.suspended', { resource_type: 'membership', resource_id: id, metadata: { user_id: member.user_id } });
        this.events.publish(ctx, { event_key: 'users.member.suspended', module: MODULE, entity_type: 'MEMBERSHIP', entity_id: id, payload: { user_id: member.user_id } });
        return updated;
    }

    async reactivate(ctx: OrgContext, id: string) {
        const member = await this.findOne(ctx, id);
        if (member.status === MembershipStatus.ACTIVE) return member;
        if (member.status === MembershipStatus.INVITED) throw new ConflictException({ message: 'The member has not accepted the invitation yet', code: 'membership_invited' });
        const updated = await this.prisma.membership.update({ where: { id }, data: { status: MembershipStatus.ACTIVE, suspended_at: null, deactivated_at: null } });
        await this.authorization.invalidate(ctx.organization_id);
        await this.audit.record(ctx, 'membership.reactivated', { resource_type: 'membership', resource_id: id, metadata: { from: member.status } });
        this.events.publish(ctx, { event_key: 'users.member.reactivated', module: MODULE, entity_type: 'MEMBERSHIP', entity_id: id });
        return updated;
    }

    /** 01 §131 — ends access everywhere: roles revoked, branches and teams ended, the member's API keys revoked. */
    async offboard(ctx: OrgContext, id: string, dto: OffboardMemberDto) {
        const member = await this.findOne(ctx, id);
        if (member.is_self) throw new BadRequestException({ message: 'You cannot offboard yourself', code: 'cannot_offboard_self' });
        if (member.status === MembershipStatus.DEACTIVATED) throw new ConflictException({ message: 'Member is already offboarded', code: 'membership_deactivated' });
        await this.access.assertNotLastOwner(ctx, id);
        const now = new Date();
        const result = await this.prisma.$transaction(async (tx) => {
            const [roles, branches, teams, keys] = await Promise.all([
                tx.roleAssignment.updateMany({ where: { membership_id: id, revoked_at: null }, data: { revoked_at: now } }),
                tx.membershipBranch.updateMany({ where: { membership_id: id, ended_at: null }, data: { ended_at: now } }),
                tx.teamMembership.updateMany({ where: { membership_id: id, ended_at: null }, data: { ended_at: now } }),
                tx.apiKey.updateMany({ where: { membership_id: id, revoked_at: null }, data: { revoked_at: now } }),
            ]);
            const offboarding = { by_membership_id: ctx.membership_id, at: now.toISOString(), reason: dto.reason ?? null, roles_revoked: roles.count, branches_ended: branches.count, teams_ended: teams.count, api_keys_revoked: keys.count };
            const updated = await tx.membership.update({ where: { id }, data: { status: MembershipStatus.DEACTIVATED, deactivated_at: now, offboarding } });
            await this.audit.record(ctx, 'membership.offboarded', { resource_type: 'membership', resource_id: id, metadata: offboarding }, tx);
            return updated;
        });
        await this.authorization.invalidate(ctx.organization_id);
        this.events.publish(ctx, { event_key: 'users.member.offboarded', module: MODULE, entity_type: 'MEMBERSHIP', entity_id: id, payload: { user_id: member.user_id } });
        return result;
    }

    // ---------------------------------------------------------------------------------------------
    // Role assignments (scope + expiry)
    // ---------------------------------------------------------------------------------------------

    async assignRole(ctx: OrgContext, id: string, dto: AssignRoleDto) {
        const member = await this.findOne(ctx, id);
        if (member.status === MembershipStatus.DEACTIVATED) throw new ConflictException({ message: 'Reactivate the member first', code: 'membership_deactivated' });
        const role = await this.access.assertAssignableRole(ctx, dto.role_id);
        const scope_type = dto.scope_type ?? ScopeType.ORGANIZATION;
        const scope_id = await this.access.assertScope(ctx, scope_type, dto.scope_id);
        if (dto.valid_until && new Date(dto.valid_until) <= new Date()) throw new BadRequestException({ message: 'The end date must be in the future', code: 'invalid_valid_until' });
        const duplicate = await this.prisma.roleAssignment.findFirst({ where: { membership_id: id, role_id: role.id, scope_type, scope_id, ...activeWindow() } });
        if (duplicate) throw new ConflictException({ message: 'The member already has this role in this scope', code: 'role_already_assigned' });

        const assignment = await this.prisma.roleAssignment.create({
            data: { membership_id: id, role_id: role.id, scope_type, scope_id, valid_until: dto.valid_until ? new Date(dto.valid_until) : null, reason: dto.reason, granted_by_user_id: ctx.user_id },
            include: { role: { select: { id: true, name: true } } },
        });
        await this.authorization.invalidate(ctx.organization_id);
        const metadata = { membership_id: id, role_id: role.id, role_name: role.name, scope_type, scope_id, valid_until: dto.valid_until ?? null, reason: dto.reason ?? null };
        const branch_id = scope_type === ScopeType.BRANCH || scope_type === ScopeType.BRANCH_HIERARCHY ? scope_id : null;
        await this.audit.record(ctx, 'membership.role_assigned', { resource_type: 'role_assignment', resource_id: assignment.id, branch_id, metadata });
        if (this.access.isAdminRole(role)) await this.audit.record(ctx, 'membership.admin_promoted', { resource_type: 'role_assignment', resource_id: assignment.id, branch_id, metadata });
        this.events.publish(ctx, { event_key: 'users.role.assigned', module: MODULE, entity_type: 'MEMBERSHIP', entity_id: id, payload: metadata });
        return assignment;
    }

    async removeRole(ctx: OrgContext, id: string, assignmentId: string) {
        await this.findOne(ctx, id);
        const assignment = await this.prisma.roleAssignment.findFirst({
            where: { id: assignmentId, membership_id: id, revoked_at: null },
            include: { role: { include: { permissions: { include: { permission: { select: { key: true } } } } } } },
        });
        if (!assignment) throw new NotFoundException({ message: 'Role assignment not found', code: 'role_assignment_not_found' });
        if (this.access.grantsOwnership(assignment.role)) await this.access.assertNotLastOwner(ctx, id, { assignmentId });
        await this.prisma.roleAssignment.update({ where: { id: assignmentId }, data: { revoked_at: new Date() } });
        await this.authorization.invalidate(ctx.organization_id);
        const metadata = { membership_id: id, role_id: assignment.role_id, role_name: assignment.role.name, scope_type: assignment.scope_type, scope_id: assignment.scope_id };
        await this.audit.record(ctx, 'membership.role_removed', { resource_type: 'role_assignment', resource_id: assignmentId, metadata });
        if (this.access.isAdminRole(assignment.role)) await this.audit.record(ctx, 'membership.admin_removed', { resource_type: 'role_assignment', resource_id: assignmentId, metadata });
        this.events.publish(ctx, { event_key: 'users.role.removed', module: MODULE, entity_type: 'MEMBERSHIP', entity_id: id, payload: metadata });
        return { success: true };
    }

    // ---------------------------------------------------------------------------------------------
    // Branches
    // ---------------------------------------------------------------------------------------------

    async addBranch(ctx: OrgContext, id: string, dto: MemberBranchDto) {
        await this.findOne(ctx, id);
        await this.access.assertScope(ctx, ScopeType.BRANCH, dto.branch_id);
        const row = await this.prisma.$transaction(async (tx) => {
            if (dto.is_primary) await tx.membershipBranch.updateMany({ where: { membership_id: id, is_primary: true }, data: { is_primary: false } });
            return tx.membershipBranch.upsert({
                where: { membership_id_branch_id: { membership_id: id, branch_id: dto.branch_id } },
                update: { ended_at: null, is_primary: dto.is_primary ?? undefined, include_children: dto.include_children ?? undefined },
                create: { membership_id: id, branch_id: dto.branch_id, is_primary: dto.is_primary ?? false, include_children: dto.include_children ?? false },
            });
        });
        await this.authorization.invalidate(ctx.organization_id);
        await this.audit.record(ctx, 'membership.branch_assigned', { resource_type: 'membership_branch', resource_id: row.id, branch_id: dto.branch_id, metadata: { membership_id: id, ...dto } });
        this.events.publish(ctx, { event_key: 'users.member.branch_assigned', module: MODULE, entity_type: 'MEMBERSHIP', entity_id: id, payload: { branch_id: dto.branch_id } });
        return row;
    }

    async removeBranch(ctx: OrgContext, id: string, branchId: string) {
        await this.findOne(ctx, id);
        const res = await this.prisma.membershipBranch.updateMany({ where: { membership_id: id, branch_id: branchId, ended_at: null }, data: { ended_at: new Date(), is_primary: false } });
        if (!res.count) throw new NotFoundException({ message: 'Member is not in this branch', code: 'branch_member_not_found' });
        await this.authorization.invalidate(ctx.organization_id);
        await this.audit.record(ctx, 'membership.branch_removed', { resource_type: 'membership_branch', branch_id: branchId, metadata: { membership_id: id, branch_id: branchId } });
        this.events.publish(ctx, { event_key: 'users.member.branch_removed', module: MODULE, entity_type: 'MEMBERSHIP', entity_id: id, payload: { branch_id: branchId } });
        return { success: true };
    }

    // ---------------------------------------------------------------------------------------------
    // Module access (01 §56–57) — per-member override on top of the organization's enabled modules
    // ---------------------------------------------------------------------------------------------

    async setModuleAccess(ctx: OrgContext, id: string, module: ModuleKey, enabled: boolean) {
        const member = await this.findOne(ctx, id);
        if (module === ModuleKey.ADMINISTRATION && !enabled && member.is_owner) {
            throw new BadRequestException({ message: 'Owners always keep Administration', code: 'owner_needs_admin' });
        }
        const row = await this.prisma.membershipModuleAccess.upsert({
            where: { membership_id_module: { membership_id: id, module } },
            update: { enabled, granted_by_user_id: ctx.user_id },
            create: { membership_id: id, module, enabled, granted_by_user_id: ctx.user_id },
        });
        await this.authorization.invalidate(ctx.organization_id);
        await this.audit.record(ctx, enabled ? 'membership.module_enabled' : 'membership.module_disabled', { resource_type: 'membership_module_access', resource_id: row.id, metadata: { membership_id: id, module } });
        this.events.publish(ctx, { event_key: 'users.member.module_access_changed', module: MODULE, entity_type: 'MEMBERSHIP', entity_id: id, payload: { module, enabled } });
        return row;
    }

    /** Remove the override: the member follows the organization setting again. */
    async resetModuleAccess(ctx: OrgContext, id: string, module: ModuleKey) {
        await this.findOne(ctx, id);
        await this.prisma.membershipModuleAccess.deleteMany({ where: { membership_id: id, module } });
        await this.authorization.invalidate(ctx.organization_id);
        await this.audit.record(ctx, 'membership.module_enabled', { resource_type: 'membership_module_access', metadata: { membership_id: id, module, reset: true } });
        return { success: true };
    }

    // ---------------------------------------------------------------------------------------------
    // Effective permissions (01 §108) — computed by the central authorization service, with sources
    // ---------------------------------------------------------------------------------------------

    async effectivePermissions(ctx: OrgContext, id: string) {
        const member = await this.findOne(ctx, id);
        const target = await this.authorization.contextFor({ organization_id: ctx.organization_id, membership_id: id, channel: 'ui' });
        const grants = await this.prisma.permissionGrant.findMany({
            where: { membership_id: id, ...activeWindow() },
            include: { permission: { select: { key: true } } },
        });
        const assignments = member.role_assignments.filter((a) => !a.valid_until || a.valid_until > new Date());
        const rolePerms = await this.prisma.rolePermission.findMany({
            where: { role_id: { in: assignments.map((a) => a.role_id) } },
            select: { role_id: true, effect: true, permission: { select: { key: true } } },
        });
        const roleName = new Map(assignments.map((a) => [a.role_id, a.role.name]));
        const sources = new Map<string, { kind: 'role' | 'grant'; name: string; effect: string; scope_type: string; scope_id: string | null }[]>();
        const push = (key: string, src: { kind: 'role' | 'grant'; name: string; effect: string; scope_type: string; scope_id: string | null }) => {
            const list = sources.get(key) ?? [];
            list.push(src);
            sources.set(key, list);
        };
        for (const a of assignments) {
            for (const rp of rolePerms.filter((r) => r.role_id === a.role_id)) {
                push(rp.permission.key, { kind: 'role', name: roleName.get(a.role_id) ?? 'Role', effect: rp.effect, scope_type: a.scope_type, scope_id: a.scope_id });
            }
        }
        for (const g of grants) push(g.permission.key, { kind: 'grant', name: 'Direct grant', effect: g.effect, scope_type: g.scope_type, scope_id: g.scope_id });

        const permissions = Object.entries(target.effective.permissions)
            .map(([key, scope]) => ({ key, scope, sources: sources.get(key) ?? [] }))
            .sort((a, b) => a.key.localeCompare(b.key));
        const denied = [...sources.entries()]
            .filter(([key, src]) => !target.effective.permissions[key] && src.some((s) => s.effect === 'DENY'))
            .map(([key, src]) => ({ key, sources: src }));
        return { membership_id: id, status: member.status, modules: target.effective.modules, permissions, denied };
    }
}
