import { ApiProperty, OmitType, PartialType } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsInt, IsOptional, IsString, IsUUID, Matches, MaxLength, MinLength } from 'class-validator';
import { DocumentScope } from 'generated/prisma';
import { z } from 'zod';

const FOLDER_NAME = /^[^\\/:*?"<>|]+$/;

export class CreateFolderDto {
    @ApiProperty({ example: 'Contracts' })
    @IsString()
    @MinLength(1)
    @MaxLength(120)
    @Matches(FOLDER_NAME, { message: 'Folder names cannot contain \\ / : * ? " < > |' })
    name: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsUUID()
    parent_folder_id?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    @MaxLength(1000)
    description?: string;

    @ApiProperty({ enum: DocumentScope, required: false })
    @IsOptional()
    @IsEnum(DocumentScope)
    scope?: DocumentScope;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsUUID()
    branch_id?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsUUID()
    team_id?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsUUID()
    project_id?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsUUID()
    company_id?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsUUID()
    default_category_id?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsBoolean()
    customer_visible?: boolean;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsBoolean()
    portal_upload_allowed?: boolean;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    @MaxLength(30)
    color?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsInt()
    sort_order?: number;
}

/** Scope and parent change only through `move` (path/depth are recomputed by the API). */
export class UpdateFolderDto extends PartialType(OmitType(CreateFolderDto, ['parent_folder_id', 'scope', 'branch_id', 'team_id', 'project_id', 'company_id'] as const)) { }

export class MoveFolderDto {
    @ApiProperty({ nullable: true, description: 'New parent (null = top level)' })
    @IsOptional()
    @IsUUID()
    parent_folder_id: string | null;
}

export const FolderTreeQuerySchema = z.object({
    scope: z.nativeEnum(DocumentScope).optional(),
    project_id: z.string().uuid().optional(),
    company_id: z.string().uuid().optional(),
});
export type FolderTreeQuery = z.infer<typeof FolderTreeQuerySchema>;

export const CreateFolderSchema = z.object({
    name: z.string().min(1).max(120).regex(FOLDER_NAME),
    parent_folder_id: z.string().uuid().optional(),
    description: z.string().max(1000).optional(),
    scope: z.nativeEnum(DocumentScope).optional(),
    branch_id: z.string().uuid().optional(),
    team_id: z.string().uuid().optional(),
    project_id: z.string().uuid().optional(),
    company_id: z.string().uuid().optional(),
    default_category_id: z.string().uuid().optional(),
    customer_visible: z.boolean().optional(),
    portal_upload_allowed: z.boolean().optional(),
    color: z.string().max(30).optional(),
    sort_order: z.number().int().optional(),
});
