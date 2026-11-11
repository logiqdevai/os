import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { MembershipStatus, Prisma, RoleType, ScopeType } from 'generated/prisma';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import { OrgContext } from '@/shared/authorization/interfaces/org-context.interface';

/**
 * Who counts as an owner: holders of the ownership permission at organization scope. We never compare role slugs
 * (roles-and-permissions rule §3); the Owner template is the only one granting this key by default.
 */
export const OWNER_PERMISSION = 'users.members.transfer_ownership';
/** Roles granting any of these keys count as administrator roles (audit `membership.admin_promoted`). */
const ADMIN_KEYS = [OWNER_PERMISSION, 'users.roles.manage', 'users.roles.assign', 'organizations.settings.manage'];

export const USER_SELECT = { id: true, email: true, display_name: true, first_name: true, last_name: true, profile_photo_url: true } as const;

const activeWindow = () => {
    const now = new Date();
    return { revoked_at: null, valid_from: { lte: now }, OR: [{ valid_until: null }, { valid_until: { gt: now } }] };
};

/**
 * Shared guard rails for module 01 admin services: tenant reference checks, privilege-escalation rules
 * ("you cannot hand out what you do not hold", 01 §63) and the last-owner rule.
 */
@Injectable()
export class AdminAccessService {
    constructor(private readonly prisma: PrismaService) { }

    /** Throw 403 unless the caller holds every key they try to hand out (role permissions, grants, API key scopes). */
    assertHoldsAll(ctx: OrgContext, keys: string[]) {
        const missing = [...new Set(keys)].filter((k) => !ctx.can(k));
        if (missing.length) {
            throw new ForbiddenException({
                message: `You cannot grant permissions you do not hold yourself: ${missing.slice(0, 5).join(', ')}${missing.length > 5 ? ` and ${missing.length - 5} more` : ''}`,
                code: 'privilege_escalation',
                permissions: missing,
            });
        }
    }

    /** Role visible to the organization (a template or the organization's own role). */
    async findRole(ctx: OrgContext, roleId: string) {
        const role = await this.prisma.role.findFirst({
            where: { id: roleId, OR: [{ organization_id: null }, { organization_id: ctx.organization_id }] },
            include: { permissions: { include: { permission: { select: { key: true } } } } },
        });
        if (!role) throw new NotFoundException({ message: 'Role not found', code: 'role_not_found' });
        return role;
    }

    /** A role may be assigned to members / service accounts only when published, not a portal role, and not wider than the caller. */
    async assertAssignableRole(ctx: OrgContext, roleId: string) {
        const role = await this.findRole(ctx, roleId);
        if (role.type === RoleType.CUSTOMER_PORTAL) throw new BadRequestException({ message: 'Customer portal roles cannot be assigned to members', code: 'role_not_assignable' });
        if (role.status !== 'PUBLISHED') throw new BadRequestException({ message: 'Only published roles can be assigned', code: 'role_not_published' });
        this.assertHoldsAll(ctx, role.permissions.filter((p) => p.effect === 'ALLOW').map((p) => p.permission.key));
        return role;
    }

    isAdminRole(role: { permissions: { effect: string; permission: { key: string } }[] }) {
        return role.permissions.some((p) => p.effect === 'ALLOW' && ADMIN_KEYS.includes(p.permission.key));
    }

    grantsOwnership(role: { permissions: { effect: string; permission: { key: string } }[] }) {
        return role.permissions.some((p) => p.effect === 'ALLOW' && p.permission.key === OWNER_PERMISSION);
    }

    /** Check that a scope target exists inside the organization. */
    async assertScope(ctx: OrgContext, scopeType: ScopeType, scopeId?: string | null) {
        if (scopeType === ScopeType.ORGANIZATION) return null;
        if (!scopeId) throw new BadRequestException({ message: 'Pick where this applies (scope)', code: 'scope_required' });
        const org = ctx.organization_id;
        let exists: unknown = null;
        switch (scopeType) {
            case ScopeType.BRANCH:
            case ScopeType.BRANCH_HIERARCHY:
                exists = await this.prisma.branch.findFirst({ where: { id: scopeId, organization_id: org }, select: { id: true } });
                break;
            case ScopeType.TEAM:
                exists = await this.prisma.team.findFirst({ where: { id: scopeId, organization_id: org }, select: { id: true } });
                break;
            case ScopeType.PROJECT:
                exists = await this.prisma.project.findFirst({ where: { id: scopeId, organization_id: org }, select: { id: true } });
                break;
            case ScopeType.CUSTOMER:
                exists = await this.prisma.crmCompany.findFirst({ where: { id: scopeId, organization_id: org }, select: { id: true } });
                break;
            case ScopeType.RESOURCE:
                exists = true; // resource ids are owned by many modules; the owning module re-checks on use
                break;
        }
        if (!exists) throw new NotFoundException({ message: 'Scope target not found', code: 'scope_not_found' });
        return scopeId;
    }

    async findMembership(ctx: OrgContext, id: string) {
        const membership = await this.prisma.membership.findFirst({ where: { id, organization_id: ctx.organization_id }, include: { user: { select: USER_SELECT } } });
        if (!membership) throw new NotFoundException({ message: 'Member not found', code: 'membership_not_found' });
        return membership;
    }

    /** Active memberships that hold the ownership permission at organization scope. */
    async ownerMembershipIds(organizationId: string, tx: Prisma.TransactionClient = this.prisma): Promise<string[]> {
        const rows = await tx.roleAssignment.findMany({
            where: {
                ...activeWindow(),
                scope_type: ScopeType.ORGANIZATION,
                membership: { organization_id: organizationId, status: MembershipStatus.ACTIVE },
                role: { status: { not: 'DRAFT' }, permissions: { some: { effect: 'ALLOW', permission: { key: OWNER_PERMISSION } } } },
            },
            select: { id: true, membership_id: true },
        });
        return [...new Set(rows.map((r) => r.membership_id).filter(Boolean) as string[])];
    }

    /** Throw 409 when the change would leave the organization without an active owner. */
    async assertNotLastOwner(ctx: OrgContext, membershipId: string, opts: { assignmentId?: string } = {}) {
        const owners = await this.ownerMembershipIds(ctx.organization_id);
        if (!owners.includes(membershipId)) return;
        if (opts.assignmentId) {
            // Removing one assignment is fine when the member holds ownership through another one.
            const other = await this.prisma.roleAssignment.count({
                where: {
                    ...activeWindow(),
                    id: { not: opts.assignmentId },
                    membership_id: membershipId,
                    scope_type: ScopeType.ORGANIZATION,
                    role: { status: { not: 'DRAFT' }, permissions: { some: { effect: 'ALLOW', permission: { key: OWNER_PERMISSION } } } },
                },
            });
            if (other > 0) return;
        }
        if (owners.length <= 1) {
            throw new ConflictException({ message: 'The organization needs at least one owner. Make someone else an owner first.', code: 'last_owner' });
        }
    }
}
