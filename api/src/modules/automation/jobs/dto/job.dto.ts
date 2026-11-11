import { ApiProperty, PartialType } from '@nestjs/swagger';
import { IsBoolean, IsDateString, IsEnum, IsInt, IsObject, IsOptional, IsString, IsUUID, Matches, Max, MaxLength, Min, MinLength, ValidateIf } from 'class-validator';
import { ModuleKey, ScheduledJobKind, ScheduledJobRunStatus, ScheduledJobStatus } from 'generated/prisma';
import { z } from 'zod';
import { BaseListQuerySchema } from '@/shared/utils/pagination/pagination.utils';

export class CreateJobDto {
    @ApiProperty({ example: 'weekly-pipeline-report' }) @Matches(/^[a-z0-9][a-z0-9_.-]{2,80}$/, { message: 'key: lowercase letters, digits, dot, dash or underscore' })
    key: string;

    @ApiProperty({ example: 'Weekly pipeline report' }) @IsString() @MinLength(1) @MaxLength(160)
    name: string;

    @ApiProperty({ required: false }) @IsOptional() @IsString() @MaxLength(1000)
    description?: string;

    @ApiProperty({ enum: ScheduledJobKind }) @IsEnum(ScheduledJobKind)
    kind: ScheduledJobKind;

    @ApiProperty({ required: false, example: '0 9 * * 1' }) @IsOptional() @IsString() @MaxLength(120)
    cron_expression?: string;

    @ApiProperty({ required: false }) @IsOptional() @IsInt() @Min(30) @Max(31 * 86400)
    interval_seconds?: number;

    @ApiProperty({ required: false }) @IsOptional() @IsDateString()
    run_at?: string;

    @ApiProperty({ required: false, default: 'UTC' }) @IsOptional() @IsString() @MaxLength(60)
    timezone?: string;

    @ApiProperty({ example: 'automation.event.publish', description: 'A registered handler that allows user-created jobs' }) @IsString() @MaxLength(120)
    handler: string;

    @ApiProperty({ required: false, example: { event_key: 'schedule.weekly_report' } }) @IsOptional() @IsObject()
    payload?: Record<string, unknown>;

    @ApiProperty({ required: false, nullable: true }) @IsOptional() @ValidateIf((_, v) => v !== null) @IsUUID()
    branch_id?: string | null;

    @ApiProperty({ required: false, default: 3 }) @IsOptional() @IsInt() @Min(0) @Max(10)
    max_retries?: number;

    @ApiProperty({ required: false, default: 60 }) @IsOptional() @IsInt() @Min(5) @Max(86400)
    retry_backoff_seconds?: number;

    @ApiProperty({ required: false, nullable: true }) @IsOptional() @ValidateIf((_, v) => v !== null) @IsInt() @Min(5) @Max(86400)
    timeout_seconds?: number | null;

    @ApiProperty({ required: false }) @IsOptional() @IsBoolean()
    allow_overlap?: boolean;

    @ApiProperty({ required: false }) @IsOptional() @IsBoolean()
    catch_up_missed?: boolean;
}

export class UpdateJobDto extends PartialType(CreateJobDto) { }

export class PreviewScheduleDto {
    @ApiProperty({ enum: ScheduledJobKind }) @IsEnum(ScheduledJobKind)
    kind: ScheduledJobKind;

    @ApiProperty({ required: false }) @IsOptional() @IsString()
    cron_expression?: string;

    @ApiProperty({ required: false }) @IsOptional() @IsInt()
    interval_seconds?: number;

    @ApiProperty({ required: false }) @IsOptional() @IsDateString()
    run_at?: string;

    @ApiProperty({ required: false }) @IsOptional() @IsString()
    timezone?: string;
}

export const JobQuerySchema = BaseListQuerySchema.extend({
    status: z.nativeEnum(ScheduledJobStatus).optional(),
    module: z.nativeEnum(ModuleKey).optional(),
    kind: z.nativeEnum(ScheduledJobKind).optional(),
});
export type JobQuery = z.infer<typeof JobQuerySchema>;

export const JobRunQuerySchema = BaseListQuerySchema.extend({ status: z.nativeEnum(ScheduledJobRunStatus).optional() });
export type JobRunQuery = z.infer<typeof JobRunQuerySchema>;
