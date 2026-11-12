import { Injectable, OnModuleInit } from '@nestjs/common';
import { ModuleKey } from 'generated/prisma';
import { z } from 'zod';
import { McpRegistry } from '@/core/mcp/mcp.registry';
import { ChannelsService } from './services/channels.service';
import { MessagesService } from './services/messages.service';
import { PresenceService } from './services/presence.service';
import { CallQuerySchema, ChannelCallsService, StartCallSchema } from './services/calls.service';
import { DecideReportSchema, MessagingModerationService, ReportMessageSchema, ReportQuerySchema } from './services/moderation.service';
import { ExportSchema, LegalHoldSchema, MessagingGovernanceService } from './services/governance.service';
import { MessagingAdminService, MessagingSettingsSchema, OverviewQuerySchema } from './services/messaging-admin.service';
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
        private readonly calls: ChannelCallsService,
        private readonly moderation: MessagingModerationService,
        private readonly governance: MessagingGovernanceService,
        private readonly admin: MessagingAdminService,
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
            { name: 'messaging_calls_list', description: 'Active (or recent) huddles and calls in channels I can read, with who is in them.', permission: 'messaging.channels.read', module: m, resource_type: 'channel_call', input: CallQuerySchema, handler: (ctx, a) => this.calls.list(ctx, a) },
            { name: 'messaging_calls_start', description: 'Start a huddle / call in a channel (or join the running one). In-app audio/camera is peer-to-peer WebRTC joined from the app (max 6 media peers); pass meeting_url for an external meeting.', permission: 'messaging.calls.start', module: m, resource_type: 'channel_call', input: StartCallSchema.extend({ channel_id: z.string().uuid() }), handler: (ctx, { channel_id, ...a }) => this.calls.start(ctx, channel_id, a) },
            { name: 'messaging_messages_report', description: 'Report a message to the moderators.', permission: 'messaging.messages.read', module: m, resource_type: 'message', input: ReportMessageSchema.extend({ id: z.string().uuid() }), handler: (ctx, { id: mid, ...a }) => this.moderation.report(ctx, mid, a) },
            { name: 'messaging_moderation_reports', description: 'Moderation queue: reported messages (status OPEN | UNDER_REVIEW | ACTIONED | DISMISSED).', permission: 'messaging.moderation.manage', module: m, resource_type: 'message_report', input: ReportQuerySchema, handler: (ctx, a) => this.moderation.reports(ctx, a) },
            { name: 'messaging_moderation_review', description: 'Decide a report: dismiss, or hide / delete the message, mute / ban the author.', permission: 'messaging.moderation.manage', module: m, resource_type: 'message_report', sensitive: true, input: DecideReportSchema.extend({ id: z.string().uuid() }), handler: (ctx, { id: rid, ...a }) => this.moderation.decide(ctx, rid, a) },
            { name: 'messaging_retention_manage', description: 'List retention policies and legal holds.', permission: 'messaging.retention.manage', module: m, resource_type: 'messaging_retention_policy', input: z.object({}), handler: async (ctx) => ({ policies: (await this.governance.policies(ctx)).data, holds: (await this.governance.holds(ctx)).data }) },
            { name: 'messaging_legal_holds_create', description: 'Put channels and / or people on legal hold (retention never deletes held messages).', permission: 'messaging.retention.manage', module: m, resource_type: 'messaging_legal_hold', sensitive: true, input: LegalHoldSchema, handler: (ctx, a) => this.governance.createHold(ctx, a) },
            { name: 'messaging_data_export', description: 'Request an export of messages (JSON / CSV / HTML) by channel, kind, person and dates.', permission: 'messaging.data.export', module: m, resource_type: 'messaging_export_job', sensitive: true, input: ExportSchema, handler: (ctx, a) => this.governance.requestExport(ctx, a) },
            { name: 'messaging_admin_overview_read', description: 'Messaging usage overview (messages, DMs, threads, files, calls, guests, moderation) for 7d / 30d / 90d.', permission: 'messaging.analytics.read', module: m, resource_type: 'messaging_usage', input: OverviewQuerySchema, handler: (ctx, a) => this.admin.overview(ctx, a) },
            { name: 'messaging_settings_manage', description: 'Change organization messaging settings (calls, guests, edit / delete windows, file policy).', permission: 'messaging.settings.manage', module: m, resource_type: 'messaging_settings', sensitive: true, input: MessagingSettingsSchema, handler: (ctx, a) => this.admin.updateSettings(ctx, a) },
            { name: 'messaging_directory_search', description: 'Find members (for mentions and DMs) with presence.', permission: 'messaging.channels.read', module: m, resource_type: 'membership', input: DirectoryQuerySchema, handler: (ctx, a) => this.presence.directory(ctx, a) },
        ]);
    }
}
