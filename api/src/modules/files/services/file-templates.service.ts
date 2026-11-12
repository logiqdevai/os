import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { DocumentSource, FolderTemplate, ModuleKey, Prisma } from 'generated/prisma';
import { Readable } from 'stream';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import { AuditService } from '@/shared/audit/audit.service';
import { EventsService } from '@/shared/events/events.service';
import { OrgContext } from '@/shared/authorization/interfaces/org-context.interface';
import { paginate, skipTake } from '@/shared/utils/pagination/pagination.utils';
import { StorageService } from '../storage/storage.service';
import { DocumentsService } from './documents.service';
import { FoldersService } from './folders.service';
import {
    ApplyFolderTemplateInput, CreateDocumentTemplateInput, CreateFolderTemplateInput, FolderTemplateNode, GenerateDocumentInput, TemplateQuery, TemplateVariable,
    UpdateDocumentTemplateInput, UpdateFolderTemplateInput,
} from '../dto/templates.dto';

/** Text bodies a template can hold (DOCX / PDF filling needs a renderer and is not offered). */
const TEXT_MIME = /^(text\/|application\/(json|xml|x-yaml|yaml|markdown))/;
const TEXT_EXT = /\.(md|markdown|txt|html?|csv|json|xml|ya?ml)$/i;
const MAX_TEMPLATE_BYTES = 2 * 1024 * 1024;
const PLACEHOLDER = /\{\{\s*([a-zA-Z][\w.]{0,59})\s*(?:\|\s*([^}]*?)\s*)?\}\}/g;

async function streamToBuffer(stream: Readable, max: number) {
    const chunks: Buffer[] = [];
    let size = 0;
    for await (const chunk of stream) {
        const b = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
        size += b.length;
        if (size > max) throw new BadRequestException({ message: 'The template body is too large (max 2 MB)', code: 'template_too_large' });
        chunks.push(b);
    }
    return Buffer.concat(chunks);
}

/** `{{key}}` / `{{key | fallback}}` placeholders found in a body, in order of appearance. */
export function detectPlaceholders(body: string): TemplateVariable[] {
    const seen = new Map<string, TemplateVariable>();
    for (const m of body.matchAll(PLACEHOLDER)) {
        if (seen.has(m[1])) continue;
        const label = m[1].replace(/[._]+/g, ' ').replace(/^./, (c) => c.toUpperCase());
        seen.set(m[1], { key: m[1], label, required: m[2] === undefined, ...(m[2] !== undefined ? { default: m[2] } : {}) });
    }
    return [...seen.values()];
}

/**
 * 17 §4, §7 — folder templates (reusable folder trees applied to a project, customer or the organization) and
 * document templates (a text document with {{placeholders}} that generates new documents). Folders and documents are
 * created through FoldersService / DocumentsService, so permissions, quota, audit and events stay identical.
 */
@Injectable()
export class FileTemplatesService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly audit: AuditService,
        private readonly events: EventsService,
        private readonly folders: FoldersService,
        private readonly documents: DocumentsService,
        private readonly storage: StorageService,
    ) { }

    // ---------------------------------------------------------------------------------------------
    // Folder templates
    // ---------------------------------------------------------------------------------------------

    async listFolderTemplates(ctx: OrgContext, query: TemplateQuery) {
        const where: Prisma.FolderTemplateWhereInput = {
            organization_id: ctx.organization_id,
            archived_at: query.archived ? { not: null } : null,
            ...(query.search && { name: { contains: query.search, mode: 'insensitive' as const } }),
        };
        const [items, total] = await Promise.all([
            this.prisma.folderTemplate.findMany({ where, ...skipTake(query), orderBy: [{ is_default: 'desc' }, { name: 'asc' }], include: { project_type: { select: { id: true, name: true } }, _count: { select: { folders: true } } } }),
            this.prisma.folderTemplate.count({ where }),
        ]);
        return paginate(items.map(({ _count, ...t }) => ({ ...t, folder_count: countNodes(t.structure as unknown as FolderTemplateNode[]), applied_count: _count.folders })), total, query);
    }

    async getFolderTemplate(ctx: OrgContext, id: string) {
        const t = await this.prisma.folderTemplate.findFirst({ where: { id, organization_id: ctx.organization_id } });
        if (!t) throw new NotFoundException({ message: 'Folder template not found', code: 'folder_template_not_found' });
        return t;
    }

    async createFolderTemplate(ctx: OrgContext, dto: CreateFolderTemplateInput) {
        await this.assertProjectType(ctx, dto.project_type_id);
        const t = await this.prisma.folderTemplate.create({
            data: { organization_id: ctx.organization_id, name: dto.name, description: dto.description ?? null, target: dto.target, project_type_id: dto.project_type_id ?? null, structure: dto.structure as unknown as Prisma.InputJsonValue, is_default: dto.is_default ?? false },
        });
        await this.audit.record(ctx, 'folder_template.created', { resource_type: 'folder_template', resource_id: t.id, metadata: { after: { name: t.name, target: t.target, folders: countNodes(dto.structure) } } });
        this.emit(ctx, 'documents.folder_template.created', t.id, { name: t.name });
        return t;
    }

    async updateFolderTemplate(ctx: OrgContext, id: string, dto: UpdateFolderTemplateInput) {
        const before = await this.getFolderTemplate(ctx, id);
        await this.assertProjectType(ctx, dto.project_type_id);
        const t = await this.prisma.folderTemplate.update({
            where: { id },
            data: { ...dto, structure: dto.structure ? (dto.structure as unknown as Prisma.InputJsonValue) : undefined },
        });
        await this.audit.record(ctx, 'folder_template.updated', { resource_type: 'folder_template', resource_id: id, metadata: { before: { name: before.name, target: before.target }, after: { ...dto, structure: dto.structure ? `${countNodes(dto.structure)} folders` : undefined } } });
        return t;
    }

    async setFolderTemplateArchived(ctx: OrgContext, id: string, archived: boolean) {
        await this.getFolderTemplate(ctx, id);
        const t = await this.prisma.folderTemplate.update({ where: { id }, data: { archived_at: archived ? new Date() : null } });
        await this.audit.record(ctx, archived ? 'folder_template.archived' : 'folder_template.restored', { resource_type: 'folder_template', resource_id: id });
        return t;
    }

    /** Create the template's folder tree (depth-first) under `parent_folder_id`, optionally inside a new root folder. */
    async applyFolderTemplate(ctx: OrgContext, id: string, dto: ApplyFolderTemplateInput) {
        const t: FolderTemplate = await this.getFolderTemplate(ctx, id);
        if (t.archived_at) throw new BadRequestException({ message: 'This template is archived', code: 'folder_template_archived' });
        const nodes = t.structure as unknown as FolderTemplateNode[];
        const refs = { project_id: dto.project_id, company_id: dto.company_id };
        const created: { id: string; name: string; parent_folder_id: string | null }[] = [];
        const make = async (name: string, parent: string | undefined, customerVisible?: boolean) => {
            const f = await this.folders.create(ctx, { name, parent_folder_id: parent, ...(customerVisible !== undefined && { customer_visible: customerVisible }), ...(parent ? {} : refs) });
            if (!f) throw new BadRequestException({ message: `Folder ${name} could not be created`, code: 'folder_create_failed' });
            await this.prisma.folder.update({ where: { id: f.id }, data: { template_id: t.id } });
            created.push({ id: f.id, name: f.name, parent_folder_id: f.parent_folder_id });
            return f.id;
        };
        const walk = async (list: FolderTemplateNode[], parent: string | undefined) => {
            for (const n of list) {
                const fid = await make(n.name, parent, n.customer_visible);
                if (n.children?.length) await walk(n.children, fid);
            }
        };
        const root = dto.root_name ? await make(dto.root_name, dto.parent_folder_id) : dto.parent_folder_id;
        await walk(nodes, root);
        await this.audit.record(ctx, 'folder_template.applied', { resource_type: 'folder_template', resource_id: id, metadata: { parent_folder_id: dto.parent_folder_id ?? null, root_folder_id: dto.root_name ? root : null, folders: created.length } });
        this.emit(ctx, 'documents.folder_template.applied', id, { name: t.name, folders: created.length, root_folder_id: root ?? null, project_id: dto.project_id ?? null, company_id: dto.company_id ?? null });
        return { template_id: id, root_folder_id: root ?? null, created };
    }

    // ---------------------------------------------------------------------------------------------
    // Document templates
    // ---------------------------------------------------------------------------------------------

    async listDocumentTemplates(ctx: OrgContext, query: TemplateQuery) {
        const where: Prisma.DocumentTemplateWhereInput = {
            organization_id: ctx.organization_id,
            archived_at: query.archived ? { not: null } : null,
            ...(query.search && { name: { contains: query.search, mode: 'insensitive' as const } }),
        };
        const [items, total] = await Promise.all([
            this.prisma.documentTemplate.findMany({
                where, ...skipTake(query), orderBy: { name: 'asc' },
                include: { category: { select: { id: true, name: true } }, folder: { select: { id: true, name: true } }, source_version: { select: { id: true, document_id: true, filename: true, mimetype: true, version_number: true } } },
            }),
            this.prisma.documentTemplate.count({ where }),
        ]);
        return paginate(items, total, query);
    }

    async getDocumentTemplate(ctx: OrgContext, id: string) {
        const t = await this.prisma.documentTemplate.findFirst({
            where: { id, organization_id: ctx.organization_id },
            include: { category: { select: { id: true, name: true } }, folder: { select: { id: true, name: true } }, source_version: { select: { id: true, document_id: true, filename: true, mimetype: true, version_number: true, storage_key: true } } },
        });
        if (!t) throw new NotFoundException({ message: 'Document template not found', code: 'document_template_not_found' });
        const body = await this.readBody(t.source_version);
        const { storage_key: _key, ...source_version } = t.source_version;
        return { ...t, source_version, body_preview: body.slice(0, 20_000), detected_variables: detectPlaceholders(body) };
    }

    async createDocumentTemplate(ctx: OrgContext, dto: CreateDocumentTemplateInput) {
        const version = await this.textVersionOf(ctx, dto.document_id);
        const body = await this.readBody(version);
        await this.assertRefs(ctx, dto);
        const variables = dto.variables ?? detectPlaceholders(body);
        const t = await this.prisma.documentTemplate.create({
            data: {
                organization_id: ctx.organization_id, name: dto.name, description: dto.description ?? null, category_id: dto.category_id ?? null, folder_id: dto.folder_id ?? null,
                scope: dto.scope, source_version_id: version.id, variables: variables as unknown as Prisma.InputJsonValue, created_by_user_id: ctx.user_id,
            },
        });
        await this.audit.record(ctx, 'document_template.created', { resource_type: 'document_template', resource_id: t.id, metadata: { after: { name: t.name, document_id: dto.document_id, variables: variables.map((v) => v.key) } } });
        this.emit(ctx, 'documents.template.created', t.id, { name: t.name });
        return this.getDocumentTemplate(ctx, t.id);
    }

    async updateDocumentTemplate(ctx: OrgContext, id: string, dto: UpdateDocumentTemplateInput) {
        const before = await this.getDocumentTemplate(ctx, id);
        await this.assertRefs(ctx, dto);
        const { document_id, variables, ...fields } = dto;
        const version = document_id ? await this.textVersionOf(ctx, document_id) : null;
        await this.prisma.documentTemplate.update({
            where: { id },
            data: { ...fields, ...(version && { source_version_id: version.id }), ...(variables && { variables: variables as unknown as Prisma.InputJsonValue }) },
        });
        await this.audit.record(ctx, 'document_template.updated', { resource_type: 'document_template', resource_id: id, metadata: { before: { name: before.name, source_version_id: before.source_version_id }, after: { ...fields, source_version_id: version?.id, variables: variables?.map((v) => v.key) } } });
        return this.getDocumentTemplate(ctx, id);
    }

    async setDocumentTemplateArchived(ctx: OrgContext, id: string, archived: boolean) {
        await this.getDocumentTemplate(ctx, id);
        await this.prisma.documentTemplate.update({ where: { id }, data: { archived_at: archived ? new Date() : null } });
        await this.audit.record(ctx, archived ? 'document_template.archived' : 'document_template.restored', { resource_type: 'document_template', resource_id: id });
        return this.getDocumentTemplate(ctx, id);
    }

    /**
     * Fill the template's {{placeholders}} and store the result as a new document (source GENERATED) through the normal
     * upload path (quota, type policy, folder access, audit `document.uploaded`). Missing required values → 400.
     */
    async generate(ctx: OrgContext, id: string, dto: GenerateDocumentInput) {
        if (!ctx.can('documents.templates.read')) throw new ForbiddenException({ message: 'Generating from a template needs documents.templates.read', code: 'permission_denied', permissions: ['documents.templates.read'] });
        const t = await this.prisma.documentTemplate.findFirst({ where: { id, organization_id: ctx.organization_id }, include: { source_version: true } });
        if (!t) throw new NotFoundException({ message: 'Document template not found', code: 'document_template_not_found' });
        if (t.archived_at) throw new BadRequestException({ message: 'This template is archived', code: 'document_template_archived' });
        const body = await this.readBody(t.source_version);
        const declared = ((t.variables as unknown as TemplateVariable[] | null) ?? detectPlaceholders(body));
        const values: Record<string, string> = {};
        for (const v of declared) {
            const given = dto.values[v.key];
            values[v.key] = given !== undefined && given !== '' ? given : v.default ?? '';
        }
        const missing = declared.filter((v) => v.required && !values[v.key]).map((v) => v.label || v.key);
        if (missing.length) throw new BadRequestException({ message: `Fill in: ${missing.join(', ')}`, code: 'template_values_missing', missing });
        const output = body.replace(PLACEHOLDER, (_all, key: string, fallback?: string) => values[key] ?? dto.values[key] ?? fallback ?? '');

        const ext = (t.source_version.filename.match(/\.[^.]+$/)?.[0] ?? '.txt').toLowerCase();
        const title = dto.title ?? `${t.name} ${new Date().toISOString().slice(0, 10)}`;
        const filename = `${title.replace(/[\\/:*?"<>|]+/g, '-').slice(0, 120)}${ext}`;
        const doc = await this.documents.upload(
            ctx,
            { buffer: Buffer.from(output, 'utf8'), originalname: filename, mimetype: t.source_version.mimetype, size: Buffer.byteLength(output) },
            {
                title,
                folder_id: dto.folder_id ?? t.folder_id ?? undefined,
                category_id: t.category_id ?? undefined,
                project_id: dto.project_id,
                company_id: dto.company_id,
            },
            { source: DocumentSource.GENERATED },
        );
        const documentId = (doc as { id: string }).id;
        await this.prisma.$transaction([
            this.prisma.document.update({ where: { id: documentId }, data: { template_id: t.id } }),
            this.prisma.documentTemplate.update({ where: { id: t.id }, data: { usage_count: { increment: 1 }, last_used_at: new Date() } }),
        ]);
        await this.audit.record(ctx, 'document_template.generated', { resource_type: 'document_template', resource_id: t.id, metadata: { document_id: documentId, variables: Object.keys(values) } });
        this.emit(ctx, 'documents.template.generated', t.id, { name: t.name, document_id: documentId });
        return { document_id: documentId, title, filename };
    }

    // ---------------------------------------------------------------------------------------------
    // Helpers
    // ---------------------------------------------------------------------------------------------

    private async textVersionOf(ctx: OrgContext, documentId: string) {
        const doc = await this.documents.getAccessible(ctx, documentId);
        const version = doc.current_version_id ? await this.prisma.documentVersion.findUnique({ where: { id: doc.current_version_id } }) : null;
        if (!version) throw new BadRequestException({ message: 'The document has no file yet', code: 'template_source_missing' });
        if (!TEXT_MIME.test(version.mimetype) && !TEXT_EXT.test(version.filename)) {
            throw new BadRequestException({ message: 'Templates must be text documents (Markdown, plain text, HTML, CSV or JSON) with {{placeholders}}', code: 'template_source_not_text' });
        }
        if (Number(version.size_bytes) > MAX_TEMPLATE_BYTES) throw new BadRequestException({ message: 'The template body is too large (max 2 MB)', code: 'template_too_large' });
        return version;
    }

    private async readBody(version: { storage_key: string }) {
        return (await streamToBuffer(await this.storage.getStream(version.storage_key), MAX_TEMPLATE_BYTES)).toString('utf8');
    }

    private async assertRefs(ctx: OrgContext, dto: { category_id?: string | null; folder_id?: string | null }) {
        if (dto.category_id && !(await this.prisma.documentCategory.count({ where: { id: dto.category_id, organization_id: ctx.organization_id } }))) {
            throw new BadRequestException({ message: 'Category not found', code: 'category_not_found' });
        }
        if (dto.folder_id) await this.folders.findOne(ctx, dto.folder_id);
    }

    private async assertProjectType(ctx: OrgContext, id: string | null | undefined) {
        if (id && !(await this.prisma.projectType.count({ where: { id, organization_id: ctx.organization_id } }))) {
            throw new BadRequestException({ message: 'Project type not found', code: 'project_type_not_found' });
        }
    }

    private emit(ctx: OrgContext, key: string, id: string, payload: Record<string, unknown>) {
        this.events.publish(ctx, { event_key: key, module: ModuleKey.DOCUMENTS, entity_kind: key.includes('folder_template') ? 'folder_template' : 'document_template', entity_id: id, payload });
    }
}

function countNodes(nodes: FolderTemplateNode[] | null | undefined): number {
    return (nodes ?? []).reduce((n, x) => n + 1 + countNodes(x.children), 0);
}
