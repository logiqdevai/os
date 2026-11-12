import { BadRequestException, ConflictException, ForbiddenException, Injectable, Logger, NotFoundException, PayloadTooLargeException } from '@nestjs/common';
import { createHash, randomUUID } from 'crypto';
import { Readable } from 'stream';
import {
    DocumentApprovalStatus,
    DocumentPreviewStatus,
    DocumentScanStatus,
    DocumentScope,
    DocumentSource,
    DocumentStatus,
    DocumentUploadJobStatus,
    DocumentVersionStatus,
    EntitlementEnforcement,
    ModuleKey,
    Prisma,
    RecordEntityType,
} from 'generated/prisma';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import { AuditService } from '@/shared/audit/audit.service';
import { EventsService } from '@/shared/events/events.service';
import { OrgContext } from '@/shared/authorization/interfaces/org-context.interface';
import { ENTITLEMENT_KEYS } from '@/shared/constants/entitlement-keys';
import { orderBy, paginate, skipTake } from '@/shared/utils/pagination/pagination.utils';
import { StorageService } from '../storage/storage.service';
import { FileSettingsService } from './file-settings.service';
import { BulkDocumentsDto, DocumentQuery, UpdateDocumentDto, UploadFields } from '../dto/documents.dto';
import { DownloadTokenPayload, signDownloadToken, verifyDownloadToken } from '../utils/download-token.utils';
import { ALWAYS_BLOCKED_EXTENSIONS, extensionOf, looksExecutable, mimeMatches, previewKindFor, safeFilename, TYPE_GROUP_MIME, typeGroupOf } from '../utils/file-policy.utils';
import { MEMBER_SELECT } from '../utils/serialize.utils';

export const DOC_READ = 'documents.documents.read';
const DOC_CREATE = 'documents.documents.create';
const DOC_UPDATE = 'documents.documents.update';

/** A file as received from multer or passed in by another module. */
export interface IncomingFile {
    buffer: Buffer;
    originalname: string;
    mimetype: string;
    size?: number;
}

/** Input for other modules attaching a generated or received file to one of their records. */
export interface AttachFileInput {
    buffer: Buffer;
    filename: string;
    mimetype: string;
    entity_type: RecordEntityType;
    entity_id: string;
    title?: string;
    folder_id?: string;
    project_id?: string;
    company_id?: string;
    category_id?: string;
    customer_visible?: boolean;
    /** Role of the document on the record (attachment, generated_pdf, signed, receipt …). */
    role?: string;
    source?: DocumentSource;
    source_module?: ModuleKey;
    /**
     * The calling module already authorized this write on its own record (e.g. 12 Messaging: the caller may post in the
     * channel). Skips the documents.documents.create check; size, type, quota, audit and events still apply.
     */
    authorized_by_module?: boolean;
}

const LIST_INCLUDE = (membershipId: string | null) =>
    ({
        current_version: { select: { id: true, version_number: true, status: true, scan_status: true, size_bytes: true, mimetype: true, created_at: true } },
        category: { select: { id: true, name: true, color: true } },
        folder: { select: { id: true, name: true } },
        owner: { select: MEMBER_SELECT },
        favorites: { where: { membership_id: membershipId ?? '00000000-0000-0000-0000-000000000000' }, select: { id: true } },
        _count: { select: { shares: { where: { status: 'ACTIVE' } }, versions: true } },
    }) satisfies Prisma.DocumentInclude;

/**
 * Documents, versions, upload, download, preview, favorites, recent, legal hold, trash and storage usage (17 §2–8, §11, §13).
 * Every read is narrowed to the caller's scope; every write is audited and published on the event bus.
 * Other modules attach files through `upload()` / `attachToEntity()` — never by writing Document rows themselves.
 */
@Injectable()
export class DocumentsService {
    private readonly logger = new Logger(DocumentsService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly audit: AuditService,
        private readonly events: EventsService,
        private readonly storage: StorageService,
        private readonly settings: FileSettingsService,
    ) { }

    // ---------------------------------------------------------------------------------------------
    // Scope
    // ---------------------------------------------------------------------------------------------

    /** Where-clause narrowing documents to what the caller may read (01 §39, §85; 17 §3). */
    scopeWhere(ctx: OrgContext, key = DOC_READ): Prisma.DocumentWhereInput {
        const and: Prisma.DocumentWhereInput[] = [];
        // HR documents need the employee documents key on top (17 §3, 10).
        if (!ctx.can('employees.documents.read')) and.push({ NOT: { scope: DocumentScope.EMPLOYEE } });
        const scope = ctx.scopeOf(key);
        if (!scope) return { id: { in: [] } };
        if (!scope.organization) {
            const or: Prisma.DocumentWhereInput[] = [
                { branch_id: { in: scope.branch_ids } },
                { team_id: { in: scope.team_ids } },
                { project_id: { in: scope.project_ids } },
                { company_id: { in: scope.customer_ids } },
                { id: { in: scope.resource_ids } },
            ];
            if (ctx.membership_id) {
                or.push({ owner_membership_id: ctx.membership_id });
                or.push({ shares: { some: { status: 'ACTIVE', membership_id: ctx.membership_id } } });
            }
            if (scope.team_ids.length) or.push({ shares: { some: { status: 'ACTIVE', team_id: { in: scope.team_ids } } } });
            and.push({ OR: or });
        }
        return and.length ? { AND: and } : {};
    }

    /** Load a document the caller can see (404 otherwise, so ids do not leak). */
    async getAccessible(ctx: OrgContext, id: string, opts: { includeDeleted?: boolean; key?: string } = {}) {
        const doc = await this.prisma.document.findFirst({
            where: { id, organization_id: ctx.organization_id, ...(opts.includeDeleted ? {} : { deleted_at: null }), ...this.scopeWhere(ctx, opts.key ?? DOC_READ) },
            include: { current_version: true, folder: { select: { id: true, path: true, legal_hold: true } } },
        });
        if (!doc) throw new NotFoundException({ message: 'Document not found', code: 'document_not_found' });
        return doc;
    }

    /** Effective legal hold: the document or any folder above it (17 §13). */
    async effectiveHold(doc: { legal_hold: boolean; folder_id: string | null }) {
        if (doc.legal_hold) return { held: true, by: 'document' as const };
        if (!doc.folder_id) return { held: false, by: null };
        const folder = await this.prisma.folder.findUnique({ where: { id: doc.folder_id }, select: { id: true, path: true, legal_hold: true, name: true } });
        if (!folder) return { held: false, by: null };
        if (folder.legal_hold) return { held: true, by: 'folder' as const, folder_id: folder.id, folder_name: folder.name };
        const ancestorIds = folder.path.split('/').filter(Boolean);
        if (!ancestorIds.length) return { held: false, by: null };
        const held = await this.prisma.folder.findFirst({ where: { id: { in: ancestorIds }, legal_hold: true }, select: { id: true, name: true } });
        return held ? { held: true, by: 'folder' as const, folder_id: held.id, folder_name: held.name } : { held: false, by: null };
    }

    // ---------------------------------------------------------------------------------------------
    // Reads
    // ---------------------------------------------------------------------------------------------

    async findAll(ctx: OrgContext, query: DocumentQuery) {
        const and: Prisma.DocumentWhereInput[] = [this.scopeWhere(ctx)];
        if (query.status === DocumentStatus.DELETED) and.push({ deleted_at: { not: null } });
        else {
            and.push({ deleted_at: null });
            and.push(query.status ? { status: query.status } : { status: { not: DocumentStatus.ARCHIVED } });
        }
        if (query.folder_id === 'root') and.push({ folder_id: null });
        else if (query.folder_id && query.recursive) {
            const folder = await this.prisma.folder.findFirst({ where: { id: query.folder_id, organization_id: ctx.organization_id }, select: { id: true, path: true } });
            const prefix = `${folder?.path ?? '/'}${query.folder_id}/`;
            and.push({ OR: [{ folder_id: query.folder_id }, { folder: { path: { startsWith: prefix } } }] });
        } else if (query.folder_id) and.push({ folder_id: query.folder_id });
        if (query.type) and.push({ OR: TYPE_GROUP_MIME[query.type].map((m) => ({ mimetype: { startsWith: m } })) });
        if (query.search) {
            and.push({
                OR: [
                    { title: { contains: query.search, mode: 'insensitive' } },
                    { filename: { contains: query.search, mode: 'insensitive' } },
                    { description: { contains: query.search, mode: 'insensitive' } },
                    { keywords: { has: query.search.toLowerCase() } },
                ],
            });
        }
        if (query.favorites) and.push({ favorites: { some: { membership_id: ctx.membership_id ?? '' } } });
        if (query.legal_hold !== undefined) and.push({ legal_hold: query.legal_hold });

        const where: Prisma.DocumentWhereInput = {
            organization_id: ctx.organization_id,
            AND: and,
            ...(query.scope && { scope: query.scope }),
            ...(query.category_id && { category_id: query.category_id }),
            ...(query.owner_membership_id && { owner_membership_id: query.owner_membership_id }),
            ...(query.project_id && { project_id: query.project_id }),
            ...(query.company_id && { company_id: query.company_id }),
            ...(query.entity_type && query.entity_id && { OR: [{ entity_type: query.entity_type, entity_id: query.entity_id }, { attachments: { some: { entity_type: query.entity_type, entity_id: query.entity_id } } }] }),
        };
        const [items, total] = await Promise.all([
            this.prisma.document.findMany({
                where,
                ...skipTake(query),
                orderBy: orderBy(query, ['title', 'created_at', 'updated_at', 'size', 'deleted_at'], query.status === DocumentStatus.DELETED ? 'deleted_at' : 'updated_at'),
                include: LIST_INCLUDE(ctx.membership_id),
            }),
            this.prisma.document.count({ where }),
        ]);
        return paginate(items.map((d) => this.listRow(d)), total, query);
    }

    private listRow<T extends { favorites?: { id: string }[]; title: string | null; filename: string; mimetype: string | null }>(d: T) {
        const { favorites, ...rest } = d;
        return { ...rest, title: d.title ?? d.filename, type_group: typeGroupOf(d.mimetype), is_favorite: !!favorites?.length };
    }

    async findOne(ctx: OrgContext, id: string) {
        await this.getAccessible(ctx, id, { includeDeleted: true });
        const doc = await this.prisma.document.findUniqueOrThrow({
            where: { id },
            include: {
                ...LIST_INCLUDE(ctx.membership_id),
                current_version: { include: { previews: true, author: { select: MEMBER_SELECT } } },
                folder: { select: { id: true, name: true, path: true } },
                retention_policy: { select: { id: true, name: true, retain_days: true, action: true } },
                project: { select: { id: true, name: true } },
                company: { select: { id: true, name: true } },
                attachments: { select: { id: true, entity_type: true, entity_id: true, role: true, source_module: true, created_at: true } },
            },
        });
        const [hold, breadcrumbs] = await Promise.all([this.effectiveHold(doc), this.breadcrumbs(ctx, doc.folder)]);
        if (ctx.membership_id) {
            await this.prisma.documentRecentAccess.upsert({
                where: { membership_id_document_id: { membership_id: ctx.membership_id, document_id: id } },
                update: { last_accessed_at: new Date(), access_count: { increment: 1 } },
                create: { membership_id: ctx.membership_id, document_id: id },
            });
        }
        await this.prisma.document.update({ where: { id }, data: { last_accessed_at: new Date() } });
        if (doc.is_sensitive) this.audit.recordAsync(ctx, 'document.viewed', { resource_type: 'document', resource_id: id, branch_id: doc.branch_id });
        return { ...this.listRow(doc), effective_legal_hold: hold, breadcrumbs };
    }

    private async breadcrumbs(ctx: OrgContext, folder: { id: string; name: string; path: string } | null) {
        if (!folder) return [];
        const ids = folder.path.split('/').filter(Boolean);
        const ancestors = ids.length ? await this.prisma.folder.findMany({ where: { id: { in: ids }, organization_id: ctx.organization_id }, select: { id: true, name: true } }) : [];
        return [...ids.map((fid) => ancestors.find((a) => a.id === fid)).filter(Boolean), { id: folder.id, name: folder.name }] as { id: string; name: string }[];
    }

    async listVersions(ctx: OrgContext, id: string) {
        await this.getAccessible(ctx, id, { includeDeleted: true });
        return this.prisma.documentVersion.findMany({
            where: { document_id: id },
            orderBy: { version_number: 'desc' },
            include: { author: { select: MEMBER_SELECT }, previews: { select: { kind: true, status: true } }, _count: { select: { approvals: true } } },
        });
    }

    // ---------------------------------------------------------------------------------------------
    // Upload (17 §5–6)
    // ---------------------------------------------------------------------------------------------

    /** Check size, extension, MIME type and executable content against the organization policy. */
    private validateFile(settings: { max_file_size_bytes: bigint; allowed_mime_types: string[]; blocked_extensions: string[] }, file: IncomingFile) {
        const size = file.size ?? file.buffer.length;
        if (!size) throw new BadRequestException({ message: 'The file is empty', code: 'file_empty' });
        if (BigInt(size) > settings.max_file_size_bytes) {
            throw new PayloadTooLargeException({ message: `The file is larger than the ${Math.round(Number(settings.max_file_size_bytes) / 1048576)} MB limit`, code: 'file_too_large' });
        }
        const ext = extensionOf(file.originalname);
        const blocked = new Set([...ALWAYS_BLOCKED_EXTENSIONS, ...settings.blocked_extensions.map((e) => e.toLowerCase())]);
        if (ext && blocked.has(ext)) throw new BadRequestException({ message: `.${ext} files are not allowed`, code: 'file_type_blocked' });
        if (looksExecutable(file.buffer)) throw new BadRequestException({ message: 'Executable files are not allowed', code: 'file_type_blocked' });
        if (settings.allowed_mime_types.length && !settings.allowed_mime_types.some((p) => mimeMatches(file.mimetype, p))) {
            throw new BadRequestException({ message: `${file.mimetype} files are not allowed in this organization`, code: 'file_type_not_allowed' });
        }
    }

    /** Storage quota: OrganizationEntitlement documents.storage_bytes (HARD blocks, SOFT only warns). */
    private async assertQuota(ctx: OrgContext, size: number) {
        const ent = await this.prisma.organizationEntitlement.findUnique({ where: { organization_id_key: { organization_id: ctx.organization_id, key: ENTITLEMENT_KEYS.DOCUMENTS_STORAGE_BYTES.key } } });
        if (!ent?.limit_value || ent.enforcement !== EntitlementEnforcement.HARD) return;
        const used = await this.usedBytes(ctx.organization_id);
        if (used + BigInt(size) > ent.limit_value) throw new PayloadTooLargeException({ message: 'The storage quota of the organization is full', code: 'storage_quota_exceeded' });
    }

    private async usedBytes(organizationId: string) {
        const agg = await this.prisma.documentVersion.aggregate({ where: { document: { organization_id: organizationId } }, _sum: { size_bytes: true } });
        return agg._sum.size_bytes ?? BigInt(0);
    }

    /**
     * Upload a file as a new document, or as a new version of `fields.document_id`.
     * Used by `POST /files/upload` and by other modules (via `attachToEntity`).
     */
    async upload(ctx: OrgContext, file: IncomingFile, fields: UploadFields, opts: { source?: DocumentSource; source_module?: ModuleKey; role?: string; authorized_by_module?: boolean } = {}) {
        if (!file?.buffer) throw new BadRequestException({ message: 'A file is required (multipart field "file")', code: 'file_required' });
        const settings = await this.settings.get(ctx.organization_id);
        this.validateFile(settings, file);
        const size = file.size ?? file.buffer.length;
        await this.assertQuota(ctx, size);

        const existing = fields.document_id ? await this.getAccessible(ctx, fields.document_id) : null;
        if (existing && !ctx.can(DOC_UPDATE)) throw new ForbiddenException({ message: 'You do not have permission to add versions (documents.documents.update)', code: 'permission_denied', permissions: [DOC_UPDATE] });
        if (!existing && !opts.authorized_by_module && !ctx.can(DOC_CREATE)) throw new ForbiddenException({ message: 'You do not have permission to upload (documents.documents.create)', code: 'permission_denied', permissions: [DOC_CREATE] });

        const placement = existing ? null : await this.resolvePlacement(ctx, fields);
        const documentId = existing?.id ?? randomUUID();
        const versionId = randomUUID();
        const filename = file.originalname || 'file';
        const mimetype = file.mimetype || 'application/octet-stream';
        const checksum = createHash('sha256').update(file.buffer).digest('hex');
        const key = `org/${ctx.organization_id}/documents/${documentId}/${versionId}/${safeFilename(filename)}`;
        const stored = await this.storage.put(key, file.buffer, mimetype);
        const previewKind = previewKindFor(mimetype);
        const source = opts.source ?? (ctx.channel === 'ui' ? DocumentSource.UPLOAD : DocumentSource.API);

        try {
            const doc = await this.prisma.$transaction(async (tx) => {
                const versionNumber = (existing?.version_count ?? 0) + 1;
                if (!existing && placement) {
                    await tx.document.create({
                        data: {
                            id: documentId,
                            organization_id: ctx.organization_id,
                            filename,
                            mimetype,
                            size: BigInt(size),
                            path: stored.key,
                            title: fields.title ?? filename.replace(/\.[^.]+$/, ''),
                            description: fields.description,
                            status: DocumentStatus.ACTIVE,
                            source,
                            source_module: opts.source_module,
                            owner_membership_id: ctx.membership_id,
                            created_by_user_id: ctx.user_id,
                            ...placement,
                        },
                    });
                }
                await tx.documentVersion.create({
                    data: {
                        id: versionId,
                        document_id: documentId,
                        version_number: versionNumber,
                        // No scanner is wired yet: versions are available at once and the scan is recorded as SKIPPED.
                        status: DocumentVersionStatus.AVAILABLE,
                        scan_status: DocumentScanStatus.SKIPPED,
                        scan_result: { reason: 'no_scanner_configured' },
                        filename,
                        mimetype,
                        size_bytes: BigInt(size),
                        checksum_sha256: checksum,
                        storage_provider: stored.provider,
                        storage_key: stored.key,
                        storage_bucket: stored.bucket,
                        change_note: fields.change_note,
                        author_membership_id: ctx.membership_id,
                        author_user_id: ctx.user_id,
                        source,
                        previews: previewKind ? { create: { kind: previewKind, status: DocumentPreviewStatus.READY, mimetype, storage_key: stored.key, size_bytes: BigInt(size), generated_at: new Date() } } : undefined,
                    },
                });
                await tx.documentUploadJob.create({
                    data: {
                        organization_id: ctx.organization_id,
                        batch_id: fields.batch_id,
                        status: DocumentUploadJobStatus.COMPLETED,
                        source,
                        source_module: opts.source_module,
                        filename,
                        mimetype,
                        expected_size_bytes: BigInt(size),
                        uploaded_bytes: BigInt(size),
                        storage_key: stored.key,
                        document_id: documentId,
                        folder_id: existing ? existing.folder_id : placement?.folder_id,
                        scope: existing ? existing.scope : placement?.scope,
                        entity_type: fields.entity_type,
                        entity_id: fields.entity_id,
                        title: fields.title,
                        change_note: fields.change_note,
                        version_id: versionId,
                        scan_status: DocumentScanStatus.SKIPPED,
                        initiated_by_membership_id: ctx.membership_id,
                        initiated_by_user_id: ctx.user_id,
                        started_at: new Date(),
                        completed_at: new Date(),
                    },
                });
                if (fields.entity_type && fields.entity_id) {
                    await tx.documentAttachment.upsert({
                        where: { document_id_entity_type_entity_id_role: { document_id: documentId, entity_type: fields.entity_type, entity_id: fields.entity_id, role: opts.role ?? 'attachment' } },
                        update: {},
                        create: { organization_id: ctx.organization_id, document_id: documentId, entity_type: fields.entity_type, entity_id: fields.entity_id, role: opts.role ?? 'attachment', source_module: opts.source_module, linked_by_user_id: ctx.user_id },
                    });
                }
                return tx.document.update({
                    where: { id: documentId },
                    data: {
                        current_version_id: versionId,
                        version_count: versionNumber,
                        filename,
                        mimetype,
                        size: BigInt(size),
                        path: stored.key,
                        checksum,
                        // A new version of an approved document needs a new approval.
                        ...(existing?.status === DocumentStatus.APPROVED && { status: DocumentStatus.ACTIVE }),
                    },
                    include: LIST_INCLUDE(ctx.membership_id),
                });
            });

            const isNew = !existing;
            await this.audit.record(ctx, isNew ? 'document.created' : 'document.version_created', {
                resource_type: 'document',
                resource_id: documentId,
                branch_id: doc.branch_id,
                metadata: { filename, mimetype, size, version_number: doc.version_count, change_note: fields.change_note, folder_id: doc.folder_id, entity_type: fields.entity_type, entity_id: fields.entity_id },
            });
            this.events.publish(ctx, {
                event_key: isNew ? 'documents.document.uploaded' : 'documents.document.version_created',
                module: ModuleKey.DOCUMENTS,
                entity_type: RecordEntityType.DOCUMENT,
                entity_id: documentId,
                payload: { title: doc.title, filename, mimetype, size, version_number: doc.version_count, folder_id: doc.folder_id, project_id: doc.project_id, company_id: doc.company_id, entity_type: fields.entity_type ?? null, entity_id: fields.entity_id ?? null },
                activity: { summary: isNew ? `uploaded ${doc.title}` : `uploaded version ${doc.version_count} of ${doc.title}`, entity_label: doc.title, project_id: doc.project_id, company_id: doc.company_id, branch_id: doc.branch_id },
            });
            return this.listRow(doc);
        } catch (error) {
            await this.storage.delete(stored.key);
            throw error;
        }
    }

    /**
     * Attach a file to a business record (task, ticket, invoice, message …) for other modules.
     * Creates a RECORD-scoped document plus a DocumentAttachment row; same checks, audit and events as an upload.
     */
    attachToEntity(ctx: OrgContext, input: AttachFileInput) {
        return this.upload(
            ctx,
            { buffer: input.buffer, originalname: input.filename, mimetype: input.mimetype, size: input.buffer.length },
            {
                title: input.title,
                folder_id: input.folder_id,
                project_id: input.project_id,
                company_id: input.company_id,
                category_id: input.category_id,
                customer_visible: input.customer_visible,
                entity_type: input.entity_type,
                entity_id: input.entity_id,
            },
            { source: input.source ?? DocumentSource.GENERATED, source_module: input.source_module, role: input.role, authorized_by_module: input.authorized_by_module },
        );
    }

    /** Folder, scope, category and record references of a new document (validated against the tenant). */
    private async resolvePlacement(ctx: OrgContext, fields: UploadFields) {
        const folder = fields.folder_id
            ? await this.prisma.folder.findFirst({ where: { id: fields.folder_id, organization_id: ctx.organization_id, deleted_at: null } })
            : null;
        if (fields.folder_id && !folder) throw new NotFoundException({ message: 'Folder not found', code: 'folder_not_found' });
        const categoryId = fields.category_id ?? folder?.default_category_id ?? null;
        const category = categoryId ? await this.prisma.documentCategory.findFirst({ where: { id: categoryId, organization_id: ctx.organization_id } }) : null;
        if (fields.category_id && !category) throw new NotFoundException({ message: 'Category not found', code: 'category_not_found' });
        const refs: Promise<unknown>[] = [];
        if (fields.project_id) refs.push(this.prisma.project.findFirstOrThrow({ where: { id: fields.project_id, organization_id: ctx.organization_id }, select: { id: true } }));
        if (fields.company_id) refs.push(this.prisma.crmCompany.findFirstOrThrow({ where: { id: fields.company_id, organization_id: ctx.organization_id }, select: { id: true } }));
        if (fields.branch_id) refs.push(this.prisma.branch.findFirstOrThrow({ where: { id: fields.branch_id, organization_id: ctx.organization_id }, select: { id: true } }));
        if (fields.team_id) refs.push(this.prisma.team.findFirstOrThrow({ where: { id: fields.team_id, organization_id: ctx.organization_id }, select: { id: true } }));
        try {
            await Promise.all(refs);
        } catch {
            throw new NotFoundException({ message: 'Project, customer, branch or team not found', code: 'reference_not_found' });
        }
        let retention: { retention_policy_id: string; retention_expires_at: Date | null } | null = null;
        if (category?.default_retention_policy_id) {
            const policy = await this.prisma.documentRetentionPolicy.findUnique({ where: { id: category.default_retention_policy_id } });
            if (policy?.is_active) retention = { retention_policy_id: policy.id, retention_expires_at: policy.retain_days && policy.anchor === 'CREATED' ? new Date(Date.now() + policy.retain_days * 86_400_000) : null };
        }
        const scope = fields.entity_type ? DocumentScope.RECORD : (fields.scope ?? folder?.scope ?? (fields.project_id ? DocumentScope.PROJECT : fields.company_id ? DocumentScope.CUSTOMER : DocumentScope.ORGANIZATION));
        return {
            folder_id: folder?.id ?? null,
            scope,
            branch_id: fields.branch_id ?? folder?.branch_id ?? null,
            team_id: fields.team_id ?? folder?.team_id ?? null,
            project_id: fields.project_id ?? folder?.project_id ?? null,
            company_id: fields.company_id ?? folder?.company_id ?? null,
            employee_id: folder?.employee_id ?? null,
            entity_type: fields.entity_type ?? null,
            entity_id: fields.entity_id ?? null,
            category_id: category?.id ?? null,
            is_sensitive: fields.is_sensitive ?? category?.is_sensitive ?? false,
            customer_visible: fields.customer_visible ?? folder?.customer_visible ?? category?.customer_visible_default ?? false,
            ...(retention ?? {}),
        };
    }

    // ---------------------------------------------------------------------------------------------
    // Download & preview (17 §8)
    // ---------------------------------------------------------------------------------------------

    private async versionFor(ctx: OrgContext, id: string, versionId?: string) {
        const doc = await this.getAccessible(ctx, id);
        const version = versionId
            ? await this.prisma.documentVersion.findFirst({ where: { id: versionId, document_id: id } })
            : doc.current_version;
        if (!version) throw new NotFoundException({ message: 'This document has no file', code: 'version_not_found' });
        if (version.status !== DocumentVersionStatus.AVAILABLE) {
            throw new ConflictException({ message: version.status === 'QUARANTINED' ? 'This file was quarantined by the virus scan' : 'This file is not available yet', code: 'version_unavailable' });
        }
        return { doc, version };
    }

    /** Signed, expiring URL path for `<a href>` / `<img src>` (the browser cannot send the bearer header). */
    async issueDownloadUrl(ctx: OrgContext, id: string, opts: { version_id?: string; disposition?: 'inline' | 'attachment' } = {}) {
        const { doc, version } = await this.versionFor(ctx, id, opts.version_id);
        const settings = await this.settings.get(ctx.organization_id);
        const disposition = opts.disposition ?? 'attachment';
        const exp = Math.floor(Date.now() / 1000) + settings.signed_url_ttl_seconds;
        const token = signDownloadToken({ v: version.id, o: ctx.organization_id, d: disposition, e: exp });
        if (disposition === 'attachment' && doc.is_sensitive) {
            await this.audit.record(ctx, 'document.downloaded', { resource_type: 'document', resource_id: id, branch_id: doc.branch_id, metadata: { version_id: version.id, version_number: version.version_number } });
        }
        return { path: `/files/public/download/${token}`, expires_at: new Date(exp * 1000), filename: version.filename, mimetype: version.mimetype, size_bytes: version.size_bytes };
    }

    /**
     * Signed URL for a file attached to a record of another module, after THAT module checked the caller may see the
     * record (e.g. 12: the message is in a channel the caller can read). No documents.documents.read scope check here.
     */
    async issueRecordDownloadUrl(organizationId: string, documentId: string, disposition: 'inline' | 'attachment' = 'attachment') {
        const doc = await this.prisma.document.findFirst({ where: { id: documentId, organization_id: organizationId, deleted_at: null }, include: { current_version: true } });
        const version = doc?.current_version;
        if (!doc || !version || version.status !== DocumentVersionStatus.AVAILABLE) throw new NotFoundException({ message: 'File not found', code: 'file_not_found' });
        const settings = await this.settings.get(organizationId);
        const exp = Math.floor(Date.now() / 1000) + settings.signed_url_ttl_seconds;
        const token = signDownloadToken({ v: version.id, o: organizationId, d: disposition, e: exp });
        return { path: `/files/public/download/${token}`, expires_at: new Date(exp * 1000), filename: version.filename, mimetype: version.mimetype, size_bytes: Number(version.size_bytes) };
    }

    /** Preview metadata of a version (kind + signed inline URL, or UNSUPPORTED → download only). */
    async preview(ctx: OrgContext, id: string, versionId?: string) {
        const { version } = await this.versionFor(ctx, id, versionId);
        const preview = await this.prisma.documentPreview.findFirst({ where: { version_id: version.id }, orderBy: { page_number: 'asc' } });
        if (!preview || preview.status !== DocumentPreviewStatus.READY) {
            return { version_id: version.id, kind: preview?.kind ?? null, status: preview?.status ?? DocumentPreviewStatus.UNSUPPORTED, mimetype: version.mimetype, path: null, expires_at: null };
        }
        const url = await this.issueDownloadUrl(ctx, id, { version_id: version.id, disposition: 'inline' });
        return { version_id: version.id, kind: preview.kind, status: preview.status, mimetype: version.mimetype, path: url.path, expires_at: url.expires_at };
    }

    /** Authenticated direct stream (API clients with a bearer token / API key). */
    async streamForCaller(ctx: OrgContext, id: string, versionId?: string) {
        const { doc, version } = await this.versionFor(ctx, id, versionId);
        if (doc.is_sensitive) await this.audit.record(ctx, 'document.downloaded', { resource_type: 'document', resource_id: id, branch_id: doc.branch_id, metadata: { version_id: version.id } });
        return { stream: await this.storage.getStream(version.storage_key), filename: version.filename, mimetype: version.mimetype, size: Number(version.size_bytes), disposition: 'attachment' as const };
    }

    /** Resolve a signed token (public endpoint). Re-checks the document state and, for share tokens, the share. */
    async streamByToken(token: string): Promise<{ stream: Readable; filename: string; mimetype: string; size: number; disposition: 'inline' | 'attachment' }> {
        const payload: DownloadTokenPayload | null = verifyDownloadToken(token);
        if (!payload) throw new NotFoundException({ message: 'This link has expired or is invalid', code: 'download_link_invalid' });
        const version = await this.prisma.documentVersion.findUnique({ where: { id: payload.v }, include: { document: { select: { id: true, organization_id: true, deleted_at: true } } } });
        if (!version || version.document.organization_id !== payload.o || version.document.deleted_at || version.status !== DocumentVersionStatus.AVAILABLE) {
            throw new NotFoundException({ message: 'File not found', code: 'file_not_found' });
        }
        if (payload.s) {
            const share = await this.prisma.documentShare.findUnique({ where: { id: payload.s } });
            if (!share || share.status !== 'ACTIVE' || (share.expires_at && share.expires_at < new Date())) throw new NotFoundException({ message: 'This link is no longer active', code: 'share_inactive' });
            if (payload.d === 'attachment') {
                if (!share.allow_download) throw new ForbiddenException({ message: 'Downloads are disabled for this link', code: 'share_download_disabled' });
                if (share.max_download_count && share.download_count >= share.max_download_count) throw new ForbiddenException({ message: 'The download limit of this link was reached', code: 'share_download_limit' });
                await this.prisma.documentShare.update({ where: { id: share.id }, data: { download_count: { increment: 1 }, last_accessed_at: new Date() } });
                await this.audit.record(null, 'document.share_downloaded', { resource_type: 'document', resource_id: version.document.id, metadata: { share_id: share.id, version_id: version.id, organization_id: payload.o } });
            }
        }
        return { stream: await this.storage.getStream(version.storage_key), filename: version.filename, mimetype: version.mimetype, size: Number(version.size_bytes), disposition: payload.d };
    }

    // ---------------------------------------------------------------------------------------------
    // Writes
    // ---------------------------------------------------------------------------------------------

    async update(ctx: OrgContext, id: string, dto: UpdateDocumentDto) {
        const before = await this.getAccessible(ctx, id);
        if (dto.category_id) await this.prisma.documentCategory.findFirstOrThrow({ where: { id: dto.category_id, organization_id: ctx.organization_id } }).catch(() => { throw new NotFoundException({ message: 'Category not found', code: 'category_not_found' }); });
        if (dto.owner_membership_id) await this.prisma.membership.findFirstOrThrow({ where: { id: dto.owner_membership_id, organization_id: ctx.organization_id } }).catch(() => { throw new NotFoundException({ message: 'Owner not found', code: 'membership_not_found' }); });
        const doc = await this.prisma.document.update({
            where: { id },
            data: { ...dto, ...(dto.keywords && { keywords: dto.keywords.map((k) => k.trim().toLowerCase()).filter(Boolean) }) },
            include: LIST_INCLUDE(ctx.membership_id),
        });
        await this.audit.record(ctx, 'document.updated', {
            resource_type: 'document', resource_id: id, branch_id: doc.branch_id,
            metadata: { before: { title: before.title, description: before.description, category_id: before.category_id, customer_visible: before.customer_visible, is_sensitive: before.is_sensitive }, after: dto },
        });
        this.events.publish(ctx, { event_key: 'documents.document.updated', module: ModuleKey.DOCUMENTS, entity_type: RecordEntityType.DOCUMENT, entity_id: id, payload: { title: doc.title }, changes: dto as Record<string, unknown> });
        return this.listRow(doc);
    }

    async move(ctx: OrgContext, id: string, folderId: string | null) {
        const before = await this.getAccessible(ctx, id);
        const folder = folderId ? await this.prisma.folder.findFirst({ where: { id: folderId, organization_id: ctx.organization_id, deleted_at: null } }) : null;
        if (folderId && !folder) throw new NotFoundException({ message: 'Folder not found', code: 'folder_not_found' });
        const doc = await this.prisma.document.update({ where: { id }, data: { folder_id: folder?.id ?? null }, include: LIST_INCLUDE(ctx.membership_id) });
        await this.audit.record(ctx, 'document.moved', { resource_type: 'document', resource_id: id, branch_id: doc.branch_id, metadata: { before: { folder_id: before.folder_id }, after: { folder_id: doc.folder_id } } });
        this.events.publish(ctx, { event_key: 'documents.document.moved', module: ModuleKey.DOCUMENTS, entity_type: RecordEntityType.DOCUMENT, entity_id: id, payload: { title: doc.title, from_folder_id: before.folder_id, to_folder_id: doc.folder_id } });
        return this.listRow(doc);
    }

    async archive(ctx: OrgContext, id: string) {
        await this.getAccessible(ctx, id);
        const doc = await this.prisma.document.update({ where: { id }, data: { status: DocumentStatus.ARCHIVED, archived_at: new Date() } });
        await this.audit.record(ctx, 'document.archived', { resource_type: 'document', resource_id: id, branch_id: doc.branch_id });
        this.events.publish(ctx, { event_key: 'documents.document.archived', module: ModuleKey.DOCUMENTS, entity_type: RecordEntityType.DOCUMENT, entity_id: id, payload: { title: doc.title } });
        return doc;
    }

    async unarchive(ctx: OrgContext, id: string) {
        const before = await this.getAccessible(ctx, id);
        if (before.status !== DocumentStatus.ARCHIVED) throw new ConflictException({ message: 'The document is not archived', code: 'document_not_archived' });
        const doc = await this.prisma.document.update({ where: { id }, data: { status: before.approval_status === DocumentApprovalStatus.APPROVED ? DocumentStatus.APPROVED : DocumentStatus.ACTIVE, archived_at: null } });
        await this.audit.record(ctx, 'document.unarchived', { resource_type: 'document', resource_id: id, branch_id: doc.branch_id });
        return doc;
    }

    /** Soft delete → trash with a recovery window (17 §13). Blocked by legal hold and locked versions. */
    async softDelete(ctx: OrgContext, id: string) {
        const before = await this.getAccessible(ctx, id);
        const hold = await this.effectiveHold(before);
        if (hold.held) throw new ConflictException({ message: 'This document is under legal hold and cannot be deleted', code: 'document_legal_hold' });
        const locked = await this.prisma.documentVersion.findFirst({ where: { document_id: id, is_locked: true }, select: { locked_by_module: true } });
        if (locked) throw new ConflictException({ message: `A version is locked by ${locked.locked_by_module ?? 'another module'} and cannot be deleted`, code: 'document_version_locked' });
        const settings = await this.settings.get(ctx.organization_id);
        const now = new Date();
        const doc = await this.prisma.document.update({
            where: { id },
            data: { status: DocumentStatus.DELETED, deleted_at: now, deleted_by_user_id: ctx.user_id, purge_scheduled_at: new Date(now.getTime() + settings.soft_delete_recovery_days * 86_400_000) },
        });
        await this.audit.record(ctx, 'document.deleted', { resource_type: 'document', resource_id: id, branch_id: doc.branch_id, metadata: { kind: 'soft', purge_scheduled_at: doc.purge_scheduled_at } });
        this.events.publish(ctx, { event_key: 'documents.document.deleted', module: ModuleKey.DOCUMENTS, entity_type: RecordEntityType.DOCUMENT, entity_id: id, payload: { title: doc.title, permanent: false } });
        return doc;
    }

    async restore(ctx: OrgContext, id: string) {
        const before = await this.getAccessible(ctx, id, { includeDeleted: true });
        if (!before.deleted_at) throw new ConflictException({ message: 'The document is not in the trash', code: 'document_not_deleted' });
        const doc = await this.prisma.document.update({
            where: { id },
            data: {
                status: before.archived_at ? DocumentStatus.ARCHIVED : before.approval_status === DocumentApprovalStatus.APPROVED ? DocumentStatus.APPROVED : DocumentStatus.ACTIVE,
                deleted_at: null, deleted_by_user_id: null, purge_scheduled_at: null,
            },
        });
        await this.audit.record(ctx, 'document.restored', { resource_type: 'document', resource_id: id, branch_id: doc.branch_id });
        this.events.publish(ctx, { event_key: 'documents.document.restored', module: ModuleKey.DOCUMENTS, entity_type: RecordEntityType.DOCUMENT, entity_id: id, payload: { title: doc.title } });
        return doc;
    }

    /** Restore an older version by creating a new version that points at the same immutable bytes (17 §6). */
    async restoreVersion(ctx: OrgContext, id: string, versionId: string, changeNote?: string) {
        const doc = await this.getAccessible(ctx, id);
        const source = await this.prisma.documentVersion.findFirst({ where: { id: versionId, document_id: id } });
        if (!source) throw new NotFoundException({ message: 'Version not found', code: 'version_not_found' });
        if (source.id === doc.current_version_id) throw new ConflictException({ message: 'This is already the current version', code: 'version_is_current' });
        const created = await this.prisma.$transaction(async (tx) => {
            const v = await tx.documentVersion.create({
                data: {
                    document_id: id,
                    version_number: doc.version_count + 1,
                    status: source.status,
                    filename: source.filename,
                    mimetype: source.mimetype,
                    size_bytes: source.size_bytes,
                    checksum_sha256: source.checksum_sha256,
                    storage_provider: source.storage_provider,
                    storage_key: source.storage_key,
                    storage_bucket: source.storage_bucket,
                    scan_status: source.scan_status,
                    change_note: changeNote ?? `Restored from version ${source.version_number}`,
                    author_membership_id: ctx.membership_id,
                    author_user_id: ctx.user_id,
                    source: source.source,
                    restored_from_version_id: source.id,
                },
            });
            const previews = await tx.documentPreview.findMany({ where: { version_id: source.id } });
            if (previews.length) {
                await tx.documentPreview.createMany({ data: previews.map(({ id: _id, version_id: _v, created_at: _c, ...p }) => ({ ...p, version_id: v.id })) });
            }
            await tx.document.update({
                where: { id },
                data: { current_version_id: v.id, version_count: v.version_number, filename: v.filename, mimetype: v.mimetype, size: v.size_bytes, path: v.storage_key, checksum: v.checksum_sha256, ...(doc.status === DocumentStatus.APPROVED && { status: DocumentStatus.ACTIVE }) },
            });
            return v;
        });
        await this.audit.record(ctx, 'document.version_restored', { resource_type: 'document', resource_id: id, branch_id: doc.branch_id, metadata: { from_version: source.version_number, new_version: created.version_number } });
        this.events.publish(ctx, { event_key: 'documents.document.version_created', module: ModuleKey.DOCUMENTS, entity_type: RecordEntityType.DOCUMENT, entity_id: id, payload: { title: doc.title, version_number: created.version_number, restored_from: source.version_number } });
        return created;
    }

    async bulk(ctx: OrgContext, dto: BulkDocumentsDto) {
        const results: { id: string; ok: boolean; error?: string }[] = [];
        for (const id of dto.ids.slice(0, 200)) {
            try {
                if (dto.action === 'archive') { this.assertCan(ctx, 'documents.documents.archive'); await this.archive(ctx, id); }
                else if (dto.action === 'delete') { this.assertCan(ctx, 'documents.documents.delete'); await this.softDelete(ctx, id); }
                else if (dto.action === 'restore') { this.assertCan(ctx, 'documents.documents.restore'); await this.restore(ctx, id); }
                else { this.assertCan(ctx, DOC_UPDATE); await this.move(ctx, id, dto.folder_id ?? null); }
                results.push({ id, ok: true });
            } catch (error) {
                results.push({ id, ok: false, error: (error as { message?: string }).message });
            }
        }
        await this.audit.record(ctx, 'document.bulk_action', { resource_type: 'document', metadata: { action: dto.action, count: results.length, failed: results.filter((r) => !r.ok).length } });
        return { results, succeeded: results.filter((r) => r.ok).length, failed: results.filter((r) => !r.ok).length };
    }

    private assertCan(ctx: OrgContext, key: string) {
        if (!ctx.can(key)) throw new ForbiddenException({ message: `Missing permission ${key}`, code: 'permission_denied', permissions: [key] });
    }

    // ---------------------------------------------------------------------------------------------
    // Legal hold (17 §13)
    // ---------------------------------------------------------------------------------------------

    async setLegalHold(ctx: OrgContext, id: string, reason: string) {
        await this.getAccessible(ctx, id, { includeDeleted: true });
        const doc = await this.prisma.document.update({ where: { id }, data: { legal_hold: true, legal_hold_reason: reason, legal_hold_set_by_user_id: ctx.user_id, legal_hold_set_at: new Date() } });
        await this.audit.record(ctx, 'document.legal_hold_set', { resource_type: 'document', resource_id: id, branch_id: doc.branch_id, metadata: { reason } });
        this.events.publish(ctx, { event_key: 'documents.legal_hold.set', module: ModuleKey.DOCUMENTS, entity_type: RecordEntityType.DOCUMENT, entity_id: id, payload: { title: doc.title, reason } });
        return doc;
    }

    async releaseLegalHold(ctx: OrgContext, id: string) {
        const before = await this.getAccessible(ctx, id, { includeDeleted: true });
        if (!before.legal_hold) throw new ConflictException({ message: 'The document is not on legal hold', code: 'document_not_held' });
        const doc = await this.prisma.document.update({ where: { id }, data: { legal_hold: false, legal_hold_reason: null, legal_hold_set_by_user_id: null, legal_hold_set_at: null } });
        await this.audit.record(ctx, 'document.legal_hold_released', { resource_type: 'document', resource_id: id, branch_id: doc.branch_id, metadata: { previous_reason: before.legal_hold_reason } });
        this.events.publish(ctx, { event_key: 'documents.legal_hold.released', module: ModuleKey.DOCUMENTS, entity_type: RecordEntityType.DOCUMENT, entity_id: id, payload: { title: doc.title } });
        return doc;
    }

    // ---------------------------------------------------------------------------------------------
    // Favorites & recent (17 §7) — personal, not audited
    // ---------------------------------------------------------------------------------------------

    private requireMember(ctx: OrgContext) {
        if (!ctx.membership_id) throw new BadRequestException({ message: 'Favorites and recent belong to a member', code: 'membership_required' });
        return ctx.membership_id;
    }

    async favorite(ctx: OrgContext, id: string, on: boolean) {
        const membershipId = this.requireMember(ctx);
        await this.getAccessible(ctx, id);
        if (on) await this.prisma.documentFavorite.upsert({ where: { membership_id_document_id: { membership_id: membershipId, document_id: id } }, update: {}, create: { membership_id: membershipId, document_id: id } });
        else await this.prisma.documentFavorite.deleteMany({ where: { membership_id: membershipId, document_id: id } });
        return { is_favorite: on };
    }

    async listRecent(ctx: OrgContext, limit = 30) {
        const membershipId = this.requireMember(ctx);
        const rows = await this.prisma.documentRecentAccess.findMany({
            where: { membership_id: membershipId, document: { organization_id: ctx.organization_id, deleted_at: null, ...this.scopeWhere(ctx) } },
            orderBy: { last_accessed_at: 'desc' },
            take: Math.min(limit, 100),
            include: { document: { include: LIST_INCLUDE(ctx.membership_id) } },
        });
        return rows.map((r) => ({ last_accessed_at: r.last_accessed_at, access_count: r.access_count, document: this.listRow(r.document) }));
    }

    async listFavorites(ctx: OrgContext) {
        const membershipId = this.requireMember(ctx);
        const rows = await this.prisma.documentFavorite.findMany({
            where: {
                membership_id: membershipId,
                OR: [
                    { document: { organization_id: ctx.organization_id, deleted_at: null, ...this.scopeWhere(ctx) } },
                    { folder: { organization_id: ctx.organization_id, deleted_at: null } },
                ],
            },
            orderBy: { created_at: 'desc' },
            include: { document: { include: LIST_INCLUDE(ctx.membership_id) }, folder: { select: { id: true, name: true, path: true, color: true, _count: { select: { documents: { where: { deleted_at: null } } } } } } },
        });
        return {
            documents: rows.filter((r) => r.document).map((r) => this.listRow(r.document!)),
            folders: rows.filter((r) => r.folder).map((r) => r.folder!),
        };
    }

    // ---------------------------------------------------------------------------------------------
    // Storage usage (17 §5)
    // ---------------------------------------------------------------------------------------------

    async storageUsage(ctx: OrgContext) {
        const org = ctx.organization_id;
        const [used, byMime, byCategory, largest, counts, trash, ent] = await Promise.all([
            this.usedBytes(org),
            this.prisma.documentVersion.groupBy({ by: ['mimetype'], where: { document: { organization_id: org } }, _sum: { size_bytes: true }, _count: { _all: true } }),
            this.prisma.document.groupBy({ by: ['category_id'], where: { organization_id: org, deleted_at: null }, _sum: { size: true }, _count: { _all: true } }),
            this.prisma.document.findMany({ where: { organization_id: org, deleted_at: null, ...this.scopeWhere(ctx) }, orderBy: { size: 'desc' }, take: 10, select: { id: true, title: true, filename: true, mimetype: true, size: true, version_count: true, updated_at: true } }),
            Promise.all([this.prisma.document.count({ where: { organization_id: org, deleted_at: null } }), this.prisma.documentVersion.count({ where: { document: { organization_id: org } } })]),
            this.prisma.document.aggregate({ where: { organization_id: org, deleted_at: { not: null } }, _sum: { size: true }, _count: { _all: true } }),
            this.prisma.organizationEntitlement.findUnique({ where: { organization_id_key: { organization_id: org, key: ENTITLEMENT_KEYS.DOCUMENTS_STORAGE_BYTES.key } } }),
        ]);
        const types = new Map<string, { bytes: number; versions: number }>();
        for (const row of byMime) {
            const g = typeGroupOf(row.mimetype);
            const cur = types.get(g) ?? { bytes: 0, versions: 0 };
            types.set(g, { bytes: cur.bytes + Number(row._sum.size_bytes ?? 0), versions: cur.versions + row._count._all });
        }
        const categories = await this.prisma.documentCategory.findMany({ where: { organization_id: org }, select: { id: true, name: true } });
        return {
            driver: this.storage.driverName,
            used_bytes: Number(used),
            quota_bytes: ent?.limit_value ? Number(ent.limit_value) : null,
            quota_enforcement: ent?.enforcement ?? null,
            documents: counts[0],
            versions: counts[1],
            trash: { documents: trash._count._all, bytes: Number(trash._sum.size ?? 0) },
            by_type: [...types.entries()].map(([type, v]) => ({ type, ...v })).sort((a, b) => b.bytes - a.bytes),
            by_category: byCategory
                .map((r) => ({ category_id: r.category_id, name: categories.find((c) => c.id === r.category_id)?.name ?? 'Uncategorized', bytes: Number(r._sum.size ?? 0), documents: r._count._all }))
                .sort((a, b) => b.bytes - a.bytes),
            largest: largest.map((d) => ({ ...d, title: d.title ?? d.filename })),
        };
    }
}
