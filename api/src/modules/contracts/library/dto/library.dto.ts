import { ApiProperty, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsBoolean, IsDateString, IsEnum, IsIn, IsInt, IsObject, IsOptional, IsString, IsUUID, Matches, Max, MaxLength, Min, MinLength, ValidateNested } from 'class-validator';
import { ContractClauseStatus, ContractRenewalType, ContractTemplateStatus } from 'generated/prisma';
import { z } from 'zod';
import { BaseListQuerySchema, boolish } from '@/shared/utils/pagination/pagination.utils';

// --- Contract types ------------------------------------------------------------------

export class CreateContractTypeDto {
    @ApiProperty({ example: 'Master services agreement' }) @IsString() @MinLength(1) @MaxLength(120) name: string;
    @ApiProperty({ required: false }) @IsOptional() @IsString() @MaxLength(2000) description?: string;
    @ApiProperty({ required: false }) @IsOptional() @IsUUID() default_template_id?: string;
    @ApiProperty({ required: false, type: [String], description: 'Metadata keys required before approval (04 §16)' }) @IsOptional() @IsArray() @IsString({ each: true }) required_metadata?: string[];
    @ApiProperty({ required: false, description: 'Default approval steps when no rule matches' }) @IsOptional() @IsArray() approval_workflow?: Record<string, unknown>[];
    @ApiProperty({ required: false }) @IsOptional() @IsObject() signature_requirements?: Record<string, unknown>;
    @ApiProperty({ enum: ContractRenewalType, required: false }) @IsOptional() @IsEnum(ContractRenewalType) default_renewal_type?: ContractRenewalType;
    @ApiProperty({ required: false }) @IsOptional() @IsInt() @Min(0) @Max(3650) default_notice_days?: number;
    @ApiProperty({ required: false, type: [Number] }) @IsOptional() @IsArray() @IsInt({ each: true }) reminder_windows_days?: number[];
    @ApiProperty({ required: false }) @IsOptional() @IsInt() @Min(0) retention_days?: number;
    @ApiProperty({ required: false }) @IsOptional() @IsInt() sort_order?: number;
}
export class UpdateContractTypeDto extends PartialType(CreateContractTypeDto) { }

// --- Templates -------------------------------------------------------------------------

export class TemplateSectionDto {
    @ApiProperty({ example: 'scope' }) @Matches(/^[a-z0-9_]{1,60}$/, { message: 'key must be lowercase letters, digits or _' }) key: string;
    @ApiProperty() @IsString() @MinLength(1) @MaxLength(200) title: string;
    @ApiProperty({ required: false, description: 'Markdown body with {{variables}}' }) @IsOptional() @IsString() @MaxLength(100_000) body?: string;
    @ApiProperty({ required: false, description: 'Embed the current version of a library clause' }) @IsOptional() @IsString() clause_key?: string;
    @ApiProperty({ required: false }) @IsOptional() @IsBoolean() is_optional?: boolean;
    @ApiProperty({ required: false }) @IsOptional() @IsBoolean() is_appendix?: boolean;
    @ApiProperty({ required: false }) @IsOptional() @IsInt() sort_order?: number;
}

export class TemplateVersionDto {
    @ApiProperty({ required: false }) @IsOptional() @IsString() @MaxLength(500) change_summary?: string;
    @ApiProperty({ type: [TemplateSectionDto] }) @IsArray() @ArrayMaxSize(200) @ValidateNested({ each: true }) @Type(() => TemplateSectionDto) sections: TemplateSectionDto[];
    @ApiProperty({ required: false }) @IsOptional() @IsArray() variables?: Record<string, unknown>[];
    @ApiProperty({ required: false }) @IsOptional() @IsArray() conditional_rules?: Record<string, unknown>[];
    @ApiProperty({ required: false }) @IsOptional() @IsArray() signature_blocks?: Record<string, unknown>[];
    @ApiProperty({ required: false, type: [String] }) @IsOptional() @IsArray() @IsString({ each: true }) required_fields?: string[];
}

export class CreateContractTemplateDto extends TemplateVersionDto {
    @ApiProperty() @IsString() @MinLength(1) @MaxLength(160) name: string;
    @ApiProperty({ required: false }) @IsOptional() @IsString() @MaxLength(2000) description?: string;
    @ApiProperty({ required: false }) @IsOptional() @IsUUID() type_id?: string;
    @ApiProperty({ required: false, example: 'en' }) @IsOptional() @IsString() @MaxLength(10) language?: string;
    @ApiProperty({ required: false }) @IsOptional() @IsBoolean() publish?: boolean;
}

export class UpdateContractTemplateDto {
    @ApiProperty({ required: false }) @IsOptional() @IsString() @MinLength(1) @MaxLength(160) name?: string;
    @ApiProperty({ required: false }) @IsOptional() @IsString() @MaxLength(2000) description?: string;
    @ApiProperty({ required: false }) @IsOptional() @IsUUID() type_id?: string;
    @ApiProperty({ required: false }) @IsOptional() @IsString() @MaxLength(10) language?: string;
}

// --- Clauses ---------------------------------------------------------------------------

export const CLAUSE_CATEGORIES = ['payment', 'ip', 'confidentiality', 'privacy', 'liability', 'warranty', 'termination', 'renewal', 'sla', 'security', 'governing_law', 'other'] as const;

export class CreateContractClauseDto {
    @ApiProperty({ example: 'limitation_of_liability' }) @Matches(/^[a-z0-9_]{2,80}$/, { message: 'key must be lowercase letters, digits or _' }) key: string;
    @ApiProperty() @IsString() @MinLength(1) @MaxLength(160) name: string;
    @ApiProperty({ enum: CLAUSE_CATEGORIES }) @IsIn(CLAUSE_CATEGORIES as unknown as string[]) category: string;
    @ApiProperty({ required: false }) @IsOptional() @IsString() @MaxLength(2000) description?: string;
    @ApiProperty() @IsString() @MinLength(1) @MaxLength(50_000) text: string;
    @ApiProperty({ enum: ContractClauseStatus, required: false }) @IsOptional() @IsEnum(ContractClauseStatus) status?: ContractClauseStatus;
    @ApiProperty({ required: false }) @IsOptional() @IsObject() usage_restrictions?: Record<string, unknown>;
}

export class UpdateContractClauseDto {
    @ApiProperty({ required: false }) @IsOptional() @IsString() @MinLength(1) @MaxLength(160) name?: string;
    @ApiProperty({ required: false, enum: CLAUSE_CATEGORIES }) @IsOptional() @IsIn(CLAUSE_CATEGORIES as unknown as string[]) category?: string;
    @ApiProperty({ required: false }) @IsOptional() @IsString() @MaxLength(2000) description?: string;
    @ApiProperty({ enum: ContractClauseStatus, required: false }) @IsOptional() @IsEnum(ContractClauseStatus) status?: ContractClauseStatus;
    @ApiProperty({ required: false }) @IsOptional() @IsObject() usage_restrictions?: Record<string, unknown>;
}

export class ClauseVersionDto {
    @ApiProperty() @IsString() @MinLength(1) @MaxLength(50_000) text: string;
    @ApiProperty({ required: false }) @IsOptional() @IsString() @MaxLength(500) change_summary?: string;
    @ApiProperty({ required: false }) @IsOptional() @IsDateString() effective_date?: string;
}

// --- Approval rules ----------------------------------------------------------------------

export class RuleConditionDto {
    @ApiProperty({ example: 'total_value', description: 'total_value | one_time_value | recurring_value | type_id | risk_level | renewal_type | relation_kind | currency | processes_personal_data | term_months' })
    @IsString() field: string;
    @ApiProperty({ enum: ['>', '>=', '<', '<=', '=', '!=', 'in', 'not_in'] }) @IsIn(['>', '>=', '<', '<=', '=', '!=', 'in', 'not_in']) operator: string;
    @ApiProperty() value: unknown;
}

export class RuleStepDto {
    @ApiProperty() @IsInt() @Min(1) @Max(20) step: number;
    @ApiProperty({ required: false, example: 'Finance' }) @IsOptional() @IsString() @MaxLength(80) name?: string;
    @ApiProperty({ description: '{ membership_id } or { team_id } (team lead)' }) @IsObject() approver: { membership_id?: string; team_id?: string };
}

export class CreateApprovalRuleDto {
    @ApiProperty() @IsString() @MinLength(1) @MaxLength(160) name: string;
    @ApiProperty({ type: [RuleConditionDto] }) @IsArray() @ValidateNested({ each: true }) @Type(() => RuleConditionDto) conditions: RuleConditionDto[];
    @ApiProperty({ type: [RuleStepDto] }) @IsArray() @ValidateNested({ each: true }) @Type(() => RuleStepDto) steps: RuleStepDto[];
    @ApiProperty({ required: false }) @IsOptional() @IsInt() priority?: number;
    @ApiProperty({ required: false }) @IsOptional() @IsBoolean() enabled?: boolean;
}
export class UpdateApprovalRuleDto extends PartialType(CreateApprovalRuleDto) { }

// --- Queries -------------------------------------------------------------------------------

export const LibraryQuerySchema = BaseListQuerySchema.extend({
    archived: boolish,
    status: z.string().optional(),
    category: z.string().optional(),
    type_id: z.string().uuid().optional(),
});
export type LibraryQuery = z.infer<typeof LibraryQuerySchema>;

export const TemplateStatusValues = ContractTemplateStatus;
