import { ApiProperty, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsDateString, IsEmail, IsInt, IsNumber, IsObject, IsOptional, IsString, IsUUID, Length, Max, MaxLength, Min, MinLength, ValidateNested } from 'class-validator';
import { z } from 'zod';
import { BaseListQuerySchema, boolish } from '@/shared/utils/pagination/pagination.utils';
import { CreateCompanyDto, CreateCompanySchema } from '../../companies/dto/company.dto';
import { CreateContactDto, CreateContactSchema } from '../../contacts/dto/contact.dto';

export class CreateLeadDto {
    @ApiProperty({ example: 'Website rebuild for Nova Hotels' }) @IsString() @MinLength(1) @MaxLength(200) name: string;
    @ApiProperty({ required: false }) @IsOptional() @IsUUID() company_id?: string;
    @ApiProperty({ required: false }) @IsOptional() @IsUUID() contact_id?: string;
    @ApiProperty({ required: false }) @IsOptional() @IsString() @MaxLength(200) company_name?: string;
    @ApiProperty({ required: false }) @IsOptional() @IsString() @MaxLength(200) contact_name?: string;
    @ApiProperty({ required: false }) @IsOptional() @IsEmail() email?: string;
    @ApiProperty({ required: false }) @IsOptional() @IsString() @MaxLength(40) phone?: string;
    @ApiProperty({ required: false }) @IsOptional() @IsString() @MaxLength(300) website?: string;
    @ApiProperty({ required: false }) @IsOptional() @IsString() @MaxLength(120) industry?: string;
    @ApiProperty({ required: false }) @IsOptional() @IsString() @MaxLength(40) estimated_company_size?: string;
    @ApiProperty({ required: false }) @IsOptional() @IsNumber() @Min(0) estimated_value?: number;
    @ApiProperty({ required: false }) @IsOptional() @IsString() @Length(3, 3) currency?: string;
    @ApiProperty({ required: false, description: 'Defaults to the default lead status' }) @IsOptional() @IsUUID() status_id?: string;
    @ApiProperty({ required: false }) @IsOptional() @IsUUID() lead_source_id?: string;
    @ApiProperty({ required: false }) @IsOptional() @IsUUID() owner_membership_id?: string;
    @ApiProperty({ required: false }) @IsOptional() @IsUUID() branch_id?: string;
    @ApiProperty({ required: false }) @IsOptional() @IsInt() @Min(0) @Max(100) manual_score?: number;
    @ApiProperty({ required: false }) @IsOptional() @IsObject() qualification?: Record<string, unknown>;
    @ApiProperty({ required: false }) @IsOptional() @IsString() @MaxLength(5000) qualification_notes?: string;
    @ApiProperty({ required: false }) @IsOptional() @IsString() @MaxLength(5000) description?: string;
    @ApiProperty({ required: false }) @IsOptional() @IsDateString() next_follow_up_at?: string;
    @ApiProperty({ required: false }) @IsOptional() @IsBoolean() allow_duplicate?: boolean;
}

export class UpdateLeadDto extends PartialType(CreateLeadDto) { }

export class LeadStatusDto {
    @ApiProperty() @IsUUID() status_id: string;
    @ApiProperty({ required: false, description: 'Required when the status is a lost status' }) @IsOptional() @IsUUID() lost_reason_id?: string;
    @ApiProperty({ required: false }) @IsOptional() @IsString() @MaxLength(1000) lost_reason?: string;
}

class ConvertCompanyDto {
    @ApiProperty({ required: false, description: 'Link an existing company' }) @IsOptional() @IsUUID() existing_id?: string;
    @ApiProperty({ required: false, type: CreateCompanyDto }) @IsOptional() @ValidateNested() @Type(() => CreateCompanyDto) new?: CreateCompanyDto;
}

class ConvertContactDto {
    @ApiProperty({ required: false }) @IsOptional() @IsUUID() existing_id?: string;
    @ApiProperty({ required: false, type: CreateContactDto }) @IsOptional() @ValidateNested() @Type(() => CreateContactDto) new?: CreateContactDto;
}

class ConvertDealDto {
    @ApiProperty() @IsString() @MinLength(1) @MaxLength(200) name: string;
    @ApiProperty({ required: false }) @IsOptional() @IsUUID() pipeline_id?: string;
    @ApiProperty({ required: false }) @IsOptional() @IsUUID() stage_id?: string;
    @ApiProperty({ required: false }) @IsOptional() @IsNumber() @Min(0) value?: number;
    @ApiProperty({ required: false }) @IsOptional() @IsString() @Length(3, 3) currency?: string;
    @ApiProperty({ required: false }) @IsOptional() @IsDateString() expected_close_date?: string;
    @ApiProperty({ required: false }) @IsOptional() @IsUUID() owner_membership_id?: string;
}

export class ConvertLeadDto {
    @ApiProperty({ required: false, type: ConvertCompanyDto }) @IsOptional() @ValidateNested() @Type(() => ConvertCompanyDto) company?: ConvertCompanyDto;
    @ApiProperty({ required: false, type: ConvertContactDto }) @IsOptional() @ValidateNested() @Type(() => ConvertContactDto) contact?: ConvertContactDto;
    @ApiProperty({ required: false, type: ConvertDealDto }) @IsOptional() @ValidateNested() @Type(() => ConvertDealDto) deal?: ConvertDealDto;
}

// ---- Zod twins + queries ---------------------------------------------------------

export const CreateLeadSchema = z.object({
    name: z.string().min(1).max(200),
    company_id: z.string().uuid().optional(),
    contact_id: z.string().uuid().optional(),
    company_name: z.string().max(200).optional(),
    contact_name: z.string().max(200).optional(),
    email: z.string().email().optional(),
    phone: z.string().max(40).optional(),
    website: z.string().max(300).optional(),
    industry: z.string().max(120).optional(),
    estimated_company_size: z.string().max(40).optional(),
    estimated_value: z.number().min(0).optional(),
    currency: z.string().length(3).optional(),
    status_id: z.string().uuid().optional(),
    lead_source_id: z.string().uuid().optional(),
    owner_membership_id: z.string().uuid().optional(),
    branch_id: z.string().uuid().optional(),
    manual_score: z.number().int().min(0).max(100).optional(),
    qualification: z.record(z.string(), z.unknown()).optional(),
    qualification_notes: z.string().max(5000).optional(),
    description: z.string().max(5000).optional(),
    next_follow_up_at: z.string().optional(),
    allow_duplicate: z.boolean().optional(),
});
export const UpdateLeadSchema = CreateLeadSchema.partial().extend({ id: z.string().uuid() });

export const ConvertLeadSchema = z.object({
    id: z.string().uuid(),
    company: z.object({ existing_id: z.string().uuid().optional(), new: CreateCompanySchema.optional() }).optional(),
    contact: z.object({ existing_id: z.string().uuid().optional(), new: CreateContactSchema.optional() }).optional(),
    deal: z.object({
        name: z.string().min(1).max(200),
        pipeline_id: z.string().uuid().optional(),
        stage_id: z.string().uuid().optional(),
        value: z.number().min(0).optional(),
        currency: z.string().length(3).optional(),
        expected_close_date: z.string().optional(),
        owner_membership_id: z.string().uuid().optional(),
    }).optional(),
});

export const LeadQuerySchema = BaseListQuerySchema.extend({
    status_id: z.string().uuid().optional(),
    lead_source_id: z.string().uuid().optional(),
    owner: z.string().optional(),
    branch_id: z.string().uuid().optional(),
    /** open = not converted and not lost (default) · converted · lost · all */
    state: z.enum(['open', 'converted', 'lost', 'all']).optional().default('open'),
    tag_id: z.string().uuid().optional(),
    archived: boolish,
});
export type LeadQuery = z.infer<typeof LeadQuerySchema>;
