import { ApiProperty } from '@nestjs/swagger';
import { ArrayMaxSize, IsArray, IsBoolean, IsInt, IsNumber, IsOptional, IsUUID, Max, Min, ValidateIf } from 'class-validator';
import { z } from 'zod';

export class UpdateAutomationSettingsDto {
    @ApiProperty({ required: false, description: 'Runs started per hour across the organization' })
    @IsOptional() @IsInt() @Min(1) @Max(1_000_000)
    org_rate_limit_per_hour?: number;

    @ApiProperty({ required: false })
    @IsOptional() @IsInt() @Min(1) @Max(1_000_000)
    default_rule_rate_limit_per_hour?: number;

    @ApiProperty({ required: false, description: 'Loop protection depth (1–10)' })
    @IsOptional() @IsInt() @Min(1) @Max(10)
    max_trigger_depth?: number;

    @ApiProperty({ required: false })
    @IsOptional() @IsInt() @Min(0) @Max(20)
    default_max_retries?: number;

    @ApiProperty({ required: false })
    @IsOptional() @IsInt() @Min(5) @Max(86_400)
    default_retry_backoff_seconds?: number;

    @ApiProperty({ required: false, description: 'Needs automation.actions.destructive.enable' })
    @IsOptional() @IsBoolean()
    destructive_actions_enabled?: boolean;

    @ApiProperty({ required: false })
    @IsOptional() @IsBoolean()
    destructive_requires_approval?: boolean;

    @ApiProperty({ required: false, nullable: true, description: 'Days; null keeps forever' })
    @IsOptional() @ValidateIf((_, v) => v !== null) @IsInt() @Min(7) @Max(3650)
    run_retention_days?: number | null;

    @ApiProperty({ required: false, nullable: true })
    @IsOptional() @ValidateIf((_, v) => v !== null) @IsInt() @Min(7) @Max(3650)
    event_retention_days?: number | null;

    @ApiProperty({ required: false, nullable: true })
    @IsOptional() @ValidateIf((_, v) => v !== null) @IsInt() @Min(7) @Max(3650)
    job_run_retention_days?: number | null;

    @ApiProperty({ required: false })
    @IsOptional() @IsBoolean()
    dead_letter_alerts_enabled?: boolean;

    @ApiProperty({ required: false, type: [String] })
    @IsOptional() @IsArray() @ArrayMaxSize(50) @IsUUID('all', { each: true })
    dead_letter_alert_membership_ids?: string[];

    @ApiProperty({ required: false })
    @IsOptional() @IsBoolean()
    dead_letter_alert_notify_rule_owner?: boolean;

    @ApiProperty({ required: false, nullable: true, description: 'Needs automation.service_accounts.manage' })
    @IsOptional() @ValidateIf((_, v) => v !== null) @IsUUID()
    default_service_account_id?: string | null;

    @ApiProperty({ required: false })
    @IsOptional() @IsNumber() @Min(0) @Max(100)
    ai_default_confidence_threshold?: number;
}

export const UpdateAutomationSettingsSchema = z.object({
    org_rate_limit_per_hour: z.number().int().min(1).optional(),
    default_rule_rate_limit_per_hour: z.number().int().min(1).optional(),
    max_trigger_depth: z.number().int().min(1).max(10).optional(),
    default_max_retries: z.number().int().min(0).max(20).optional(),
    default_retry_backoff_seconds: z.number().int().min(5).max(86400).optional(),
    destructive_actions_enabled: z.boolean().optional(),
    destructive_requires_approval: z.boolean().optional(),
    run_retention_days: z.number().int().min(7).max(3650).nullable().optional(),
    event_retention_days: z.number().int().min(7).max(3650).nullable().optional(),
    dead_letter_alerts_enabled: z.boolean().optional(),
});
