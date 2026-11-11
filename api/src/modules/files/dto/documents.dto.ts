import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsBoolean, IsEnum, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';
import { DocumentScope, DocumentStatus, RecordEntityType } from 'generated/prisma';
import { z } from 'zod';
import { BaseListQuerySchema, boolish } from '@/shared/utils/pagination/pagination.utils';

const boolField = z.preprocess((v) => (v === 'true' || v === '1' ? true : v === 'false' || v === '0' ? false : v), z.boolean()).optional();

/**
 * Multipart fields of `POST /files/upload` (sent next to the `file` part). Multipart values are strings,
 * so this is a zod schema (also used by the MCP-free attach API of other modules).
 */
export const UploadFieldsSchema = z.object({
    /** Add a new version to this document instead of creating one. */
    document_id: z.string().uuid().optional(),
    folder_id: z.string().uuid().optional(),
    title: z.string().trim().min(1).max(255).optional(),
    description: z.string().max(5000).optional(),
    category_id: z.string().uuid().optional(),
    scope: z.nativeEnum(DocumentScope).optional(),
    branch_id: z.string().uuid().optional(),
    team_id: z.string().uuid().optional(),
    project_id: z.string().uuid().optional(),
    company_id: z.string().uuid().optional(),
    /** Attach to a business record (RECORD scope): entity_type + entity_id. */
    entity_type: z.nativeEnum(RecordEntityType).optional(),
    entity_id: z.string().uuid().optional(),
    change_note: z.string().max(1000).optional(),
    customer_visible: boolField,
    is_sensitive: boolField,
    batch_id: z.string().uuid().optional(),
});
export type UploadFields = z.infer<typeof UploadFieldsSchema>;

export const DocumentQuerySchema = BaseListQuerySchema.extend({
    /** `root` = documents without a folder. */
    folder_id: z.union([z.string().uuid(), z.literal('root')]).optional(),
    /** Include documents of subfolders too. */
    recursive: boolish,
    scope: z.nativeEnum(DocumentScope).optional(),
    status: z.nativeEnum(DocumentStatus).optional(),
    category_id: z.string().uuid().optional(),
    type: z.enum(['image', 'pdf', 'document', 'spreadsheet', 'presentation', 'video', 'audio', 'archive', 'text']).optional(),
    owner_membership_id: z.string().uuid().optional(),
    project_id: z.string().uuid().optional(),
    company_id: z.string().uuid().optional(),
    entity_type: z.nativeEnum(RecordEntityType).optional(),
    entity_id: z.string().uuid().optional(),
    favorites: boolish,
    legal_hold: boolish,
});
export type DocumentQuery = z.infer<typeof DocumentQuerySchema>;

export class UpdateDocumentDto {
    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    @MinLength(1)
    @MaxLength(255)
    title?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    @MaxLength(5000)
    description?: string;

    @ApiProperty({ required: false, nullable: true })
    @IsOptional()
    @IsUUID()
    category_id?: string | null;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsBoolean()
    customer_visible?: boolean;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsBoolean()
    is_sensitive?: boolean;

    @ApiProperty({ required: false, type: [String] })
    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    keywords?: string[];

    @ApiProperty({ required: false })
    @IsOptional()
    @IsUUID()
    owner_membership_id?: string;
}

export const UpdateDocumentSchema = z.object({
    title: z.string().min(1).max(255).optional(),
    description: z.string().max(5000).optional(),
    category_id: z.string().uuid().nullable().optional(),
    customer_visible: z.boolean().optional(),
    is_sensitive: z.boolean().optional(),
    keywords: z.array(z.string()).optional(),
    owner_membership_id: z.string().uuid().optional(),
});

export class MoveDocumentDto {
    @ApiProperty({ nullable: true, description: 'Target folder (null = root)' })
    @IsOptional()
    @IsUUID()
    folder_id: string | null;
}

export class LegalHoldDto {
    @ApiProperty({ example: 'Dispute with supplier — keep all correspondence' })
    @IsString()
    @MinLength(3)
    @MaxLength(1000)
    reason: string;
}

export class RestoreVersionDto {
    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    @MaxLength(1000)
    change_note?: string;
}

export class BulkDocumentsDto {
    @ApiProperty({ type: [String] })
    @IsArray()
    @IsUUID('all', { each: true })
    ids: string[];

    @ApiProperty({ enum: ['archive', 'delete', 'restore', 'move'] })
    @IsEnum(['archive', 'delete', 'restore', 'move'])
    action: 'archive' | 'delete' | 'restore' | 'move';

    @ApiProperty({ required: false, nullable: true })
    @IsOptional()
    @IsUUID()
    folder_id?: string | null;
}
