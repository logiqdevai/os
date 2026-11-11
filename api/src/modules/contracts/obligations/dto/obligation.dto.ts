import { ApiProperty, OmitType, PartialType } from '@nestjs/swagger';
import { IsDateString, IsEnum, IsIn, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min, MinLength } from 'class-validator';
import { ContractObligationStatus, ContractObligationType } from 'generated/prisma';
import { z } from 'zod';
import { BaseListQuerySchema, boolish, csv } from '@/shared/utils/pagination/pagination.utils';

export const OBLIGATION_FREQUENCIES = ['none', 'weekly', 'monthly', 'quarterly', 'annual'] as const;

export class CreateObligationDto {
    @ApiProperty() @IsUUID() contract_id: string;
    @ApiProperty({ required: false }) @IsOptional() @IsUUID() section_id?: string;
    @ApiProperty({ enum: ContractObligationType, required: false }) @IsOptional() @IsEnum(ContractObligationType) type?: ContractObligationType;
    @ApiProperty() @IsString() @MinLength(1) @MaxLength(200) title: string;
    @ApiProperty({ required: false }) @IsOptional() @IsString() @MaxLength(4000) description?: string;
    @ApiProperty({ required: false }) @IsOptional() @IsUUID() responsible_party_id?: string;
    @ApiProperty({ required: false }) @IsOptional() @IsUUID() responsible_membership_id?: string;
    @ApiProperty({ required: false }) @IsOptional() @IsDateString() due_date?: string;
    @ApiProperty({ required: false, enum: OBLIGATION_FREQUENCIES }) @IsOptional() @IsIn(OBLIGATION_FREQUENCIES as unknown as string[]) frequency?: string;
    @ApiProperty({ required: false }) @IsOptional() @IsInt() @Min(0) @Max(365) reminder_days_before?: number;
    @ApiProperty({ required: false }) @IsOptional() @IsUUID() project_id?: string;
}

export class UpdateObligationDto extends PartialType(OmitType(CreateObligationDto, ['contract_id'] as const)) {
    @ApiProperty({ enum: ContractObligationStatus, required: false }) @IsOptional() @IsEnum(ContractObligationStatus) status?: ContractObligationStatus;
}

export const ObligationQuerySchema = BaseListQuerySchema.extend({
    contract_id: z.string().uuid().optional(),
    status: csv(z.nativeEnum(ContractObligationStatus)),
    type: z.nativeEnum(ContractObligationType).optional(),
    responsible_membership_id: z.string().uuid().optional(),
    mine: boolish,
    overdue: boolish,
    due_within_days: z.coerce.number().int().min(1).max(3650).optional(),
});
export type ObligationQuery = z.infer<typeof ObligationQuerySchema>;

export const CreateObligationSchema = z.object({
    contract_id: z.string().uuid(),
    type: z.nativeEnum(ContractObligationType).optional(),
    title: z.string().min(1).max(200),
    description: z.string().max(4000).optional(),
    responsible_membership_id: z.string().uuid().optional(),
    due_date: z.string().optional(),
    frequency: z.enum(OBLIGATION_FREQUENCIES).optional(),
    reminder_days_before: z.number().int().min(0).max(365).optional(),
});
