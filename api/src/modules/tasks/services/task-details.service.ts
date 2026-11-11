import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { DocumentScope, DocumentSource, ModuleKey, Prisma, RecordEntityType, TaskCommentVisibility, TaskDependencyType } from 'generated/prisma';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import { AuditService } from '@/shared/audit/audit.service';
import { EventsService } from '@/shared/events/events.service';
import { OrgContext } from '@/shared/authorization/interfaces/org-context.interface';
import { MEMBER_SELECT } from '@/modules/projects/utils/projects.utils';
import { AddAttachmentDto, CreateChecklistItemDto, CreateCommentDto, CreateDependencyDto, UpdateChecklistItemDto, UpdateCommentDto } from '../dto/create-task.dto';
import { TasksService } from './tasks.service';

const INTERNAL_READ = 'tasks.comments.internal.read';

/** Comments, checklist, dependencies, watchers and attachments of a task (06 §3, §7, §8). */
@Injectable()
export class TaskDetailsService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly audit: AuditService,
        private readonly events: EventsService,
        private readonly tasks: TasksService,
    ) { }

    // --- Comments ---------------------------------------------------------------------------------

    async listComments(ctx: OrgContext, idOrKey: string) {
        const task = await this.tasks.assertAccess(ctx, idOrKey);
        return this.prisma.taskComment.findMany({
            where: {
                task_id: task.id,
                deleted_at: null,
                // INTERNAL comments need tasks.comments.internal.read (customer-visible ones are always readable).
                ...(!ctx.can(INTERNAL_READ) && { visibility: TaskCommentVisibility.CUSTOMER_VISIBLE }),
            },
            orderBy: { created_at: 'asc' },
            include: { author: { select: MEMBER_SELECT } },
        });
    }

    async createComment(ctx: OrgContext, idOrKey: string, dto: CreateCommentDto) {
        const task = await this.tasks.assertAccess(ctx, idOrKey);
        const visibility = dto.visibility ?? TaskCommentVisibility.INTERNAL;
        if (visibility === TaskCommentVisibility.INTERNAL && !ctx.can(INTERNAL_READ)) {
            throw new ForbiddenException({ message: 'Internal comments need tasks.comments.internal.read', code: 'permission_denied' });
        }
        if (visibility === TaskCommentVisibility.CUSTOMER_VISIBLE && !task.customer_visible) {
            throw new BadRequestException({ message: 'Make the task customer-visible before writing customer-visible comments', code: 'task_not_customer_visible' });
        }
        if (dto.parent_comment_id) {
            const parent = await this.prisma.taskComment.findFirst({ where: { id: dto.parent_comment_id, task_id: task.id }, select: { id: true } });
            if (!parent) throw new BadRequestException({ message: 'Reply target not found', code: 'comment_not_found' });
        }
        const mentions = [...new Set(dto.mentions ?? [])];
        if (mentions.length) {
            const count = await this.prisma.membership.count({ where: { id: { in: mentions }, organization_id: ctx.organization_id } });
            if (count !== mentions.length) throw new BadRequestException({ message: 'A mentioned member was not found', code: 'reference_not_found' });
        }
        const comment = await this.prisma.$transaction(async (tx) => {
            const c = await tx.taskComment.create({
                data: { task_id: task.id, body: dto.body, visibility, parent_comment_id: dto.parent_comment_id, author_membership_id: ctx.membership_id, author_user_id: ctx.user_id, mentions },
                include: { author: { select: MEMBER_SELECT } },
            });
            if (ctx.membership_id) await tx.taskWatcher.createMany({ data: [{ task_id: task.id, membership_id: ctx.membership_id }], skipDuplicates: true });
            await tx.task.update({ where: { id: task.id }, data: { updated_at: new Date() } });
            return c;
        });
        await this.audit.record(ctx, 'task.commented', { resource_type: 'task', resource_id: task.id, metadata: { identifier: task.identifier, comment_id: comment.id, visibility } });
        const watchers = await this.tasks.watcherIds(task.id, ctx.membership_id);
        this.events.publish(ctx, {
            event_key: 'tasks.task.commented', module: ModuleKey.TASKS, entity_type: RecordEntityType.TASK, entity_id: task.id,
            payload: {
                identifier: task.identifier, title: task.title, comment_id: comment.id, visibility, excerpt: dto.body.slice(0, 200),
                watcher_membership_ids: watchers, mentioned_membership_ids: mentions.filter((id) => id !== ctx.membership_id),
            },
            activity: { summary: `commented on ${task.identifier}`, entity_label: `${task.identifier} ${task.title}`, project_id: task.project_id, customer_visible: visibility === TaskCommentVisibility.CUSTOMER_VISIBLE },
        });
        return comment;
    }

    async updateComment(ctx: OrgContext, idOrKey: string, commentId: string, dto: UpdateCommentDto) {
        const task = await this.tasks.assertAccess(ctx, idOrKey);
        const comment = await this.prisma.taskComment.findFirst({ where: { id: commentId, task_id: task.id, deleted_at: null } });
        if (!comment) throw new NotFoundException({ message: 'Comment not found', code: 'comment_not_found' });
        if (comment.author_membership_id !== ctx.membership_id) throw new ForbiddenException({ message: 'Only the author can edit a comment', code: 'not_comment_author' });
        const updated = await this.prisma.taskComment.update({ where: { id: commentId }, data: { body: dto.body, edited_at: new Date() }, include: { author: { select: MEMBER_SELECT } } });
        await this.audit.record(ctx, 'task.comment_edited', { resource_type: 'task', resource_id: task.id, metadata: { comment_id: commentId, before: comment.body, after: dto.body } });
        return updated;
    }

    async deleteComment(ctx: OrgContext, idOrKey: string, commentId: string) {
        const task = await this.tasks.assertAccess(ctx, idOrKey);
        const comment = await this.prisma.taskComment.findFirst({ where: { id: commentId, task_id: task.id, deleted_at: null } });
        if (!comment) throw new NotFoundException({ message: 'Comment not found', code: 'comment_not_found' });
        if (comment.author_membership_id !== ctx.membership_id && !ctx.can('tasks.tasks.delete')) {
            throw new ForbiddenException({ message: 'Only the author or someone with tasks.tasks.delete can remove a comment', code: 'not_comment_author' });
        }
        await this.prisma.taskComment.update({ where: { id: commentId }, data: { deleted_at: new Date() } });
        await this.audit.record(ctx, 'task.comment_deleted', { resource_type: 'task', resource_id: task.id, metadata: { comment_id: commentId } });
        return { success: true };
    }

    // --- Checklist --------------------------------------------------------------------------------

    async addChecklistItem(ctx: OrgContext, idOrKey: string, dto: CreateChecklistItemDto) {
        const task = await this.tasks.assertAccess(ctx, idOrKey, 'tasks.tasks.update');
        const last = await this.prisma.taskChecklistItem.aggregate({ where: { task_id: task.id }, _max: { sort_order: true } });
        const item = await this.prisma.taskChecklistItem.create({ data: { task_id: task.id, title: dto.title, sort_order: (last._max.sort_order ?? -1) + 1 } });
        await this.audit.record(ctx, 'task.checklist_item_added', { resource_type: 'task', resource_id: task.id, metadata: { item_id: item.id, title: dto.title } });
        return item;
    }

    async updateChecklistItem(ctx: OrgContext, idOrKey: string, itemId: string, dto: UpdateChecklistItemDto) {
        const task = await this.tasks.assertAccess(ctx, idOrKey, 'tasks.tasks.update');
        const item = await this.prisma.taskChecklistItem.findFirst({ where: { id: itemId, task_id: task.id } });
        if (!item) throw new NotFoundException({ message: 'Checklist item not found', code: 'checklist_item_not_found' });
        const updated = await this.prisma.taskChecklistItem.update({
            where: { id: itemId },
            data: {
                ...dto,
                ...(dto.is_completed === true && !item.is_completed && { completed_at: new Date(), completed_by_membership_id: ctx.membership_id }),
                ...(dto.is_completed === false && { completed_at: null, completed_by_membership_id: null }),
            },
        });
        await this.audit.record(ctx, 'task.checklist_item_updated', { resource_type: 'task', resource_id: task.id, metadata: { item_id: itemId, before: { title: item.title, is_completed: item.is_completed }, after: dto } });
        return updated;
    }

    async deleteChecklistItem(ctx: OrgContext, idOrKey: string, itemId: string) {
        const task = await this.tasks.assertAccess(ctx, idOrKey, 'tasks.tasks.update');
        const res = await this.prisma.taskChecklistItem.deleteMany({ where: { id: itemId, task_id: task.id } });
        if (!res.count) throw new NotFoundException({ message: 'Checklist item not found', code: 'checklist_item_not_found' });
        await this.audit.record(ctx, 'task.checklist_item_removed', { resource_type: 'task', resource_id: task.id, metadata: { item_id: itemId } });
        return { success: true };
    }

    // --- Dependencies -----------------------------------------------------------------------------

    async addDependency(ctx: OrgContext, idOrKey: string, dto: CreateDependencyDto) {
        const task = await this.tasks.assertAccess(ctx, idOrKey, 'tasks.tasks.update');
        const target = await this.tasks.assertAccess(ctx, dto.target_task_id);
        if (target.id === task.id) throw new BadRequestException({ message: 'A task cannot depend on itself', code: 'dependency_self' });
        const type = dto.type ?? TaskDependencyType.BLOCKS;
        if (type === TaskDependencyType.BLOCKS) {
            const reverse = await this.prisma.taskDependency.findFirst({ where: { source_task_id: target.id, target_task_id: task.id, type } });
            if (reverse) throw new ConflictException({ message: `${target.identifier} already blocks ${task.identifier}`, code: 'dependency_cycle' });
        }
        try {
            const dep = await this.prisma.taskDependency.create({ data: { source_task_id: task.id, target_task_id: target.id, type, created_by_user_id: ctx.user_id } });
            if (type === TaskDependencyType.DUPLICATE_OF) await this.prisma.task.update({ where: { id: task.id }, data: { duplicate_of_task_id: target.id } });
            await this.audit.record(ctx, 'task.dependency_added', { resource_type: 'task', resource_id: task.id, metadata: { identifier: task.identifier, target: target.identifier, type } });
            this.events.publish(ctx, { event_key: 'tasks.dependency.added', module: ModuleKey.TASKS, entity_type: RecordEntityType.TASK, entity_id: task.id, payload: { identifier: task.identifier, target: target.identifier, type } });
            return dep;
        } catch (error) {
            if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') throw new ConflictException({ message: 'This link already exists', code: 'dependency_exists' });
            throw error;
        }
    }

    async removeDependency(ctx: OrgContext, idOrKey: string, dependencyId: string) {
        const task = await this.tasks.assertAccess(ctx, idOrKey, 'tasks.tasks.update');
        const dep = await this.prisma.taskDependency.findFirst({ where: { id: dependencyId, OR: [{ source_task_id: task.id }, { target_task_id: task.id }] } });
        if (!dep) throw new NotFoundException({ message: 'Link not found', code: 'dependency_not_found' });
        await this.prisma.taskDependency.delete({ where: { id: dependencyId } });
        if (dep.type === TaskDependencyType.DUPLICATE_OF) await this.prisma.task.update({ where: { id: dep.source_task_id }, data: { duplicate_of_task_id: null } });
        await this.audit.record(ctx, 'task.dependency_removed', { resource_type: 'task', resource_id: task.id, metadata: { dependency_id: dependencyId, type: dep.type } });
        return { success: true };
    }

    // --- Watchers ---------------------------------------------------------------------------------

    async watch(ctx: OrgContext, idOrKey: string, membershipId?: string) {
        const other = membershipId && membershipId !== ctx.membership_id;
        const task = await this.tasks.assertAccess(ctx, idOrKey, other ? 'tasks.tasks.update' : undefined);
        const target = membershipId ?? ctx.membership_id;
        if (!target) throw new BadRequestException({ message: 'Choose a member', code: 'watcher_required' });
        if (other) {
            const m = await this.prisma.membership.findFirst({ where: { id: target, organization_id: ctx.organization_id }, select: { id: true } });
            if (!m) throw new BadRequestException({ message: 'Member not found', code: 'membership_not_found' });
        }
        await this.prisma.taskWatcher.createMany({ data: [{ task_id: task.id, membership_id: target }], skipDuplicates: true });
        await this.audit.record(ctx, 'task.watcher_added', { resource_type: 'task', resource_id: task.id, metadata: { membership_id: target } });
        return { watching: true };
    }

    async unwatch(ctx: OrgContext, idOrKey: string, membershipId?: string) {
        const other = membershipId && membershipId !== ctx.membership_id;
        const task = await this.tasks.assertAccess(ctx, idOrKey, other ? 'tasks.tasks.update' : undefined);
        const target = membershipId ?? ctx.membership_id;
        await this.prisma.taskWatcher.deleteMany({ where: { task_id: task.id, membership_id: target ?? '' } });
        await this.audit.record(ctx, 'task.watcher_removed', { resource_type: 'task', resource_id: task.id, metadata: { membership_id: target } });
        return { watching: false };
    }

    // --- Attachments (metadata; files live in 17 Documents) ---------------------------------------

    async addAttachment(ctx: OrgContext, idOrKey: string, dto: AddAttachmentDto) {
        const task = await this.tasks.assertAccess(ctx, idOrKey, 'tasks.tasks.update');
        let documentId = dto.document_id;
        if (documentId) {
            const doc = await this.prisma.document.findFirst({ where: { id: documentId, organization_id: ctx.organization_id }, select: { id: true } });
            if (!doc) throw new BadRequestException({ message: 'Document not found', code: 'document_not_found' });
        } else {
            if (!dto.file_name && !dto.url) throw new BadRequestException({ message: 'Send a document_id, or a file name / link', code: 'attachment_required' });
            const doc = await this.prisma.document.create({
                data: {
                    organization_id: ctx.organization_id,
                    filename: dto.file_name ?? dto.url,
                    title: dto.file_name ?? dto.url,
                    mimetype: dto.mime_type ?? null,
                    size: dto.size !== undefined ? BigInt(dto.size) : null,
                    external_url: dto.url ?? null,
                    source: DocumentSource.UPLOAD,
                    source_module: ModuleKey.TASKS,
                    scope: DocumentScope.RECORD,
                    entity_type: RecordEntityType.TASK,
                    entity_id: task.id,
                    project_id: task.project_id,
                    owner_membership_id: ctx.membership_id,
                    created_by_user_id: ctx.user_id,
                },
                select: { id: true },
            });
            documentId = doc.id;
        }
        try {
            const attachment = await this.prisma.taskAttachment.create({
                data: { task_id: task.id, document_id: documentId, added_by_user_id: ctx.user_id },
                include: { document: { select: { id: true, title: true, filename: true, mimetype: true, size: true, external_url: true, url: true, created_at: true } } },
            });
            await this.audit.record(ctx, 'task.attachment_added', { resource_type: 'task', resource_id: task.id, metadata: { document_id: documentId, file_name: dto.file_name ?? null } });
            this.events.publish(ctx, { event_key: 'tasks.attachment.added', module: ModuleKey.TASKS, entity_type: RecordEntityType.TASK, entity_id: task.id, payload: { identifier: task.identifier, document_id: documentId } });
            return { ...attachment, document: { ...attachment.document, size: attachment.document.size !== null ? Number(attachment.document.size) : null } };
        } catch (error) {
            if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') throw new ConflictException({ message: 'Already attached', code: 'attachment_exists' });
            throw error;
        }
    }

    async removeAttachment(ctx: OrgContext, idOrKey: string, attachmentId: string) {
        const task = await this.tasks.assertAccess(ctx, idOrKey, 'tasks.tasks.update');
        const att = await this.prisma.taskAttachment.findFirst({ where: { id: attachmentId, task_id: task.id } });
        if (!att) throw new NotFoundException({ message: 'Attachment not found', code: 'attachment_not_found' });
        await this.prisma.taskAttachment.delete({ where: { id: attachmentId } });
        await this.audit.record(ctx, 'task.attachment_removed', { resource_type: 'task', resource_id: task.id, metadata: { document_id: att.document_id } });
        return { success: true };
    }
}
