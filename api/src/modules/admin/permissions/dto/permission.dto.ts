import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsEnum, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { ModuleKey, PermissionEffect, ScopeType } from 'generated/prisma';
import { z } from 'zod';
import { BaseListQuerySchema, boolish } from '@/shared/utils/pagination/pagination.utils';

export const PermissionQuerySchema = BaseListQuerySchema.extend({
    module: z.nativeEnum(ModuleKey).optional(),
    sensitive: boolish,
    limit: z.coerce.number().int().min(1).max(2000).optional().default(2000),
});
export type PermissionQuery = z.infer<typeof PermissionQuerySchema>;

export class CreateGrantDto {
    @ApiProperty()
    @IsUUID()
    membership_id: string;

    @ApiProperty({ example: 'finance.invoices.read' })
    @IsString()
    @MaxLength(120)
    permission_key: string;

    @ApiProperty({ enum: PermissionEffect })
    @IsEnum(PermissionEffect)
    effect: PermissionEffect;

    @ApiProperty({ enum: ScopeType, required: false })
    @IsOptional()
    @IsEnum(ScopeType)
    scope_type?: ScopeType;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsUUID()
    scope_id?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsDateString()
    valid_until?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    @MaxLength(500)
    reason?: string;
}

export const CreateGrantSchema = z.object({
    membership_id: z.string().uuid(),
    permission_key: z.string().max(120),
    effect: z.nativeEnum(PermissionEffect),
    scope_type: z.nativeEnum(ScopeType).optional(),
    scope_id: z.string().uuid().optional(),
    valid_until: z.string().datetime().optional(),
    reason: z.string().max(500).optional(),
});

export const GrantQuerySchema = BaseListQuerySchema.extend({
    membership_id: z.string().uuid().optional(),
    effect: z.nativeEnum(PermissionEffect).optional(),
});
export type GrantQuery = z.infer<typeof GrantQuerySchema>;

export class SimulateDto {
    @ApiProperty()
    @IsUUID()
    membership_id: string;

    @ApiProperty({ example: 'crm.deals.update' })
    @IsString()
    @MaxLength(120)
    permission_key: string;

    @ApiProperty({ required: false, description: 'Check a record in this branch' })
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
}

export const SimulateSchema = z.object({
    membership_id: z.string().uuid(),
    permission_key: z.string().max(120),
    branch_id: z.string().uuid().optional(),
    team_id: z.string().uuid().optional(),
    project_id: z.string().uuid().optional(),
});
