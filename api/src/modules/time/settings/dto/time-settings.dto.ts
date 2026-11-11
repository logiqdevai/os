import { ApiProperty, PartialType } from '@nestjs/swagger';
import { IsArray, IsBoolean, IsEnum, IsInt, IsNumber, IsOptional, IsString, IsUUID, Matches, Max, MaxLength, Min, MinLength, ValidateIf } from 'class-validator';
import { TimeNonBillableCategory, TimeRoundingMode, TimesheetApproverPolicy, TimesheetPeriodType } from 'generated/prisma';
import { z } from 'zod';

export class UpdateTimeSettingsDto {
    @ApiProperty({ enum: TimesheetPeriodType, required: false }) @IsOptional() @IsEnum(TimesheetPeriodType) period_type?: TimesheetPeriodType;
    @ApiProperty({ required: false, description: '0 = Sunday … 6 = Saturday (null = Monday)' }) @IsOptional() @ValidateIf((_, v) => v !== null) @IsInt() @Min(0) @Max(6) week_start?: number | null;
    @ApiProperty({ required: false }) @IsOptional() @IsBoolean() require_approval?: boolean;
    @ApiProperty({ enum: TimesheetApproverPolicy, required: false }) @IsOptional() @IsEnum(TimesheetApproverPolicy) approver_policy?: TimesheetApproverPolicy;
    @ApiProperty({ required: false }) @IsOptional() @ValidateIf((_, v) => v !== null) @IsUUID() default_approver_membership_id?: string | null;
    @ApiProperty({ required: false }) @IsOptional() @IsBoolean() lock_on_approval?: boolean;
    @ApiProperty({ required: false }) @IsOptional() @IsBoolean() allow_self_approval?: boolean;
    @ApiProperty({ required: false }) @IsOptional() @IsBoolean() default_billable?: boolean;
    @ApiProperty({ required: false }) @IsOptional() @IsBoolean() require_billable_override_reason?: boolean;
    @ApiProperty({ required: false }) @IsOptional() @IsInt() @Min(1) @Max(60) rounding_increment_minutes?: number;
    @ApiProperty({ enum: TimeRoundingMode, required: false }) @IsOptional() @IsEnum(TimeRoundingMode) rounding_mode?: TimeRoundingMode;
    @ApiProperty({ required: false }) @IsOptional() @ValidateIf((_, v) => v !== null) @IsInt() @Min(1) @Max(480) min_entry_minutes?: number | null;
    @ApiProperty({ required: false }) @IsOptional() @ValidateIf((_, v) => v !== null) @IsNumber() @Min(1) @Max(24) max_hours_per_day?: number | null;
    @ApiProperty({ required: false }) @IsOptional() @IsBoolean() allow_overlapping_entries?: boolean;
    @ApiProperty({ required: false }) @IsOptional() @IsBoolean() allow_future_entries?: boolean;
    @ApiProperty({ required: false }) @IsOptional() @IsBoolean() require_project?: boolean;
    @ApiProperty({ required: false }) @IsOptional() @IsBoolean() require_task_or_ticket?: boolean;
    @ApiProperty({ required: false }) @IsOptional() @IsBoolean() require_description?: boolean;
    @ApiProperty({ required: false }) @IsOptional() @IsBoolean() require_activity_type?: boolean;
    @ApiProperty({ required: false }) @IsOptional() @ValidateIf((_, v) => v !== null) @IsInt() @Min(0) @Max(365) edit_window_days?: number | null;
    @ApiProperty({ required: false, description: 'YYYY-MM-DD — entries before this date are locked' }) @IsOptional() @ValidateIf((_, v) => v !== null) @Matches(/^\d{4}-\d{2}-\d{2}$/) locked_before_date?: string | null;
    @ApiProperty({ required: false }) @IsOptional() @ValidateIf((_, v) => v !== null) @IsInt() @Min(1) @Max(240) idle_timeout_minutes?: number | null;
    @ApiProperty({ required: false }) @IsOptional() @ValidateIf((_, v) => v !== null) @IsInt() @Min(1) @Max(48) timer_auto_stop_hours?: number | null;
    @ApiProperty({ required: false }) @IsOptional() @IsBoolean() calendar_capture_enabled?: boolean;
    @ApiProperty({ required: false }) @IsOptional() @IsBoolean() ai_suggestions_enabled?: boolean;
    @ApiProperty({ required: false }) @IsOptional() @IsBoolean() attendance_prefill_enabled?: boolean;
    @ApiProperty({ required: false }) @IsOptional() @IsBoolean() missing_time_reminder_enabled?: boolean;
    @ApiProperty({ required: false, type: [Number] }) @IsOptional() @IsArray() @IsInt({ each: true }) missing_time_reminder_days?: number[];
    @ApiProperty({ required: false }) @IsOptional() @ValidateIf((_, v) => v !== null) @Matches(/^\d{2}:\d{2}$/) missing_time_reminder_time?: string | null;
    @ApiProperty({ required: false }) @IsOptional() @IsBoolean() submission_reminder_enabled?: boolean;
    @ApiProperty({ required: false }) @IsOptional() @IsInt() @Min(0) @Max(14) submission_reminder_offset_days?: number;
    @ApiProperty({ required: false }) @IsOptional() @IsNumber() @Min(1) @Max(80) default_expected_hours_per_week?: number;
    @ApiProperty({ required: false }) @IsOptional() @ValidateIf((_, v) => v !== null) @IsNumber() @Min(0) @Max(100) utilization_target_percent?: number | null;
    @ApiProperty({ required: false }) @IsOptional() @IsBoolean() utilization_billable_only?: boolean;
    @ApiProperty({ required: false }) @IsOptional() @ValidateIf((_, v) => v !== null) @Matches(/^[A-Z]{3}$/) reporting_currency?: string | null;
}

export class CreateActivityTypeDto {
    @ApiProperty({ example: 'Code review' }) @IsString() @MinLength(1) @MaxLength(80) name: string;
    @ApiProperty({ required: false }) @IsOptional() @IsString() @MaxLength(500) description?: string;
    @ApiProperty({ required: false, example: 'blue' }) @IsOptional() @IsString() @MaxLength(20) color?: string;
    @ApiProperty({ required: false, description: 'null = inherit from project / organization' }) @IsOptional() @ValidateIf((_, v) => v !== null) @IsBoolean() default_billable?: boolean | null;
    @ApiProperty({ enum: TimeNonBillableCategory, required: false }) @IsOptional() @ValidateIf((_, v) => v !== null) @IsEnum(TimeNonBillableCategory) default_non_billable_category?: TimeNonBillableCategory | null;
    @ApiProperty({ required: false }) @IsOptional() @IsBoolean() is_default?: boolean;
    @ApiProperty({ required: false }) @IsOptional() @IsInt() sort_order?: number;
}
export class UpdateActivityTypeDto extends PartialType(CreateActivityTypeDto) { }

export class UpdateProjectTimeSettingsDto {
    @ApiProperty({ required: false }) @IsOptional() @ValidateIf((_, v) => v !== null) @IsBoolean() default_billable?: boolean | null;
    @ApiProperty({ enum: TimeNonBillableCategory, required: false }) @IsOptional() @ValidateIf((_, v) => v !== null) @IsEnum(TimeNonBillableCategory) default_non_billable_category?: TimeNonBillableCategory | null;
    @ApiProperty({ required: false }) @IsOptional() @ValidateIf((_, v) => v !== null) @IsUUID() default_activity_type_id?: string | null;
    @ApiProperty({ required: false }) @IsOptional() @ValidateIf((_, v) => v !== null) @IsUUID() approver_membership_id?: string | null;
    @ApiProperty({ required: false }) @IsOptional() @IsBoolean() time_tracking_enabled?: boolean;
    @ApiProperty({ required: false }) @IsOptional() @IsBoolean() members_only?: boolean;
    @ApiProperty({ required: false }) @IsOptional() @IsBoolean() require_task?: boolean;
    @ApiProperty({ required: false }) @IsOptional() @ValidateIf((_, v) => v !== null) @IsInt() @Min(1) @Max(500) hours_alert_percent?: number | null;
}

export const UpdateTimeSettingsSchema = z.object({
    require_approval: z.boolean().optional(),
    approver_policy: z.nativeEnum(TimesheetApproverPolicy).optional(),
    lock_on_approval: z.boolean().optional(),
    allow_self_approval: z.boolean().optional(),
    default_billable: z.boolean().optional(),
    rounding_increment_minutes: z.number().int().min(1).max(60).optional(),
    rounding_mode: z.nativeEnum(TimeRoundingMode).optional(),
    min_entry_minutes: z.number().int().min(1).max(480).nullable().optional(),
    max_hours_per_day: z.number().min(1).max(24).nullable().optional(),
    allow_future_entries: z.boolean().optional(),
    require_project: z.boolean().optional(),
    require_description: z.boolean().optional(),
    default_expected_hours_per_week: z.number().min(1).max(80).optional(),
});
