import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNumber, IsOptional, IsString, IsUUID, Matches, Max, MaxLength, Min, ValidateIf } from 'class-validator';
import { BillingRateScope, TimeRateKind } from 'generated/prisma';
import { z } from 'zod';
import { BaseListQuerySchema } from '@/shared/utils/pagination/pagination.utils';

const DATE = /^\d{4}-\d{2}-\d{2}$/;

export class CreateBillingRateDto {
    @ApiProperty({ enum: TimeRateKind, required: false }) @IsOptional() @IsEnum(TimeRateKind) kind?: TimeRateKind;
    @ApiProperty({ enum: BillingRateScope }) @IsEnum(BillingRateScope) scope: BillingRateScope;
    @ApiProperty({ required: false }) @IsOptional() @IsUUID() product_id?: string;
    @ApiProperty({ required: false }) @IsOptional() @IsUUID() project_id?: string;
    @ApiProperty({ required: false }) @IsOptional() @IsUUID() membership_id?: string;
    @ApiProperty({ required: false }) @IsOptional() @IsUUID() activity_type_id?: string;
    @ApiProperty({ required: false }) @IsOptional() @IsString() @MaxLength(120) name?: string;
    @ApiProperty({ example: 'EUR' }) @Matches(/^[A-Z]{3}$/, { message: 'currency must be a 3-letter ISO code' }) currency: string;
    @ApiProperty({ example: 95 }) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) @Max(100000) hourly_rate: number;
    @ApiProperty({ example: '2026-01-01' }) @Matches(DATE) effective_from: string;
    @ApiProperty({ required: false }) @IsOptional() @ValidateIf((_, v) => v !== null) @Matches(DATE) effective_to?: string | null;
    @ApiProperty({ required: false }) @IsOptional() @IsString() @MaxLength(1000) notes?: string;
}

/** Once a rate has been snapshotted on entries only these fields may change (end-date it and create a new rate). */
export class UpdateBillingRateDto {
    @ApiProperty({ required: false }) @IsOptional() @IsString() @MaxLength(120) name?: string;
    @ApiProperty({ required: false }) @IsOptional() @IsString() @MaxLength(1000) notes?: string;
    @ApiProperty({ required: false }) @IsOptional() @ValidateIf((_, v) => v !== null) @Matches(DATE) effective_to?: string | null;
    @ApiProperty({ required: false }) @IsOptional() @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) @Max(100000) hourly_rate?: number;
    @ApiProperty({ required: false }) @IsOptional() @Matches(/^[A-Z]{3}$/) currency?: string;
    @ApiProperty({ required: false }) @IsOptional() @Matches(DATE) effective_from?: string;
}

export const BillingRateQuerySchema = BaseListQuerySchema.extend({
    kind: z.nativeEnum(TimeRateKind).optional(),
    scope: z.nativeEnum(BillingRateScope).optional(),
    project_id: z.string().uuid().optional(),
    membership_id: z.string().uuid().optional(),
    activity_type_id: z.string().uuid().optional(),
    status: z.enum(['active', 'expired', 'archived', 'scheduled', 'all']).optional(),
});
export type BillingRateQuery = z.infer<typeof BillingRateQuerySchema>;

export const ResolveRateQuerySchema = z.object({
    membership_id: z.string().uuid(),
    project_id: z.string().uuid().optional(),
    activity_type_id: z.string().uuid().optional(),
    date: z.string().regex(DATE).optional(),
});
export type ResolveRateQuery = z.infer<typeof ResolveRateQuerySchema>;
