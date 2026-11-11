import { Module } from '@nestjs/common';
import { AutomationMcp } from './automation.mcp';
import { AutomationEngineService } from './engine/automation-engine.service';
import { AutomationWorkerService } from './engine/automation-worker.service';
import { JobHandlerRegistry } from './jobs/job-handler.registry';
import { JobsController } from './jobs/jobs.controller';
import { JobsService } from './jobs/jobs.service';
import { SchedulerService } from './jobs/scheduler.service';
import { RulesController } from './rules/rules.controller';
import { RulesService } from './rules/rules.service';
import { RunsController } from './runs/runs.controller';
import { RunsService } from './runs/runs.service';
import { AutomationInsightsService } from './settings/automation-insights.service';
import { AutomationSettingsController } from './settings/automation-settings.controller';
import { AutomationSettingsService } from './settings/automation-settings.service';
import { WebhookDeliveryService } from './webhooks/webhook-delivery.service';
import { InboundReceiverController, WebhooksController } from './webhooks/webhooks.controller';
import { WebhooksService } from './webhooks/webhooks.service';

/**
 * 20 Automation Engine. Other modules:
 *  - publish events with `EventsService.publish` (the engine consumes the bus) and add their keys to `catalog/trigger-catalog.ts`;
 *  - expose actions as MCP tools and list them in `catalog/action-catalog.ts`;
 *  - host recurring work with `JobHandlerRegistry.register(...)` + `SchedulerService.ensureJob(...)` (both exported).
 */
@Module({
    controllers: [RulesController, RunsController, WebhooksController, InboundReceiverController, JobsController, AutomationSettingsController],
    providers: [
        JobHandlerRegistry,
        SchedulerService,
        AutomationSettingsService,
        WebhookDeliveryService,
        AutomationEngineService,
        AutomationWorkerService,
        RulesService,
        RunsService,
        WebhooksService,
        JobsService,
        AutomationInsightsService,
        AutomationMcp,
    ],
    exports: [JobHandlerRegistry, SchedulerService, AutomationEngineService, WebhookDeliveryService],
})
export class AutomationModule { }
