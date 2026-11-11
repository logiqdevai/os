import { ApiProperty, PartialType } from '@nestjs/swagger';
import { IsArray, IsBoolean, IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';

export class UpdateDocumentSettingsDto {
    @ApiProperty({ required: false, description: 'Max upload size in bytes (≤ 200 MB)' })
    @IsOptional()
    @IsInt()
    @Min(1024)
    @Max(200 * 1024 * 1024)
    max_file_size_bytes?: number;

    @ApiProperty({ required: false, type: [String], description: 'Allowed MIME types (wildcards like image/*); empty = all except blocked' })
    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    allowed_mime_types?: string[];

    @ApiProperty({ required: false, type: [String] })
    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    blocked_extensions?: string[];

    @ApiProperty({ required: false })
    @IsOptional()
    @IsInt()
    @Min(1)
    @Max(20)
    folder_max_depth?: number;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsBoolean()
    public_links_enabled?: boolean;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsInt()
    @Min(1)
    @Max(365)
    public_link_max_days?: number;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsInt()
    @Min(1)
    @Max(3650)
    default_share_expiry_days?: number;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsInt()
    @Min(60)
    @Max(86400)
    signed_url_ttl_seconds?: number;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsInt()
    @Min(1)
    @Max(365)
    soft_delete_recovery_days?: number;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsBoolean()
    watermark_customer_documents?: boolean;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsBoolean()
    portal_upload_enabled?: boolean;
}

export class CreateCategoryDto {
    @ApiProperty({ example: 'Specification' })
    @IsString()
    @MinLength(1)
    @MaxLength(80)
    name: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    @MaxLength(500)
    description?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    @MaxLength(30)
    color?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsBoolean()
    is_sensitive?: boolean;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsBoolean()
    customer_visible_default?: boolean;
}

export class UpdateCategoryDto extends PartialType(CreateCategoryDto) { }
