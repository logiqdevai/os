import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Put, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtGuard } from '@/shared/guards/jwt.guard';
import { PermissionsGuard } from '@/shared/authorization/guards/permissions.guard';
import { CurrentOrg, RequireAnyPermission, RequirePermission } from '@/shared/authorization/decorators/require-permission.decorator';
import { OrgContext } from '@/shared/authorization/interfaces/org-context.interface';
import { ZodValidationPipe } from '@/shared/pipes/zod.validation.pipe';
import { ChannelsService } from '../services/channels.service';
import { MessagesService } from '../services/messages.service';
import { AddChannelMembersDto, ChannelPreferencesDto, CreateChannelDto, UpdateChannelDto } from '../dto/channel.dto';
import { MarkReadDto, PostMessageDto, SaveDraftDto } from '../dto/message.dto';
import { BrowseChannelsQuery, BrowseChannelsQuerySchema, MessageListQuery, MessageListQuerySchema } from '../dto/messaging-query.schema';
import { boolish } from '@/shared/utils/pagination/pagination.utils';
import { z } from 'zod';

const MineQuerySchema = z.object({ archived: boolish });
const DraftQuerySchema = z.object({ thread_root_message_id: z.string().uuid().optional() });

/**
 * Channels, membership and channel-scoped message endpoints (12). Membership, visibility (private → 404) and channel roles are
 * enforced in the services on top of the permission keys below.
 */
@ApiTags('Messaging · Channels')
@ApiBearerAuth()
@Controller('messaging/channels')
@UseGuards(JwtGuard, PermissionsGuard)
export class ChannelsController {
    constructor(
        private readonly channels: ChannelsService,
        private readonly messages: MessagesService,
    ) { }

    @Get()
    @RequirePermission('messaging.channels.read')
    @ApiOperation({ summary: 'My channels and DMs with unread and mention counts (sidebar)' })
    mine(@CurrentOrg() ctx: OrgContext, @Query(new ZodValidationPipe(MineQuerySchema)) query: { archived?: boolean }) {
        return this.channels.mine(ctx, !!query.archived);
    }

    @Get('browse')
    @RequirePermission('messaging.channels.read')
    @ApiOperation({ summary: 'Browse discoverable channels' })
    browse(@CurrentOrg() ctx: OrgContext, @Query(new ZodValidationPipe(BrowseChannelsQuerySchema)) query: BrowseChannelsQuery) {
        return this.channels.browse(ctx, query);
    }

    @Get('sources')
    @RequirePermission('messaging.channels.create')
    @ApiOperation({ summary: 'Teams and projects a new channel can be created for, with their member ids' })
    sources(@CurrentOrg() ctx: OrgContext, @Query(new ZodValidationPipe(z.object({ search: z.string().max(100).optional() }))) query: { search?: string }) {
        return this.channels.sources(ctx, query.search);
    }

    @Post()
    @RequirePermission('messaging.channels.create')
    @ApiOperation({ summary: 'Create a public or private channel' })
    create(@CurrentOrg() ctx: OrgContext, @Body() dto: CreateChannelDto) {
        return this.channels.create(ctx, dto);
    }

    @Get(':id')
    @RequirePermission('messaging.channels.read')
    @ApiOperation({ summary: 'Get a channel (404 for private channels you are not in)' })
    findOne(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.channels.findOne(ctx, id);
    }

    @Patch(':id')
    @RequirePermission('messaging.channels.read')
    @ApiOperation({ summary: 'Update name / description / purpose (channel admins) or topic (any member)' })
    update(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateChannelDto) {
        return this.channels.update(ctx, id, dto);
    }

    @Post(':id/archive')
    @RequireAnyPermission('messaging.channels.create', 'messaging.channels.manage')
    @ApiOperation({ summary: 'Archive a channel (read-only afterwards)' })
    archive(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.channels.setArchived(ctx, id, true);
    }

    @Post(':id/unarchive')
    @RequireAnyPermission('messaging.channels.create', 'messaging.channels.manage')
    @ApiOperation({ summary: 'Unarchive a channel' })
    unarchive(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.channels.setArchived(ctx, id, false);
    }

    @Post(':id/join')
    @RequirePermission('messaging.channels.read')
    @ApiOperation({ summary: 'Join an open channel' })
    join(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.channels.join(ctx, id);
    }

    @Post(':id/leave')
    @RequirePermission('messaging.channels.read')
    @ApiOperation({ summary: 'Leave a channel or group DM' })
    leave(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.channels.leave(ctx, id);
    }

    @Get(':id/members')
    @RequirePermission('messaging.channels.read')
    @ApiOperation({ summary: 'Channel members' })
    members(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.channels.members(ctx, id);
    }

    @Post(':id/members')
    @RequirePermission('messaging.channel_members.manage')
    @ApiOperation({ summary: 'Add members (and external people when allowed)' })
    addMembers(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: AddChannelMembersDto) {
        return this.channels.addMembers(ctx, id, dto);
    }

    @Delete(':id/members/:memberId')
    @RequirePermission('messaging.channel_members.manage')
    @ApiOperation({ summary: 'Remove a member (channel admins)' })
    removeMember(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Param('memberId', ParseUUIDPipe) memberId: string) {
        return this.channels.removeMember(ctx, id, memberId);
    }

    @Patch(':id/preferences')
    @RequirePermission('messaging.channels.read')
    @ApiOperation({ summary: 'My favorite / mute settings for a channel' })
    preferences(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: ChannelPreferencesDto) {
        return this.channels.preferences(ctx, id, dto);
    }

    @Get(':id/messages')
    @RequirePermission('messaging.messages.read')
    @ApiOperation({ summary: 'Top-level messages, oldest → newest; cursor with before / after (message ids)' })
    listMessages(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Query(new ZodValidationPipe(MessageListQuerySchema)) query: MessageListQuery) {
        return this.messages.list(ctx, id, query);
    }

    @Post(':id/messages')
    @RequirePermission('messaging.messages.post')
    @ApiOperation({ summary: 'Post a message or a thread reply (parent_message_id). Mentions: @[Name](membership_id), @channel, @here' })
    post(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: PostMessageDto) {
        return this.messages.post(ctx, id, dto);
    }

    @Get(':id/pins')
    @RequirePermission('messaging.messages.read')
    @ApiOperation({ summary: 'Pinned messages' })
    pins(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.messages.pins(ctx, id);
    }

    @Post(':id/read')
    @RequirePermission('messaging.messages.read')
    @ApiOperation({ summary: 'Mark the channel read up to a message (default: newest)' })
    markRead(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: MarkReadDto) {
        return this.messages.markRead(ctx, id, dto);
    }

    @Get(':id/draft')
    @RequirePermission('messaging.messages.post')
    @ApiOperation({ summary: 'My unsent draft in this channel (or thread)' })
    getDraft(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Query(new ZodValidationPipe(DraftQuerySchema)) query: { thread_root_message_id?: string }) {
        return this.messages.getDraft(ctx, id, query.thread_root_message_id);
    }

    @Put(':id/draft')
    @RequirePermission('messaging.messages.post')
    @ApiOperation({ summary: 'Save my draft (empty body deletes it)' })
    saveDraft(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: SaveDraftDto) {
        return this.messages.saveDraft(ctx, id, dto);
    }

    @Delete(':id/draft')
    @RequirePermission('messaging.messages.post')
    @ApiOperation({ summary: 'Discard my draft' })
    deleteDraft(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Query(new ZodValidationPipe(DraftQuerySchema)) query: { thread_root_message_id?: string }) {
        return this.messages.deleteDraft(ctx, id, query.thread_root_message_id);
    }
}
