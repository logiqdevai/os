import { Module } from '@nestjs/common';
import { ChannelsController } from './controllers/channels.controller';
import { MessagesController } from './controllers/messages.controller';
import { ChannelsService } from './services/channels.service';
import { MessagesService } from './services/messages.service';
import { MessagingAccessService } from './services/messaging-access.service';
import { MessagingRealtimeService } from './services/messaging-realtime.service';
import { PresenceService } from './services/presence.service';
import { MessagingGateway } from './messaging.gateway';
import { MessagingMcp } from './messaging.mcp';

/** 12 Messaging & Team Communication: channels, DMs, messages, threads, reactions, pins, read state, presence + Socket.IO `/messaging`. */
@Module({
    controllers: [ChannelsController, MessagesController],
    providers: [MessagingAccessService, MessagingRealtimeService, MessagesService, ChannelsService, PresenceService, MessagingGateway, MessagingMcp],
    exports: [MessagingAccessService, MessagesService, ChannelsService, MessagingRealtimeService],
})
export class MessagingModule { }
