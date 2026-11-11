import { ApiProperty, PartialType } from '@nestjs/swagger';
import { IsEnum, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min, MinLength } from 'class-validator';
import { WikiPageType } from 'generated/prisma';
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
    space_id: z.string().uuid().optional(),
    archived: boolish,
});
export type TemplateQuery = z.infer<typeof TemplateQuerySchema>;
