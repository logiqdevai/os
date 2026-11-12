import { ApiProperty, PartialType } from '@nestjs/swagger';
import { IsBoolean, IsDateString, IsEnum, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';
import { VaultEntryType, VaultGrantSubjectType, VaultScope } from 'generated/prisma';
import { z } from 'zod';
import { BaseListQuerySchema, boolish } from '@/shared/utils/pagination/pagination.utils';

export class CreateVaultEntryDto {
    @ApiProperty({ example: 'Acme — production hosting' })
    @IsString()
    @MinLength(1)
    @MaxLength(160)
    name: string;

    @ApiProperty({ enum: VaultEntryType, required: false })
    @IsOptional()
    @IsEnum(VaultEntryType)
    type?: VaultEntryType;

    @ApiProperty({ enum: VaultScope, required: false })
    @IsOptional()
    @IsEnum(VaultScope)
    scope?: VaultScope;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsUUID()
    company_id?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsUUID()
    project_id?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    @MaxLength(255)
    username?: string;

    @ApiProperty({ required: false, description: 'Write-only. Encrypted at rest, never returned outside the reveal endpoint.' })
    @IsOptional()
    @IsString()
    @MaxLength(20000)
    secret?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    @MaxLength(2000)
    url?: string;

    @ApiProperty({ required: false, description: 'Non-secret notes' })
    @IsOptional()
    @IsString()
    @MaxLength(5000)
    notes?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsDateString()
    expires_at?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsUUID()
    owner_membership_id?: string;
}

export class UpdateVaultEntryDto extends PartialType(CreateVaultEntryDto) { }

export class RevealVaultEntryDto {
    @ApiProperty({ required: false, description: 'Why the secret is needed (written to the access log)' })
    @IsOptional()
    @IsString()
    @MaxLength(500)
    reason?: string;
}

export class CreateVaultGrantDto {
    @ApiProperty({ enum: VaultGrantSubjectType })
    @IsEnum(VaultGrantSubjectType)
    subject_type: VaultGrantSubjectType;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsUUID()
    membership_id?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsUUID()
    team_id?: string;

    @ApiProperty({ required: false, description: 'User id of a Customer Portal user of the entry\'s customer (CUSTOMER-scoped entries only)' })
    @IsOptional()
    @IsUUID()
    portal_user_id?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsBoolean()
    can_reveal?: boolean;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsBoolean()
    can_manage?: boolean;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsDateString()
    expires_at?: string;
}

export const VaultQuerySchema = BaseListQuerySchema.extend({
    scope: z.nativeEnum(VaultScope).optional(),
    type: z.nativeEnum(VaultEntryType).optional(),
    company_id: z.string().uuid().optional(),
    project_id: z.string().uuid().optional(),
    /** Expired or expiring within 30 days. */
    expiring: boolish,
    archived: boolish,
});
export type VaultQuery = z.infer<typeof VaultQuerySchema>;

export const CreateVaultEntrySchema = z.object({
    name: z.string().min(1).max(160),
    type: z.nativeEnum(VaultEntryType).optional(),
    scope: z.nativeEnum(VaultScope).optional(),
    company_id: z.string().uuid().optional(),
    project_id: z.string().uuid().optional(),
    username: z.string().max(255).optional(),
    secret: z.string().max(20000).optional(),
    url: z.string().max(2000).optional(),
    notes: z.string().max(5000).optional(),
    expires_at: z.string().datetime().optional(),
    owner_membership_id: z.string().uuid().optional(),
});
