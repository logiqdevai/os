import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { DocumentApprovalDecision, DocumentApprovalStatus, DocumentStatus, DocumentVersionStatus, MembershipStatus, ModuleKey, Prisma, RecordEntityType } from 'generated/prisma';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import { AuditService } from '@/shared/audit/audit.service';
import { EventsService } from '@/shared/events/events.service';
import { OrgContext } from '@/shared/authorization/interfaces/org-context.interface';
import { paginate, skipTake } from '@/shared/utils/pagination/pagination.utils';
import { DocumentsService } from './documents.service';
import { ApprovalDecisionDto, ApprovalQuery, CreateApprovalDto } from '../dto/approvals.dto';
import { MEMBER_SELECT } from '../utils/serialize.utils';

const APPROVAL_INCLUDE = {
    document: { select: { id: true, title: true, filename: true, mimetype: true, current_version_id: true } },
    version: { select: { id: true, version_number: true, filename: true } },
    requested_by: { select: MEMBER_SELECT },
    approvers: { orderBy: { sort_order: 'asc' }, include: { membership: { select: MEMBER_SELECT } } },
} satisfies Prisma.DocumentApprovalInclude;

/** Document-level approvals bound to one exact version (17 §10). Contract approval stays in 04. */
@Injectable()
export class ApprovalsService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly audit: AuditService,
        private readonly events: EventsService,
        private readonly documents: DocumentsService,
    ) { }

    async findAll(ctx: OrgContext, query: ApprovalQuery) {
        const where: Prisma.DocumentApprovalWhereInput = {
            organization_id: ctx.organization_id,
            document: { deleted_at: null, ...this.documents.scopeWhere(ctx) },
            ...(query.status && { status: query.status }),
            ...(query.document_id && { document_id: query.document_id }),
            ...(query.mine && { status: DocumentApprovalStatus.PENDING, approvers: { some: { membership_id: ctx.membership_id ?? '', decision: null } } }),
            ...(query.requested && { requested_by_membership_id: ctx.membership_id ?? '' }),
            ...(query.search && { OR: [{ title: { contains: query.search, mode: 'insensitive' } }, { document: { title: { contains: query.search, mode: 'insensitive' } } }] }),
        };
        const [items, total] = await Promise.all([
            this.prisma.documentApproval.findMany({ where, ...skipTake(query), orderBy: { created_at: query.order_direction ?? 'desc' }, include: APPROVAL_INCLUDE }),
            this.prisma.documentApproval.count({ where }),
        ]);
        return paginate(items.map((a) => this.present(ctx, a)), total, query);
    }

    private present(ctx: OrgContext, a: Prisma.DocumentApprovalGetPayload<{ include: typeof APPROVAL_INCLUDE }>) {
        const mine = a.approvers.find((x) => x.membership_id && x.membership_id === ctx.membership_id);
        return {
            ...a,
            document: { ...a.document, title: a.document.title ?? a.document.filename },
            version_superseded: a.document.current_version_id !== a.version_id,
            my_decision: mine ? (mine.decision ?? 'PENDING') : null,
            can_decide: a.status === DocumentApprovalStatus.PENDING && !!mine && !mine.decision,
        };
    }

    async findOne(ctx: OrgContext, id: string) {
        const approval = await this.prisma.documentApproval.findFirst({
            where: { id, organization_id: ctx.organization_id, document: { ...this.documents.scopeWhere(ctx) } },
            include: APPROVAL_INCLUDE,
        });
        if (!approval) throw new NotFoundException({ message: 'Approval not found', code: 'approval_not_found' });
        return this.present(ctx, approval);
    }

    async create(ctx: OrgContext, dto: CreateApprovalDto) {
        const doc = await this.documents.getAccessible(ctx, dto.document_id);
        const versionId = dto.version_id ?? doc.current_version_id;
        const version = versionId ? await this.prisma.documentVersion.findFirst({ where: { id: versionId, document_id: doc.id } }) : null;
        if (!version) throw new NotFoundException({ message: 'Version not found', code: 'version_not_found' });
        if (version.status !== DocumentVersionStatus.AVAILABLE) throw new ConflictException({ message: 'This version is not available', code: 'version_unavailable' });
        const ids = [...new Set(dto.approver_membership_ids)];
        const members = await this.prisma.membership.findMany({ where: { id: { in: ids }, organization_id: ctx.organization_id, status: MembershipStatus.ACTIVE }, select: { id: true } });
        if (members.length !== ids.length) throw new NotFoundException({ message: 'One or more approvers are not active members', code: 'approver_not_found' });
        if (dto.due_at && new Date(dto.due_at) <= new Date()) throw new BadRequestException({ message: 'The due date must be in the future', code: 'approval_due_past' });
        const pending = await this.prisma.documentApproval.findFirst({ where: { document_id: doc.id, version_id: version.id, status: DocumentApprovalStatus.PENDING } });
        if (pending) throw new ConflictException({ message: 'An approval is already pending for this version', code: 'approval_pending' });

        const approval = await this.prisma.$transaction(async (tx) => {
            const a = await tx.documentApproval.create({
                data: {
                    organization_id: ctx.organization_id,
                    document_id: doc.id,
                    version_id: version.id,
                    title: dto.title ?? `Approve ${doc.title ?? doc.filename} v${version.version_number}`,
                    message: dto.message,
                    require_all: dto.require_all ?? true,
                    due_at: dto.due_at ? new Date(dto.due_at) : null,
                    requested_by_membership_id: ctx.membership_id,
                    requested_by_user_id: ctx.user_id,
                    approvers: { create: ids.map((membership_id, i) => ({ membership_id, sort_order: i })) },
                },
                include: APPROVAL_INCLUDE,
            });
            await tx.document.update({ where: { id: doc.id }, data: { approval_status: DocumentApprovalStatus.PENDING } });
            return a;
        });
        await this.audit.record(ctx, 'document.approval_requested', { resource_type: 'document', resource_id: doc.id, branch_id: doc.branch_id, metadata: { approval_id: approval.id, version_number: version.version_number, approvers: ids, require_all: approval.require_all } });
        this.events.publish(ctx, {
            event_key: 'documents.approval.requested',
            module: ModuleKey.DOCUMENTS,
            entity_type: RecordEntityType.DOCUMENT,
            entity_id: doc.id,
            payload: { approval_id: approval.id, title: approval.title, version_number: version.version_number, approver_membership_ids: ids, due_at: approval.due_at },
            activity: { summary: `requested approval of ${doc.title ?? doc.filename}`, entity_label: doc.title, project_id: doc.project_id, company_id: doc.company_id, branch_id: doc.branch_id },
        });
        return this.present(ctx, approval);
    }

    async decide(ctx: OrgContext, id: string, dto: ApprovalDecisionDto) {
        const approval = await this.findOne(ctx, id);
        if (approval.status !== DocumentApprovalStatus.PENDING) throw new ConflictException({ message: 'This approval is already completed', code: 'approval_completed' });
        const mine = approval.approvers.find((a) => a.membership_id && a.membership_id === ctx.membership_id);
        if (!mine) throw new ForbiddenException({ message: 'You are not an approver of this request', code: 'not_an_approver' });
        if (mine.decision) throw new ConflictException({ message: 'You already decided', code: 'approval_already_decided' });
        if (dto.decision !== DocumentApprovalDecision.APPROVED && !dto.comment?.trim()) throw new BadRequestException({ message: 'Add a comment explaining what needs to change', code: 'approval_comment_required' });

        const decidedAt = new Date();
        const decisions = approval.approvers.map((a) => (a.id === mine.id ? dto.decision : a.decision));
        let outcome: DocumentApprovalStatus = DocumentApprovalStatus.PENDING;
        if (dto.decision === DocumentApprovalDecision.REJECTED) outcome = DocumentApprovalStatus.REJECTED;
        else if (dto.decision === DocumentApprovalDecision.CHANGES_REQUESTED) outcome = DocumentApprovalStatus.CHANGES_REQUESTED;
        else if (!approval.require_all || decisions.every((d) => d === DocumentApprovalDecision.APPROVED)) outcome = DocumentApprovalStatus.APPROVED;

        await this.prisma.$transaction(async (tx) => {
            await tx.documentApprover.update({ where: { id: mine.id }, data: { decision: dto.decision, comment: dto.comment, decided_at: decidedAt } });
            if (outcome !== DocumentApprovalStatus.PENDING) {
                await tx.documentApproval.update({ where: { id }, data: { status: outcome, completed_at: decidedAt, outcome_comment: dto.comment } });
                const isCurrent = approval.document.current_version_id === approval.version_id;
                await tx.document.update({
                    where: { id: approval.document_id },
                    data: {
                        approval_status: outcome,
                        ...(outcome === DocumentApprovalStatus.APPROVED && { approved_version_id: approval.version_id, approved_at: decidedAt, ...(isCurrent && { status: DocumentStatus.APPROVED }) }),
                    },
                });
            }
        });
        await this.audit.record(ctx, 'document.approval_decided', { resource_type: 'document', resource_id: approval.document_id, metadata: { approval_id: id, decision: dto.decision, outcome } });
        this.events.publish(ctx, {
            event_key: outcome === DocumentApprovalStatus.APPROVED ? 'documents.document.approved' : outcome === DocumentApprovalStatus.PENDING ? 'documents.approval.decided' : 'documents.approval.rejected',
            module: ModuleKey.DOCUMENTS,
            entity_type: RecordEntityType.DOCUMENT,
            entity_id: approval.document_id,
            payload: { approval_id: id, decision: dto.decision, outcome, version_number: approval.version.version_number, title: approval.document.title, requested_by_membership_id: approval.requested_by_membership_id },
            activity: outcome === DocumentApprovalStatus.PENDING ? undefined : { summary: `${outcome === 'APPROVED' ? 'approved' : outcome === 'REJECTED' ? 'rejected' : 'requested changes to'} ${approval.document.title}`, entity_label: approval.document.title },
        });
        return this.findOne(ctx, id);
    }

    async cancel(ctx: OrgContext, id: string) {
        const approval = await this.findOne(ctx, id);
        if (approval.status !== DocumentApprovalStatus.PENDING) throw new ConflictException({ message: 'Only pending approvals can be cancelled', code: 'approval_completed' });
        await this.prisma.$transaction([
            this.prisma.documentApproval.update({ where: { id }, data: { status: DocumentApprovalStatus.CANCELLED, cancelled_at: new Date(), cancelled_by_user_id: ctx.user_id } }),
            this.prisma.document.update({ where: { id: approval.document_id }, data: { approval_status: DocumentApprovalStatus.CANCELLED } }),
        ]);
        await this.audit.record(ctx, 'document.approval_cancelled', { resource_type: 'document', resource_id: approval.document_id, metadata: { approval_id: id } });
        return this.findOne(ctx, id);
    }
}
