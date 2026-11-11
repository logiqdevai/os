import { ApiProperty, PartialType } from '@nestjs/swagger';
import { IsArray, IsBoolean, IsEnum, IsInt, IsObject, IsOptional, IsString, IsUUID, Matches, Max, MaxLength, Min, MinLength, ValidateIf } from 'class-validator';
import { KnowledgeArticleStatus, KnowledgeVisibility } from 'generated/prisma';
import { z } from 'zod';
import { BaseListQuerySchema, boolish } from '@/shared/utils/pagination/pagination.utils';

export const ArticleQuerySchema = BaseListQuerySchema.extend({
    status: z.nativeEnum(KnowledgeArticleStatus).optional(),
    visibility: z.nativeEnum(KnowledgeVisibility).optional(),
    category_id: z.string().uuid().optional(),
    locale: z.string().max(10).optional(),
    is_faq: boolish,
    archived: boolish,
});
export type ArticleQuery = z.infer<typeof ArticleQuerySchema>;

export const PublicArticleQuerySchema = BaseListQuerySchema.extend({
    category: z.string().max(120).optional(),
    locale: z.string().max(10).optional(),
    faq: boolish,
});
export type PublicArticleQuery = z.infer<typeof PublicArticleQuerySchema>;

export class CreateKnowledgeCategoryDto {
    @ApiProperty({ example: 'Getting started' })
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
    @MaxLength(40)
    icon?: string;

    @ApiProperty({ required: false, enum: KnowledgeVisibility })
    @IsOptional()
    @IsEnum(KnowledgeVisibility)
    visibility?: KnowledgeVisibility;

    @ApiProperty({ required: false, nullable: true })
    @IsOptional()
    @ValidateIf((_, v) => v !== null)
    @IsUUID()
    parent_category_id?: string | null;
}

export class UpdateKnowledgeCategoryDto extends PartialType(CreateKnowledgeCategoryDto) { }

export class CreateArticleDto {
    @ApiProperty({ example: 'How to reset your password' })
    @IsString()
    @MinLength(1)
    @MaxLength(200)
    title: string;

    @ApiProperty({ required: false, description: 'URL slug (generated from the title when omitted)' })
    @IsOptional()
    @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, { message: 'Slug may contain lowercase letters, digits and dashes' })
    @MaxLength(120)
    slug?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    @MaxLength(500)
    summary?: string;

    @ApiProperty({ description: 'Markdown' })
    @IsString()
    @MaxLength(200000)
    body: string;

    @ApiProperty({ required: false, nullable: true })
    @IsOptional()
    @ValidateIf((_, v) => v !== null)
    @IsUUID()
    category_id?: string | null;

    @ApiProperty({ required: false, enum: KnowledgeVisibility })
    @IsOptional()
    @IsEnum(KnowledgeVisibility)
    visibility?: KnowledgeVisibility;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsBoolean()
    is_faq?: boolean;

    @ApiProperty({ required: false, example: 'en' })
    @IsOptional()
    @Matches(/^[a-z]{2}(-[A-Z]{2})?$/)
    locale?: string;

    @ApiProperty({ required: false, type: [String] })
    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    keywords?: string[];

    @ApiProperty({ required: false, type: [String] })
    @IsOptional()
    @IsArray()
    @IsUUID('all', { each: true })
    related_article_ids?: string[];

    @ApiProperty({ required: false, description: '{ meta_title, meta_description, canonical_url }' })
    @IsOptional()
    @IsObject()
    seo?: Record<string, string>;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsUUID()
    source_ticket_id?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsInt()
    @Min(0)
    @Max(100000)
    sort_order?: number;
}

export class UpdateArticleDto extends PartialType(CreateArticleDto) {
    @ApiProperty({ required: false, description: 'Note stored with the new version' })
    @IsOptional()
    @IsString()
    @MaxLength(500)
    change_note?: string;
}

export class RestoreVersionDto {
    @ApiProperty()
    @IsInt()
    @Min(1)
    version: number;
}

export class ArticleFeedbackDto {
    @ApiProperty()
    @IsBoolean()
    is_helpful: boolean;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    @MaxLength(2000)
    comment?: string;

    @ApiProperty({ required: false, description: 'Anonymous visitor key to deduplicate votes' })
    @IsOptional()
    @IsString()
    @MaxLength(80)
    visitor_key?: string;
}

export class CsatSubmitDto {
    @ApiProperty({ minimum: 1, maximum: 5 })
    @IsInt()
    @Min(1)
    @Max(5)
    rating: number;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    @MaxLength(4000)
    comment?: string;
}

export const CreateArticleSchema = z.object({
    title: z.string().min(1).max(200),
    summary: z.string().max(500).optional(),
    body: z.string().max(200000),
    category_id: z.string().uuid().optional(),
    visibility: z.nativeEnum(KnowledgeVisibility).optional(),
    is_faq: z.boolean().optional(),
    keywords: z.array(z.string()).optional(),
    source_ticket_id: z.string().uuid().optional(),
});
