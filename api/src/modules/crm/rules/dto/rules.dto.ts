import { z } from 'zod';
import { CrmTargetMetric, CrmTargetPeriod } from 'generated/prisma';

/**
 * One condition over a lead (02 §6, §31). `field` is a lead column from `LEAD_RULE_FIELDS` or `cf:<custom field key>`.
 * All conditions of a rule must match (AND). An empty list always matches.
 */
export const RuleConditionSchema = z.object({
    field: z.string().min(1).max(60),
    operator: z.enum(['equals', 'not_equals', 'contains', 'in', 'gt', 'gte', 'lt', 'lte', 'is_empty', 'is_not_empty']),
    value: z.union([z.string().max(200), z.number(), z.boolean(), z.array(z.string().max(200)).max(100)]).optional().nullable(),
});
export type RuleCondition = z.infer<typeof RuleConditionSchema>;

export const AssignToSchema = z.union([
    z.object({ membership_id: z.string().uuid() }),
    /** round_robin = the candidate who least recently received a lead; least_loaded = fewest open leads. */
    z.object({ team_id: z.string().uuid(), strategy: z.enum(['round_robin', 'least_loaded']) }),
    z.object({ membership_ids: z.array(z.string().uuid()).min(1).max(100), strategy: z.enum(['round_robin', 'least_loaded']) }),
]);
export type AssignTo = z.infer<typeof AssignToSchema>;

export const CreateAssignmentRuleSchema = z.object({
    name: z.string().trim().min(1).max(120),
    conditions: z.array(RuleConditionSchema).max(20).default([]),
    assign_to: AssignToSchema,
    priority: z.number().int().min(0).max(10000).optional(),
    enabled: z.boolean().optional(),
});
export const UpdateAssignmentRuleSchema = CreateAssignmentRuleSchema.partial();
export type CreateAssignmentRuleInput = z.infer<typeof CreateAssignmentRuleSchema>;
export type UpdateAssignmentRuleInput = z.infer<typeof UpdateAssignmentRuleSchema>;

export const CreateScoringRuleSchema = z.object({
    name: z.string().trim().min(1).max(120),
    description: z.string().max(500).optional().nullable(),
    conditions: z.array(RuleConditionSchema).min(1).max(20),
    points: z.number().int().min(-100).max(100),
    enabled: z.boolean().optional(),
    sort_order: z.number().int().min(0).max(10000).optional(),
});
export const UpdateScoringRuleSchema = CreateScoringRuleSchema.partial();
export type CreateScoringRuleInput = z.infer<typeof CreateScoringRuleSchema>;
export type UpdateScoringRuleInput = z.infer<typeof UpdateScoringRuleSchema>;

export const CreateTargetSchema = z.object({
    /** Individual target; omit both owner and team for an organization-wide target. */
    owner_membership_id: z.string().uuid().optional().nullable(),
    team_id: z.string().uuid().optional().nullable(),
    pipeline_id: z.string().uuid().optional().nullable(),
    period: z.nativeEnum(CrmTargetPeriod),
    /** Any date inside the period; the server snaps it to the month / quarter / year start. */
    period_start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    metric: z.nativeEnum(CrmTargetMetric).default(CrmTargetMetric.REVENUE_WON),
    amount: z.number().min(0).max(1e12),
    currency: z.string().length(3).optional(),
});
export const UpdateTargetSchema = CreateTargetSchema.partial();
export type CreateTargetInput = z.infer<typeof CreateTargetSchema>;
export type UpdateTargetInput = z.infer<typeof UpdateTargetSchema>;

export const TargetQuerySchema = z.object({
    /** Targets whose period contains this date (default today). */
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    period: z.nativeEnum(CrmTargetPeriod).optional(),
    owner: z.string().optional(),
    team_id: z.string().uuid().optional(),
});
export type TargetQuery = z.infer<typeof TargetQuerySchema>;
