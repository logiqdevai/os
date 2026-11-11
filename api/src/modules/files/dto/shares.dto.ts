import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsDateString, IsEmail, IsEnum, IsInt, IsOptional, IsString, IsUUID, MaxLength, Min, MinLength } from 'class-validator';
import { DocumentSharePermission, DocumentShareStatus, DocumentShareSubjectType } from 'generated/prisma';
import { z } from 'zod';
import { BaseListQuerySchema, boolish } from '@/shared/utils/pagination/pagination.utils';

export class CreateShareDto {
    @ApiProperty({ required: false, description: 'Exactly one of document_id / folder_id' })
    @IsOptional()
    @IsUUID()
    document_id?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsUUID()
    folder_id?: string;

    @ApiProperty({ enum: DocumentShareSubjectType })
    @IsEnum(DocumentShareSubjectType)
    subject_type: DocumentShareSubjectType;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsUUID()
    membership_id?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsUUID()
    team_id?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsUUID()
    portal_user_id?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsEmail()
    external_email?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    @MaxLength(120)
    external_name?: string;

    @ApiProperty({ enum: DocumentSharePermission, required: false })
    @IsOptional()
    @IsEnum(DocumentSharePermission)
    permission?: DocumentSharePermission;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsBoolean()
    allow_download?: boolean;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsBoolean()
    watermark?: boolean;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsUUID()
    pinned_version_id?: string;

    @ApiProperty({ required: false, description: 'Required for public links' })
    @IsOptional()
    @IsDateString()
    expires_at?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsInt()
    @Min(1)
    max_access_count?: number;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsInt()
    @Min(1)
    max_download_count?: number;

    @ApiProperty({ required: false, description: 'Optional link password (min 6 characters); stored as a bcrypt hash only' })
    @IsOptional()
    @IsString()
    @MinLength(6)
    @MaxLength(200)
    password?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    @MaxLength(2000)
    message?: string;
}

export class UpdateShareDto {
    @ApiProperty({ enum: DocumentSharePermission, required: false })
    @IsOptional()
    @IsEnum(DocumentSharePermission)
    permission?: DocumentSharePermission;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsBoolean()
    allow_download?: boolean;

    @ApiProperty({ required: false, nullable: true })
    @IsOptional()
    @IsDateString()
    expires_at?: string | null;

    @ApiProperty({ required: false, nullable: true })
    @IsOptional()
    @IsInt()
    @Min(1)
    max_access_count?: number | null;

    @ApiProperty({ required: false, nullable: true })
    @IsOptional()
    @IsInt()
    @Min(1)
    max_download_count?: number | null;
}

export class ShareAccessDto {
    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    @MaxLength(200)
    password?: string;
}

export const ShareQuerySchema = BaseListQuerySchema.extend({
    document_id: z.string().uuid().optional(),
    folder_id: z.string().uuid().optional(),
    subject_type: z.nativeEnum(DocumentShareSubjectType).optional(),
    status: z.nativeEnum(DocumentShareStatus).optional(),
    /** Only links (PUBLIC_LINK + EXTERNAL_EMAIL). */
    links: boolish,
    /** Shares targeting the caller (membership or one of their teams). */
    with_me: boolish,
});
export type ShareQuery = z.infer<typeof ShareQuerySchema>;

export const CreateShareSchema = z.object({
    document_id: z.string().uuid().optional(),
    folder_id: z.string().uuid().optional(),
    subject_type: z.nativeEnum(DocumentShareSubjectType),
    membership_id: z.string().uuid().optional(),
    team_id: z.string().uuid().optional(),
    portal_user_id: z.string().uuid().optional(),
    external_email: z.string().email().optional(),
    external_name: z.string().max(120).optional(),
    permission: z.nativeEnum(DocumentSharePermission).optional(),
    allow_download: z.boolean().optional(),
    watermark: z.boolean().optional(),
    pinned_version_id: z.string().uuid().optional(),
    expires_at: z.string().datetime().optional(),
    max_access_count: z.number().int().min(1).optional(),
    max_download_count: z.number().int().min(1).optional(),
    password: z.string().min(6).max(200).optional(),
    message: z.string().max(2000).optional(),
});
