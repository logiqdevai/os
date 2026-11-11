import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { DocumentScope, ModuleKey, Prisma } from 'generated/prisma';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import { AuditService } from '@/shared/audit/audit.service';
import { EventsService } from '@/shared/events/events.service';
import { OrgContext } from '@/shared/authorization/interfaces/org-context.interface';
import { FileSettingsService } from './file-settings.service';
import { DOC_READ } from './documents.service';
import { CreateFolderDto, FolderTreeQuery, UpdateFolderDto } from '../dto/folders.dto';

/**
 * Folder hierarchy (17 §7). `path` holds the ancestor ids ("/a/b/") and `depth` the level; both are computed here,
 * never sent by the client. Moving or renaming a folder never changes Document ids.
 */
@Injectable()
export class FoldersService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly audit: AuditService,
        private readonly events: EventsService,
        private readonly settings: FileSettingsService,
    ) { }

    /** Folders visible to the caller: organization-wide scope sees all; otherwise folders of their branches/teams/projects/customers. */
    private scopeWhere(ctx: OrgContext): Prisma.FolderWhereInput {
        const and: Prisma.FolderWhereInput[] = [];
        if (!ctx.can('employees.documents.read')) and.push({ NOT: { scope: DocumentScope.EMPLOYEE } });
        const scope = ctx.scopeOf(DOC_READ);
        if (scope && !scope.organization) {
            and.push({
                OR: [
                    { scope: DocumentScope.ORGANIZATION },
                    { branch_id: { in: scope.branch_ids } },
                    { team_id: { in: scope.team_ids } },
                    { project_id: { in: scope.project_ids } },
                    { company_id: { in: scope.customer_ids } },
                ],
            });
        }
        return and.length ? { AND: and } : {};
    }

    private async get(ctx: OrgContext, id: string) {
        const folder = await this.prisma.folder.findFirst({ where: { id, organization_id: ctx.organization_id, deleted_at: null, ...this.scopeWhere(ctx) } });
        if (!folder) throw new NotFoundException({ message: 'Folder not found', code: 'folder_not_found' });
        return folder;
    }

    /** Flat list of every visible folder with document counts; the client builds the tree from parent ids. */
    async tree(ctx: OrgContext, query: FolderTreeQuery) {
        const folders = await this.prisma.folder.findMany({
            where: {
                organization_id: ctx.organization_id,
                deleted_at: null,
                archived_at: null,
                ...this.scopeWhere(ctx),
                ...(query.scope && { scope: query.scope }),
                ...(query.project_id && { project_id: query.project_id }),
                ...(query.company_id && { company_id: query.company_id }),
            },
            orderBy: [{ depth: 'asc' }, { sort_order: 'asc' }, { name: 'asc' }],
            select: {
                id: true, name: true, parent_folder_id: true, path: true, depth: true, scope: true, color: true, is_system: true,
                customer_visible: true, legal_hold: true, project_id: true, company_id: true,
                _count: { select: { documents: { where: { deleted_at: null, status: { not: 'ARCHIVED' } } }, children: { where: { deleted_at: null, archived_at: null } } } },
            },
        });
        return folders;
    }

    async findOne(ctx: OrgContext, id: string) {
        const folder = await this.get(ctx, id);
        const ids = folder.path.split('/').filter(Boolean);
        const [ancestors, children, favorite, hold] = await Promise.all([
            ids.length ? this.prisma.folder.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } }) : Promise.resolve([]),
            this.prisma.folder.findMany({
                where: { parent_folder_id: id, deleted_at: null, archived_at: null, ...this.scopeWhere(ctx) },
                orderBy: [{ sort_order: 'asc' }, { name: 'asc' }],
                select: { id: true, name: true, color: true, legal_hold: true, updated_at: true, _count: { select: { documents: { where: { deleted_at: null } }, children: { where: { deleted_at: null } } } } },
            }),
            ctx.membership_id ? this.prisma.documentFavorite.findFirst({ where: { membership_id: ctx.membership_id, folder_id: id }, select: { id: true } }) : Promise.resolve(null),
            ids.length ? this.prisma.folder.findFirst({ where: { id: { in: ids }, legal_hold: true }, select: { id: true, name: true } }) : Promise.resolve(null),
        ]);
        return {
            ...folder,
            breadcrumbs: [...ids.map((fid) => ancestors.find((a) => a.id === fid)).filter(Boolean), { id: folder.id, name: folder.name }],
            children,
            is_favorite: !!favorite,
            inherited_legal_hold: hold,
        };
    }

    async create(ctx: OrgContext, dto: CreateFolderDto) {
        const parent = dto.parent_folder_id ? await this.get(ctx, dto.parent_folder_id) : null;
        const depth = parent ? parent.depth + 1 : 0;
        const settings = await this.settings.get(ctx.organization_id);
        if (depth >= settings.folder_max_depth) throw new BadRequestException({ message: `Folders can be nested at most ${settings.folder_max_depth} levels deep`, code: 'folder_depth_exceeded' });
        await this.assertRefs(ctx, dto);
        const scope = dto.scope ?? parent?.scope ?? (dto.project_id ? DocumentScope.PROJECT : dto.company_id ? DocumentScope.CUSTOMER : DocumentScope.ORGANIZATION);
        await this.assertNameFree(ctx, parent?.id ?? null, dto.name.trim());
        try {
            const folder = await this.prisma.folder.create({
                data: {
                    organization_id: ctx.organization_id,
                    name: dto.name.trim(),
                    description: dto.description,
                    parent_folder_id: parent?.id ?? null,
                    path: parent ? `${parent.path || '/'}${parent.id}/` : '/',
                    depth,
                    scope,
                    branch_id: dto.branch_id ?? parent?.branch_id ?? null,
                    team_id: dto.team_id ?? parent?.team_id ?? null,
                    project_id: dto.project_id ?? parent?.project_id ?? null,
                    company_id: dto.company_id ?? parent?.company_id ?? null,
                    employee_id: parent?.employee_id ?? null,
                    default_category_id: dto.default_category_id,
                    customer_visible: dto.customer_visible ?? parent?.customer_visible ?? false,
                    portal_upload_allowed: dto.portal_upload_allowed ?? false,
                    color: dto.color,
                    sort_order: dto.sort_order ?? 0,
                    created_by_user_id: ctx.user_id,
                },
            });
            await this.audit.record(ctx, 'folder.created', { resource_type: 'folder', resource_id: folder.id, branch_id: folder.branch_id, metadata: { after: dto } });
            this.events.publish(ctx, { event_key: 'documents.folder.created', module: ModuleKey.DOCUMENTS, entity_kind: 'folder', entity_id: folder.id, payload: { name: folder.name, parent_folder_id: folder.parent_folder_id, scope: folder.scope, project_id: folder.project_id, company_id: folder.company_id } });
            return folder;
        } catch (error) {
            this.rethrowUnique(error);
        }
    }

    async update(ctx: OrgContext, id: string, dto: UpdateFolderDto) {
        const before = await this.get(ctx, id);
        if (before.is_system && dto.name && dto.name !== before.name) throw new ConflictException({ message: 'System folders cannot be renamed', code: 'folder_system' });
        if (dto.name && dto.name.trim() !== before.name) await this.assertNameFree(ctx, before.parent_folder_id, dto.name.trim(), id);
        try {
            const folder = await this.prisma.folder.update({ where: { id }, data: { ...dto, ...(dto.name && { name: dto.name.trim() }) } });
            await this.audit.record(ctx, 'folder.updated', { resource_type: 'folder', resource_id: id, branch_id: folder.branch_id, metadata: { before: { name: before.name, description: before.description, customer_visible: before.customer_visible }, after: dto } });
            this.events.publish(ctx, { event_key: 'documents.folder.updated', module: ModuleKey.DOCUMENTS, entity_kind: 'folder', entity_id: id, payload: { name: folder.name }, changes: dto as Record<string, unknown> });
            return folder;
        } catch (error) {
            this.rethrowUnique(error);
        }
    }

    /** Move a folder (and its subtree) under a new parent; recomputes path and depth of every descendant. */
    async move(ctx: OrgContext, id: string, parentId: string | null) {
        const folder = await this.get(ctx, id);
        if (folder.is_system) throw new ConflictException({ message: 'System folders cannot be moved', code: 'folder_system' });
        const parent = parentId ? await this.get(ctx, parentId) : null;
        const oldPrefix = `${folder.path || '/'}${folder.id}/`;
        if (parent && (parent.id === id || `${parent.path}${parent.id}/`.startsWith(oldPrefix))) {
            throw new ConflictException({ message: 'A folder cannot be moved into itself or one of its subfolders', code: 'folder_cycle' });
        }
        const newPath = parent ? `${parent.path || '/'}${parent.id}/` : '/';
        const newDepth = parent ? parent.depth + 1 : 0;
        const descendants = await this.prisma.folder.findMany({ where: { organization_id: ctx.organization_id, path: { startsWith: oldPrefix } }, select: { id: true, path: true, depth: true } });
        const delta = newDepth - folder.depth;
        const maxDepth = Math.max(newDepth, ...descendants.map((d) => d.depth + delta));
        const settings = await this.settings.get(ctx.organization_id);
        if (maxDepth >= settings.folder_max_depth) throw new BadRequestException({ message: `Folders can be nested at most ${settings.folder_max_depth} levels deep`, code: 'folder_depth_exceeded' });
        const newPrefix = `${newPath}${folder.id}/`;
        try {
            await this.prisma.$transaction([
                this.prisma.folder.update({ where: { id }, data: { parent_folder_id: parent?.id ?? null, path: newPath, depth: newDepth } }),
                ...descendants.map((d) => this.prisma.folder.update({ where: { id: d.id }, data: { path: newPrefix + d.path.slice(oldPrefix.length), depth: d.depth + delta } })),
            ]);
        } catch (error) {
            this.rethrowUnique(error);
        }
        await this.audit.record(ctx, 'folder.moved', { resource_type: 'folder', resource_id: id, branch_id: folder.branch_id, metadata: { before: { parent_folder_id: folder.parent_folder_id }, after: { parent_folder_id: parent?.id ?? null }, descendants: descendants.length } });
        this.events.publish(ctx, { event_key: 'documents.folder.moved', module: ModuleKey.DOCUMENTS, entity_kind: 'folder', entity_id: id, payload: { name: folder.name, from_parent_id: folder.parent_folder_id, to_parent_id: parent?.id ?? null } });
        return this.findOne(ctx, id);
    }

    /** Delete an empty, non-system folder (documents must be moved or deleted first; legal hold blocks). */
    async remove(ctx: OrgContext, id: string) {
        const folder = await this.get(ctx, id);
        if (folder.is_system) throw new ConflictException({ message: 'System folders cannot be deleted', code: 'folder_system' });
        if (folder.legal_hold) throw new ConflictException({ message: 'This folder is under legal hold', code: 'folder_legal_hold' });
        const [docs, children] = await Promise.all([
            this.prisma.document.count({ where: { folder_id: id, deleted_at: null } }),
            this.prisma.folder.count({ where: { parent_folder_id: id, deleted_at: null } }),
        ]);
        if (docs || children) throw new ConflictException({ message: 'Only empty folders can be deleted. Move or delete its contents first.', code: 'folder_not_empty' });
        // Soft-delete; rename so the unique (parent, name) slot is free again.
        await this.prisma.folder.update({ where: { id }, data: { deleted_at: new Date(), name: `${folder.name} (deleted ${folder.id.slice(0, 8)})` } });
        await this.audit.record(ctx, 'folder.deleted', { resource_type: 'folder', resource_id: id, branch_id: folder.branch_id, metadata: { name: folder.name } });
        this.events.publish(ctx, { event_key: 'documents.folder.deleted', module: ModuleKey.DOCUMENTS, entity_kind: 'folder', entity_id: id, payload: { name: folder.name } });
        return { success: true };
    }

    async favorite(ctx: OrgContext, id: string, on: boolean) {
        if (!ctx.membership_id) throw new BadRequestException({ message: 'Favorites belong to a member', code: 'membership_required' });
        await this.get(ctx, id);
        if (on) await this.prisma.documentFavorite.upsert({ where: { membership_id_folder_id: { membership_id: ctx.membership_id, folder_id: id } }, update: {}, create: { membership_id: ctx.membership_id, folder_id: id } });
        else await this.prisma.documentFavorite.deleteMany({ where: { membership_id: ctx.membership_id, folder_id: id } });
        return { is_favorite: on };
    }

    async setLegalHold(ctx: OrgContext, id: string, reason: string) {
        await this.get(ctx, id);
        const folder = await this.prisma.folder.update({ where: { id }, data: { legal_hold: true, legal_hold_reason: reason, legal_hold_set_by_user_id: ctx.user_id, legal_hold_set_at: new Date() } });
        await this.audit.record(ctx, 'folder.legal_hold_set', { resource_type: 'folder', resource_id: id, branch_id: folder.branch_id, metadata: { reason } });
        this.events.publish(ctx, { event_key: 'documents.legal_hold.set', module: ModuleKey.DOCUMENTS, entity_kind: 'folder', entity_id: id, payload: { name: folder.name, reason } });
        return folder;
    }

    async releaseLegalHold(ctx: OrgContext, id: string) {
        const before = await this.get(ctx, id);
        if (!before.legal_hold) throw new ConflictException({ message: 'The folder is not on legal hold', code: 'folder_not_held' });
        const folder = await this.prisma.folder.update({ where: { id }, data: { legal_hold: false, legal_hold_reason: null, legal_hold_set_by_user_id: null, legal_hold_set_at: null } });
        await this.audit.record(ctx, 'folder.legal_hold_released', { resource_type: 'folder', resource_id: id, branch_id: folder.branch_id, metadata: { previous_reason: before.legal_hold_reason } });
        this.events.publish(ctx, { event_key: 'documents.legal_hold.released', module: ModuleKey.DOCUMENTS, entity_kind: 'folder', entity_id: id, payload: { name: folder.name } });
        return folder;
    }

    /** Folders and documents currently on legal hold (retention screen). */
    async holds(ctx: OrgContext) {
        const [folders, documents] = await Promise.all([
            this.prisma.folder.findMany({ where: { organization_id: ctx.organization_id, legal_hold: true, deleted_at: null }, select: { id: true, name: true, legal_hold_reason: true, legal_hold_set_at: true } }),
            this.prisma.document.findMany({ where: { organization_id: ctx.organization_id, legal_hold: true }, select: { id: true, title: true, filename: true, legal_hold_reason: true, legal_hold_set_at: true, deleted_at: true } }),
        ]);
        return { folders, documents: documents.map((d) => ({ ...d, title: d.title ?? d.filename })) };
    }

    private async assertRefs(ctx: OrgContext, dto: CreateFolderDto) {
        const checks: Promise<unknown>[] = [];
        const org = ctx.organization_id;
        if (dto.branch_id) checks.push(this.prisma.branch.findFirstOrThrow({ where: { id: dto.branch_id, organization_id: org } }));
        if (dto.team_id) checks.push(this.prisma.team.findFirstOrThrow({ where: { id: dto.team_id, organization_id: org } }));
        if (dto.project_id) checks.push(this.prisma.project.findFirstOrThrow({ where: { id: dto.project_id, organization_id: org } }));
        if (dto.company_id) checks.push(this.prisma.crmCompany.findFirstOrThrow({ where: { id: dto.company_id, organization_id: org } }));
        if (dto.default_category_id) checks.push(this.prisma.documentCategory.findFirstOrThrow({ where: { id: dto.default_category_id, organization_id: org } }));
        try {
            await Promise.all(checks);
        } catch {
            throw new NotFoundException({ message: 'Branch, team, project, customer or category not found', code: 'reference_not_found' });
        }
    }

    /** The DB unique index ignores NULL parents, so top-level names are checked here (case-insensitive everywhere). */
    private async assertNameFree(ctx: OrgContext, parentId: string | null, name: string, exceptId?: string) {
        const clash = await this.prisma.folder.findFirst({
            where: { organization_id: ctx.organization_id, parent_folder_id: parentId, deleted_at: null, name: { equals: name, mode: 'insensitive' }, ...(exceptId && { id: { not: exceptId } }) },
            select: { id: true },
        });
        if (clash) throw new ConflictException({ message: 'A folder with this name already exists here', code: 'folder_conflict' });
    }

    private rethrowUnique(error: unknown): never {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
            throw new ConflictException({ message: 'A folder with this name already exists here', code: 'folder_conflict' });
        }
        throw error;
    }
}
