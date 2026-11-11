import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtGuard } from '@/shared/guards/jwt.guard';
import { PermissionsGuard } from '@/shared/authorization/guards/permissions.guard';
import { CurrentOrg, RequirePermission } from '@/shared/authorization/decorators/require-permission.decorator';
import { OrgContext } from '@/shared/authorization/interfaces/org-context.interface';
import { ZodValidationPipe } from '@/shared/pipes/zod.validation.pipe';
import { ConversationsService } from './conversations.service';
import {
    AddParticipantDto,
    AssignConversationDto,
    ConversationQuery,
    ConversationQuerySchema,
    CreateConversationDto,
    MergeConversationDto,
    PostMessageDto,
    SnoozeConversationDto,
    UpdateConversationDto,
} from './dto/conversation.dto';

@ApiTags('Support · Conversations')
@ApiBearerAuth()
@Controller('support/conversations')
@UseGuards(JwtGuard, PermissionsGuard)
export class ConversationsController {
    constructor(private readonly conversations: ConversationsService) { }

    @Get()
    @RequirePermission('support.conversations.read')
    @ApiOperation({ summary: 'Unified inbox (views: all, mine, unassigned, mentions, participating)' })
    findAll(@CurrentOrg() ctx: OrgContext, @Query(new ZodValidationPipe(ConversationQuerySchema)) query: ConversationQuery) {
        return this.conversations.findAll(ctx, query);
    }

    @Get('counts')
    @RequirePermission('support.conversations.read')
    @ApiOperation({ summary: 'Open conversation counts per inbox view' })
    counts(@CurrentOrg() ctx: OrgContext) {
        return this.conversations.counts(ctx);
    }

    @Get(':id')
    @RequirePermission('support.conversations.read')
    @ApiOperation({ summary: 'Conversation with messages (replies and internal notes), tickets and customer history' })
    findOne(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.conversations.findOne(ctx, id);
    }

    @Post()
    @RequirePermission('support.conversations.create')
    @ApiOperation({ summary: 'Start an outbound conversation or log an inbound one' })
    create(@CurrentOrg() ctx: OrgContext, @Body() dto: CreateConversationDto) {
        return this.conversations.create(ctx, dto);
    }

    @Post(':id/messages')
    @RequirePermission('support.conversations.reply')
    @ApiOperation({ summary: 'Send a reply (AGENT) or add a private internal note (INTERNAL_NOTE)' })
    postMessage(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: PostMessageDto) {
        return this.conversations.postMessage(ctx, id, dto);
    }

    @Post(':id/read')
    @RequirePermission('support.conversations.read')
    @ApiOperation({ summary: 'Mark the conversation read for me' })
    markRead(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.conversations.markRead(ctx, id);
    }

    @Post(':id/assign')
    @RequirePermission('support.conversations.assign')
    @ApiOperation({ summary: 'Assign (or unassign) the conversation' })
    assign(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: AssignConversationDto) {
        return this.conversations.assign(ctx, id, dto);
    }

    @Patch(':id')
    @RequirePermission('support.conversations.update')
    @ApiOperation({ summary: 'Update subject, priority, team, customer or transfer to another inbox' })
    update(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateConversationDto) {
        return this.conversations.update(ctx, id, dto);
    }

    @Post(':id/snooze')
    @RequirePermission('support.conversations.update')
    @ApiOperation({ summary: 'Snooze until a date (reopens automatically)' })
    snooze(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: SnoozeConversationDto) {
        return this.conversations.snooze(ctx, id, dto.until);
    }

    @Post(':id/pending')
    @RequirePermission('support.conversations.update')
    @ApiOperation({ summary: 'Mark pending (waiting on the customer)' })
    pending(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.conversations.setPending(ctx, id);
    }

    @Post(':id/close')
    @RequirePermission('support.conversations.close')
    @ApiOperation({ summary: 'Resolve the conversation (requests CSAT when enabled)' })
    close(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.conversations.close(ctx, id);
    }

    @Post(':id/reopen')
    @RequirePermission('support.conversations.close')
    @ApiOperation({ summary: 'Reopen a resolved or snoozed conversation' })
    reopen(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.conversations.reopen(ctx, id);
    }

    @Post(':id/participants')
    @RequirePermission('support.conversations.update')
    @ApiOperation({ summary: 'Add a collaborator' })
    addParticipant(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: AddParticipantDto) {
        return this.conversations.addParticipant(ctx, id, dto);
    }

    @Delete(':id/participants/:membershipId')
    @RequirePermission('support.conversations.update')
    @ApiOperation({ summary: 'Remove a collaborator' })
    removeParticipant(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Param('membershipId', ParseUUIDPipe) membershipId: string) {
        return this.conversations.removeParticipant(ctx, id, membershipId);
    }

    @Post(':id/merge')
    @RequirePermission('support.conversations.update')
    @ApiOperation({ summary: 'Merge into another conversation' })
    merge(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: MergeConversationDto) {
        return this.conversations.merge(ctx, id, dto);
    }
}
