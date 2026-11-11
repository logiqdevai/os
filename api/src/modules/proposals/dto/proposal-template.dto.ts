import { ApiProperty, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsBoolean, IsEnum, IsIn, IsInt, IsNumber, IsObject, IsOptional, IsString, IsUUID, Max, MaxLength, Min, MinLength, ValidateNested } from 'class-validator';
import { ProposalSectionType } from 'generated/prisma';

export class TemplateSectionDto {
    @ApiProperty({ enum: ProposalSectionType })
    @IsEnum(ProposalSectionType)
    type: ProposalSectionType;

    @ApiProperty()
    @IsString() @MinLength(1) @MaxLength(200)
    title: string;

    @ApiProperty({ required: false, description: 'Markdown with {{variables}}' })
    @IsOptional() @IsString() @MaxLength(100000)
    body_template?: string;

    @ApiProperty({ required: false })
    @IsOptional() @IsBoolean()
    is_required?: boolean;
}

export class CreateProposalTemplateDto {
    @ApiProperty({ example: 'Website development' })
    @IsString() @MinLength(1) @MaxLength(200)
    name: string;

    @ApiProperty({ required: false })
    @IsOptional() @IsString() @MaxLength(2000)
    description?: string | null;

    @ApiProperty({ required: false, example: 'website' })
    @IsOptional() @IsString() @MaxLength(60)
    work_type?: string | null;

    @ApiProperty({ required: false, example: 'en' })
    @IsOptional() @IsString() @MaxLength(10)
    language?: string;

    @ApiProperty({ type: [TemplateSectionDto] })
    @IsArray() @ArrayMaxSize(60) @ValidateNested({ each: true }) @Type(() => TemplateSectionDto)
    sections: TemplateSectionDto[];

    @ApiProperty({ required: false, description: '{ payment_terms, line_items[], payment_schedule[], tax_percent }' })
    @IsOptional() @IsObject()
    defaults?: Record<string, unknown> | null;

    @ApiProperty({ required: false, type: [String], example: ['customer.name', 'project.name'] })
    @IsOptional() @IsArray() @ArrayMaxSize(60) @IsString({ each: true })
    variables?: string[];

    @ApiProperty({ required: false, example: 30 })
    @IsOptional() @IsInt() @Min(1) @Max(365)
    default_validity_days?: number;

    @ApiProperty({ required: false })
    @IsOptional() @IsBoolean()
    is_default?: boolean;

    @ApiProperty({ required: false, description: 'Why this save changes the template (stored on the version snapshot)' })
    @IsOptional() @IsString() @MaxLength(500)
    change_summary?: string;
}

export class UpdateProposalTemplateDto extends PartialType(CreateProposalTemplateDto) { }

const FIELDS = ['gross_total', 'net_total', 'discount_percent', 'discount_total', 'recurring_monthly', 'currency', 'requires_contract'] as const;
const OPERATORS = ['>', '>=', '<', '<=', '=', '!='] as const;

export class ApprovalConditionDto {
    @ApiProperty({ enum: FIELDS })
    @IsIn(FIELDS)
    field: (typeof FIELDS)[number];

    @ApiProperty({ enum: OPERATORS })
    @IsIn(OPERATORS)
    operator: (typeof OPERATORS)[number];

    @ApiProperty({ description: 'Number, string or boolean' })
    value: number | string | boolean;
}

export class ApprovalStepDto {
    @ApiProperty({ example: 1 })
    @IsInt() @Min(1) @Max(10)
    step: number;

    @ApiProperty({ example: 'Finance' })
    @IsString() @MinLength(1) @MaxLength(120)
    name: string;

    @ApiProperty()
    @IsUUID()
    approver_membership_id: string;
}

export class CreateApprovalRuleDto {
    @ApiProperty({ example: 'Discount over 10%' })
    @IsString() @MinLength(1) @MaxLength(200)
    name: string;

    @ApiProperty({ type: [ApprovalConditionDto], description: 'All conditions must match' })
    @IsArray() @ArrayMinSize(1) @ArrayMaxSize(10) @ValidateNested({ each: true }) @Type(() => ApprovalConditionDto)
    conditions: ApprovalConditionDto[];

    @ApiProperty({ type: [ApprovalStepDto] })
    @IsArray() @ArrayMinSize(1) @ArrayMaxSize(10) @ValidateNested({ each: true }) @Type(() => ApprovalStepDto)
    steps: ApprovalStepDto[];

    @ApiProperty({ required: false, example: 100 })
    @IsOptional() @IsNumber() @Min(0) @Max(10000)
    priority?: number;

    @ApiProperty({ required: false })
    @IsOptional() @IsBoolean()
    enabled?: boolean;
}

export class UpdateApprovalRuleDto extends PartialType(CreateApprovalRuleDto) { }

export const APPROVAL_FIELDS = FIELDS;
