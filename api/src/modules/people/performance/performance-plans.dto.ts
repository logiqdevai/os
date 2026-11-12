import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
    ArrayMaxSize, ArrayMinSize, IsArray, IsBoolean, IsDateString, IsEnum, IsIn, IsInt, IsNumber, IsOptional, IsString, IsUUID, Max, MaxLength, Min, MinLength, ValidateNested,
} from 'class-validator';
import { PerformanceImprovementItemStatus, PerformanceImprovementPlanStatus, PerformanceFeedbackRequestStatus } from 'generated/prisma';
import { z } from 'zod';
import { BaseListQuerySchema, csv } from '@/shared/utils/pagination/pagination.utils';

// ------------------------------------------------------------------ improvement plans (PIP)

export class PipItemDto {
    @ApiProperty() @IsString() @MinLength(1) @MaxLength(200) title: string;
    @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(2000) description?: string;
    @ApiPropertyOptional() @IsOptional() @IsDateString() due_date?: string;
}

export class UpdatePipItemDto extends PartialType(PipItemDto) {
    @ApiPropertyOptional({ enum: PerformanceImprovementItemStatus }) @IsOptional() @IsEnum(PerformanceImprovementItemStatus) status?: PerformanceImprovementItemStatus;
    @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(2000) note?: string;
}

export class PipDto {
    @ApiProperty() @IsUUID() employee_id: string;
    @ApiProperty({ example: 'Delivery improvement plan' }) @IsString() @MinLength(1) @MaxLength(160) title: string;
    @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(5000) reason?: string;
    @ApiPropertyOptional({ description: 'Expected outcomes and support offered (markdown)' }) @IsOptional() @IsString() @MaxLength(20000) objectives?: string;
    @ApiProperty() @IsDateString() start_date: string;
    @ApiProperty() @IsDateString() end_date: string;
    @ApiPropertyOptional() @IsOptional() @IsInt() @Min(1) @Max(90) check_in_frequency_days?: number;
    @ApiPropertyOptional() @IsOptional() @IsUUID() manager_membership_id?: string;
    @ApiPropertyOptional() @IsOptional() @IsUUID() hr_membership_id?: string;
    @ApiPropertyOptional() @IsOptional() @IsUUID() review_id?: string;
    @ApiPropertyOptional({ type: [PipItemDto] }) @IsOptional() @IsArray() @ArrayMaxSize(30) @ValidateNested({ each: true }) @Type(() => PipItemDto) items?: PipItemDto[];
}

export class UpdatePipDto extends PartialType(PipDto) {
    @ApiPropertyOptional() @IsOptional() @IsDateString() next_check_in_on?: string;
}

export class ClosePipDto {
    @ApiProperty({ enum: ['COMPLETED_SUCCESSFUL', 'COMPLETED_UNSUCCESSFUL', 'CANCELLED'] }) @IsIn(['COMPLETED_SUCCESSFUL', 'COMPLETED_UNSUCCESSFUL', 'CANCELLED']) outcome: 'COMPLETED_SUCCESSFUL' | 'COMPLETED_UNSUCCESSFUL' | 'CANCELLED';
    @ApiProperty() @IsString() @MinLength(3) @MaxLength(5000) outcome_note: string;
}

export const PipQuerySchema = BaseListQuerySchema.extend({
    employee_id: z.string().uuid().optional(),
    status: csv(z.nativeEnum(PerformanceImprovementPlanStatus)),
});
export type PipQuery = z.infer<typeof PipQuerySchema>;

// ------------------------------------------------------------------ feedback requests (360 / peer)

export class FeedbackRequestDto {
    @ApiProperty({ description: 'The employee the feedback is about' }) @IsUUID() employee_id: string;
    @ApiProperty({ type: [String], description: 'Members asked for feedback' }) @IsArray() @ArrayMinSize(1) @ArrayMaxSize(20) @IsUUID('all', { each: true }) requested_from_membership_ids: string[];
    @ApiPropertyOptional() @IsOptional() @IsDateString() due_date?: string;
    @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(2000) message?: string;
    @ApiPropertyOptional() @IsOptional() @IsBoolean() is_anonymous?: boolean;
    @ApiPropertyOptional() @IsOptional() @IsUUID() review_id?: string;
    @ApiPropertyOptional() @IsOptional() @IsUUID() cycle_id?: string;
}

export class SubmitFeedbackRequestDto {
    @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(200) title?: string;
    @ApiProperty() @IsString() @MinLength(1) @MaxLength(10000) body: string;
    @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) @Max(10) rating?: number;
}

export class DeclineFeedbackRequestDto {
    @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(1000) reason?: string;
}

export const FeedbackRequestQuerySchema = BaseListQuerySchema.extend({
    box: z.enum(['inbox', 'sent', 'all']).optional().default('inbox'),
    employee_id: z.string().uuid().optional(),
    status: csv(z.nativeEnum(PerformanceFeedbackRequestStatus)),
});
export type FeedbackRequestQuery = z.infer<typeof FeedbackRequestQuerySchema>;

// ------------------------------------------------------------------ calibration

export class CalibrateReviewDto {
    @ApiProperty() @IsNumber() @Min(0) @Max(10) calibrated_rating: number;
    @ApiProperty() @IsString() @MinLength(3) @MaxLength(2000) reason: string;
}

/** Zod twins for MCP tools. */
export const PipSchema = z.object({
    employee_id: z.string().uuid(),
    title: z.string().min(1).max(160),
    reason: z.string().max(5000).optional(),
    objectives: z.string().max(20000).optional(),
    start_date: z.string().date(),
    end_date: z.string().date(),
    check_in_frequency_days: z.number().int().min(1).max(90).optional(),
    items: z.array(z.object({ title: z.string().min(1).max(200), description: z.string().max(2000).optional(), due_date: z.string().date().optional() })).max(30).optional(),
});
export const FeedbackRequestSchema = z.object({
    employee_id: z.string().uuid(),
    requested_from_membership_ids: z.array(z.string().uuid()).min(1).max(20),
    due_date: z.string().date().optional(),
    message: z.string().max(2000).optional(),
    is_anonymous: z.boolean().optional(),
    review_id: z.string().uuid().optional(),
    cycle_id: z.string().uuid().optional(),
});
export const CalibrateSchema = z.object({ review_id: z.string().uuid(), calibrated_rating: z.number().min(0).max(10), reason: z.string().min(3).max(2000) });
