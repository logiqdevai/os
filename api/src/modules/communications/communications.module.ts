import { Module } from '@nestjs/common';
import { CommProviderService } from './delivery/comm-provider.service';
import { CommStatsService } from './delivery/comm-stats.service';
import { CommDispatchService } from './delivery/comm-dispatch.service';
import { AudienceService } from './audience/audience.service';
import { ListsService } from './audience/lists.service';
import { SegmentsService } from './audience/segments.service';
import { ComplianceService } from './audience/compliance.service';
import { ComplianceController, ListsController, SegmentsController } from './audience/audience.controller';
import { SendersService } from './senders/senders.service';
import { SendersController } from './senders/senders.controller';
import { TemplatesService } from './templates/templates.service';
import { TemplatesController } from './templates/templates.controller';
import { CampaignsService } from './campaigns/campaigns.service';
import { CampaignRunnerService } from './campaigns/campaign-runner.service';
import { CampaignsController } from './campaigns/campaigns.controller';
import { MessagesService } from './messages/messages.service';
import { MessagesController } from './messages/messages.controller';
import { AnalyticsService } from './analytics/analytics.service';
import { AnalyticsController } from './analytics/analytics.controller';
import { TrackingController } from './tracking/tracking.controller';
import { CommunicationsMcp } from './communications.mcp';

/**
 * 11 Communication Center — outbound email & SMS (docs/features/11-communication-center.md).
 * Provider keys come from the organization's own IntegrationConnection (Resend / Twilio), never from .env.
 * Other modules send through CommDispatchService / MessagesService (exported) so consent, suppression and history stay in one place.
 */
@Module({
    controllers: [
        AnalyticsController, CampaignsController, TemplatesController, ListsController, SegmentsController, ComplianceController,
        MessagesController, SendersController, TrackingController,
    ],
    providers: [
        CommProviderService, CommStatsService, CommDispatchService, AudienceService, ListsService, SegmentsService, ComplianceService,
        SendersService, TemplatesService, CampaignsService, CampaignRunnerService, MessagesService, AnalyticsService, CommunicationsMcp,
    ],
    exports: [MessagesService, CommDispatchService, TemplatesService],
})
export class CommunicationsModule { }
