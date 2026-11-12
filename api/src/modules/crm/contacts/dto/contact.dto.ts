import { ApiProperty, PartialType } from '@nestjs/swagger';
import { IsArray, IsBoolean, IsEmail, IsEnum, IsObject, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';
import { CrmContactRole } from 'generated/prisma';
import { z } from 'zod';
import { CustomFieldValuesSchema } from '../../custom-fields/dto/custom-field.dto';
import { BaseListQuerySchema, boolish, csv } from '@/shared/utils/pagination/pagination.utils';

export class CreateContactDto {
    @ApiProperty({ example: 'Maria' }) @IsString() @MinLength(1) @MaxLength(100) first_name: string;
    @ApiProperty({ required: false }) @IsOptional() @IsString() @MaxLength(100) last_name?: string;
    @ApiProperty({ required: false }) @IsOptional() @IsString() @MaxLength(120) job_title?: string;
    @ApiProperty({ required: false }) @IsOptional() @IsString() @MaxLength(120) department?: string;
    @ApiProperty({ required: false }) @IsOptional() @IsUUID() company_id?: string;
    @ApiProperty({ required: false }) @IsOptional() @IsEmail() email?: string;
    @ApiProperty({ required: false }) @IsOptional() @IsString() @MaxLength(40) phone?: string;
    @ApiProperty({ required: false }) @IsOptional() @IsString() @MaxLength(40) mobile?: string;
    @ApiProperty({ required: false }) @IsOptional() @IsString() @MaxLength(300) website?: string;
    @ApiProperty({ required: false }) @IsOptional() @IsString() @MaxLength(300) linkedin_url?: string;
    @ApiProperty({ enum: CrmContactRole, isArray: true, required: false }) @IsOptional() @IsArray() @IsEnum(CrmContactRole, { each: true }) roles?: CrmContactRole[];
    @ApiProperty({ required: false }) @IsOptional() @IsString() @MaxLength(60) contact_type?: string;
    @ApiProperty({ required: false }) @IsOptional() @IsUUID() lifecycle_stage_id?: string;
    @ApiProperty({ required: false }) @IsOptional() @IsUUID() lead_source_id?: string;
    @ApiProperty({ required: false }) @IsOptional() @IsUUID() owner_membership_id?: string;
    @ApiProperty({ required: false }) @IsOptional() @IsString() @MaxLength(60) timezone?: string;
    @ApiProperty({ required: false }) @IsOptional() @IsString() @MaxLength(10) language?: string;
    @ApiProperty({ required: false }) @IsOptional() @IsObject() address?: Record<string, string>;
    @ApiProperty({ required: false, description: 'Marketing consent per channel, e.g. { email: true }' }) @IsOptional() @IsObject() consent?: Record<string, boolean>;
    @ApiProperty({ required: false }) @IsOptional() @IsString() @MaxLength(5000) description?: string;
    @ApiProperty({ required: false }) @IsOptional() @IsBoolean() allow_duplicate?: boolean;
    @ApiProperty({ required: false, description: 'Custom field values keyed by field key (02 §26), e.g. { customer_tier: "enterprise" }; null clears a value' }) @IsOptional() @IsObject() custom_fields?: Record<string, unknown>;
}

export class UpdateContactDto extends PartialType(CreateContactDto) { }

export const CreateContactSchema = z.object({
    first_name: z.string().min(1).max(100),
    last_name: z.string().max(100).optional(),
    job_title: z.string().max(120).optional(),
    department: z.string().max(120).optional(),
    company_id: z.string().uuid().optional(),
    email: z.string().email().optional(),
    phone: z.string().max(40).optional(),
    mobile: z.string().max(40).optional(),
    website: z.string().max(300).optional(),
    linkedin_url: z.string().max(300).optional(),
    roles: z.array(z.nativeEnum(CrmContactRole)).optional(),
    contact_type: z.string().max(60).optional(),
    lifecycle_stage_id: z.string().uuid().optional(),
    lead_source_id: z.string().uuid().optional(),
    owner_membership_id: z.string().uuid().optional(),
    timezone: z.string().max(60).optional(),
    language: z.string().max(10).optional(),
    address: z.record(z.string(), z.string()).optional(),
    consent: z.record(z.string(), z.boolean()).optional(),
    description: z.string().max(5000).optional(),
    allow_duplicate: z.boolean().optional(),
    custom_fields: CustomFieldValuesSchema.optional().describe('Custom field values keyed by field key; null clears'),
});
export const UpdateContactSchema = CreateContactSchema.partial().extend({ id: z.string().uuid() });

export const ContactQuerySchema = BaseListQuerySchema.extend({
    company_id: z.string().uuid().optional(),
    role: csv(z.nativeEnum(CrmContactRole)),
    owner: z.string().optional(),
    lifecycle_stage_id: z.string().uuid().optional(),
    tag_id: z.string().uuid().optional(),
    /** Custom-field filter (02 §26): records whose value of field `cf_key` contains `cf_value`. */
    cf_key: z.string().max(50).optional(),
    cf_value: z.string().max(200).optional(),
    archived: boolish,
});
export type ContactQuery = z.infer<typeof ContactQuerySchema>;
