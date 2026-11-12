import { ApiProperty, PartialType } from '@nestjs/swagger';
import { IsArray, IsBoolean, IsEnum, IsIn, IsInt, IsObject, IsOptional, IsString, IsUUID, Max, MaxLength, Min, MinLength, ValidateIf } from 'class-validator';
import { AutomationRuleScopeType, AutomationRuleStatus, AutomationRunMode, AutomationTriggerKind, ModuleKey, RecordEntityType } from 'generated/prisma';
import { z } from 'zod';
import { BaseListQuerySchema, boolish } from '@/shared/utils/pagination/pagination.utils';

// ---------------------------------------------------------------------------------------------------
// Zod: rule definition (shared by REST validation in the service and the MCP tools)
// ---------------------------------------------------------------------------------------------------
const OPERATORS = ['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'contains', 'not_contains', 'starts_with', 'ends_with', 'in', 'not_in', 'exists', 'not_exists', 'changed'] as const;

export const ConditionPredicateSchema = z.object({
    path: z.string().min(1).max(200),
    operator: z.enum(OPERATORS),
    value: z.unknown().optional(),
});

export type ConditionNodeInput = z.infer<typeof ConditionPredicateSchema> | { all?: ConditionNodeInput[]; any?: ConditionNodeInput[]; not?: ConditionNodeInput[] };

export const ConditionGroupSchema: z.ZodType<{ all?: ConditionNodeInput[]; any?: ConditionNodeInput[]; not?: ConditionNodeInput[] }> = z.lazy(() =>
    z.object({
        all: z.array(z.union([ConditionPredicateSchema, ConditionGroupSchema])).max(50).optional(),
        any: z.array(z.union([ConditionPredicateSchema, ConditionGroupSchema])).max(50).optional(),
        not: z.array(z.union([ConditionPredicateSchema, ConditionGroupSchema])).max(50).optional(),
    }),
);

export const RuleStepSchema = z.object({
    key: z.string().regex(/^[a-z0-9_]{1,40}$/, 'step key: lowercase letters, digits and _'),
    action_key: z.string().min(1).max(100),
    inputs: z.record(z.string(), z.unknown()).default({}),
    on_error: z.enum(['stop', 'continue']).optional().default('stop'),
    name: z.string().max(120).optional(),
});

export const TriggerConfigSchema = z.object({
    cron: z.string().max(120).optional(),
    timezone: z.string().max(60).optional(),
    interval_seconds: z.number().int().min(60).max(31 * 86400).optional(),
    slug: z.string().max(80).optional(),
}).passthrough();

const ruleFields = {
    name: z.string().min(1).max(160),
    description: z.string().max(2000).nullish(),
    module: z.nativeEnum(ModuleKey).nullish(),
    trigger_kind: z.nativeEnum(AutomationTriggerKind),
    trigger_key: z.string().min(1).max(160),
    trigger_config: TriggerConfigSchema.nullish(),
    entity_type: z.nativeEnum(RecordEntityType).nullish(),
    conditions: ConditionGroupSchema.nullish(),
    actions: z.array(RuleStepSchema).max(25),
    scope_type: z.nativeEnum(AutomationRuleScopeType).optional(),
    branch_id: z.string().uuid().nullish(),
    team_id: z.string().uuid().nullish(),
    project_type_id: z.string().uuid().nullish(),
    project_id: z.string().uuid().nullish(),
    owner_membership_id: z.string().uuid().nullish(),
    run_as_service_account_id: z.string().uuid().nullish(),
    serialize_per_record: z.boolean().optional(),
    max_retries: z.number().int().min(0).max(20).nullish(),
    retry_backoff_seconds: z.number().int().min(5).max(86400).nullish(),
    rate_limit_per_hour: z.number().int().min(1).max(1_000_000).nullish(),
    max_trigger_depth: z.number().int().min(1).max(10).nullish(),
    allow_destructive_actions: z.boolean().optional(),
    require_approval_for_destructive: z.boolean().optional(),
    timeout_seconds: z.number().int().min(10).max(86400).nullish(),
    template_id: z.string().max(120).nullish(),
};

export const CreateRuleSchema = z.object(ruleFields);
export const UpdateRuleSchema = z.object(ruleFields).partial();
export type RuleInput = z.infer<typeof UpdateRuleSchema>;

// ---------------------------------------------------------------------------------------------------
// class-validator DTOs (REST); structure of conditions / actions is validated with the zod schema above.
// ---------------------------------------------------------------------------------------------------
export class CreateRuleDto {
    @ApiProperty({ example: 'Deal won → kick-off task' }) @IsString() @MinLength(1) @MaxLength(160)
    name: string;

    @ApiProperty({ required: false, nullable: true }) @IsOptional() @IsString() @MaxLength(2000)
    description?: string | null;

    @ApiProperty({ enum: ModuleKey, required: false, nullable: true }) @IsOptional() @IsEnum(ModuleKey)
    module?: ModuleKey | null;

    @ApiProperty({ enum: AutomationTriggerKind }) @IsEnum(AutomationTriggerKind)
    trigger_kind: AutomationTriggerKind;

    @ApiProperty({ example: 'crm.deal.won', description: 'Event key, `schedule.cron`, `manual` or `inbound_webhook.<slug>`' }) @IsString() @MaxLength(160)
    trigger_key: string;

    @ApiProperty({ required: false, nullable: true, description: 'SCHEDULE: { cron, timezone } or { interval_seconds }' }) @IsOptional() @IsObject()
    trigger_config?: Record<string, unknown> | null;

    @ApiProperty({ enum: RecordEntityType, required: false, nullable: true }) @IsOptional() @IsEnum(RecordEntityType)
    entity_type?: RecordEntityType | null;

    @ApiProperty({ required: false, nullable: true, description: '{ all: [{ path, operator, value }], any: [...], not: [...] }' }) @IsOptional() @IsObject()
    conditions?: Record<string, unknown> | null;

    @ApiProperty({ type: 'array', description: '[{ key, action_key, inputs, on_error }]' }) @IsArray()
    actions: Record<string, unknown>[];

    @ApiProperty({ enum: AutomationRuleScopeType, required: false }) @IsOptional() @IsEnum(AutomationRuleScopeType)
    scope_type?: AutomationRuleScopeType;

    @ApiProperty({ required: false, nullable: true }) @IsOptional() @ValidateIf((_, v) => v !== null) @IsUUID()
    branch_id?: string | null;

    @ApiProperty({ required: false, nullable: true }) @IsOptional() @ValidateIf((_, v) => v !== null) @IsUUID()
    team_id?: string | null;

    @ApiProperty({ required: false, nullable: true }) @IsOptional() @ValidateIf((_, v) => v !== null) @IsUUID()
    project_type_id?: string | null;

    @ApiProperty({ required: false, nullable: true }) @IsOptional() @ValidateIf((_, v) => v !== null) @IsUUID()
    project_id?: string | null;

    @ApiProperty({ required: false, nullable: true, description: 'Defaults to the caller' }) @IsOptional() @ValidateIf((_, v) => v !== null) @IsUUID()
    owner_membership_id?: string | null;

    @ApiProperty({ required: false, nullable: true, description: 'Needs automation.service_accounts.manage' }) @IsOptional() @ValidateIf((_, v) => v !== null) @IsUUID()
    run_as_service_account_id?: string | null;

    @ApiProperty({ required: false }) @IsOptional() @IsBoolean()
    serialize_per_record?: boolean;

    @ApiProperty({ required: false, nullable: true }) @IsOptional() @ValidateIf((_, v) => v !== null) @IsInt() @Min(0) @Max(20)
    max_retries?: number | null;

    @ApiProperty({ required: false, nullable: true }) @IsOptional() @ValidateIf((_, v) => v !== null) @IsInt() @Min(5) @Max(86400)
    retry_backoff_seconds?: number | null;

    @ApiProperty({ required: false, nullable: true }) @IsOptional() @ValidateIf((_, v) => v !== null) @IsInt() @Min(1)
    rate_limit_per_hour?: number | null;

    @ApiProperty({ required: false, nullable: true }) @IsOptional() @ValidateIf((_, v) => v !== null) @IsInt() @Min(1) @Max(10)
    max_trigger_depth?: number | null;

    @ApiProperty({ required: false, description: 'Needs automation.actions.destructive.enable' }) @IsOptional() @IsBoolean()
    allow_destructive_actions?: boolean;

    @ApiProperty({ required: false }) @IsOptional() @IsBoolean()
    require_approval_for_destructive?: boolean;

    @ApiProperty({ required: false, nullable: true }) @IsOptional() @ValidateIf((_, v) => v !== null) @IsInt() @Min(10) @Max(86400)
    timeout_seconds?: number | null;

    @ApiProperty({ required: false, nullable: true, description: 'System template key or organization template id' }) @IsOptional() @IsString() @MaxLength(120)
    template_id?: string | null;
}

export class UpdateRuleDto extends PartialType(CreateRuleDto) { }

export class PublishRuleDto {
    @ApiProperty({ required: false, example: 'Added a wait step' }) @IsOptional() @IsString() @MaxLength(500)
    change_summary?: string;
}

export class RunRuleDto {
    @ApiProperty({ required: false, description: 'Event payload exposed as {{event.payload.*}}' }) @IsOptional() @IsObject()
    payload?: Record<string, unknown>;

    @ApiProperty({ required: false }) @IsOptional() @IsString() @MaxLength(100)
    entity_id?: string;
}

export class TestRuleDto extends RunRuleDto {
    @ApiProperty({ enum: [AutomationRunMode.TEST, AutomationRunMode.DRY_RUN], default: AutomationRunMode.DRY_RUN }) @IsOptional() @IsIn([AutomationRunMode.TEST, AutomationRunMode.DRY_RUN])
    mode?: AutomationRunMode;

    @ApiProperty({ required: false, default: true, description: 'Test the unpublished draft when there is one' }) @IsOptional() @IsBoolean()
    use_draft?: boolean;
}

export class DatePreviewDto {
    @ApiProperty({ example: 'date.tasks.task.due_date' }) @IsString() @MaxLength(160)
    trigger_key: string;

    @ApiProperty({ required: false, example: { offset_days: 3, direction: 'before' } }) @IsOptional() @IsObject()
    trigger_config?: Record<string, unknown>;
}

export class ImportRuleDto {
    @ApiProperty({ description: 'Body of GET /automation/rules/:id/export' }) @IsObject()
    rule: Record<string, unknown>;
}

export class CreateTemplateDto {
    @ApiProperty() @IsUUID()
    from_rule_id: string;

    @ApiProperty() @IsString() @MinLength(1) @MaxLength(160)
    name: string;

    @ApiProperty({ required: false }) @IsOptional() @IsString() @MaxLength(2000)
    description?: string;

    @ApiProperty({ required: false }) @IsOptional() @IsString() @MaxLength(60)
    category?: string;
}

export const RuleQuerySchema = BaseListQuerySchema.extend({
    status: z.nativeEnum(AutomationRuleStatus).optional(),
    enabled: boolish,
    module: z.nativeEnum(ModuleKey).optional(),
    trigger_kind: z.nativeEnum(AutomationTriggerKind).optional(),
    trigger_key: z.string().optional(),
    archived: boolish,
});
export type RuleQuery = z.infer<typeof RuleQuerySchema>;
