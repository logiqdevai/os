import { ApiProperty, OmitType, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
    ArrayMaxSize, IsArray, IsBoolean, IsDateString, IsEmail, IsEnum, IsIn, IsInt, IsNumber, IsObject, IsOptional, IsString, IsUUID, Length, Max, MaxLength, Min, MinLength, ValidateNested,
} from 'class-validator';
import { ContractObligationStatus, ContractPartyType, ContractRelationKind, ContractRenewalDecisionType, ContractRenewalType, ContractStatus, ContractTerminationType } from 'generated/prisma';
import { z } from 'zod';
import { BaseListQuerySchema, boolish, csv } from '@/shared/utils/pagination/pagination.utils';

export class SignatoryDto {
    @ApiProperty({ required: false }) @IsOptional() @IsUUID() membership_id?: string;
    @ApiProperty({ required: false }) @IsOptional() @IsUUID() contact_id?: string;
    @ApiProperty() @IsString() @MinLength(1) @MaxLength(160) name: string;
    @ApiProperty({ required: false }) @IsOptional() @IsString() @MaxLength(120) title?: string;
    @ApiProperty() @IsEmail() email: string;
    @ApiProperty({ required: false, description: 'E.164' }) @IsOptional() @IsString() @MaxLength(20) phone?: string;
    @ApiProperty({ required: false }) @IsOptional() @IsBoolean() is_required?: boolean;
}

export class PartyDto {
    @ApiProperty({ enum: ContractPartyType }) @IsEnum(ContractPartyType) party_type: ContractPartyType;
    @ApiProperty({ required: false }) @IsOptional() @IsUUID() company_id?: string;
    @ApiProperty() @IsString() @MinLength(1) @MaxLength(200) legal_name: string;
    @ApiProperty({ required: false }) @IsOptional() @IsObject() address?: Record<string, unknown>;
    @ApiProperty({ required: false }) @IsOptional() @IsString() @MaxLength(60) registration_number?: string;
    @ApiProperty({ required: false }) @IsOptional() @IsString() @MaxLength(60) vat_number?: string;
    @ApiProperty({ type: [SignatoryDto], required: false }) @IsOptional() @IsArray() @ArrayMaxSize(20) @ValidateNested({ each: true }) @Type(() => SignatoryDto) signatories?: SignatoryDto[];
}

export class CreateContractDto {
    @ApiProperty({ example: 'Master services agreement — Acme' }) @IsString() @MinLength(1) @MaxLength(200) title: string;
    @ApiProperty({ required: false }) @IsOptional() @IsUUID() type_id?: string;
    @ApiProperty({ required: false, description: 'Template; its published version is used unless template_version_id is given' }) @IsOptional() @IsUUID() template_id?: string;
    @ApiProperty({ required: false }) @IsOptional() @IsUUID() template_version_id?: string;
    @ApiProperty({ required: false }) @IsOptional() @IsUUID() primary_company_id?: string;
    @ApiProperty({ required: false }) @IsOptional() @IsUUID() owner_membership_id?: string;
    @ApiProperty({ required: false }) @IsOptional() @IsUUID() branch_id?: string;
    @ApiProperty({ required: false }) @IsOptional() @IsUUID() proposal_id?: string;
    @ApiProperty({ required: false }) @IsOptional() @IsUUID() proposal_version_id?: string;
    @ApiProperty({ required: false, example: 'EUR' }) @IsOptional() @IsString() @Length(3, 3) currency?: string;
    @ApiProperty({ required: false, example: 'en' }) @IsOptional() @IsString() @MaxLength(10) language?: string;
    @ApiProperty({ required: false }) @IsOptional() @IsDateString() effective_date?: string;
    @ApiProperty({ required: false }) @IsOptional() @IsDateString() start_date?: string;
    @ApiProperty({ required: false }) @IsOptional() @IsDateString() end_date?: string;
    @ApiProperty({ required: false }) @IsOptional() @IsDateString() expiration_date?: string;
    @ApiProperty({ required: false }) @IsOptional() @IsDateString() renewal_date?: string;
    @ApiProperty({ required: false }) @IsOptional() @IsDateString() notice_deadline?: string;
    @ApiProperty({ enum: ContractRenewalType, required: false }) @IsOptional() @IsEnum(ContractRenewalType) renewal_type?: ContractRenewalType;
    @ApiProperty({ required: false }) @IsOptional() @IsInt() @Min(1) @Max(240) renewal_term_months?: number;
    @ApiProperty({ required: false }) @IsOptional() @IsInt() @Min(0) @Max(3650) notice_days?: number;
    @ApiProperty({ required: false }) @IsOptional() @IsNumber() @Min(0) total_value?: number;
    @ApiProperty({ required: false }) @IsOptional() @IsNumber() @Min(0) one_time_value?: number;
    @ApiProperty({ required: false }) @IsOptional() @IsNumber() @Min(0) recurring_value?: number;
    @ApiProperty({ required: false, example: 'monthly' }) @IsOptional() @IsIn(['monthly', 'quarterly', 'annual', 'milestone', 'custom']) billing_frequency?: string;
    @ApiProperty({ required: false }) @IsOptional() @IsString() @MaxLength(500) payment_terms?: string;
    @ApiProperty({ required: false }) @IsOptional() @IsBoolean() customer_visible?: boolean;
    @ApiProperty({ required: false }) @IsOptional() @IsBoolean() processes_personal_data?: boolean;
    @ApiProperty({ type: [PartyDto], required: false, description: 'Defaults to the agency + the primary company' }) @IsOptional() @IsArray() @ArrayMaxSize(10) @ValidateNested({ each: true }) @Type(() => PartyDto) parties?: PartyDto[];
    @ApiProperty({ type: [String], required: false }) @IsOptional() @IsArray() @IsUUID('all', { each: true }) project_ids?: string[];
    @ApiProperty({ required: false, description: 'Extra template variables (key → value)' }) @IsOptional() @IsObject() variables?: Record<string, string>;
}

export class UpdateContractDto extends PartialType(OmitType(CreateContractDto, ['template_id', 'template_version_id', 'parties', 'project_ids', 'variables', 'proposal_id', 'proposal_version_id'] as const)) { }

export class SetPartiesDto {
    @ApiProperty({ type: [PartyDto] }) @IsArray() @ArrayMaxSize(10) @ValidateNested({ each: true }) @Type(() => PartyDto) parties: PartyDto[];
}

export class LinkProjectDto {
    @ApiProperty() @IsUUID() project_id: string;
    @ApiProperty({ required: false, enum: ['primary', 'sow', 'related'] }) @IsOptional() @IsIn(['primary', 'sow', 'related']) role?: string;
}

export class RenewalDecisionDto {
    @ApiProperty({ enum: ContractRenewalDecisionType }) @IsEnum(ContractRenewalDecisionType) decision: ContractRenewalDecisionType;
    @ApiProperty({ required: false }) @IsOptional() @IsString() @MaxLength(2000) reason?: string;
}

export class RenewContractDto {
    @ApiProperty({ required: false, description: 'Defaults to the contract renewal term or 12' }) @IsOptional() @IsInt() @Min(1) @Max(240) term_months?: number;
    @ApiProperty({ required: false, description: 'Defaults to the day after the current end date' }) @IsOptional() @IsDateString() effective_date?: string;
    @ApiProperty({ required: false, enum: ['none', 'percent', 'amount'] }) @IsOptional() @IsIn(['none', 'percent', 'amount']) value_change_type?: 'none' | 'percent' | 'amount';
    @ApiProperty({ required: false }) @IsOptional() @IsNumber() value_change?: number;
    @ApiProperty({ required: false }) @IsOptional() @IsString() @MaxLength(200) title?: string;
}

export class AmendmentChangeDto {
    @ApiProperty() @IsString() @MaxLength(60) section_key: string;
    @ApiProperty({ enum: ['replace', 'add', 'remove'] }) @IsIn(['replace', 'add', 'remove']) action: 'replace' | 'add' | 'remove';
    @ApiProperty({ required: false }) @IsOptional() @IsString() @MaxLength(200) title?: string;
    @ApiProperty({ required: false }) @IsOptional() @IsString() @MaxLength(100_000) text?: string;
}

export class AmendContractDto {
    @ApiProperty({ enum: [ContractRelationKind.AMENDMENT, ContractRelationKind.CHANGE_ORDER, ContractRelationKind.SOW] })
    @IsIn([ContractRelationKind.AMENDMENT, ContractRelationKind.CHANGE_ORDER, ContractRelationKind.SOW]) kind: ContractRelationKind;
    @ApiProperty({ required: false }) @IsOptional() @IsString() @MaxLength(200) title?: string;
    @ApiProperty({ required: false }) @IsOptional() @IsString() @MaxLength(2000) reason?: string;
    @ApiProperty({ type: [AmendmentChangeDto], required: false }) @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => AmendmentChangeDto) changes?: AmendmentChangeDto[];
    @ApiProperty({ required: false }) @IsOptional() @IsDateString() effective_date?: string;
    @ApiProperty({ required: false }) @IsOptional() @IsNumber() value_delta?: number;
}

export class TerminateContractDto {
    @ApiProperty({ enum: ContractTerminationType }) @IsEnum(ContractTerminationType) type: ContractTerminationType;
    @ApiProperty({ required: false }) @IsOptional() @IsString() @MaxLength(4000) reason?: string;
    @ApiProperty({ required: false }) @IsOptional() @IsUUID() requesting_party_id?: string;
    @ApiProperty({ required: false }) @IsOptional() @IsDateString() notice_date?: string;
    @ApiProperty() @IsDateString() effective_date: string;
    @ApiProperty({ required: false }) @IsOptional() @IsString() @MaxLength(4000) notes?: string;
    @ApiProperty({ required: false, enum: ['waive', 'cancel', 'keep'] }) @IsOptional() @IsIn(['waive', 'cancel', 'keep']) close_obligations?: 'waive' | 'cancel' | 'keep';
}

export const ContractQuerySchema = BaseListQuerySchema.extend({
    status: csv(z.nativeEnum(ContractStatus)),
    type_id: z.string().uuid().optional(),
    primary_company_id: z.string().uuid().optional(),
    owner_membership_id: z.string().uuid().optional(),
    relation_kind: z.nativeEnum(ContractRelationKind).optional(),
    parent_contract_id: z.string().uuid().optional(),
    proposal_id: z.string().uuid().optional(),
    expiring_within_days: z.coerce.number().int().min(1).max(3650).optional(),
    archived: boolish,
});
export type ContractQuery = z.infer<typeof ContractQuerySchema>;

export const RenewalsQuerySchema = BaseListQuerySchema.extend({
    within_days: z.coerce.number().int().min(1).max(3650).optional().default(90),
    type_id: z.string().uuid().optional(),
    renewal_type: z.nativeEnum(ContractRenewalType).optional(),
    owner_membership_id: z.string().uuid().optional(),
});
export type RenewalsQuery = z.infer<typeof RenewalsQuerySchema>;

/** Zod twin of CreateContractDto for MCP (main fields). */
export const CreateContractSchema = z.object({
    title: z.string().min(1).max(200),
    type_id: z.string().uuid().optional(),
    template_id: z.string().uuid().optional(),
    primary_company_id: z.string().uuid().optional(),
    owner_membership_id: z.string().uuid().optional(),
    currency: z.string().length(3).optional(),
    start_date: z.string().optional(),
    end_date: z.string().optional(),
    renewal_type: z.nativeEnum(ContractRenewalType).optional(),
    notice_days: z.number().int().min(0).optional(),
    total_value: z.number().min(0).optional(),
    payment_terms: z.string().max(500).optional(),
    project_ids: z.array(z.string().uuid()).optional(),
});

export const UpdateContractSchema = CreateContractSchema.omit({ template_id: true, project_ids: true }).partial().extend({ id: z.string().uuid() });

export const TerminateContractSchema = z.object({
    id: z.string().uuid(),
    type: z.nativeEnum(ContractTerminationType),
    reason: z.string().max(4000).optional(),
    effective_date: z.string(),
    notice_date: z.string().optional(),
    close_obligations: z.enum(['waive', 'cancel', 'keep']).optional(),
});

export const ObligationStatusValues = ContractObligationStatus;
