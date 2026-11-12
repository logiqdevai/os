import { ApiProperty, PartialType } from '@nestjs/swagger';
import { IsBoolean, IsEmail, IsEnum, IsInt, IsNumber, IsObject, IsOptional, IsString, IsUUID, Length, Max, MaxLength, Min, MinLength } from 'class-validator';
import { CrmCompanyType } from 'generated/prisma';
import { z } from 'zod';
import { CustomFieldValuesSchema } from '../../custom-fields/dto/custom-field.dto';

export class CreateCompanyDto {
    @ApiProperty({ example: 'Acme Digital' })
    @IsString()
    @MinLength(1)
    @MaxLength(200)
    name: string;

    @ApiProperty({ required: false }) @IsOptional() @IsString() @MaxLength(200) legal_name?: string;
    @ApiProperty({ enum: CrmCompanyType, required: false }) @IsOptional() @IsEnum(CrmCompanyType) type?: CrmCompanyType;
    @ApiProperty({ required: false }) @IsOptional() @IsUUID() parent_company_id?: string;
    @ApiProperty({ required: false }) @IsOptional() @IsUUID() lifecycle_stage_id?: string;
    @ApiProperty({ required: false }) @IsOptional() @IsString() @MaxLength(120) industry?: string;
    @ApiProperty({ required: false, example: '11-50' }) @IsOptional() @IsString() @MaxLength(40) company_size?: string;
    @ApiProperty({ required: false }) @IsOptional() @IsInt() @Min(0) number_of_employees?: number;
    @ApiProperty({ required: false, description: 'Needs crm.financials.read to be shown' }) @IsOptional() @IsNumber() @Min(0) annual_revenue?: number;
    @ApiProperty({ required: false, example: 'EUR' }) @IsOptional() @IsString() @Length(3, 3) currency?: string;
    @ApiProperty({ required: false, example: 'https://acme.com' }) @IsOptional() @IsString() @MaxLength(300) website?: string;
    @ApiProperty({ required: false }) @IsOptional() @IsEmail() email?: string;
    @ApiProperty({ required: false }) @IsOptional() @IsString() @MaxLength(40) phone?: string;
    @ApiProperty({ required: false, example: 'GR' }) @IsOptional() @IsString() @MaxLength(2) country?: string;
    @ApiProperty({ required: false, description: '{ line1, line2, city, region, postal_code, country }' }) @IsOptional() @IsObject() address?: Record<string, string>;
    @ApiProperty({ required: false }) @IsOptional() @IsString() @MaxLength(60) tax_id?: string;
    @ApiProperty({ required: false }) @IsOptional() @IsString() @MaxLength(60) vat_number?: string;
    @ApiProperty({ required: false }) @IsOptional() @IsString() @MaxLength(60) registration_number?: string;
    @ApiProperty({ required: false }) @IsOptional() @IsString() @MaxLength(5000) description?: string;
    @ApiProperty({ required: false }) @IsOptional() @IsUUID() lead_source_id?: string;
    @ApiProperty({ required: false }) @IsOptional() @IsNumber() @Min(0) @Max(100) partner_commission_percent?: number;
    @ApiProperty({ required: false, description: 'Changing owners needs crm.companies.assign' }) @IsOptional() @IsUUID() owner_membership_id?: string;
    @ApiProperty({ required: false }) @IsOptional() @IsUUID() account_manager_membership_id?: string;
    @ApiProperty({ required: false }) @IsOptional() @IsUUID() team_id?: string;
    @ApiProperty({ required: false, description: 'Primary branch relationship (01 §31)' }) @IsOptional() @IsUUID() branch_id?: string;
    @ApiProperty({ required: false, description: 'Create even when possible duplicates exist' }) @IsOptional() @IsBoolean() allow_duplicate?: boolean;
    @ApiProperty({ required: false, description: 'Custom field values keyed by field key (02 §26), e.g. { customer_tier: "enterprise" }; null clears a value' }) @IsOptional() @IsObject() custom_fields?: Record<string, unknown>;
}

export class UpdateCompanyDto extends PartialType(CreateCompanyDto) { }

export class AssignOwnerDto {
    @ApiProperty({ description: 'Membership id of the new owner' })
    @IsUUID()
    owner_membership_id: string;
}

/** Zod twin of CreateCompanyDto for MCP tools. */
export const CreateCompanySchema = z.object({
    name: z.string().min(1).max(200),
    legal_name: z.string().max(200).optional(),
    type: z.nativeEnum(CrmCompanyType).optional(),
    parent_company_id: z.string().uuid().optional(),
    lifecycle_stage_id: z.string().uuid().optional(),
    industry: z.string().max(120).optional(),
    company_size: z.string().max(40).optional(),
    number_of_employees: z.number().int().min(0).optional(),
    annual_revenue: z.number().min(0).optional(),
    currency: z.string().length(3).optional(),
    website: z.string().max(300).optional(),
    email: z.string().email().optional(),
    phone: z.string().max(40).optional(),
    country: z.string().max(2).optional(),
    address: z.record(z.string(), z.string()).optional(),
    tax_id: z.string().max(60).optional(),
    vat_number: z.string().max(60).optional(),
    registration_number: z.string().max(60).optional(),
    description: z.string().max(5000).optional(),
    lead_source_id: z.string().uuid().optional(),
    partner_commission_percent: z.number().min(0).max(100).optional(),
    owner_membership_id: z.string().uuid().optional(),
    account_manager_membership_id: z.string().uuid().optional(),
    team_id: z.string().uuid().optional(),
    branch_id: z.string().uuid().optional(),
    allow_duplicate: z.boolean().optional(),
    custom_fields: CustomFieldValuesSchema.optional().describe('Custom field values keyed by field key; null clears'),
});
export const UpdateCompanySchema = CreateCompanySchema.partial().extend({ id: z.string().uuid() });
