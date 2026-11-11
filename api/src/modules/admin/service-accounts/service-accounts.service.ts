import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { ModuleKey, Prisma, ScopeType, ServiceAccountStatus } from 'generated/prisma';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import { AuditService } from '@/shared/audit/audit.service';
import { EventsService } from '@/shared/events/events.service';
import { AuthorizationService } from '@/shared/authorization/authorization.service';
import { OrgContext } from '@/shared/authorization/interfaces/org-context.interface';
import { orderBy, paginate, skipTake } from '@/shared/utils/pagination/pagination.utils';
import { AdminAccessService, USER_SELECT } from '../shared/admin-access.service';
import { CreateServiceAccountDto, ServiceAccountQuery, ServiceAccountRoleDto, UpdateServiceAccountDto } from './dto/service-account.dto';

const MODULE = ModuleKey.ADMINISTRATION;

/**
 * Service accounts (01 §76): non-human identities for automation, integrations and AI agents. Permissions come
 * only from role assignments; every one has an owner and a purpose. Revoking also revokes its API keys.
 */
@Injectable()
export class ServiceAccountsService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly audit: AuditService,
        private readonly events: EventsService,
        private readonly authorization: AuthorizationService,
        private readonly access: AdminAccessService,
    ) { }

    async findAll(ctx: OrgContext, query: ServiceAccountQuery) {
        const where: Prisma.ServiceAccountWhereInput = {
            organization_id: ctx.organization_id,
            ...(query.status && { status: query.status }),
            ...(query.search && { OR: [{ name: { contains: query.search, mode: 'insensitive' } }, { purpose: { contains: query.search, mode: 'insensitive' } }] }),
        };
        const [items, total] = await Promise.all([
            this.prisma.serviceAccount.findMany({
                where,
                ...skipTake(query),
                orderBy: orderBy(query, ['name', 'created_at'], 'created_at'),
                include: {
                    owner: { select: { id: true, user: { select: USER_SELECT } } },
                    role_assignments: { where: { revoked_at: null }, select: { id: true, scope_type: true, role: { select: { id: true, name: true } } } },
                    _count: { select: { api_keys: { where: { revoked_at: null } } } },
                },
            }),
            this.prisma.serviceAccount.count({ where }),
        ]);
        return paginate(items, total, query);
    }

    async findOne(ctx: OrgContext, id: string) {
        const sa = await this.prisma.serviceAccount.findFirst({
            where: { id, organization_id: ctx.organization_id },
            include: {
                owner: { select: { id: true, user: { select: USER_SELECT } } },
                role_assignments: { where: { revoked_at: null }, include: { role: { select: { id: true, name: true, type: true } } }, orderBy: { created_at: 'asc' } },
                api_keys: { orderBy: { created_at: 'desc' }, select: { id: true, name: true, key_prefix: true, scopes: true, expires_at: true, last_used_at: true, revoked_at: true, created_at: true } },
            },
        });
        if (!sa) throw new NotFoundException({ message: 'Service account not found', code: 'service_account_not_found' });
        const effective = await this.authorization.effectiveFor({ organization_id: ctx.organization_id, service_account_id: id });
        return { ...sa, permission_count: Object.keys(effective.permissions).length };
    }

    async create(ctx: OrgContext, dto: CreateServiceAccountDto) {
        const owner_membership_id = dto.owner_membership_id ?? ctx.membership_id;
        if (dto.owner_membership_id) await this.access.findMembership(ctx, dto.owner_membership_id);
        if (dto.expires_at && new Date(dto.expires_at) <= new Date()) throw new BadRequestException({ message: 'The expiry must be in the future', code: 'invalid_expiry' });
        const role = dto.role_id ? await this.access.assertAssignableRole(ctx, dto.role_id) : null;
        const scope_type = dto.scope_type ?? ScopeType.ORGANIZATION;
        const scope_id = role ? await this.access.assertScope(ctx, scope_type, dto.scope_id) : null;
        try {
            const sa = await this.prisma.$transaction(async (tx) => {
                const created = await tx.serviceAccount.create({
                    data: { organization_id: ctx.organization_id, name: dto.name, purpose: dto.purpose ?? null, owner_membership_id, expires_at: dto.expires_at ? new Date(dto.expires_at) : null },
                });
                if (role) await tx.roleAssignment.create({ data: { service_account_id: created.id, role_id: role.id, scope_type, scope_id, granted_by_user_id: ctx.user_id } });
                return created;
            });
            await this.authorization.invalidate(ctx.organization_id);
            await this.audit.record(ctx, 'service_account.created', { resource_type: 'service_account', resource_id: sa.id, metadata: { name: sa.name, purpose: sa.purpose, role_id: role?.id ?? null } });
            this.events.publish(ctx, { event_key: 'organizations.service_account.created', module: MODULE, entity_kind: 'service_account', entity_id: sa.id, payload: { name: sa.name } });
            return this.findOne(ctx, sa.id);
        } catch (error) {
            this.rethrowUnique(error);
        }
    }

    async update(ctx: OrgContext, id: string, dto: UpdateServiceAccountDto) {
        const before = await this.findOne(ctx, id);
        if (dto.owner_membership_id) await this.access.findMembership(ctx, dto.owner_membership_id);
        try {
            await this.prisma.serviceAccount.update({ where: { id }, data: { ...dto, ...(dto.expires_at !== undefined && { expires_at: dto.expires_at ? new Date(dto.expires_at) : null }) } });
        } catch (error) {
            this.rethrowUnique(error);
        }
        await this.authorization.invalidate(ctx.organization_id);
        await this.audit.record(ctx, 'service_account.updated', { resource_type: 'service_account', resource_id: id, metadata: { before: { name: before.name, purpose: before.purpose, expires_at: before.expires_at }, after: dto } });
        return this.findOne(ctx, id);
    }

    async setStatus(ctx: OrgContext, id: string, status: ServiceAccountStatus) {
        const sa = await this.findOne(ctx, id);
        if (sa.status === ServiceAccountStatus.REVOKED) throw new ConflictException({ message: 'Revoked service accounts cannot be changed', code: 'service_account_revoked' });
        if (sa.status === status) return sa;
        await this.prisma.$transaction(async (tx) => {
            await tx.serviceAccount.update({ where: { id }, data: { status } });
            if (status === ServiceAccountStatus.REVOKED) await tx.apiKey.updateMany({ where: { service_account_id: id, revoked_at: null }, data: { revoked_at: new Date() } });
        });
        await this.authorization.invalidate(ctx.organization_id);
        const event = status === ServiceAccountStatus.SUSPENDED ? 'service_account.suspended' : status === ServiceAccountStatus.REVOKED ? 'service_account.revoked' : 'service_account.updated';
        await this.audit.record(ctx, event, { resource_type: 'service_account', resource_id: id, metadata: { name: sa.name, from: sa.status, to: status } });
        this.events.publish(ctx, { event_key: `organizations.service_account.${status.toLowerCase()}`, module: MODULE, entity_kind: 'service_account', entity_id: id, payload: { name: sa.name } });
        return this.findOne(ctx, id);
    }

    async assignRole(ctx: OrgContext, id: string, dto: ServiceAccountRoleDto) {
        const sa = await this.findOne(ctx, id);
        if (sa.status === ServiceAccountStatus.REVOKED) throw new ConflictException({ message: 'Revoked service accounts cannot get roles', code: 'service_account_revoked' });
        const role = await this.access.assertAssignableRole(ctx, dto.role_id);
        const scope_type = dto.scope_type ?? ScopeType.ORGANIZATION;
        const scope_id = await this.access.assertScope(ctx, scope_type, dto.scope_id);
        const assignment = await this.prisma.roleAssignment.create({
            data: { service_account_id: id, role_id: role.id, scope_type, scope_id, valid_until: dto.valid_until ? new Date(dto.valid_until) : null, granted_by_user_id: ctx.user_id },
            include: { role: { select: { id: true, name: true } } },
        });
        await this.authorization.invalidate(ctx.organization_id);
        await this.audit.record(ctx, 'membership.role_assigned', { resource_type: 'role_assignment', resource_id: assignment.id, metadata: { service_account_id: id, role_id: role.id, role_name: role.name, scope_type, scope_id } });
        this.events.publish(ctx, { event_key: 'users.role.assigned', module: MODULE, entity_kind: 'service_account', entity_id: id, payload: { role_id: role.id, scope_type, scope_id } });
        return assignment;
    }

    async removeRole(ctx: OrgContext, id: string, assignmentId: string) {
        await this.findOne(ctx, id);
        const res = await this.prisma.roleAssignment.updateMany({ where: { id: assignmentId, service_account_id: id, revoked_at: null }, data: { revoked_at: new Date() } });
        if (!res.count) throw new NotFoundException({ message: 'Role assignment not found', code: 'role_assignment_not_found' });
        await this.authorization.invalidate(ctx.organization_id);
        await this.audit.record(ctx, 'membership.role_removed', { resource_type: 'role_assignment', resource_id: assignmentId, metadata: { service_account_id: id } });
        this.events.publish(ctx, { event_key: 'users.role.removed', module: MODULE, entity_kind: 'service_account', entity_id: id, payload: { assignment_id: assignmentId } });
        return { success: true };
    }

    private rethrowUnique(error: unknown): never {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
            throw new ConflictException({ message: 'A service account with this name already exists', code: 'service_account_conflict' });
        }
        throw error;
    }
}
