import { ApiProperty, PartialType } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsObject, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';
import { CommChannel, CommTemplateCategory, CommTemplateKind, CommTemplateStatus } from 'generated/prisma';
import { z } from 'zod';
import { BaseListQuerySchema, boolish } from '@/shared/utils/pagination/pagination.utils';

export class TemplateContentDto {
    @ApiProperty({ required: false, example: 'Your project update, {{first_name}}' })
    @IsOptional()
    @IsString()
    @MaxLength(300)
    subject?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    @MaxLength(300)
    preheader?: string;

    @ApiProperty({ required: false, description: 'HTML body with {{variables}} (email only)' })
    @IsOptional()
    @IsString()
    @MaxLength(500_000)
    body_html?: string;

    @ApiProperty({ required: false, description: 'Plain text body (email fallback / SMS content)' })
    @IsOptional()
    @IsString()
    @MaxLength(100_000)
    body_text?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsObject()
    design?: Record<string, unknown>;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    @MaxLength(500)
    change_note?: string;
}

export class CreateTemplateDto extends TemplateContentDto {
    @ApiProperty({ example: 'Monthly newsletter' })
    @IsString()
    @MinLength(1)
    @MaxLength(160)
    name: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    @MaxLength(2000)
    description?: string;

    @ApiProperty({ enum: CommChannel })
    @IsEnum(CommChannel)
    channel: CommChannel;

    @ApiProperty({ enum: CommTemplateKind, required: false })
    @IsOptional()
    @IsEnum(CommTemplateKind)
    kind?: CommTemplateKind;

    @ApiProperty({ enum: CommTemplateCategory, required: false })
    @IsOptional()
    @IsEnum(CommTemplateCategory)
    category?: CommTemplateCategory;

    @ApiProperty({ required: false, example: 'en' })
    @IsOptional()
    @IsString()
    @MaxLength(12)
    language?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsUUID()
    default_sender_identity_id?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsUUID()
    branch_id?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsBoolean()
    use_branded_layout?: boolean;
}

export class UpdateTemplateDto extends PartialType(CreateTemplateDto) { }

export class PreviewTemplateDto extends TemplateContentDto {
    @ApiProperty({ required: false, description: 'Render a saved version instead of the inline content' })
    @IsOptional()
    @IsUUID()
    version_id?: string;

    @ApiProperty({ required: false, description: 'Use this CRM contact for variable values (sample data otherwise)' })
    @IsOptional()
    @IsUUID()
    contact_id?: string;
}

export const TemplateQuerySchema = BaseListQuerySchema.extend({
    channel: z.nativeEnum(CommChannel).optional(),
    kind: z.nativeEnum(CommTemplateKind).optional(),
    category: z.nativeEnum(CommTemplateCategory).optional(),
    status: z.nativeEnum(CommTemplateStatus).optional(),
    archived: boolish,
});
export type TemplateQuery = z.infer<typeof TemplateQuerySchema>;

export const TemplateContentSchema = z.object({
    subject: z.string().max(300).optional(),
    preheader: z.string().max(300).optional(),
    body_html: z.string().max(500_000).optional(),
    body_text: z.string().max(100_000).optional(),
    change_note: z.string().max(500).optional(),
});

export const CreateTemplateSchema = TemplateContentSchema.extend({
    name: z.string().min(1).max(160),
    description: z.string().max(2000).optional(),
    channel: z.nativeEnum(CommChannel),
    kind: z.nativeEnum(CommTemplateKind).optional(),
    category: z.nativeEnum(CommTemplateCategory).optional(),
    language: z.string().max(12).optional(),
    default_sender_identity_id: z.string().uuid().optional(),
    branch_id: z.string().uuid().optional(),
});
