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
import { SupportMcp } from './support.mcp';

/** 13 Customer Support & Communication Hub (docs/features/13-customer-support-communication-hub.md). */
@Module({
    imports: [NumberingModule],
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
        SupportMcp,
    ],
    exports: [TicketsService, ConversationsService, KnowledgeService, CsatService, SupportSetupService, TicketWorkflowService],
})
export class SupportModule { }
