import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtGuard } from '@/shared/guards/jwt.guard';
import { PermissionsGuard } from '@/shared/authorization/guards/permissions.guard';
import { CurrentOrg, RequireAnyPermission, RequirePermission } from '@/shared/authorization/decorators/require-permission.decorator';
import { OrgContext } from '@/shared/authorization/interfaces/org-context.interface';
import { ZodValidationPipe } from '@/shared/pipes/zod.validation.pipe';
import { TicketsService } from './tickets.service';
import { TicketConfigService } from './ticket-config.service';
import {
    AssignTicketDto,
    ChangeTicketStatusDto,
    ConvertToTaskDto,
    CreateTicketDto,
    EscalateTicketDto,
    FollowerDto,
    LinkConversationDto,
    LinkTaskDto,
    MergeTicketDto,
    TicketQuery,
    TicketQuerySchema,
    TicketRelationDto,
    TicketReplyDto,
    UpdateTicketDto,
} from './dto/ticket.dto';
import { ArchiveTicketStatusDto, CreateTicketCategoryDto, CreateTicketStatusDto, ReorderDto, UpdateTicketCategoryDto, UpdateTicketStatusDto } from './dto/ticket-config.dto';

@ApiTags('Support · Tickets')
@ApiBearerAuth()
@Controller('support/tickets')
@UseGuards(JwtGuard, PermissionsGuard)
export class TicketsController {
    constructor(private readonly tickets: TicketsService) { }

    @Get()
    @RequirePermission('support.tickets.read')
    @ApiOperation({ summary: 'List tickets (scope-limited; filters: state, status, priority, assignee=me|unassigned|id, sla, …)' })
    findAll(@CurrentOrg() ctx: OrgContext, @Query(new ZodValidationPipe(TicketQuerySchema)) q: TicketQuery) {
        return this.tickets.findAll(ctx, q);
    }

    @Get('counts')
    @RequirePermission('support.tickets.read')
    @ApiOperation({ summary: 'Counts for the ticket views' })
    counts(@CurrentOrg() ctx: OrgContext) {
        return this.tickets.counts(ctx);
    }

    @Get(':idOrReference')
    @RequirePermission('support.tickets.read')
    @ApiOperation({ summary: 'Get a ticket by id or reference (SUP-1042)' })
    findOne(@CurrentOrg() ctx: OrgContext, @Param('idOrReference') idOrReference: string) {
        return this.tickets.findOne(ctx, idOrReference);
    }

    @Get(':id/messages')
    @RequirePermission('support.tickets.read')
    @ApiOperation({ summary: 'Ticket thread (replies and internal notes of its conversations)' })
    messages(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.tickets.messages(ctx, id);
    }

    @Post()
    @RequirePermission('support.tickets.create')
    @ApiOperation({ summary: 'Create a ticket (SLA timers start immediately)' })
    create(@CurrentOrg() ctx: OrgContext, @Body() dto: CreateTicketDto) {
        return this.tickets.create(ctx, dto);
    }

    @Patch(':id')
    @RequirePermission('support.tickets.update')
    @ApiOperation({ summary: 'Update a ticket (priority / policy changes recompute SLA)' })
    update(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateTicketDto) {
        return this.tickets.update(ctx, id, dto);
    }

    @Post(':id/status')
    @RequirePermission('support.tickets.update')
    @ApiOperation({ summary: 'Change status (workflow transitions enforced; resolve requests CSAT)' })
    status(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: ChangeTicketStatusDto) {
        return this.tickets.changeStatus(ctx, id, dto);
    }

    @Post(':id/assign')
    @RequirePermission('support.tickets.assign')
    @ApiOperation({ summary: 'Assign the ticket to a member and/or team' })
    assign(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: AssignTicketDto) {
        return this.tickets.assign(ctx, id, dto);
    }

    @Post(':id/escalate')
    @RequirePermission('support.tickets.escalate')
    @ApiOperation({ summary: 'Escalate the ticket' })
    escalate(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: EscalateTicketDto) {
        return this.tickets.escalate(ctx, id, dto);
    }

    @Post(':id/merge')
    @RequirePermission('support.tickets.merge')
    @ApiOperation({ summary: 'Merge into another ticket (source is closed as duplicate)' })
    merge(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: MergeTicketDto) {
        return this.tickets.merge(ctx, id, dto);
    }

    @Post(':id/replies')
    @RequirePermission('support.conversations.reply')
    @ApiOperation({ summary: 'Reply to the requester (AGENT) or add an internal note' })
    reply(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: TicketReplyDto) {
        return this.tickets.reply(ctx, id, dto);
    }

    @Post(':id/followers')
    @RequirePermission('support.tickets.read')
    @ApiOperation({ summary: 'Follow the ticket (others need support.tickets.update)' })
    follow(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: FollowerDto) {
        return this.tickets.follow(ctx, id, dto.membership_id);
    }

    @Delete(':id/followers/:membershipId')
    @RequirePermission('support.tickets.read')
    @ApiOperation({ summary: 'Unfollow (others need support.tickets.update)' })
    unfollow(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Param('membershipId', ParseUUIDPipe) membershipId: string) {
        return this.tickets.unfollow(ctx, id, membershipId);
    }

    @Post(':id/relations')
    @RequirePermission('support.tickets.update')
    @ApiOperation({ summary: 'Relate to another ticket (related, duplicate, blocks, same incident)' })
    addRelation(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: TicketRelationDto) {
        return this.tickets.addRelation(ctx, id, dto);
    }

    @Delete(':id/relations/:relationId')
    @RequirePermission('support.tickets.update')
    @ApiOperation({ summary: 'Remove a relation' })
    removeRelation(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Param('relationId', ParseUUIDPipe) relationId: string) {
        return this.tickets.removeRelation(ctx, id, relationId);
    }

    @Post(':id/conversations')
    @RequirePermission('support.tickets.update')
    @ApiOperation({ summary: 'Link a conversation to the ticket' })
    linkConversation(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: LinkConversationDto) {
        return this.tickets.linkConversation(ctx, id, dto.conversation_id);
    }

    @Post(':id/convert-to-task')
    @RequirePermission('support.tickets.convert_to_task')
    @ApiOperation({ summary: 'Convert to a Task (06) with a permanent link (also needs tasks.tasks.create)' })
    convert(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: ConvertToTaskDto) {
        return this.tickets.convertToTask(ctx, id, dto);
    }

    @Post(':id/tasks')
    @RequirePermission('support.tickets.update')
    @ApiOperation({ summary: 'Link an existing task' })
    linkTask(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: LinkTaskDto) {
        return this.tickets.linkTask(ctx, id, dto.task_id);
    }

    @Delete(':id/tasks/:taskId')
    @RequirePermission('support.tickets.update')
    @ApiOperation({ summary: 'Unlink a task' })
    unlinkTask(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Param('taskId', ParseUUIDPipe) taskId: string) {
        return this.tickets.unlinkTask(ctx, id, taskId);
    }

    @Post(':id/archive')
    @RequirePermission('support.tickets.archive')
    @ApiOperation({ summary: 'Archive a ticket' })
    archive(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.tickets.archive(ctx, id);
    }

    @Post(':id/restore')
    @RequirePermission('support.tickets.archive')
    @ApiOperation({ summary: 'Restore an archived ticket' })
    restore(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.tickets.restore(ctx, id);
    }
}

@ApiTags('Support · Ticket setup')
@ApiBearerAuth()
@Controller('support')
@UseGuards(JwtGuard, PermissionsGuard)
export class TicketConfigController {
    constructor(private readonly config: TicketConfigService) { }

    @Get('ticket-statuses')
    @RequireAnyPermission('support.tickets.read', 'support.settings.manage')
    @ApiOperation({ summary: 'Ticket statuses (defaults created on first use)' })
    statuses(@CurrentOrg() ctx: OrgContext, @Query('archived') archived?: string) {
        return this.config.statuses(ctx, archived === 'true');
    }

    @Post('ticket-statuses')
    @RequirePermission('support.settings.manage')
    @ApiOperation({ summary: 'Create a ticket status' })
    createStatus(@CurrentOrg() ctx: OrgContext, @Body() dto: CreateTicketStatusDto) {
        return this.config.createStatus(ctx, dto);
    }

    @Post('ticket-statuses/reorder')
    @RequirePermission('support.settings.manage')
    @ApiOperation({ summary: 'Reorder ticket statuses' })
    reorderStatuses(@CurrentOrg() ctx: OrgContext, @Body() dto: ReorderDto) {
        return this.config.reorderStatuses(ctx, dto.ids);
    }

    @Patch('ticket-statuses/:id')
    @RequirePermission('support.settings.manage')
    @ApiOperation({ summary: 'Update a ticket status' })
    updateStatus(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateTicketStatusDto) {
        return this.config.updateStatus(ctx, id, dto);
    }

    @Post('ticket-statuses/:id/archive')
    @RequirePermission('support.settings.manage')
    @ApiOperation({ summary: 'Archive a status (tickets move to the replacement)' })
    archiveStatus(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: ArchiveTicketStatusDto) {
        return this.config.archiveStatus(ctx, id, dto);
    }

    @Get('ticket-categories')
    @RequireAnyPermission('support.tickets.read', 'support.settings.manage')
    @ApiOperation({ summary: 'Ticket categories' })
    categories(@CurrentOrg() ctx: OrgContext, @Query('archived') archived?: string) {
        return this.config.categories(ctx, archived === 'true');
    }

    @Post('ticket-categories')
    @RequirePermission('support.settings.manage')
    @ApiOperation({ summary: 'Create a ticket category' })
    createCategory(@CurrentOrg() ctx: OrgContext, @Body() dto: CreateTicketCategoryDto) {
        return this.config.createCategory(ctx, dto);
    }

    @Patch('ticket-categories/:id')
    @RequirePermission('support.settings.manage')
    @ApiOperation({ summary: 'Update a ticket category' })
    updateCategory(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateTicketCategoryDto) {
        return this.config.updateCategory(ctx, id, dto);
    }

    @Post('ticket-categories/:id/archive')
    @RequirePermission('support.settings.manage')
    @ApiOperation({ summary: 'Archive a ticket category' })
    archiveCategory(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.config.archiveCategory(ctx, id);
    }
}
