import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsArray, IsBoolean, IsDateString, IsEnum, IsNumber, IsObject, IsOptional, IsString, IsUUID, Max, MaxLength, Min, MinLength } from 'class-validator';
import {
    PerformanceFeedbackKind, PerformanceFeedbackVisibility, PerformanceGoalKind, PerformanceGoalStatus, PerformanceReviewCycleStatus, PerformanceReviewStatus, PerformanceReviewType,
} from 'generated/prisma';
import { z } from 'zod';
import { BaseListQuerySchema, csv } from '@/shared/utils/pagination/pagination.utils';

export class CycleDto {
    @ApiProperty({ example: 'H2 2026' }) @IsString() @MinLength(1) @MaxLength(120) name: string;
    @ApiPropertyOptional({ enum: PerformanceReviewType }) @IsOptional() @IsEnum(PerformanceReviewType) type?: PerformanceReviewType;
    @ApiProperty() @IsDateString() period_start: string;
    @ApiProperty() @IsDateString() period_end: string;
    @ApiPropertyOptional() @IsOptional() @IsDateString() due_date?: string;
    @ApiPropertyOptional({ description: '{ criteria: [{ key, label }] , rating_scale_max }' }) @IsOptional() @IsObject() template?: Record<string, unknown>;
}
export class UpdateCycleDto extends PartialType(CycleDto) {
    @ApiPropertyOptional({ enum: PerformanceReviewCycleStatus }) @IsOptional() @IsEnum(PerformanceReviewCycleStatus) status?: PerformanceReviewCycleStatus;
}

export class LaunchCycleDto {
    @ApiPropertyOptional({ type: [String], description: 'Employees to review; omit for every active employee in scope' }) @IsOptional() @IsArray() @IsUUID('all', { each: true }) employee_ids?: string[];
}

export class ReviewDto {
    @ApiProperty() @IsUUID() employee_id: string;
    @ApiPropertyOptional() @IsOptional() @IsUUID() cycle_id?: string;
    @ApiPropertyOptional() @IsOptional() @IsUUID() reviewer_membership_id?: string;
    @ApiPropertyOptional({ enum: PerformanceReviewType }) @IsOptional() @IsEnum(PerformanceReviewType) type?: PerformanceReviewType;
    @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(160) title?: string;
    @ApiProperty() @IsDateString() period_start: string;
    @ApiProperty() @IsDateString() period_end: string;
    @ApiPropertyOptional() @IsOptional() @IsDateString() due_date?: string;
}

export class UpdateReviewDto {
    @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(20000) self_assessment?: string;
    @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(20000) manager_assessment?: string;
    @ApiPropertyOptional({ description: '{ criterion_key: rating }' }) @IsOptional() @IsObject() ratings?: Record<string, number>;
    @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) @Max(10) overall_rating?: number;
    @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(5000) strengths?: string;
    @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(5000) improvement_areas?: string;
    @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(5000) summary?: string;
    @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(5000) employee_comment?: string;
    @ApiPropertyOptional() @IsOptional() @IsDateString() due_date?: string;
    @ApiPropertyOptional() @IsOptional() @IsDateString() next_review_date?: string;
    @ApiPropertyOptional() @IsOptional() @IsUUID() reviewer_membership_id?: string;
}

export class GoalDto {
    @ApiProperty() @IsUUID() employee_id: string;
    @ApiPropertyOptional({ enum: PerformanceGoalKind }) @IsOptional() @IsEnum(PerformanceGoalKind) kind?: PerformanceGoalKind;
    @ApiProperty() @IsString() @MinLength(1) @MaxLength(200) title: string;
    @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(5000) description?: string;
    @ApiPropertyOptional() @IsOptional() @IsUUID() parent_goal_id?: string;
    @ApiPropertyOptional() @IsOptional() @IsUUID() review_id?: string;
    @ApiPropertyOptional() @IsOptional() @IsUUID() project_id?: string;
    @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) @Max(100) weight_percent?: number;
    @ApiPropertyOptional() @IsOptional() @IsNumber() target_value?: number;
    @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(30) unit?: string;
    @ApiPropertyOptional() @IsOptional() @IsDateString() start_date?: string;
    @ApiPropertyOptional() @IsOptional() @IsDateString() due_date?: string;
    @ApiPropertyOptional() @IsOptional() @IsBoolean() employee_visible?: boolean;
}
export class UpdateGoalDto extends PartialType(GoalDto) {
    @ApiPropertyOptional({ enum: PerformanceGoalStatus }) @IsOptional() @IsEnum(PerformanceGoalStatus) status?: PerformanceGoalStatus;
}

export class GoalUpdateDto {
    @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) @Max(100) progress_percent?: number;
    @ApiPropertyOptional() @IsOptional() @IsNumber() current_value?: number;
    @ApiPropertyOptional({ enum: PerformanceGoalStatus }) @IsOptional() @IsEnum(PerformanceGoalStatus) status?: PerformanceGoalStatus;
    @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(2000) note?: string;
}

export class FeedbackDto {
    @ApiProperty() @IsUUID() employee_id: string;
    @ApiProperty({ enum: PerformanceFeedbackKind }) @IsEnum(PerformanceFeedbackKind) kind: PerformanceFeedbackKind;
    @ApiPropertyOptional({ enum: PerformanceFeedbackVisibility }) @IsOptional() @IsEnum(PerformanceFeedbackVisibility) visibility?: PerformanceFeedbackVisibility;
    @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(200) title?: string;
    @ApiProperty() @IsString() @MinLength(1) @MaxLength(10000) body: string;
    @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) @Max(10) rating?: number;
    @ApiPropertyOptional() @IsOptional() @IsUUID() review_id?: string;
    @ApiPropertyOptional() @IsOptional() @IsUUID() goal_id?: string;
    @ApiPropertyOptional() @IsOptional() @IsBoolean() is_anonymous?: boolean;
    @ApiPropertyOptional() @IsOptional() @IsDateString() occurred_on?: string;
}

export const ReviewQuerySchema = BaseListQuerySchema.extend({
    cycle_id: z.string().uuid().optional(),
    employee_id: z.string().uuid().optional(),
    status: csv(z.nativeEnum(PerformanceReviewStatus)),
    mine: z.enum(['employee', 'reviewer']).optional(),
});
export type ReviewQuery = z.infer<typeof ReviewQuerySchema>;

export const GoalQuerySchema = BaseListQuerySchema.extend({
    employee_id: z.string().uuid().optional(),
    status: csv(z.nativeEnum(PerformanceGoalStatus)),
    kind: z.nativeEnum(PerformanceGoalKind).optional(),
    review_id: z.string().uuid().optional(),
});
export type GoalQuery = z.infer<typeof GoalQuerySchema>;

export const FeedbackQuerySchema = BaseListQuerySchema.extend({
    employee_id: z.string().uuid().optional(),
    kind: z.nativeEnum(PerformanceFeedbackKind).optional(),
});
export type FeedbackQuery = z.infer<typeof FeedbackQuerySchema>;

