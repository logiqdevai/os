import { Module } from '@nestjs/common';
import { FilesModule } from '@/modules/files/files.module';
import { ChannelsController } from './controllers/channels.controller';
import { MessagesController } from './controllers/messages.controller';
import { MessagingWorkspaceController } from './controllers/workspace.controller';
import { MessagingAdminController, MessagingHooksController } from './controllers/messaging-admin.controller';
import { ChannelsService } from './services/channels.service';
import { MessagesService } from './services/messages.service';
import { MessagingAccessService } from './services/messaging-access.service';
import { MessagingRealtimeService } from './services/messaging-realtime.service';
import { PresenceService } from './services/presence.service';
import { MessagingAttachmentsService } from './services/attachments.service';
import { ChannelCallsService } from './services/calls.service';
import { MessagingModerationService } from './services/moderation.service';
import { MessagingGovernanceService } from './services/governance.service';
import { MessagingAdminService } from './services/messaging-admin.service';
import { MessagingGateway } from './messaging.gateway';
import { MessagingMcp } from './messaging.mcp';

/**
 * 12 Messaging & Team Communication: channels, DMs, messages, threads, reactions, pins, read state, presence + Socket.IO `/messaging`;
 * files (17 Documents), huddles / calls, moderation, retention + legal hold + exports, admin (overview, guests, settings, integrations).
 */
@Module({
    imports: [FilesModule],
    controllers: [ChannelsController, MessagesController, MessagingWorkspaceController, MessagingAdminController, MessagingHooksController],
    providers: [
        MessagingAccessService, MessagingRealtimeService, MessagesService, ChannelsService, PresenceService, MessagingGateway, MessagingMcp,
        MessagingAttachmentsService, ChannelCallsService, MessagingModerationService, MessagingGovernanceService, MessagingAdminService,
    ],
    exports: [MessagingAccessService, MessagesService, ChannelsService, MessagingRealtimeService],
})
export class MessagingModule { }
