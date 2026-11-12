import { Module } from '@nestjs/common';
import { NumberingModule } from '@/modules/numbering/numbering.module';
import { SupportSetupService } from './common/support-setup.service';
import { SlaService } from './sla/sla.service';
import { SlaPoliciesService } from './sla/sla-policies.service';
import { SlaPoliciesController } from './sla/sla-policies.controller';
import { SupportSettingsService } from './settings/support-settings.service';
import { SupportSettingsController } from './settings/support-settings.controller';
import { InboxesService } from './inboxes/inboxes.service';
import { InboxesController } from './inboxes/inboxes.controller';
import { ConversationsService } from './conversations/conversations.service';
import { ConversationsController } from './conversations/conversations.controller';
import { TicketWorkflowService } from './tickets/ticket-workflow.service';
import { TicketsService } from './tickets/tickets.service';
import { TicketConfigService } from './tickets/ticket-config.service';
import { TicketConfigController, TicketsController } from './tickets/tickets.controller';
import { CsatService } from './csat/csat.service';
import { CsatController } from './csat/csat.controller';
import { CannedResponsesService } from './canned-responses/canned-responses.service';
import { CannedResponsesController } from './canned-responses/canned-responses.controller';
import { KnowledgeService } from './knowledge/knowledge.service';
import { HelpCenterController, KnowledgeController } from './knowledge/knowledge.controller';
import { IncidentsService } from './incidents/incidents.service';
import { IncidentsController } from './incidents/incidents.controller';
import { SupportAnalyticsService } from './analytics/analytics.service';
import { SupportAnalyticsController } from './analytics/analytics.controller';
import { SupportAiService } from './ai/support-ai.service';
import { SupportAiController } from './ai/support-ai.controller';
import { SupportAiAgentService } from './ai/support-ai-agent.service';
import { SupportMcp } from './support.mcp';
import { SupportWidgetService } from './widget/widget.service';
import { SupportWidgetController } from './widget/widget.controller';
import { SupportRealtimeService } from './realtime/support-realtime.service';
import { SupportGateway } from './realtime/support.gateway';
import { CommunicationsModule } from '@/modules/communications/communications.module';
import { AiIntegrationModule } from '@/integrations/ai/ai.module';
import { SupportEmailService } from './email/support-email.service';
import { SupportEmailInboundController, SupportEmailSetupController } from './email/support-email.controller';

/** 13 Customer Support & Communication Hub (docs/features/13-customer-support-communication-hub.md). */
@Module({
    imports: [NumberingModule, CommunicationsModule, AiIntegrationModule],
    controllers: [
        SupportSettingsController,
        InboxesController,
        ConversationsController,
        TicketsController,
        TicketConfigController,
        SlaPoliciesController,
        CsatController,
        CannedResponsesController,
        KnowledgeController,
        HelpCenterController,
        IncidentsController,
        SupportAnalyticsController,
        SupportAiController,
        SupportWidgetController,
        SupportEmailSetupController,
        SupportEmailInboundController,
    ],
    providers: [
        SupportSetupService,
        SlaService,
        SlaPoliciesService,
        SupportSettingsService,
        InboxesService,
        ConversationsService,
        TicketWorkflowService,
        TicketsService,
        TicketConfigService,
        CsatService,
        CannedResponsesService,
        KnowledgeService,
        IncidentsService,
        SupportAnalyticsService,
        SupportAiService,
        SupportAiAgentService,
        SupportMcp,
        SupportWidgetService,
        SupportRealtimeService,
        SupportGateway,
        SupportEmailService,
    ],
    exports: [TicketsService, ConversationsService, KnowledgeService, CsatService, SupportSetupService, TicketWorkflowService],
})
export class SupportModule { }
