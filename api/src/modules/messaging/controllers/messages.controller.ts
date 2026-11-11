import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Put, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtGuard } from '@/shared/guards/jwt.guard';
import { PermissionsGuard } from '@/shared/authorization/guards/permissions.guard';
import { CurrentOrg, RequireAnyPermission, RequirePermission } from '@/shared/authorization/decorators/require-permission.decorator';
import { OrgContext } from '@/shared/authorization/interfaces/org-context.interface';
import { ZodValidationPipe } from '@/shared/pipes/zod.validation.pipe';
import { ChannelsService } from '../services/channels.service';
import { MessagesService } from '../services/messages.service';
import { PresenceService } from '../services/presence.service';
import { OpenDmDto } from '../dto/channel.dto';
import { EditMessageDto, ReactionDto, SaveMessageDto, UpdatePresenceDto } from '../dto/message.dto';
import {
    DirectoryQuery, DirectoryQuerySchema, InboxQuery, InboxQuerySchema, PresenceQuery, PresenceQuerySchema, SearchMessagesQuery, SearchMessagesQuerySchema,
} from '../dto/messaging-query.schema';

/** Message-level actions, DMs, personal inboxes (threads, mentions, saved, drafts), search, directory and presence (12). */
@ApiTags('Messaging · Messages')
@ApiBearerAuth()
@Controller('messaging')
@UseGuards(JwtGuard, PermissionsGuard)
export class MessagesController {
    constructor(
        private readonly channels: ChannelsService,
        private readonly messages: MessagesService,
        private readonly presence: PresenceService,
    ) { }

    @Post('dms')
    @RequirePermission('messaging.messages.post')
    @ApiOperation({ summary: 'Open (or create once) a direct or group message with these members' })
    openDm(@CurrentOrg() ctx: OrgContext, @Body() dto: OpenDmDto) {
        return this.channels.openDm(ctx, dto);
    }

    @Get('search')
    @RequirePermission('messaging.messages.read')
    @ApiOperation({ summary: 'Search messages in channels you can read' })
    search(@CurrentOrg() ctx: OrgContext, @Query(new ZodValidationPipe(SearchMessagesQuerySchema)) query: SearchMessagesQuery) {
        return this.messages.search(ctx, query);
    }

    @Get('threads')
    @RequirePermission('messaging.messages.read')
    @ApiOperation({ summary: 'Threads I follow, newest reply first' })
    threads(@CurrentOrg() ctx: OrgContext, @Query(new ZodValidationPipe(InboxQuerySchema)) query: InboxQuery) {
        return this.messages.threadsInbox(ctx, query);
    }

    @Get('mentions')
    @RequirePermission('messaging.messages.read')
    @ApiOperation({ summary: 'Messages that mention me' })
    mentions(@CurrentOrg() ctx: OrgContext, @Query(new ZodValidationPipe(InboxQuerySchema)) query: InboxQuery) {
        return this.messages.mentionsInbox(ctx, query);
    }

    @Post('mentions/read')
    @RequirePermission('messaging.messages.read')
    @ApiOperation({ summary: 'Mark all my mentions read' })
    mentionsRead(@CurrentOrg() ctx: OrgContext) {
        return this.messages.markMentionsRead(ctx);
    }

    @Get('saved')
    @RequirePermission('messaging.messages.read')
    @ApiOperation({ summary: 'My saved messages' })
    saved(@CurrentOrg() ctx: OrgContext, @Query(new ZodValidationPipe(InboxQuerySchema)) query: InboxQuery) {
        return this.messages.savedList(ctx, query);
    }

    @Get('drafts')
    @RequirePermission('messaging.messages.post')
    @ApiOperation({ summary: 'My unsent drafts' })
    drafts(@CurrentOrg() ctx: OrgContext) {
        return this.messages.drafts(ctx);
    }

    @Get('directory')
    @RequirePermission('messaging.channels.read')
    @ApiOperation({ summary: 'Organization members for mentions and DMs, with presence' })
    directory(@CurrentOrg() ctx: OrgContext, @Query(new ZodValidationPipe(DirectoryQuerySchema)) query: DirectoryQuery) {
        return this.presence.directory(ctx, query);
    }

    @Get('presence')
    @RequirePermission('messaging.channels.read')
    @ApiOperation({ summary: 'Presence of members (default: everyone online)' })
    presenceList(@CurrentOrg() ctx: OrgContext, @Query(new ZodValidationPipe(PresenceQuerySchema)) query: PresenceQuery) {
        return this.presence.list(ctx, query);
    }

    @Get('presence/me')
    @RequirePermission('messaging.channels.read')
    @ApiOperation({ summary: 'My presence and custom status' })
    presenceMe(@CurrentOrg() ctx: OrgContext) {
        return this.presence.me(ctx);
    }

    @Put('presence/me')
    @RequirePermission('messaging.channels.read')
    @ApiOperation({ summary: 'Set Away / Do not disturb and a custom status' })
    updatePresence(@CurrentOrg() ctx: OrgContext, @Body() dto: UpdatePresenceDto) {
        return this.presence.update(ctx, dto);
    }

    @Get('messages/:id')
    @RequirePermission('messaging.messages.read')
    @ApiOperation({ summary: 'Get one message (permalink)' })
    findOne(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.messages.findOne(ctx, id);
    }

    @Patch('messages/:id')
    @RequirePermission('messaging.messages.post')
    @ApiOperation({ summary: 'Edit my message (keeps a MessageVersion)' })
    edit(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: EditMessageDto) {
        return this.messages.edit(ctx, id, dto);
    }

    @Delete('messages/:id')
    @RequireAnyPermission('messaging.messages.post', 'messaging.messages.delete_any')
    @ApiOperation({ summary: 'Delete my message, or anyone\'s with messaging.messages.delete_any' })
    remove(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.messages.remove(ctx, id);
    }

    @Get('messages/:id/thread')
    @RequirePermission('messaging.messages.read')
    @ApiOperation({ summary: 'Thread root and replies' })
    thread(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.messages.thread(ctx, id);
    }

    @Post('messages/:id/thread/read')
    @RequirePermission('messaging.messages.read')
    @ApiOperation({ summary: 'Mark a thread read' })
    threadRead(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.messages.markThreadRead(ctx, id);
    }

    @Put('messages/:id/follow')
    @RequirePermission('messaging.messages.read')
    @ApiOperation({ summary: 'Follow a thread' })
    follow(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.messages.follow(ctx, id, true);
    }

    @Delete('messages/:id/follow')
    @RequirePermission('messaging.messages.read')
    @ApiOperation({ summary: 'Unfollow a thread' })
    unfollow(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.messages.follow(ctx, id, false);
    }

    @Post('messages/:id/reactions')
    @RequirePermission('messaging.messages.post')
    @ApiOperation({ summary: 'Toggle my reaction' })
    react(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: ReactionDto) {
        return this.messages.toggleReaction(ctx, id, dto.emoji);
    }

    @Put('messages/:id/pin')
    @RequirePermission('messaging.messages.pin')
    @ApiOperation({ summary: 'Pin to channel' })
    pin(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.messages.pin(ctx, id, true);
    }

    @Delete('messages/:id/pin')
    @RequirePermission('messaging.messages.pin')
    @ApiOperation({ summary: 'Unpin' })
    unpin(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.messages.pin(ctx, id, false);
    }

    @Put('messages/:id/save')
    @RequirePermission('messaging.messages.read')
    @ApiOperation({ summary: 'Save for later' })
    save(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: SaveMessageDto) {
        return this.messages.save(ctx, id, dto, true);
    }

    @Delete('messages/:id/save')
    @RequirePermission('messaging.messages.read')
    @ApiOperation({ summary: 'Remove from saved' })
    unsave(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.messages.save(ctx, id, {}, false);
    }
}
