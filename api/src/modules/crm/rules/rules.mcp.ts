import { Injectable, OnModuleInit } from '@nestjs/common';
import { ModuleKey } from 'generated/prisma';
import { z } from 'zod';
import { McpRegistry } from '@/core/mcp/mcp.registry';
import { CrmLeadRulesService } from './lead-rules.service';
import { CrmTargetsService } from './targets.service';
import { CreateAssignmentRuleSchema, CreateScoringRuleSchema, CreateTargetSchema, TargetQuerySchema, UpdateTargetSchema } from './dto/rules.dto';

/** MCP tools for lead rules and sales targets (same services as REST). */
@Injectable()
export class CrmRulesMcp implements OnModuleInit {
    constructor(private readonly registry: McpRegistry, private readonly rules: CrmLeadRulesService, private readonly targets: CrmTargetsService) { }

    onModuleInit() {
        const m = ModuleKey.CRM;
        this.registry.registerMany([
            {
                name: 'crm_targets_read', module: m, resource_type: 'crm_sales_target', permission: 'crm.targets.read',
                description: 'Sales targets active on a date (default today) with actual, attainment % and pace (elapsed % of the period). Filter by period MONTH|QUARTER|YEAR, owner "me" or membership id, team_id.',
                input: TargetQuerySchema,
                handler: (ctx, args) => this.targets.findAll(ctx, args),
            },
            {
                name: 'crm_targets_create', module: m, resource_type: 'crm_sales_target', permission: 'crm.targets.manage', sensitive: true,
                description: 'Create a sales target for a member (owner_membership_id), a team (team_id) or the organization (neither). metric REVENUE_WON|DEALS_WON|PIPELINE_CREATED; period_start is any date in the period.',
                input: CreateTargetSchema,
                handler: (ctx, args) => this.targets.create(ctx, args),
            },
            {
                name: 'crm_targets_update', module: m, resource_type: 'crm_sales_target', permission: 'crm.targets.manage', sensitive: true,
                description: 'Update a sales target by id (amount, metric, period, owner or team).',
                input: UpdateTargetSchema.extend({ id: z.string().uuid() }),
                handler: (ctx, { id, ...dto }) => this.targets.update(ctx, id, dto),
            },
            {
                name: 'crm_assignment_rules_list', module: m, resource_type: 'crm_assignment_rule', permission: 'crm.settings.manage',
                description: 'Lead assignment rules in priority order (conditions + assign_to member / round robin / least loaded).',
                input: z.object({}),
                handler: (ctx) => this.rules.assignmentRules(ctx),
            },
            {
                name: 'crm_assignment_rules_create', module: m, resource_type: 'crm_assignment_rule', permission: 'crm.settings.manage', sensitive: true,
                description: 'Create a lead assignment rule. conditions: [{ field (lead_source_id, branch_id, industry, email_domain, estimated_value, cf:<key>…), operator, value }]; assign_to: { membership_id } | { team_id, strategy } | { membership_ids, strategy }.',
                input: CreateAssignmentRuleSchema,
                handler: (ctx, args) => this.rules.createAssignmentRule(ctx, args),
            },
            {
                name: 'crm_scoring_rules_list', module: m, resource_type: 'crm_lead_scoring_rule', permission: 'crm.scoring_rules.manage',
                description: 'Lead scoring rules (conditions + points). A lead score is the sum of matching rules, 0–100.',
                input: z.object({}),
                handler: (ctx) => this.rules.scoringRules(ctx),
            },
            {
                name: 'crm_scoring_rules_create', module: m, resource_type: 'crm_lead_scoring_rule', permission: 'crm.scoring_rules.manage',
                description: 'Create a lead scoring rule: points (-100…100) are added when every condition matches. Run crm_scoring_rules_recalculate afterwards to update existing leads.',
                input: CreateScoringRuleSchema,
                handler: (ctx, args) => this.rules.createScoringRule(ctx, args),
            },
            {
                name: 'crm_scoring_rules_recalculate', module: m, resource_type: 'crm_lead_scoring_rule', permission: 'crm.scoring_rules.manage',
                description: 'Recompute the score of every open lead with the current scoring rules.',
                input: z.object({}),
                handler: (ctx) => this.rules.rescoreAll(ctx),
            },
        ]);
    }
}
