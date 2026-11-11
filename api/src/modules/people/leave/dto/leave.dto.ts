import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
    IsArray, IsBoolean, IsDateString, IsEnum, IsInt, IsNumber, IsOptional, IsString, IsUUID, Matches, Max, MaxLength, Min, MinLength,
} from 'class-validator';
import { CompanyHolidayKind, EmploymentType, LeaveAccrualMethod, LeaveCategory, LeaveDayPart, LeaveRequestStatus } from 'generated/prisma';
import { z } from 'zod';
import { BaseListQuerySchema, boolish, csv } from '@/shared/utils/pagination/pagination.utils';

export class LeaveTypeDto {
    @ApiProperty({ example: 'Vacation' }) @IsString() @MinLength(1) @MaxLength(80) name: string;
    @ApiProperty({ example: 'VAC' }) @Matches(/^[A-Z][A-Z0-9_]{1,15}$/) code: string;
    @ApiProperty({ enum: LeaveCategory }) @IsEnum(LeaveCategory) category: LeaveCategory;
    @ApiPropertyOptional({ example: 'info', description: 'Semantic color token name (info, success, warning, danger, violet, neutral)' }) @IsOptional() @IsString() @MaxLength(20) color?: string;
    @ApiPropertyOptional() @IsOptional() @IsBoolean() is_paid?: boolean;
    @ApiPropertyOptional() @IsOptional() @IsBoolean() requires_approval?: boolean;
    @ApiPropertyOptional() @IsOptional() @IsBoolean() requires_attachment?: boolean;
    @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) attachment_after_days?: number;
    @ApiPropertyOptional() @IsOptional() @IsBoolean() allows_half_day?: boolean;
    @ApiPropertyOptional() @IsOptional() @IsBoolean() deducts_balance?: boolean;
    @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) @Max(365) min_notice_days?: number;
    @ApiPropertyOptional() @IsOptional() @IsInt() @Min(1) @Max(730) max_consecutive_days?: number;
    @ApiPropertyOptional({ enum: EmploymentType, isArray: true }) @IsOptional() @IsArray() @IsEnum(EmploymentType, { each: true }) applies_to_types?: EmploymentType[];
    @ApiPropertyOptional() @IsOptional() @IsInt() sort_order?: number;
}
export class UpdateLeaveTypeDto extends PartialType(LeaveTypeDto) { }

export class LeavePolicyDto {
    @ApiProperty() @IsUUID() leave_type_id: string;
    @ApiPropertyOptional() @IsOptional() @IsUUID() branch_id?: string;
    @ApiProperty({ example: 'Vacation — Portugal' }) @IsString() @MinLength(1) @MaxLength(120) name: string;
    @ApiPropertyOptional({ enum: LeaveAccrualMethod }) @IsOptional() @IsEnum(LeaveAccrualMethod) accrual_method?: LeaveAccrualMethod;
    @ApiProperty({ example: 22 }) @IsNumber() @Min(0) @Max(366) annual_entitlement_days: number;
    @ApiPropertyOptional() @IsOptional() @IsBoolean() prorate_first_year?: boolean;
    @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) seniority_bonus_days_per_year?: number;
    @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) max_entitlement_days?: number;
    @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) carry_over_max_days?: number;
    @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) carry_over_expiry_months?: number;
    @ApiPropertyOptional() @IsOptional() @IsBoolean() allow_negative_balance?: boolean;
    @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) max_negative_days?: number;
    @ApiPropertyOptional() @IsOptional() @IsInt() @Min(1) @Max(12) period_start_month?: number;
    @ApiPropertyOptional() @IsOptional() @IsInt() @Min(1) @Max(31) period_start_day?: number;
    @ApiPropertyOptional({ enum: EmploymentType, isArray: true }) @IsOptional() @IsArray() @IsEnum(EmploymentType, { each: true }) applies_to_types?: EmploymentType[];
    @ApiPropertyOptional() @IsOptional() @IsBoolean() is_default?: boolean;
}
export class UpdateLeavePolicyDto extends PartialType(LeavePolicyDto) { }

export class AssignPolicyDto {
    @ApiProperty() @IsUUID() employee_id: string;
    @ApiProperty() @IsDateString() effective_from: string;
}

export class HolidayDto {
    @ApiProperty() @IsString() @MinLength(1) @MaxLength(120) name: string;
    @ApiProperty() @IsDateString() date: string;
    @ApiPropertyOptional({ enum: CompanyHolidayKind }) @IsOptional() @IsEnum(CompanyHolidayKind) kind?: CompanyHolidayKind;
    @ApiPropertyOptional() @IsOptional() @IsBoolean() is_half_day?: boolean;
    @ApiPropertyOptional() @IsOptional() @IsBoolean() recurring?: boolean;
    @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(2) country_code?: string;
    @ApiPropertyOptional({ type: [String] }) @IsOptional() @IsArray() @IsUUID('all', { each: true }) applies_to_branch_ids?: string[];
}

export class LeaveRequestDto {
    @ApiPropertyOptional({ description: 'On behalf of another employee (employees.leave.manage_balances). Omit for yourself.' }) @IsOptional() @IsUUID() employee_id?: string;
    @ApiProperty() @IsUUID() leave_type_id: string;
    @ApiProperty({ example: '2026-12-21' }) @IsDateString() start_date: string;
    @ApiProperty({ example: '2026-12-24' }) @IsDateString() end_date: string;
    @ApiPropertyOptional({ enum: LeaveDayPart }) @IsOptional() @IsEnum(LeaveDayPart) start_day_part?: LeaveDayPart;
    @ApiPropertyOptional({ enum: LeaveDayPart }) @IsOptional() @IsEnum(LeaveDayPart) end_day_part?: LeaveDayPart;
    @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(2000) reason?: string;
    @ApiPropertyOptional() @IsOptional() @IsUUID() covering_employee_id?: string;
    @ApiPropertyOptional() @IsOptional() @IsUUID() attachment_document_id?: string;
    @ApiPropertyOptional({ description: 'false = save as DRAFT' }) @IsOptional() @IsBoolean() submit?: boolean;
}

export class DecideLeaveDto {
    @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(1000) note?: string;
}

export class CancelLeaveDto {
    @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(1000) cancellation_reason?: string;
}

export class AdjustBalanceDto {
    @ApiProperty({ example: 1.5, description: 'Positive adds days, negative removes days' }) @IsNumber() @Min(-366) @Max(366) days: number;
    @ApiProperty() @IsString() @MinLength(3) @MaxLength(500) reason: string;
}

export const LeaveRequestQuerySchema = BaseListQuerySchema.extend({
    status: csv(z.nativeEnum(LeaveRequestStatus)),
    employee_id: z.string().uuid().optional(),
    leave_type_id: z.string().uuid().optional(),
    from: z.string().date().optional(),
    to: z.string().date().optional(),
    mine: boolish,
    to_approve: boolish,
});
export type LeaveRequestQuery = z.infer<typeof LeaveRequestQuerySchema>;

export const LeaveBalanceQuerySchema = BaseListQuerySchema.extend({
    employee_id: z.string().uuid().optional(),
    year: z.coerce.number().int().min(2000).max(2100).optional(),
    department_team_id: z.string().uuid().optional(),
});
export type LeaveBalanceQuery = z.infer<typeof LeaveBalanceQuerySchema>;

export const LeaveCalendarQuerySchema = z.object({
    from: z.string().date(),
    to: z.string().date(),
    team_id: z.string().uuid().optional(),
    branch_id: z.string().uuid().optional(),
});
export type LeaveCalendarQuery = z.infer<typeof LeaveCalendarQuerySchema>;

export const HolidayQuerySchema = z.object({ year: z.coerce.number().int().min(2000).max(2100).optional() });

/** Zod twin of LeaveRequestDto for the MCP tool. */
export const LeaveRequestSchema = z.object({
    employee_id: z.string().uuid().optional(),
    leave_type_id: z.string().uuid(),
    start_date: z.string().date(),
    end_date: z.string().date(),
    start_day_part: z.nativeEnum(LeaveDayPart).optional(),
    end_day_part: z.nativeEnum(LeaveDayPart).optional(),
    reason: z.string().max(2000).optional(),
    submit: z.boolean().optional(),
});
