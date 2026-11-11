import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { JwtGuard } from '@/shared/guards/jwt.guard';
import { PermissionsGuard } from '@/shared/authorization/guards/permissions.guard';
import { CurrentOrg, RequireAnyPermission, RequirePermission } from '@/shared/authorization/decorators/require-permission.decorator';
import { OrgContext } from '@/shared/authorization/interfaces/org-context.interface';
import { ZodValidationPipe } from '@/shared/pipes/zod.validation.pipe';
import { TasksService } from '../services/tasks.service';
import { TaskDetailsService } from '../services/task-details.service';
import {
    AddAttachmentDto,
    AssignTaskDto,
    BulkTaskDto,
    CreateChecklistItemDto,
    CreateCommentDto,
    CreateDependencyDto,
    CreateTaskDto,
    MoveTaskDto,
    UpdateChecklistItemDto,
    UpdateCommentDto,
    UpdateTaskDto,
    WatcherDto,
} from '../dto/create-task.dto';
import { BoardQuery, BoardQuerySchema, TaskLookupQuery, TaskLookupSchema, TaskQuery, TaskQuerySchema, TaskWorkloadQuery, TaskWorkloadSchema } from '../dto/task-query.schema';

/**
 * 06 Tasks. `:id` accepts the task uuid or its identifier (e.g. WEB-142). Static paths are declared before `:id`.
 */
@ApiTags('Tasks')
@ApiBearerAuth()
@Controller('tasks')
@UseGuards(JwtGuard, PermissionsGuard)
export class TasksController {
    constructor(
        private readonly tasks: TasksService,
        private readonly details: TaskDetailsService,
    ) { }

    @Get()
    @RequirePermission('tasks.tasks.read')
    @ApiOperation({ summary: 'List tasks (mine, assignee, status, label, project, cycle, priority, due filters)' })
    findAll(@CurrentOrg() ctx: OrgContext, @Query(new ZodValidationPipe(TaskQuerySchema)) query: TaskQuery) {
        return this.tasks.findAll(ctx, query);
    }

    @Get('lookup')
    @RequirePermission('tasks.tasks.read')
    @ApiOperation({ summary: 'Task picker for other modules (identifier, title, project)' })
    lookup(@CurrentOrg() ctx: OrgContext, @Query(new ZodValidationPipe(TaskLookupSchema)) query: TaskLookupQuery) {
        return this.tasks.lookup(ctx, query);
    }

    @Get('people')
    @RequirePermission('tasks.tasks.read')
    @ApiOperation({ summary: 'Active members for assignee pickers' })
    people(@CurrentOrg() ctx: OrgContext, @Query(new ZodValidationPipe(TaskLookupSchema)) query: TaskLookupQuery) {
        return this.tasks.people(ctx, query.search);
    }

    @Get('board')
    @RequirePermission('tasks.tasks.read')
    @ApiOperation({ summary: 'Kanban board of a team: workflow statuses + tasks ordered by rank' })
    board(@CurrentOrg() ctx: OrgContext, @Query(new ZodValidationPipe(BoardQuerySchema)) query: BoardQuery) {
        return this.tasks.board(ctx, query);
    }

    @Get('workload')
    @RequirePermission('tasks.workload.read')
    @ApiOperation({ summary: 'Open task distribution per person' })
    workload(@CurrentOrg() ctx: OrgContext, @Query(new ZodValidationPipe(TaskWorkloadSchema)) query: TaskWorkloadQuery) {
        return this.tasks.workload(ctx, query);
    }

    @Post()
    @RequirePermission('tasks.tasks.create')
    @ApiOperation({ summary: 'Create a task (identifier is allocated atomically)' })
    create(@CurrentOrg() ctx: OrgContext, @Body() dto: CreateTaskDto) {
        return this.tasks.create(ctx, dto);
    }

    @Post('bulk')
    @RequirePermission('tasks.bulk.execute')
    @ApiOperation({ summary: 'Bulk update, label, archive or delete tasks (each task is still checked)' })
    bulk(@CurrentOrg() ctx: OrgContext, @Body() dto: BulkTaskDto) {
        return this.tasks.bulk(ctx, dto);
    }

    @Get(':id')
    @RequirePermission('tasks.tasks.read')
    @ApiParam({ name: 'id', description: 'Task uuid or identifier (WEB-142)' })
    @ApiOperation({ summary: 'Get a task with sub-tasks, checklist, links and watchers' })
    findOne(@CurrentOrg() ctx: OrgContext, @Param('id') id: string) {
        return this.tasks.findOne(ctx, id);
    }

    @Patch(':id')
    @RequirePermission('tasks.tasks.update')
    @ApiOperation({ summary: 'Update a task (status follows the workflow transitions)' })
    update(@CurrentOrg() ctx: OrgContext, @Param('id') id: string, @Body() dto: UpdateTaskDto) {
        return this.tasks.update(ctx, id, dto);
    }

    @Delete(':id')
    @RequirePermission('tasks.tasks.delete')
    @ApiOperation({ summary: 'Delete a task permanently' })
    remove(@CurrentOrg() ctx: OrgContext, @Param('id') id: string) {
        return this.tasks.remove(ctx, id);
    }

    @Post(':id/archive')
    @RequirePermission('tasks.tasks.archive')
    @ApiOperation({ summary: 'Archive a task' })
    archive(@CurrentOrg() ctx: OrgContext, @Param('id') id: string) {
        return this.tasks.archive(ctx, id);
    }

    @Post(':id/restore')
    @RequirePermission('tasks.tasks.archive')
    @ApiOperation({ summary: 'Restore an archived task' })
    restore(@CurrentOrg() ctx: OrgContext, @Param('id') id: string) {
        return this.tasks.archive(ctx, id, true);
    }

    @Post(':id/assign')
    @RequirePermission('tasks.tasks.assign')
    @ApiOperation({ summary: 'Assign or unassign a task' })
    assign(@CurrentOrg() ctx: OrgContext, @Param('id') id: string, @Body() dto: AssignTaskDto) {
        return this.tasks.assign(ctx, id, dto);
    }

    @Post(':id/move')
    @RequirePermission('tasks.tasks.update')
    @ApiOperation({ summary: 'Board drag & drop: change column and/or position' })
    move(@CurrentOrg() ctx: OrgContext, @Param('id') id: string, @Body() dto: MoveTaskDto) {
        return this.tasks.move(ctx, id, dto);
    }

    @Get(':id/activity')
    @RequirePermission('tasks.tasks.read')
    @ApiOperation({ summary: 'Status history and audit trail of a task' })
    activity(@CurrentOrg() ctx: OrgContext, @Param('id') id: string) {
        return this.tasks.activity(ctx, id);
    }

    // --- Comments ---

    @Get(':id/comments')
    @RequirePermission('tasks.tasks.read')
    @ApiOperation({ summary: 'Comments (internal ones need tasks.comments.internal.read)' })
    comments(@CurrentOrg() ctx: OrgContext, @Param('id') id: string) {
        return this.details.listComments(ctx, id);
    }

    @Post(':id/comments')
    @RequireAnyPermission('tasks.tasks.update', 'tasks.tasks.create')
    @ApiOperation({ summary: 'Comment on a task (mentions notify members)' })
    comment(@CurrentOrg() ctx: OrgContext, @Param('id') id: string, @Body() dto: CreateCommentDto) {
        return this.details.createComment(ctx, id, dto);
    }

    @Patch(':id/comments/:commentId')
    @RequireAnyPermission('tasks.tasks.update', 'tasks.tasks.create')
    @ApiOperation({ summary: 'Edit your comment' })
    editComment(@CurrentOrg() ctx: OrgContext, @Param('id') id: string, @Param('commentId', ParseUUIDPipe) commentId: string, @Body() dto: UpdateCommentDto) {
        return this.details.updateComment(ctx, id, commentId, dto);
    }

    @Delete(':id/comments/:commentId')
    @RequireAnyPermission('tasks.tasks.update', 'tasks.tasks.create')
    @ApiOperation({ summary: 'Delete a comment (author, or tasks.tasks.delete)' })
    deleteComment(@CurrentOrg() ctx: OrgContext, @Param('id') id: string, @Param('commentId', ParseUUIDPipe) commentId: string) {
        return this.details.deleteComment(ctx, id, commentId);
    }

    // --- Checklist ---

    @Post(':id/checklist')
    @RequirePermission('tasks.tasks.update')
    @ApiOperation({ summary: 'Add a checklist item' })
    addChecklist(@CurrentOrg() ctx: OrgContext, @Param('id') id: string, @Body() dto: CreateChecklistItemDto) {
        return this.details.addChecklistItem(ctx, id, dto);
    }

    @Patch(':id/checklist/:itemId')
    @RequirePermission('tasks.tasks.update')
    @ApiOperation({ summary: 'Tick, rename or reorder a checklist item' })
    updateChecklist(@CurrentOrg() ctx: OrgContext, @Param('id') id: string, @Param('itemId', ParseUUIDPipe) itemId: string, @Body() dto: UpdateChecklistItemDto) {
        return this.details.updateChecklistItem(ctx, id, itemId, dto);
    }

    @Delete(':id/checklist/:itemId')
    @RequirePermission('tasks.tasks.update')
    @ApiOperation({ summary: 'Remove a checklist item' })
    deleteChecklist(@CurrentOrg() ctx: OrgContext, @Param('id') id: string, @Param('itemId', ParseUUIDPipe) itemId: string) {
        return this.details.deleteChecklistItem(ctx, id, itemId);
    }

    // --- Dependencies ---

    @Post(':id/dependencies')
    @RequirePermission('tasks.tasks.update')
    @ApiOperation({ summary: 'Link tasks: blocks / related / duplicate of' })
    addDependency(@CurrentOrg() ctx: OrgContext, @Param('id') id: string, @Body() dto: CreateDependencyDto) {
        return this.details.addDependency(ctx, id, dto);
    }

    @Delete(':id/dependencies/:dependencyId')
    @RequirePermission('tasks.tasks.update')
    @ApiOperation({ summary: 'Remove a task link' })
    removeDependency(@CurrentOrg() ctx: OrgContext, @Param('id') id: string, @Param('dependencyId', ParseUUIDPipe) dependencyId: string) {
        return this.details.removeDependency(ctx, id, dependencyId);
    }

    // --- Watchers ---

    @Post(':id/watchers')
    @RequirePermission('tasks.tasks.read')
    @ApiOperation({ summary: 'Watch a task (adding someone else needs tasks.tasks.update)' })
    watch(@CurrentOrg() ctx: OrgContext, @Param('id') id: string, @Body() dto: WatcherDto) {
        return this.details.watch(ctx, id, dto.membership_id);
    }

    @Delete(':id/watchers')
    @RequirePermission('tasks.tasks.read')
    @ApiOperation({ summary: 'Stop watching a task' })
    unwatch(@CurrentOrg() ctx: OrgContext, @Param('id') id: string) {
        return this.details.unwatch(ctx, id);
    }

    @Delete(':id/watchers/:membershipId')
    @RequirePermission('tasks.tasks.update')
    @ApiOperation({ summary: 'Remove a watcher' })
    removeWatcher(@CurrentOrg() ctx: OrgContext, @Param('id') id: string, @Param('membershipId', ParseUUIDPipe) membershipId: string) {
        return this.details.unwatch(ctx, id, membershipId);
    }

    // --- Attachments ---

    @Post(':id/attachments')
    @RequirePermission('tasks.tasks.update')
    @ApiOperation({ summary: 'Attach a document or a link (metadata; files live in Documents)' })
    addAttachment(@CurrentOrg() ctx: OrgContext, @Param('id') id: string, @Body() dto: AddAttachmentDto) {
        return this.details.addAttachment(ctx, id, dto);
    }

    @Delete(':id/attachments/:attachmentId')
    @RequirePermission('tasks.tasks.update')
    @ApiOperation({ summary: 'Remove an attachment' })
    removeAttachment(@CurrentOrg() ctx: OrgContext, @Param('id') id: string, @Param('attachmentId', ParseUUIDPipe) attachmentId: string) {
        return this.details.removeAttachment(ctx, id, attachmentId);
    }
}
