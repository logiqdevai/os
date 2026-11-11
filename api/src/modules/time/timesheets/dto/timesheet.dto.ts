import { ApiProperty } from '@nestjs/swagger';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsEnum, IsOptional, IsString, IsUUID, Matches, MaxLength, MinLength } from 'class-validator';
import { TimesheetStatus } from 'generated/prisma';
import { z } from 'zod';
import { BaseListQuerySchema, csv } from '@/shared/utils/pagination/pagination.utils';

const DATE = /^\d{4}-\d{2}-\d{2}$/;

export class SubmitTimesheetDto {
    @ApiProperty({ example: '2026-11-09', description: 'Any day of the week to submit' }) @Matches(DATE) period_start: string;
    @ApiProperty({ required: false }) @IsOptional() @IsString() @MaxLength(1000) comment?: string;
}

export class CommentDto {
    @ApiProperty({ required: false }) @IsOptional() @IsString() @MaxLength(1000) comment?: string;
}

export class RequiredCommentDto {
    @ApiProperty() @IsString() @MinLength(3) @MaxLength(1000) comment: string;
}

export class BulkTimesheetDto {
    @ApiProperty({ type: [String] }) @IsArray() @ArrayMinSize(1) @ArrayMaxSize(200) @IsUUID('all', { each: true }) ids: string[];
    @ApiProperty({ enum: ['approve', 'reject'] }) @IsEnum({ approve: 'approve', reject: 'reject' }) action: 'approve' | 'reject';
    @ApiProperty({ required: false }) @IsOptional() @IsString() @MaxLength(1000) comment?: string;
}

export const TimesheetQuerySchema = BaseListQuerySchema.extend({
    scope: z.enum(['mine', 'team', 'all']).optional(),
    period_start: z.string().regex(DATE).optional(),
    status: csv(z.nativeEnum(TimesheetStatus)),
    membership_id: z.string().uuid().optional(),
    team_id: z.string().uuid().optional(),
});
export type TimesheetQuery = z.infer<typeof TimesheetQuerySchema>;

export const WeekQuerySchema = z.object({
    period_start: z.string().regex(DATE).optional(),
    membership_id: z.string().uuid().optional(),
    scope: z.enum(['team', 'all']).optional(),
    team_id: z.string().uuid().optional(),
    status: z.string().optional(),
});
export type WeekQuery = z.infer<typeof WeekQuerySchema>;

export const SubmitTimesheetSchema = z.object({ period_start: z.string().regex(DATE), comment: z.string().max(1000).optional() });
export const DecideTimesheetSchema = z.object({ id: z.string().uuid(), comment: z.string().max(1000).optional() });
export const RejectTimesheetSchema = z.object({ id: z.string().uuid(), comment: z.string().min(3).max(1000) });
