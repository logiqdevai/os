import { Injectable, OnModuleInit } from '@nestjs/common';
import { AutomationRunMode, ModuleKey } from 'generated/prisma';
import { z } from 'zod';
import { McpRegistry } from '@/core/mcp/mcp.registry';
import { RulesService } from './rules/rules.service';
import { RunsService } from './runs/runs.service';
import { JobsService } from './jobs/jobs.service';
import { WebhooksService } from './webhooks/webhooks.service';
import { AutomationInsightsService } from './settings/automation-insights.service';
import { CreateRuleSchema, RuleQuerySchema, UpdateRuleSchema } from './rules/dto/rule.dto';
import { EventQuerySchema, PublishEventSchema, RunQuerySchema } from './runs/dto/run.dto';
import { JobQuerySchema } from './jobs/dto/job.dto';
import { OutboundQuerySchema } from './webhooks/dto/webhook.dto';

const id = z.object({ id: z.string().uuid() });
const M = ModuleKey.AUTOMATION;

/** MCP adapter for 20 Automation — same service methods and validation as REST. Approval decisions are never exposed. */
@Injectable()
export class AutomationMcp implements OnModuleInit {
    constructor(
        private readonly registry: McpRegistry,
        private readonly rules: RulesService,
        private readonly runs: RunsService,
        private readonly jobs: JobsService,
        private readonly webhooks: WebhooksService,
        private readonly insights: AutomationInsightsService,
    ) { }

    onModuleInit() {
        this.registry.registerMany([
            { name: 'automation_rules_list', description: 'List workflows (automation rules) with status, trigger and run counts.', permission: 'automation.rules.read', module: M, resource_type: 'automation_rule', input: RuleQuerySchema, handler: (ctx, a) => this.rules.findAll(ctx, a) },
            { name: 'automation_rules_get', description: 'Get one workflow with trigger, conditions, steps and unpublished draft.', permission: 'automation.rules.read', module: M, resource_type: 'automation_rule', input: id, handler: (ctx, a) => this.rules.findOne(ctx, a.id) },
            { name: 'automation_catalog_read', description: 'Trigger and action catalogs: which events can start a workflow and which steps it can run.', permission: 'automation.rules.read', module: M, input: z.object({}), handler: async (ctx) => ({ triggers: await this.insights.triggers(ctx, {}), actions: this.insights.actions(ctx) }) },
            {
                name: 'automation_rules_create',
                description: 'Create a DRAFT workflow: trigger (kind + key), optional conditions { all: [{ path, operator, value }] } and ordered steps [{ key, action_key, inputs }]. Inputs may use {{event.payload.x}} templates.',
                permission: 'automation.rules.create', module: M, resource_type: 'automation_rule', input: CreateRuleSchema,
                handler: (ctx, a) => this.rules.create(ctx, a as unknown as Record<string, unknown>),
            },
            { name: 'automation_rules_update', description: 'Edit a workflow (published workflows get an unpublished draft).', permission: 'automation.rules.update', module: M, resource_type: 'automation_rule', input: UpdateRuleSchema.extend({ id: z.string().uuid() }), handler: (ctx, { id: ruleId, ...rest }) => this.rules.update(ctx, ruleId, rest as Record<string, unknown>) },
            { name: 'automation_rules_test', description: 'Dry run a workflow with a sample payload (nothing executes) and return the run id.', permission: 'automation.rules.read', module: M, resource_type: 'automation_rule', input: z.object({ id: z.string().uuid(), payload: z.record(z.string(), z.unknown()).optional() }), handler: (ctx, a) => this.rules.test(ctx, a.id, { mode: AutomationRunMode.DRY_RUN, payload: a.payload }) },
            { name: 'automation_rules_publish', description: 'Publish the workflow draft as a new version.', permission: 'automation.rules.enable', module: M, resource_type: 'automation_rule', sensitive: true, input: z.object({ id: z.string().uuid(), change_summary: z.string().max(500).optional() }), handler: (ctx, a) => this.rules.publish(ctx, a.id, a.change_summary) },
            { name: 'automation_rules_enable', description: 'Enable or disable a published workflow.', permission: 'automation.rules.enable', module: M, resource_type: 'automation_rule', sensitive: true, input: z.object({ id: z.string().uuid(), enabled: z.boolean() }), handler: (ctx, a) => this.rules.setEnabled(ctx, a.id, a.enabled) },
            { name: 'automation_rules_run', description: 'Run a published workflow now with an optional payload.', permission: 'automation.rules.run', module: M, resource_type: 'automation_rule', sensitive: true, input: z.object({ id: z.string().uuid(), payload: z.record(z.string(), z.unknown()).optional(), entity_id: z.string().optional() }), handler: (ctx, a) => this.rules.runNow(ctx, a.id, a) },
            { name: 'automation_rules_delete', description: 'Delete a workflow permanently.', permission: 'automation.rules.delete', module: M, resource_type: 'automation_rule', sensitive: true, input: id, handler: (ctx, a) => this.rules.remove(ctx, a.id) },
            { name: 'automation_runs_list', description: 'List workflow runs (filter by status, workflow, record, dates).', permission: 'automation.runs.read', module: M, resource_type: 'automation_run', input: RunQuerySchema, handler: (ctx, a) => this.runs.findAll(ctx, a) },
            { name: 'automation_runs_get', description: 'Get one run with each step, its inputs, outputs and errors.', permission: 'automation.runs.read', module: M, resource_type: 'automation_run', input: id, handler: (ctx, a) => this.runs.findOne(ctx, a.id) },
            { name: 'automation_runs_retry', description: 'Retry a failed or dead-lettered run from the failed step.', permission: 'automation.runs.manage', module: M, resource_type: 'automation_run', sensitive: true, input: id, handler: (ctx, a) => this.runs.retry(ctx, a.id) },
            { name: 'automation_events_list', description: 'Read the event bus log.', permission: 'automation.runs.read', module: M, resource_type: 'platform_event', input: EventQuerySchema, handler: (ctx, a) => this.runs.eventLog(ctx, a) },
            { name: 'automation_events_publish', description: 'Publish a custom.* event on the bus so workflows and webhooks react to it.', permission: 'automation.runs.manage', module: M, resource_type: 'platform_event', sensitive: true, input: PublishEventSchema, handler: (ctx, a) => this.runs.publishCustom(ctx, a) },
            { name: 'automation_jobs_list', description: 'List scheduled jobs with next run and last result.', permission: 'automation.jobs.read', module: M, resource_type: 'scheduled_job', input: JobQuerySchema, handler: (ctx, a) => this.jobs.findAll(ctx, a) },
            { name: 'automation_jobs_run_now', description: 'Run a scheduled job now.', permission: 'automation.jobs.manage', module: M, resource_type: 'scheduled_job', sensitive: true, input: id, handler: (ctx, a) => this.jobs.runNow(ctx, a.id) },
            { name: 'automation_webhooks_list', description: 'List outbound webhook endpoints (secrets are never returned).', permission: 'automation.webhooks.read', module: M, resource_type: 'outbound_webhook', input: OutboundQuerySchema, handler: (ctx, a) => this.webhooks.listOutbound(ctx, a) },
        ]);
    }
}
