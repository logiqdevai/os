import { Injectable, OnModuleInit } from '@nestjs/common';
import { AutomationRunMode, ModuleKey, OutboundWebhookStatus } from 'generated/prisma';
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
import { CreateOutboundWebhookSchema, DeliveryQuerySchema, OutboundQuerySchema, UpdateInboundWebhookSchema, UpdateOutboundWebhookSchema } from './webhooks/dto/webhook.dto';
import { ApprovalPoliciesService } from './approval-policies/approval-policies.service';
import { ApprovalPolicyQuerySchema, CreateApprovalPolicySchema, UpdateApprovalPolicySchema } from './approval-policies/dto/approval-policy.dto';

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
        private readonly policies: ApprovalPoliciesService,
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
            { name: 'automation_approval_policies_list', description: 'List reusable approval policies (approvers, teams, roles, expiry, escalation) that approval steps can reference with policy_id.', permission: 'automation.rules.read', module: M, resource_type: 'automation_approval_policy', input: ApprovalPolicyQuerySchema, handler: (ctx, a) => this.policies.findAll(ctx, a) },
            { name: 'automation_approval_policies_create', description: 'Create an approval policy: approver_membership_ids / approver_team_ids / approver_role_ids, optional expiry and escalation.', permission: 'automation.approval_policies.manage', module: M, resource_type: 'automation_approval_policy', sensitive: true, input: CreateApprovalPolicySchema, handler: (ctx, a) => this.policies.create(ctx, a) },
            { name: 'automation_approval_policies_update', description: 'Change an approval policy.', permission: 'automation.approval_policies.manage', module: M, resource_type: 'automation_approval_policy', sensitive: true, input: UpdateApprovalPolicySchema.extend({ id: z.string().uuid() }), handler: (ctx, { id: policyId, ...rest }) => this.policies.update(ctx, policyId, rest) },
            { name: 'automation_inbound_webhooks_list', description: 'List inbound webhook endpoints (URL path, auth scheme, linked workflow, counters; never the secret).', permission: 'automation.webhooks.read', module: M, resource_type: 'inbound_webhook', input: z.object({}), handler: (ctx) => this.webhooks.listInbound(ctx) },
            { name: 'automation_inbound_webhooks_update', description: 'Edit an inbound endpoint: name, auth, IP allow-list, rate limit, pause/resume, or link the workflow it starts (rule_id; needs automation.rules.update).', permission: 'automation.webhooks.manage', module: M, resource_type: 'inbound_webhook', sensitive: true, input: UpdateInboundWebhookSchema, handler: (ctx, { id: hookId, ...rest }) => this.webhooks.updateInbound(ctx, hookId, rest) },
            { name: 'automation_agents_overview', description: 'AI agents & MCP overview: tool-call counts by status, tool, account and client over N days (call stats need organizations.mcp_calls.read) and the service accounts workflows run as.', permission: 'automation.rules.read', module: M, input: z.object({ days: z.number().int().min(1).max(90).default(30) }), handler: (ctx, a) => this.insights.agentsOverview(ctx, a.days) },
            { name: 'automation_webhooks_list', description: 'List outbound webhook endpoints (secrets are never returned).', permission: 'automation.webhooks.read', module: M, resource_type: 'outbound_webhook', input: OutboundQuerySchema, handler: (ctx, a) => this.webhooks.listOutbound(ctx, a) },
            // Outbound webhooks (20 §12, administered in Admin → Webhooks). Secrets are only returned by create / rotate.
            { name: 'automation_webhooks_get', description: 'Get one outbound webhook with 7-day delivery counts by status (never the secret).', permission: 'automation.webhooks.read', module: M, resource_type: 'outbound_webhook', input: id, handler: (ctx, a) => this.webhooks.getOutbound(ctx, a.id) },
            { name: 'automation_webhooks_create', description: 'Create an outbound webhook for platform event keys (`crm.deal.won`, `tasks.*`, `*`). Returns the HMAC-SHA256 signing secret once.', permission: 'automation.webhooks.manage', module: M, resource_type: 'outbound_webhook', sensitive: true, input: CreateOutboundWebhookSchema, handler: (ctx, a) => this.webhooks.createOutbound(ctx, a) },
            { name: 'automation_webhooks_update', description: 'Change an outbound webhook: URL, events, headers, retries.', permission: 'automation.webhooks.manage', module: M, resource_type: 'outbound_webhook', sensitive: true, input: UpdateOutboundWebhookSchema, handler: (ctx, { id: hookId, ...rest }) => this.webhooks.updateOutbound(ctx, hookId, rest) },
            { name: 'automation_webhooks_set_enabled', description: 'Enable (resume, resets the failure counter) or disable (pause) an outbound webhook.', permission: 'automation.webhooks.manage', module: M, resource_type: 'outbound_webhook', sensitive: true, input: z.object({ id: z.string().uuid(), enabled: z.boolean() }), handler: (ctx, a) => this.webhooks.setOutboundStatus(ctx, a.id, a.enabled ? OutboundWebhookStatus.ACTIVE : OutboundWebhookStatus.PAUSED) },
            { name: 'automation_webhooks_test', description: 'Send a signed `webhook.test` delivery now and return the result.', permission: 'automation.webhooks.manage', module: M, resource_type: 'outbound_webhook', sensitive: true, input: id, handler: (ctx, a) => this.webhooks.sendTest(ctx, a.id) },
            { name: 'automation_webhooks_rotate_secret', description: 'Rotate the signing secret (returned once; the previous one stays valid for 24 hours).', permission: 'automation.webhooks.manage', module: M, resource_type: 'outbound_webhook', sensitive: true, input: id, handler: (ctx, a) => this.webhooks.rotateOutboundSecret(ctx, a.id) },
            { name: 'automation_webhooks_delete', description: 'Delete an outbound webhook and its delivery log.', permission: 'automation.webhooks.manage', module: M, resource_type: 'outbound_webhook', sensitive: true, input: id, handler: (ctx, a) => this.webhooks.removeOutbound(ctx, a.id) },
            { name: 'automation_webhook_deliveries_list', description: 'Delivery log: filter by webhook_id, status, event_key.', permission: 'automation.webhooks.read', module: M, resource_type: 'webhook_delivery', input: DeliveryQuerySchema, handler: (ctx, a) => this.webhooks.listDeliveries(ctx, a) },
            { name: 'automation_webhook_deliveries_retry', description: 'Retry a failed or dead-lettered delivery now.', permission: 'automation.webhooks.manage', module: M, resource_type: 'webhook_delivery', sensitive: true, input: id, handler: (ctx, a) => this.webhooks.retryDelivery(ctx, a.id) },
        ]);
    }
}
