import { Injectable, OnModuleInit } from '@nestjs/common';
import { ModuleKey } from 'generated/prisma';
import { z } from 'zod';
import { McpRegistry } from '@/core/mcp/mcp.registry';
import { ChannelsService } from './services/channels.service';
import { MessagesService } from './services/messages.service';
import { PresenceService } from './services/presence.service';
import { CreateChannelSchema, OpenDmSchema } from './dto/channel.dto';
import { PostMessageSchema } from './dto/message.dto';
import { BrowseChannelsQuerySchema, DirectoryQuerySchema, InboxQuerySchema, MessageListQuerySchema, SearchMessagesQuerySchema } from './dto/messaging-query.schema';

const id = z.object({ id: z.string().uuid() });

/** MCP tools for Messaging — same service methods (and visibility checks) as REST. */
@Injectable()
export class MessagingMcp implements OnModuleInit {
    constructor(
        private readonly registry: McpRegistry,
        private readonly channels: ChannelsService,
        private readonly messages: MessagesService,
        private readonly presence: PresenceService,
    ) { }

    onModuleInit() {
        const m = ModuleKey.MESSAGING;
        this.registry.registerMany([
            { name: 'messaging_channels_list', description: 'List my channels and DMs with unread and mention counts.', permission: 'messaging.channels.read', module: m, resource_type: 'channel', input: z.object({}), handler: (ctx) => this.channels.mine(ctx) },
            { name: 'messaging_channels_browse', description: 'Browse public channels of the organization (search by name or topic).', permission: 'messaging.channels.read', module: m, resource_type: 'channel', input: BrowseChannelsQuerySchema, handler: (ctx, a) => this.channels.browse(ctx, a) },
            { name: 'messaging_channels_get', description: 'Get one channel.', permission: 'messaging.channels.read', module: m, resource_type: 'channel', input: id, handler: (ctx, a) => this.channels.findOne(ctx, a.id) },
            { name: 'messaging_channels_create', description: 'Create a public or private channel, optionally with members.', permission: 'messaging.channels.create', module: m, resource_type: 'channel', input: CreateChannelSchema, handler: (ctx, a) => this.channels.create(ctx, a) },
            { name: 'messaging_channels_join', description: 'Join a public channel.', permission: 'messaging.channels.read', module: m, resource_type: 'channel', input: id, handler: (ctx, a) => this.channels.join(ctx, a.id) },
            {
                name: 'messaging_channel_members_add', description: 'Add members (membership ids) to a channel.', permission: 'messaging.channel_members.manage', module: m, resource_type: 'channel',
                input: z.object({ id: z.string().uuid(), membership_ids: z.array(z.string().uuid()).min(1).max(200) }), handler: (ctx, a) => this.channels.addMembers(ctx, a.id, { membership_ids: a.membership_ids }),
            },
            { name: 'messaging_dms_open', description: 'Open (or create once) a direct or group message with these members.', permission: 'messaging.messages.post', module: m, resource_type: 'channel', input: OpenDmSchema, handler: (ctx, a) => this.channels.openDm(ctx, a) },
            {
                name: 'messaging_messages_list', description: 'Read messages of a channel, oldest to newest (cursor: before/after message id).', permission: 'messaging.messages.read', module: m, resource_type: 'message',
                input: MessageListQuerySchema.extend({ channel_id: z.string().uuid() }), handler: (ctx, a) => this.messages.list(ctx, a.channel_id, a),
            },
            { name: 'messaging_messages_thread', description: 'Read a thread (root message and replies).', permission: 'messaging.messages.read', module: m, resource_type: 'message', input: id, handler: (ctx, a) => this.messages.thread(ctx, a.id) },
            {
                name: 'messaging_messages_post',
                description: 'Post a message in a channel or reply in a thread (parent_message_id). Mention people with @[Name](membership_id); @channel notifies everyone.',
                permission: 'messaging.messages.post', module: m, resource_type: 'message', sensitive: false,
                input: PostMessageSchema, handler: (ctx, a) => this.messages.post(ctx, a.channel_id, a),
            },
            { name: 'messaging_messages_search', description: 'Search messages in channels I can read.', permission: 'messaging.messages.read', module: m, resource_type: 'message', input: SearchMessagesQuerySchema, handler: (ctx, a) => this.messages.search(ctx, a) },
            { name: 'messaging_messages_react', description: 'Toggle an emoji reaction on a message.', permission: 'messaging.messages.post', module: m, resource_type: 'message', input: z.object({ id: z.string().uuid(), emoji: z.string().min(1).max(64) }), handler: (ctx, a) => this.messages.toggleReaction(ctx, a.id, a.emoji) },
            { name: 'messaging_messages_pin', description: 'Pin a message to its channel.', permission: 'messaging.messages.pin', module: m, resource_type: 'message', input: id, handler: (ctx, a) => this.messages.pin(ctx, a.id, true) },
            { name: 'messaging_messages_delete', description: 'Delete a message (own, or any with messaging.messages.delete_any).', permission: 'messaging.messages.read', module: m, resource_type: 'message', sensitive: true, input: id, handler: (ctx, a) => this.messages.remove(ctx, a.id) },
            { name: 'messaging_mentions_list', description: 'Messages that mention me.', permission: 'messaging.messages.read', module: m, resource_type: 'message', input: InboxQuerySchema, handler: (ctx, a) => this.messages.mentionsInbox(ctx, a) },
            { name: 'messaging_threads_list', description: 'Threads I follow, newest reply first.', permission: 'messaging.messages.read', module: m, resource_type: 'message', input: InboxQuerySchema, handler: (ctx, a) => this.messages.threadsInbox(ctx, a) },
            { name: 'messaging_directory_search', description: 'Find members (for mentions and DMs) with presence.', permission: 'messaging.channels.read', module: m, resource_type: 'membership', input: DirectoryQuerySchema, handler: (ctx, a) => this.presence.directory(ctx, a) },
        ]);
    }
}
