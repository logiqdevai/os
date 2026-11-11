import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ModuleKey, PermissionEffect, Prisma, RoleStatus, RoleType, ScopeType } from 'generated/prisma';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import { AuditService } from '@/shared/audit/audit.service';
import { EventsService } from '@/shared/events/events.service';
import { AuthorizationService } from '@/shared/authorization/authorization.service';
import { OrgContext } from '@/shared/authorization/interfaces/org-context.interface';
import { orderBy, paginate, skipTake } from '@/shared/utils/pagination/pagination.utils';
import { slugify } from '@/modules/auth/services/organization-setup.service';
import { AdminAccessService } from '../shared/admin-access.service';
import { CreateRoleDto, RolePermissionInput, RoleQuery, UpdateRoleDto } from './dto/role.dto';

const MODULE = ModuleKey.ADMINISTRATION;
const CUSTOM_TYPES: RoleType[] = [RoleType.ORGANIZATION, RoleType.BRANCH, RoleType.TEAM, RoleType.PROJECT];

/**
 * Roles (01 §44–45, §109–112). System templates (organization_id null) are read-only and assigned directly;
 * organizations clone them into custom roles. A role starts as DRAFT (grants nothing), publishing snapshots a
 * RoleVersion. Editors can only ALLOW permissions they hold themselves (privilege escalation rule).
 */
@Injectable()
export class RolesService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly audit: AuditService,
        private readonly events: EventsService,
        private readonly authorization: AuthorizationService,
        private readonly access: AdminAccessService,
    ) { }

    /** Active assignments of a role inside this organization (templates are shared across organizations). */
    private assignmentCountWhere(ctx: OrgContext): Prisma.RoleAssignmentWhereInput {
        return {
            revoked_at: null,
            OR: [{ membership: { organization_id: ctx.organization_id } }, { service_account: { organization_id: ctx.organization_id } }],
        };
    }

    async findAll(ctx: OrgContext, query: RoleQuery) {
        const ownership: Prisma.RoleWhereInput =
            query.source === 'templates' ? { organization_id: null } : query.source === 'custom' ? { organization_id: ctx.organization_id } : { OR: [{ organization_id: null }, { organization_id: ctx.organization_id }] };
        const where: Prisma.RoleWhereInput = {
            AND: [ownership, query.search ? { OR: [{ name: { contains: query.search, mode: 'insensitive' } }, { description: { contains: query.search, mode: 'insensitive' } }] } : {}],
            ...(query.type && { type: query.type }),
            ...(query.status && { status: query.status }),
        };
        const [items, total] = await Promise.all([
            this.prisma.role.findMany({
                where,
                ...skipTake(query),
                orderBy: [{ organization_id: { sort: 'asc', nulls: 'first' } }, orderBy(query, ['name', 'created_at', 'updated_at'], 'name')],
                include: { _count: { select: { permissions: true, assignments: { where: this.assignmentCountWhere(ctx) } } } },
            }),
            this.prisma.role.count({ where }),
        ]);
        return paginate(items.map((r) => ({ ...r, is_template: r.organization_id === null })), total, query);
    }

    async findOne(ctx: OrgContext, id: string) {
        const role = await this.prisma.role.findFirst({
            where: { id, OR: [{ organization_id: null }, { organization_id: ctx.organization_id }] },
            include: {
                permissions: { include: { permission: { select: { key: true, module: true, resource: true, action: true, is_sensitive: true, description: true } } } },
                versions: { orderBy: { version: 'desc' }, take: 20, select: { id: true, version: true, note: true, published_at: true, published_by: { select: { id: true, user: { select: { display_name: true, email: true } } } } } },
                _count: { select: { assignments: { where: this.assignmentCountWhere(ctx) } } },
            },
        });
        if (!role) throw new NotFoundException({ message: 'Role not found', code: 'role_not_found' });
        const template = role.template_role_id ? await this.prisma.role.findUnique({ where: { id: role.template_role_id }, select: { id: true, name: true } }) : null;
        return { ...role, is_template: role.organization_id === null, template };
    }

    async create(ctx: OrgContext, dto: CreateRoleDto) {
        let permissions: RolePermissionInput[] = dto.permissions ?? [];
        let template: Awaited<ReturnType<RolesService['findOne']>> | null = null;
        if (dto.template_role_id) {
            template = await this.findOne(ctx, dto.template_role_id);
            if (template.type === RoleType.CUSTOMER_PORTAL) throw new BadRequestException({ message: 'Customer portal roles cannot be cloned here', code: 'role_not_clonable' });
            if (!dto.permissions) permissions = template.permissions.map((p) => ({ key: p.permission.key, effect: p.effect }));
        }
        const type = dto.type ?? (template && CUSTOM_TYPES.includes(template.type) ? template.type : RoleType.ORGANIZATION);
        if (!CUSTOM_TYPES.includes(type)) throw new BadRequestException({ message: 'Custom roles are organization, branch, team or project roles', code: 'invalid_role_type' });
        const resolved = await this.resolvePermissions(ctx, permissions);

        try {
            const role = await this.prisma.$transaction(async (tx) => {
                const created = await tx.role.create({
                    data: {
                        organization_id: ctx.organization_id,
                        name: dto.name,
                        slug: await this.uniqueSlug(tx, ctx, dto.name),
                        description: dto.description ?? template?.description ?? null,
                        type,
                        status: RoleStatus.DRAFT,
                        is_system: false,
                        template_role_id: template?.id ?? null,
                        default_scope: dto.default_scope ?? template?.default_scope ?? ScopeType.ORGANIZATION,
                        modules: dto.modules ?? template?.modules ?? [],
                        version: 0,
                    },
                });
                if (resolved.length) await tx.rolePermission.createMany({ data: resolved.map((p) => ({ role_id: created.id, permission_id: p.permission_id, effect: p.effect })) });
                return created;
            });
            await this.audit.record(ctx, 'role.created', { resource_type: 'role', resource_id: role.id, metadata: { name: role.name, template_role_id: template?.id ?? null, permissions: resolved.length } });
            this.events.publish(ctx, { event_key: 'users.role.created', module: MODULE, entity_kind: 'role', entity_id: role.id, payload: { name: role.name } });
            return this.findOne(ctx, role.id);
        } catch (error) {
            this.rethrowUnique(error);
        }
    }

    async update(ctx: OrgContext, id: string, dto: UpdateRoleDto) {
        const before = await this.ownRole(ctx, id);
        if (before.status === RoleStatus.DEPRECATED) throw new ConflictException({ message: 'Deprecated roles cannot be edited', code: 'role_deprecated' });
        if (dto.type && !CUSTOM_TYPES.includes(dto.type)) throw new BadRequestException({ message: 'Custom roles are organization, branch, team or project roles', code: 'invalid_role_type' });
        const resolved = dto.permissions ? await this.resolvePermissions(ctx, dto.permissions, before.permissions.map((p) => p.permission.key)) : null;
        const { permissions: _ignored, ...fields } = dto;
        try {
            await this.prisma.$transaction(async (tx) => {
                await tx.role.update({ where: { id }, data: fields });
                if (resolved) {
                    await tx.rolePermission.deleteMany({ where: { role_id: id } });
                    if (resolved.length) await tx.rolePermission.createMany({ data: resolved.map((p) => ({ role_id: id, permission_id: p.permission_id, effect: p.effect })) });
                }
            });
        } catch (error) {
            this.rethrowUnique(error);
        }
        // Published roles apply immediately to everyone holding them.
        if (before.status === RoleStatus.PUBLISHED) await this.authorization.invalidate(ctx.organization_id);
        const beforeKeys = before.permissions.map((p) => `${p.effect === 'DENY' ? '!' : ''}${p.permission.key}`);
        const afterKeys = resolved?.map((p) => `${p.effect === 'DENY' ? '!' : ''}${p.key}`);
        await this.audit.record(ctx, 'role.updated', {
            resource_type: 'role', resource_id: id,
            metadata: {
                before: { name: before.name, description: before.description, default_scope: before.default_scope },
                after: fields,
                ...(afterKeys && { added: afterKeys.filter((k) => !beforeKeys.includes(k)), removed: beforeKeys.filter((k) => !afterKeys.includes(k)) }),
            },
        });
        this.events.publish(ctx, { event_key: 'users.role.updated', module: MODULE, entity_kind: 'role', entity_id: id, payload: { name: dto.name ?? before.name } });
        return this.findOne(ctx, id);
    }

    async publish(ctx: OrgContext, id: string, note?: string) {
        const role = await this.ownRole(ctx, id);
        if (role.status === RoleStatus.DEPRECATED) throw new ConflictException({ message: 'Deprecated roles cannot be published', code: 'role_deprecated' });
        const version = (role.version ?? 0) + 1;
        await this.prisma.$transaction(async (tx) => {
            await tx.role.update({ where: { id }, data: { status: RoleStatus.PUBLISHED, version, published_at: new Date() } });
            await tx.roleVersion.create({
                data: {
                    role_id: id,
                    version,
                    name: role.name,
                    description: role.description,
                    default_scope: role.default_scope,
                    modules: role.modules,
                    permissions: role.permissions.map((p) => ({ permission_key: p.permission.key, effect: p.effect, conditions: p.conditions })) as Prisma.InputJsonValue,
                    restrictions: (role.restrictions ?? undefined) as Prisma.InputJsonValue,
                    note: note ?? null,
                    published_by_membership_id: ctx.membership_id,
                },
            });
        });
        await this.authorization.invalidate(ctx.organization_id);
        await this.audit.record(ctx, 'role.published', { resource_type: 'role_version', resource_id: id, metadata: { role_id: id, name: role.name, version, note: note ?? null } });
        this.events.publish(ctx, { event_key: 'users.role.published', module: MODULE, entity_kind: 'role', entity_id: id, payload: { name: role.name, version } });
        return this.findOne(ctx, id);
    }

    async deprecate(ctx: OrgContext, id: string) {
        const role = await this.ownRole(ctx, id);
        if (role.status === RoleStatus.DEPRECATED) return this.findOne(ctx, id);
        await this.prisma.role.update({ where: { id }, data: { status: RoleStatus.DEPRECATED } });
        await this.authorization.invalidate(ctx.organization_id);
        await this.audit.record(ctx, 'role.deprecated', { resource_type: 'role', resource_id: id, metadata: { name: role.name } });
        this.events.publish(ctx, { event_key: 'users.role.deprecated', module: MODULE, entity_kind: 'role', entity_id: id, payload: { name: role.name } });
        return this.findOne(ctx, id);
    }

    /** Organization-owned role (templates are read-only). */
    private async ownRole(ctx: OrgContext, id: string) {
        const role = await this.prisma.role.findFirst({
            where: { id, OR: [{ organization_id: null }, { organization_id: ctx.organization_id }] },
            include: { permissions: { include: { permission: { select: { key: true } } } } },
        });
        if (!role) throw new NotFoundException({ message: 'Role not found', code: 'role_not_found' });
        if (role.organization_id === null) throw new ForbiddenException({ message: 'System role templates are read-only. Clone the template to change it.', code: 'role_template_read_only' });
        return role;
    }

    /**
     * Map keys to permission ids. New ALLOW keys must be held by the editor; keys already in the role
     * (inherited from a template) may stay even if the editor lacks them.
     */
    private async resolvePermissions(ctx: OrgContext, input: RolePermissionInput[], keep: string[] = []) {
        const byKey = new Map<string, PermissionEffect>();
        for (const p of input) byKey.set(p.key, p.effect ?? PermissionEffect.ALLOW);
        const keys = [...byKey.keys()];
        const rows = await this.prisma.permission.findMany({ where: { key: { in: keys } }, select: { id: true, key: true } });
        const unknown = keys.filter((k) => !rows.some((r) => r.key === k));
        if (unknown.length) throw new BadRequestException({ message: `Unknown permission keys: ${unknown.slice(0, 5).join(', ')}`, code: 'unknown_permission' });
        this.access.assertHoldsAll(ctx, keys.filter((k) => byKey.get(k) === PermissionEffect.ALLOW && !keep.includes(k)));
        return rows.map((r) => ({ permission_id: r.id, key: r.key, effect: byKey.get(r.key) as PermissionEffect }));
    }

    private async uniqueSlug(tx: Prisma.TransactionClient, ctx: OrgContext, name: string) {
        const base = slugify(name) || 'role';
        let slug = base;
        for (let i = 2; await tx.role.findFirst({ where: { organization_id: ctx.organization_id, slug }, select: { id: true } }); i++) slug = `${base}-${i}`;
        return slug;
    }

    private rethrowUnique(error: unknown): never {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
            throw new ConflictException({ message: 'A role with this name already exists', code: 'role_conflict' });
        }
        throw error;
    }
}
