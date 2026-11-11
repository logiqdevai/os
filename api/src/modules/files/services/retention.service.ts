import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { DocumentDeletionKind, DocumentDeletionStatus, ModuleKey, Prisma, RecordEntityType } from 'generated/prisma';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import { AuditService } from '@/shared/audit/audit.service';
import { EventsService } from '@/shared/events/events.service';
import { OrgContext } from '@/shared/authorization/interfaces/org-context.interface';
import { paginate, skipTake } from '@/shared/utils/pagination/pagination.utils';
import { StorageService } from '../storage/storage.service';
import { DocumentsService } from './documents.service';
import { CreateRetentionPolicyDto, DeletionQuery, RequestDeletionDto, UpdateRetentionPolicyDto } from '../dto/retention.dto';

/**
 * Retention policies and the restricted permanent-deletion workflow (17 §13).
 * Permanent deletion needs a request and an approval by a different person; legal hold always blocks it.
 */
@Injectable()
export class RetentionService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly audit: AuditService,
        private readonly events: EventsService,
        private readonly storage: StorageService,
        private readonly documents: DocumentsService,
    ) { }

    // --- Policies ---------------------------------------------------------------------------------

    listPolicies(ctx: OrgContext) {
        return this.prisma.documentRetentionPolicy.findMany({
            where: { organization_id: ctx.organization_id, archived_at: null },
            orderBy: [{ is_active: 'desc' }, { name: 'asc' }],
            include: { category: { select: { id: true, name: true } }, _count: { select: { documents: true, default_for_categories: true } } },
        });
    }

    async createPolicy(ctx: OrgContext, dto: CreateRetentionPolicyDto) {
        if (dto.category_id) await this.assertCategory(ctx, dto.category_id);
        const policy = await this.prisma.documentRetentionPolicy.create({ data: { ...dto, organization_id: ctx.organization_id, created_by_user_id: ctx.user_id } });
        await this.audit.record(ctx, 'documents.retention_policy_created', { resource_type: 'document_retention_policy', resource_id: policy.id, metadata: { after: dto } });
        this.events.publish(ctx, { event_key: 'documents.retention_policy.created', module: ModuleKey.DOCUMENTS, entity_kind: 'document_retention_policy', entity_id: policy.id, payload: { name: policy.name } });
        return policy;
    }

    async updatePolicy(ctx: OrgContext, id: string, dto: UpdateRetentionPolicyDto) {
        const before = await this.getPolicy(ctx, id);
        if (before.enforced_by_module) throw new ConflictException({ message: `This policy is enforced by ${before.enforced_by_module} and cannot be changed here`, code: 'retention_policy_enforced' });
        if (dto.category_id) await this.assertCategory(ctx, dto.category_id);
        const policy = await this.prisma.documentRetentionPolicy.update({ where: { id }, data: dto });
        await this.audit.record(ctx, 'documents.retention_policy_updated', {
            resource_type: 'document_retention_policy', resource_id: id,
            metadata: { before: { name: before.name, retain_days: before.retain_days, anchor: before.anchor, action: before.action, is_active: before.is_active, category_id: before.category_id, scope: before.scope }, after: dto },
        });
        return policy;
    }

    async archivePolicy(ctx: OrgContext, id: string) {
        const before = await this.getPolicy(ctx, id);
        if (before.enforced_by_module) throw new ConflictException({ message: `This policy is enforced by ${before.enforced_by_module}`, code: 'retention_policy_enforced' });
        const policy = await this.prisma.documentRetentionPolicy.update({ where: { id }, data: { archived_at: new Date(), is_active: false } });
        await this.audit.record(ctx, 'documents.retention_policy_archived', { resource_type: 'document_retention_policy', resource_id: id });
        return policy;
    }

    private async getPolicy(ctx: OrgContext, id: string) {
        const policy = await this.prisma.documentRetentionPolicy.findFirst({ where: { id, organization_id: ctx.organization_id, archived_at: null } });
        if (!policy) throw new NotFoundException({ message: 'Retention policy not found', code: 'retention_policy_not_found' });
        return policy;
    }

    private async assertCategory(ctx: OrgContext, id: string) {
        if (!(await this.prisma.documentCategory.findFirst({ where: { id, organization_id: ctx.organization_id } }))) throw new NotFoundException({ message: 'Category not found', code: 'category_not_found' });
    }

    // --- Permanent deletion -----------------------------------------------------------------------

    async listDeletionRequests(ctx: OrgContext, query: DeletionQuery) {
        const where: Prisma.DocumentDeletionRequestWhereInput = {
            organization_id: ctx.organization_id,
            ...(query.status && { status: query.status }),
            ...(query.search && { document_title: { contains: query.search, mode: 'insensitive' } }),
        };
        const [items, total] = await Promise.all([
            this.prisma.documentDeletionRequest.findMany({ where, ...skipTake(query), orderBy: { created_at: query.order_direction ?? 'desc' } }),
            this.prisma.documentDeletionRequest.count({ where }),
        ]);
        return paginate(items.map((r) => ({ ...r, is_mine: r.requested_by_user_id === ctx.user_id })), total, query);
    }

    /** Ask for permanent deletion of a document in the trash. */
    async requestPermanent(ctx: OrgContext, dto: RequestDeletionDto) {
        const doc = await this.documents.getAccessible(ctx, dto.document_id, { includeDeleted: true });
        if (!doc.deleted_at) throw new ConflictException({ message: 'Move the document to the trash first', code: 'document_not_deleted' });
        const hold = await this.documents.effectiveHold(doc);
        if (hold.held) throw new ConflictException({ message: 'This document is under legal hold', code: 'document_legal_hold' });
        const open = await this.prisma.documentDeletionRequest.findFirst({ where: { document_id: doc.id, status: DocumentDeletionStatus.REQUESTED } });
        if (open) throw new ConflictException({ message: 'A permanent deletion request is already waiting for approval', code: 'deletion_already_requested' });
        const request = await this.prisma.documentDeletionRequest.create({
            data: { organization_id: ctx.organization_id, document_id: doc.id, document_title: doc.title ?? doc.filename, kind: DocumentDeletionKind.PERMANENT, reason: dto.reason, requested_by_user_id: ctx.user_id },
        });
        await this.audit.record(ctx, 'document.permanent_deletion_requested', { resource_type: 'document', resource_id: doc.id, metadata: { request_id: request.id, reason: dto.reason } });
        this.events.publish(ctx, { event_key: 'documents.deletion.requested', module: ModuleKey.DOCUMENTS, entity_type: RecordEntityType.DOCUMENT, entity_id: doc.id, payload: { request_id: request.id, title: request.document_title, reason: dto.reason } });
        return request;
    }

    private async getRequest(ctx: OrgContext, id: string) {
        const request = await this.prisma.documentDeletionRequest.findFirst({ where: { id, organization_id: ctx.organization_id } });
        if (!request) throw new NotFoundException({ message: 'Deletion request not found', code: 'deletion_request_not_found' });
        if (request.status !== DocumentDeletionStatus.REQUESTED) throw new ConflictException({ message: 'This request is already decided', code: 'deletion_request_decided' });
        return request;
    }

    /** Approve (four-eyes: never the requester) and execute: purge every version's bytes, then the record. */
    async approve(ctx: OrgContext, id: string) {
        const request = await this.getRequest(ctx, id);
        if (request.requested_by_user_id && request.requested_by_user_id === ctx.user_id) {
            throw new ForbiddenException({ message: 'A different person must approve a permanent deletion', code: 'deletion_self_approval' });
        }
        const doc = request.document_id ? await this.prisma.document.findFirst({ where: { id: request.document_id, organization_id: ctx.organization_id } }) : null;
        if (!doc) throw new NotFoundException({ message: 'The document no longer exists', code: 'document_not_found' });
        const hold = await this.documents.effectiveHold(doc);
        if (hold.held) throw new ConflictException({ message: 'This document is under legal hold', code: 'document_legal_hold' });

        const versions = await this.prisma.documentVersion.findMany({ where: { document_id: doc.id }, select: { storage_key: true, previews: { select: { storage_key: true } } } });
        const keys = [...new Set(versions.flatMap((v) => [v.storage_key, ...v.previews.map((p) => p.storage_key).filter((k): k is string => !!k)]))];
        const now = new Date();
        try {
            await this.prisma.$transaction(async (tx) => {
                await tx.documentDeletionRequest.update({ where: { id }, data: { status: DocumentDeletionStatus.EXECUTED, approved_by_user_id: ctx.user_id, approved_at: now, executed_at: now, executed_by_user_id: ctx.user_id, purged_storage_keys: keys } });
                await tx.document.update({ where: { id: doc.id }, data: { current_version_id: null } });
                await tx.document.delete({ where: { id: doc.id } });
            });
        } catch (error) {
            if (error instanceof Prisma.PrismaClientKnownRequestError && (error.code === 'P2003' || error.code === 'P2014')) {
                throw new ConflictException({ message: 'Another record still references this document (e.g. a contract or invoice); it cannot be purged', code: 'document_referenced' });
            }
            throw error;
        }
        await Promise.all(keys.map((k) => this.storage.delete(k)));
        await this.audit.record(ctx, 'document.permanently_deleted', { resource_type: 'document', resource_id: doc.id, metadata: { request_id: id, title: request.document_title, purged_keys: keys.length } });
        this.events.publish(ctx, { event_key: 'documents.document.purged', module: ModuleKey.DOCUMENTS, entity_type: RecordEntityType.DOCUMENT, entity_id: doc.id, payload: { title: request.document_title, request_id: id } });
        return this.prisma.documentDeletionRequest.findUniqueOrThrow({ where: { id } });
    }

    async reject(ctx: OrgContext, id: string, reason?: string) {
        const request = await this.getRequest(ctx, id);
        const updated = await this.prisma.documentDeletionRequest.update({ where: { id }, data: { status: DocumentDeletionStatus.REJECTED, rejected_reason: reason, approved_by_user_id: ctx.user_id, approved_at: new Date() } });
        await this.audit.record(ctx, 'document.permanent_deletion_rejected', { resource_type: 'document', resource_id: request.document_id, metadata: { request_id: id, reason } });
        return updated;
    }

    async cancel(ctx: OrgContext, id: string) {
        const request = await this.getRequest(ctx, id);
        if (request.requested_by_user_id !== ctx.user_id) throw new ForbiddenException({ message: 'Only the requester can cancel this request', code: 'deletion_cancel_forbidden' });
        const updated = await this.prisma.documentDeletionRequest.update({ where: { id }, data: { status: DocumentDeletionStatus.CANCELLED } });
        await this.audit.record(ctx, 'document.permanent_deletion_cancelled', { resource_type: 'document', resource_id: request.document_id, metadata: { request_id: id } });
        return updated;
    }
}
