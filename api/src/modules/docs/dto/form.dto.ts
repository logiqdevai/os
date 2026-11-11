import { ApiProperty, PartialType } from '@nestjs/swagger';
import { IsArray, IsBoolean, IsDateString, IsEnum, IsObject, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';
import { CustomFormFieldType, CustomFormKind, CustomFormStatus, FormAssignmentTargetType, FormSubmissionStatus } from 'generated/prisma';
import { z } from 'zod';
import { BaseListQuerySchema, boolish } from '@/shared/utils/pagination/pagination.utils';

/** One field of CustomForm.fields_schema (schema.prisma comment on CustomForm). */
export const FormFieldSchema = z.object({
    key: z.string().regex(/^[a-z][a-z0-9_]{0,59}$/, 'key must be snake_case'),
    type: z.nativeEnum(CustomFormFieldType),
    label: z.string().min(1).max(300),
    description: z.string().max(1000).optional(),
    required: z.boolean().default(false),
    options: z.array(z.object({ value: z.string().min(1).max(120), label: z.string().min(1).max(200) })).max(50).optional(),
    scale: z.object({ min: z.number().int().min(0).max(10), max: z.number().int().min(1).max(10), min_label: z.string().max(60).optional(), max_label: z.string().max(60).optional() }).optional(),
    accept: z.array(z.string()).optional(),
    max_files: z.number().int().min(1).max(20).optional(),
});
export const FieldsSchema = z.array(FormFieldSchema).max(100).superRefine((fields, ctx) => {
    const seen = new Set<string>();
    fields.forEach((f, i) => {
        if (seen.has(f.key)) ctx.addIssue({ code: 'custom', path: [i, 'key'], message: `Duplicate field key ${f.key}` });
        seen.add(f.key);
        if ((f.type === 'SINGLE_CHOICE' || f.type === 'MULTI_CHOICE') && !f.options?.length) ctx.addIssue({ code: 'custom', path: [i, 'options'], message: `${f.label}: add at least one option` });
        if (f.type === 'SCALE' && f.scale && f.scale.min >= f.scale.max) ctx.addIssue({ code: 'custom', path: [i, 'scale'], message: `${f.label}: scale min must be below max` });
    });
});
export type FormField = z.infer<typeof FormFieldSchema>;

export class CreateFormDto {
    @ApiProperty({ example: 'Equipment request' })
    @IsString()
    @MinLength(1)
    @MaxLength(160)
    name: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    @MaxLength(2000)
    description?: string;

    @ApiProperty({ enum: CustomFormKind, required: false })
    @IsOptional()
    @IsEnum(CustomFormKind)
    kind?: CustomFormKind;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsUUID()
    space_id?: string;

    @ApiProperty({ required: false, description: 'Array of fields: { key, type, label, description?, required, options?, scale? }' })
    @IsOptional()
    @IsArray()
    fields_schema?: unknown[];

    @ApiProperty({ required: false, description: 'Anonymous forms never store respondent ids. Anonymous + published also enables the public link.' })
    @IsOptional()
    @IsBoolean()
    is_anonymous?: boolean;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsBoolean()
    allow_multiple_submissions?: boolean;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsBoolean()
    requires_review?: boolean;

    @ApiProperty({ required: false, type: [String] })
    @IsOptional()
    @IsArray()
    @IsUUID('all', { each: true })
    reviewer_membership_ids?: string[];

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    @MaxLength(1000)
    confirmation_message?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsDateString()
    opens_at?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsDateString()
    closes_at?: string;
}

export class UpdateFormDto extends PartialType(CreateFormDto) { }

export class PublishFormDto {
    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    @MaxLength(500)
    change_summary?: string;
}

export class CreateAssignmentDto {
    @ApiProperty({ enum: FormAssignmentTargetType })
    @IsEnum(FormAssignmentTargetType)
    target_type: FormAssignmentTargetType;

    @ApiProperty({ required: false, description: 'Membership / team / department / branch id (omit for ORGANIZATION)' })
    @IsOptional()
    @IsUUID()
    target_id?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsDateString()
    due_at?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    @MaxLength(1000)
    message?: string;
}

export class SubmitFormDto {
    @ApiProperty({ description: '{ [field_key]: value }' })
    @IsObject()
    answers: Record<string, unknown>;
}

export class ReviewSubmissionDto {
    @ApiProperty({ enum: [FormSubmissionStatus.UNDER_REVIEW, FormSubmissionStatus.REVIEWED, FormSubmissionStatus.REJECTED] })
    @IsEnum(FormSubmissionStatus)
    status: FormSubmissionStatus;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    @MaxLength(2000)
    review_notes?: string;
}

export const FormQuerySchema = BaseListQuerySchema.extend({
    kind: z.nativeEnum(CustomFormKind).optional(),
    status: z.nativeEnum(CustomFormStatus).optional(),
    space_id: z.string().uuid().optional(),
    archived: boolish,
});
export type FormQuery = z.infer<typeof FormQuerySchema>;

export const SubmissionQuerySchema = BaseListQuerySchema.extend({
    status: z.nativeEnum(FormSubmissionStatus).optional(),
});
export type SubmissionQuery = z.infer<typeof SubmissionQuerySchema>;

export const CreateFormSchema = z.object({
    name: z.string().min(1).max(160),
    description: z.string().max(2000).optional(),
    kind: z.nativeEnum(CustomFormKind).optional(),
    space_id: z.string().uuid().optional(),
    fields_schema: FieldsSchema.optional(),
    is_anonymous: z.boolean().optional(),
});
