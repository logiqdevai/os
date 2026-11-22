import { ApiProperty, PartialType } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min, MinLength } from 'class-validator';
import { WikiPageType, WikiTemplateCategory } from 'generated/prisma';
import { z } from 'zod';
import { BaseListQuerySchema, boolish } from '@/shared/utils/pagination/pagination.utils';

export class CreateTemplateDto {
    @ApiProperty({ example: 'Incident runbook' })
    @IsString()
    @MinLength(1)
    @MaxLength(120)
    name: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    @MaxLength(1000)
    description?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    @MaxLength(16)
    icon?: string;

    @ApiProperty({ enum: WikiPageType, required: false })
    @IsOptional()
    @IsEnum(WikiPageType)
    page_type?: WikiPageType;

    @ApiProperty({ enum: WikiTemplateCategory, required: false, description: 'Gallery section (default OTHER)' })
    @IsOptional()
    @IsEnum(WikiTemplateCategory)
    category?: WikiTemplateCategory;

    @ApiProperty({ required: false, description: 'Show in the gallery\'s "Featured" row' })
    @IsOptional()
    @IsBoolean()
    is_featured?: boolean;

    @ApiProperty({ required: false, description: 'Template body as Markdown' })
    @IsOptional()
    @IsString()
    @MaxLength(200_000)
    content_markdown?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsUUID()
    space_id?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsInt()
    @Min(1)
    @Max(730)
    default_review_interval_days?: number;
}

export class UpdateTemplateDto extends PartialType(CreateTemplateDto) { }

export const TemplateQuerySchema = BaseListQuerySchema.extend({
    page_type: z.nativeEnum(WikiPageType).optional(),
    category: z.nativeEnum(WikiTemplateCategory).optional(),
    featured: boolish,
    /** "system" = built-in gallery templates, "organization" = this organization's own. */
    source: z.enum(['system', 'organization']).optional(),
    space_id: z.string().uuid().optional(),
    archived: boolish,
});
export type TemplateQuery = z.infer<typeof TemplateQuerySchema>;

/** Save an existing page as an organization template (Notion: "Save as template"). Name defaults to the page title. */
export const TemplateFromPageSchema = z.object({
    page_id: z.string().uuid(),
    name: z.string().trim().min(1).max(120).optional(),
    description: z.string().max(1000).optional(),
    category: z.nativeEnum(WikiTemplateCategory).optional(),
    is_featured: z.boolean().optional(),
    space_id: z.string().uuid().optional(),
});
export type TemplateFromPageInput = z.infer<typeof TemplateFromPageSchema>;

export class TemplateFromPageDto {
    @ApiProperty() @IsUUID() page_id: string;
    @ApiProperty({ required: false }) @IsOptional() @IsString() @MinLength(1) @MaxLength(120) name?: string;
    @ApiProperty({ required: false }) @IsOptional() @IsString() @MaxLength(1000) description?: string;
    @ApiProperty({ enum: WikiTemplateCategory, required: false }) @IsOptional() @IsEnum(WikiTemplateCategory) category?: WikiTemplateCategory;
    @ApiProperty({ required: false }) @IsOptional() @IsBoolean() is_featured?: boolean;
    @ApiProperty({ required: false, description: 'Offer the template only inside this space' }) @IsOptional() @IsUUID() space_id?: string;
}
