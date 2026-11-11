import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { BranchStatus, ModuleKey, Prisma } from 'generated/prisma';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import { AuditService } from '@/shared/audit/audit.service';
import { EventsService } from '@/shared/events/events.service';
import { AuthorizationService } from '@/shared/authorization/authorization.service';
import { OrgContext } from '@/shared/authorization/interfaces/org-context.interface';
import { orderBy, paginate, skipTake } from '@/shared/utils/pagination/pagination.utils';
import { USER_SELECT } from '../shared/admin-access.service';
import { BranchQuery, CreateBranchDto, UpdateBranchDto } from './dto/branch.dto';

const READ = 'organizations.branches.read';
const MODULE = ModuleKey.ADMINISTRATION;

/**
 * Branches (01 §16–23): hierarchy through parent_branch_id with a materialized `path` of ancestor ids
 * (`<root>/<child>/`) and `depth`; at most one headquarters per organization.
 */
@Injectable()
export class BranchesService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly audit: AuditService,
        private readonly events: EventsService,
        private readonly authorization: AuthorizationService,
    ) { }

    private scopeWhere(ctx: OrgContext): Prisma.BranchWhereInput {
        const scope = ctx.scopeOf(READ);
        if (!scope || scope.organization) return {};
        return { id: { in: scope.branch_ids } };
    }

    async findAll(ctx: OrgContext, query: BranchQuery) {
        const where: Prisma.BranchWhereInput = {
            organization_id: ctx.organization_id,
            ...this.scopeWhere(ctx),
            ...(query.archived ? { archived_at: { not: null } } : { archived_at: null }),
            ...(query.status && { status: query.status }),
            ...(query.kind && { kind: query.kind }),
            ...(query.search && { OR: [{ name: { contains: query.search, mode: 'insensitive' } }, { code: { contains: query.search, mode: 'insensitive' } }, { city: { contains: query.search, mode: 'insensitive' } }] }),
        };
        const [items, total] = await Promise.all([
            this.prisma.branch.findMany({
                where,
                ...skipTake(query),
                orderBy: [{ depth: 'asc' }, orderBy(query, ['name', 'created_at'], 'name')],
                include: {
                    parent: { select: { id: true, name: true } },
                    _count: { select: { memberships: { where: { ended_at: null } }, teams: { where: { archived_at: null } }, children: { where: { archived_at: null } } } },
                },
            }),
            this.prisma.branch.count({ where }),
        ]);
        return paginate(items, total, query);
    }

    async findOne(ctx: OrgContext, id: string) {
        const branch = await this.prisma.branch.findFirst({
            where: { id, organization_id: ctx.organization_id, ...this.scopeWhere(ctx) },
            include: {
                parent: { select: { id: true, name: true } },
                children: { where: { archived_at: null }, select: { id: true, name: true, code: true, kind: true, status: true }, orderBy: { name: 'asc' } },
                managers: { include: { membership: { select: { id: true, job_title: true, user: { select: USER_SELECT } } } } },
                memberships: {
                    where: { ended_at: null },
                    take: 100,
                    orderBy: { started_at: 'asc' },
                    include: { membership: { select: { id: true, status: true, job_title: true, user: { select: USER_SELECT } } } },
                },
                teams: { where: { archived_at: null }, select: { id: true, name: true, kind: true }, orderBy: { name: 'asc' } },
                _count: { select: { memberships: { where: { ended_at: null } } } },
            },
        });
        if (!branch) throw new NotFoundException({ message: 'Branch not found', code: 'branch_not_found' });
        return branch;
    }

    async create(ctx: OrgContext, dto: CreateBranchDto) {
        const parent = dto.parent_branch_id ? await this.parentOf(ctx, dto.parent_branch_id) : null;
        try {
            const branch = await this.prisma.$transaction(async (tx) => {
                if (dto.is_headquarters) await tx.branch.updateMany({ where: { organization_id: ctx.organization_id, is_headquarters: true }, data: { is_headquarters: false } });
                return tx.branch.create({
                    data: {
                        ...dto,
                        email: dto.email || null,
                        organization_id: ctx.organization_id,
                        parent_branch_id: parent?.id ?? null,
                        path: parent ? `${parent.path}${parent.id}/` : '',
                        depth: parent ? parent.depth + 1 : 0,
                    },
                });
            });
            await this.authorization.invalidate(ctx.organization_id);
            await this.audit.record(ctx, 'branch.created', { resource_type: 'branch', resource_id: branch.id, branch_id: branch.id, metadata: { after: dto } });
            this.events.publish(ctx, { event_key: 'organizations.branch.created', module: MODULE, entity_kind: 'branch', entity_id: branch.id, payload: { name: branch.name } });
            return branch;
        } catch (error) {
            this.rethrowUnique(error);
        }
    }

    async update(ctx: OrgContext, id: string, dto: UpdateBranchDto) {
        const before = await this.findOne(ctx, id);
        if (before.is_headquarters && dto.is_headquarters === false) {
            throw new BadRequestException({ message: 'Mark another branch as headquarters instead', code: 'headquarters_required' });
        }
        const parentChanged = dto.parent_branch_id !== undefined && dto.parent_branch_id !== before.parent_branch_id;
        let parent: { id: string; path: string; depth: number } | null = null;
        if (parentChanged && dto.parent_branch_id) {
            parent = await this.parentOf(ctx, dto.parent_branch_id);
            if (parent.id === id || parent.path.split('/').includes(id)) {
                throw new BadRequestException({ message: 'A branch cannot sit under itself or one of its children', code: 'branch_cycle' });
            }
        }
        try {
            const branch = await this.prisma.$transaction(async (tx) => {
                if (dto.is_headquarters) await tx.branch.updateMany({ where: { organization_id: ctx.organization_id, is_headquarters: true, id: { not: id } }, data: { is_headquarters: false } });
                const data: Prisma.BranchUncheckedUpdateInput = { ...dto, ...(dto.email !== undefined && { email: dto.email || null }) };
                if (parentChanged) {
                    const path = parent ? `${parent.path}${parent.id}/` : '';
                    const depth = parent ? parent.depth + 1 : 0;
                    Object.assign(data, { parent_branch_id: parent?.id ?? null, path, depth });
                    // Re-root every descendant: replace the old prefix with the new one.
                    const oldPrefix = `${before.path}${id}/`;
                    const newPrefix = `${path}${id}/`;
                    const descendants = await tx.branch.findMany({ where: { organization_id: ctx.organization_id, path: { startsWith: oldPrefix } }, select: { id: true, path: true } });
                    for (const d of descendants) {
                        const nextPath = newPrefix + d.path.slice(oldPrefix.length);
                        await tx.branch.update({ where: { id: d.id }, data: { path: nextPath, depth: nextPath.split('/').filter(Boolean).length } });
                    }
                }
                return tx.branch.update({ where: { id }, data });
            });
            await this.authorization.invalidate(ctx.organization_id);
            await this.audit.record(ctx, 'branch.updated', {
                resource_type: 'branch', resource_id: id, branch_id: id,
                metadata: { before: { name: before.name, code: before.code, kind: before.kind, status: before.status, parent_branch_id: before.parent_branch_id, is_headquarters: before.is_headquarters }, after: dto },
            });
            this.events.publish(ctx, { event_key: 'organizations.branch.updated', module: MODULE, entity_kind: 'branch', entity_id: id, payload: { name: branch.name }, changes: dto as Record<string, unknown> });
            return branch;
        } catch (error) {
            this.rethrowUnique(error);
        }
    }

    async archive(ctx: OrgContext, id: string) {
        const branch = await this.findOne(ctx, id);
        if (branch.is_headquarters) throw new BadRequestException({ message: 'The headquarters cannot be archived. Mark another branch as headquarters first.', code: 'headquarters_archive' });
        if (branch.children.length) throw new ConflictException({ message: 'Move or archive the child branches first', code: 'branch_has_children' });
        const updated = await this.prisma.branch.update({ where: { id }, data: { archived_at: new Date(), status: BranchStatus.ARCHIVED } });
        await this.authorization.invalidate(ctx.organization_id);
        await this.audit.record(ctx, 'branch.archived', { resource_type: 'branch', resource_id: id, branch_id: id, metadata: { name: branch.name } });
        this.events.publish(ctx, { event_key: 'organizations.branch.archived', module: MODULE, entity_kind: 'branch', entity_id: id, payload: { name: branch.name } });
        return updated;
    }

    async restore(ctx: OrgContext, id: string) {
        const branch = await this.prisma.branch.findFirst({ where: { id, organization_id: ctx.organization_id, archived_at: { not: null } } });
        if (!branch) throw new NotFoundException({ message: 'Archived branch not found', code: 'branch_not_found' });
        const restored = await this.prisma.branch.update({ where: { id }, data: { archived_at: null, status: BranchStatus.ACTIVE } });
        await this.authorization.invalidate(ctx.organization_id);
        await this.audit.record(ctx, 'branch.updated', { resource_type: 'branch', resource_id: id, branch_id: id, metadata: { after: { archived_at: null, status: 'ACTIVE' } } });
        return restored;
    }

    private async parentOf(ctx: OrgContext, parentId: string) {
        const parent = await this.prisma.branch.findFirst({ where: { id: parentId, organization_id: ctx.organization_id, archived_at: null }, select: { id: true, path: true, depth: true } });
        if (!parent) throw new NotFoundException({ message: 'Parent branch not found', code: 'parent_branch_not_found' });
        return parent;
    }

    private rethrowUnique(error: unknown): never {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
            throw new ConflictException({ message: 'Another branch already uses this code', code: 'branch_code_taken' });
        }
        throw error;
    }
}
