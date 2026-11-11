import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsBoolean, IsEnum, IsInt, IsNumber, IsObject, IsOptional, IsString, IsUUID, Matches, Max, MaxLength, Min, ValidateIf } from 'class-validator';
import { SupportCsatScale } from 'generated/prisma';
import { z } from 'zod';

export class UpdateSupportSettingsDto {
    @ApiProperty({ required: false, example: 'SUP', description: '2–6 uppercase letters' })
    @IsOptional()
    @Matches(/^[A-Z]{2,6}$/, { message: 'ticket_prefix must be 2–6 uppercase letters' })
    ticket_prefix?: string;

    @ApiProperty({ required: false, nullable: true })
    @IsOptional()
    @ValidateIf((_, v) => v !== null)
    @IsUUID()
    default_sla_policy_id?: string | null;

    @ApiProperty({ required: false, nullable: true })
    @IsOptional()
    @ValidateIf((_, v) => v !== null)
    @IsUUID()
    default_inbox_id?: string | null;

    @ApiProperty({ required: false, nullable: true })
    @IsOptional()
    @ValidateIf((_, v) => v !== null)
    @IsInt()
    @Min(1)
    @Max(365)
    auto_close_after_days?: number | null;

    @ApiProperty({ required: false, nullable: true })
    @IsOptional()
    @ValidateIf((_, v) => v !== null)
    @IsInt()
    @Min(1)
    @Max(8760)
    inactivity_after_hours?: number | null;

    @ApiProperty({ required: false, nullable: true })
    @IsOptional()
    @ValidateIf((_, v) => v !== null)
    @IsInt()
    @Min(1)
    @Max(365)
    reopen_window_days?: number | null;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsBoolean()
    csat_enabled?: boolean;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsInt()
    @Min(0)
    @Max(10080)
    csat_delay_minutes?: number;

    @ApiProperty({ required: false, enum: SupportCsatScale })
    @IsOptional()
    @IsEnum(SupportCsatScale)
    csat_scale?: SupportCsatScale;

    @ApiProperty({ required: false, nullable: true })
    @IsOptional()
    @ValidateIf((_, v) => v !== null)
    @IsString()
    @MaxLength(300)
    csat_question?: string | null;

    @ApiProperty({ required: false, nullable: true })
    @IsOptional()
    @ValidateIf((_, v) => v !== null)
    @IsString()
    @MaxLength(300)
    csat_thank_you?: string | null;

    @ApiProperty({ required: false, nullable: true })
    @IsOptional()
    @ValidateIf((_, v) => v !== null)
    @IsInt()
    @Min(1)
    @Max(5)
    csat_follow_up_threshold?: number | null;

    @ApiProperty({ required: false, nullable: true })
    @IsOptional()
    @ValidateIf((_, v) => v !== null)
    @IsString()
    @MaxLength(4000)
    default_signature?: string | null;

    @ApiProperty({ required: false, nullable: true, description: 'Ticket priority → task priority' })
    @IsOptional()
    @ValidateIf((_, v) => v !== null)
    @IsObject()
    task_priority_mapping?: Record<string, string> | null;

    @ApiProperty({ required: false, nullable: true })
    @IsOptional()
    @ValidateIf((_, v) => v !== null)
    @IsUUID()
    default_task_type_id?: string | null;

    // --- AI (support.ai.configure) -------------------------------------------------
    @ApiProperty({ required: false })
    @IsOptional()
    @IsBoolean()
    ai_agent_enabled?: boolean;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    @MaxLength(80)
    ai_model?: string;

    @ApiProperty({ required: false, nullable: true })
    @IsOptional()
    @ValidateIf((_, v) => v !== null)
    @IsNumber()
    @Min(0)
    @Max(1)
    ai_auto_classify_threshold?: number | null;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsBoolean()
    ai_require_reply_approval?: boolean;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsBoolean()
    ai_require_task_approval?: boolean;

    @ApiProperty({ required: false, type: [String] })
    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    ai_escalation_intents?: string[];
}

export const AI_SETTING_KEYS = ['ai_agent_enabled', 'ai_model', 'ai_auto_classify_threshold', 'ai_require_reply_approval', 'ai_require_task_approval', 'ai_escalation_intents'] as const;

export const SupportSettingsSchema = z.object({
    ticket_prefix: z.string().regex(/^[A-Z]{2,6}$/).optional(),
    auto_close_after_days: z.number().int().min(1).max(365).nullable().optional(),
    reopen_window_days: z.number().int().min(1).max(365).nullable().optional(),
    csat_enabled: z.boolean().optional(),
    csat_delay_minutes: z.number().int().min(0).max(10080).optional(),
    default_signature: z.string().max(4000).nullable().optional(),
});
