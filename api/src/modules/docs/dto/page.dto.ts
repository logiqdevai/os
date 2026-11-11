import { ApiProperty, OmitType, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsBoolean, IsDateString, IsEnum, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min, MinLength, ValidateNested } from 'class-validator';
import { RecordEntityType, WikiPageStatus, WikiPageType, WikiPermissionLevel, WikiPrincipalType, WikiVisibility } from 'generated/prisma';
import { z } from 'zod';
import { BaseListQuerySchema, boolish, csv } from '@/shared/utils/pagination/pagination.utils';

const MAX_CONTENT = 500_000;

export class CreatePageDto {
    @ApiProperty()
    @IsUUID()
    space_id: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsUUID()
    parent_page_id?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsUUID()
    template_id?: string;

    @ApiProperty({ example: 'Deployment runbook' })
    @IsString()
    @MinLength(1)
    @MaxLength(200)
    title: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    @MaxLength(16)
    icon?: string;

    @ApiProperty({ enum: WikiPageType, required: false })
    @IsOptional()
    @IsEnum(WikiPageType)
    page_type?: WikiPageType;

    @ApiProperty({ required: false, description: 'Page body as Markdown' })
    @IsOptional()
    @IsString()
    @MaxLength(MAX_CONTENT)
    content_markdown?: string;

    @ApiProperty({ enum: WikiVisibility, required: false })
    @IsOptional()
    @IsEnum(WikiVisibility)
    visibility?: WikiVisibility;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsUUID()
    owner_membership_id?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsInt()
    @Min(1)
    @Max(730)
    review_interval_days?: number;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsBoolean()
    requires_acknowledgement?: boolean;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsBoolean()
    customer_visible?: boolean;

    @ApiProperty({ required: false, type: [String] })
    @IsOptional()
    @IsArray()
    @IsUUID('all', { each: true })
    reviewer_ids?: string[];

    @ApiProperty({ required: false, description: 'Publish immediately (needs docs.pages.publish)' })
    @IsOptional()
    @IsBoolean()
    publish?: boolean;
}

export class UpdatePageDto extends PartialType(OmitType(CreatePageDto, ['space_id', 'parent_page_id', 'template_id', 'publish'] as const)) {
    @ApiProperty({ required: false, description: 'Note stored on the new version' })
    @IsOptional()
    @IsString()
    @MaxLength(500)
    change_summary?: string;
}

export class MovePageDto {
    @ApiProperty({ required: false, nullable: true, description: 'New parent (null = top level)' })
    @IsOptional()
    @IsUUID()
    parent_page_id?: string | null;

    @ApiProperty({ required: false, description: 'Move to another space' })
    @IsOptional()
    @IsUUID()
    space_id?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsInt()
    @Min(0)
    sort_order?: number;
}

export class PublishPageDto {
    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    @MaxLength(500)
    change_summary?: string;
}

export class PageGrantDto {
    @ApiProperty({ enum: WikiPrincipalType })
    @IsEnum(WikiPrincipalType)
    principal_type: WikiPrincipalType;

    @ApiProperty()
    @IsUUID()
    principal_id: string;

    @ApiProperty({ enum: WikiPermissionLevel })
    @IsEnum(WikiPermissionLevel)
    level: WikiPermissionLevel;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsBoolean()
    inherit?: boolean;
}

export class SetPagePermissionsDto {
    @ApiProperty({ enum: WikiVisibility })
    @IsEnum(WikiVisibility)
    visibility: WikiVisibility;

    @ApiProperty({ type: [PageGrantDto] })
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => PageGrantDto)
    grants: PageGrantDto[];
}

export class CreateCommentDto {
    @ApiProperty()
    @IsString()
    @MinLength(1)
    @MaxLength(10_000)
    body: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsUUID()
    parent_comment_id?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    @MaxLength(80)
    block_id?: string;

    @ApiProperty({ required: false, type: [String] })
    @IsOptional()
    @IsArray()
    @IsUUID('all', { each: true })
    mentions?: string[];
}

export class UpdateCommentDto {
    @ApiProperty()
    @IsString()
    @MinLength(1)
    @MaxLength(10_000)
    body: string;
}

export class AddPageLinkDto {
    @ApiProperty({ enum: RecordEntityType })
    @IsEnum(RecordEntityType)
    entity_type: RecordEntityType;

    @ApiProperty()
    @IsUUID()
    entity_id: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    @MaxLength(200)
    label?: string;
}

export class MarkReviewedDto {
    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    @MaxLength(2000)
    notes?: string;
}

export class RequireAckDto {
    @ApiProperty({ type: [String], description: 'Membership ids that must acknowledge the page' })
    @IsArray()
    @IsUUID('all', { each: true })
    membership_ids: string[];

    @ApiProperty({ required: false })
    @IsOptional()
    @IsDateString()
    required_by?: string;
}

export class RestoreVersionDto {
    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    @MaxLength(500)
    change_summary?: string;
}

export const PageQuerySchema = BaseListQuerySchema.extend({
    space_id: z.string().uuid().optional(),
    parent_page_id: z.string().optional(),
    status: csv(z.nativeEnum(WikiPageStatus)),
    page_type: csv(z.nativeEnum(WikiPageType)),
    owner_id: z.string().uuid().optional(),
    review: z.enum(['overdue', 'due_soon']).optional(),
    archived: boolish,
    favorites: boolish,
});
export type PageQuery = z.infer<typeof PageQuerySchema>;

export const SearchQuerySchema = BaseListQuerySchema.extend({
    q: z.string().trim().min(1).max(200),
    space_id: z.string().uuid().optional(),
    page_type: csv(z.nativeEnum(WikiPageType)),
    status: csv(z.nativeEnum(WikiPageStatus)),
    owner_id: z.string().uuid().optional(),
    updated_after: z.string().datetime().optional(),
});
export type SearchQuery = z.infer<typeof SearchQuerySchema>;

export const TrashQuerySchema = BaseListQuerySchema.extend({
    tab: z.enum(['archived', 'deleted']).optional().default('deleted'),
    space_id: z.string().uuid().optional(),
});
export type TrashQuery = z.infer<typeof TrashQuerySchema>;

export const AnalyticsQuerySchema = z.object({
    space_id: z.string().uuid().optional(),
    days: z.coerce.number().int().min(1).max(365).optional().default(30),
});
export type AnalyticsQuery = z.infer<typeof AnalyticsQuerySchema>;

/** Zod twins for MCP tools. */
export const CreatePageSchema = z.object({
    space_id: z.string().uuid(),
    parent_page_id: z.string().uuid().optional(),
    template_id: z.string().uuid().optional(),
    title: z.string().min(1).max(200),
    icon: z.string().max(16).optional(),
    page_type: z.nativeEnum(WikiPageType).optional(),
    content_markdown: z.string().max(MAX_CONTENT).optional(),
    visibility: z.nativeEnum(WikiVisibility).optional(),
    publish: z.boolean().optional(),
});
export const UpdatePageSchema = z.object({
    id: z.string().uuid(),
    title: z.string().min(1).max(200).optional(),
    icon: z.string().max(16).optional(),
    page_type: z.nativeEnum(WikiPageType).optional(),
    content_markdown: z.string().max(MAX_CONTENT).optional(),
    change_summary: z.string().max(500).optional(),
});
