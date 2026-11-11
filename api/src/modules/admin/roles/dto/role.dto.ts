import { ApiProperty, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsEnum, IsOptional, IsString, IsUUID, MaxLength, MinLength, ValidateNested } from 'class-validator';
import { ModuleKey, PermissionEffect, RoleStatus, RoleType, ScopeType } from 'generated/prisma';
import { z } from 'zod';
import { BaseListQuerySchema } from '@/shared/utils/pagination/pagination.utils';

export class RolePermissionInput {
    @ApiProperty({ example: 'crm.deals.read' })
    @IsString()
    @MaxLength(120)
    key: string;

    @ApiProperty({ enum: PermissionEffect, required: false, default: PermissionEffect.ALLOW })
    @IsOptional()
    @IsEnum(PermissionEffect)
    effect?: PermissionEffect;
}

class RoleFieldsDto {
    @ApiProperty({ example: 'Senior designer' })
    @IsString()
    @MinLength(2)
    @MaxLength(80)
    name: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    @MaxLength(500)
    description?: string;

    @ApiProperty({ enum: [RoleType.ORGANIZATION, RoleType.BRANCH, RoleType.TEAM, RoleType.PROJECT], required: false })
    @IsOptional()
    @IsEnum(RoleType)
    type?: RoleType;

    @ApiProperty({ enum: ScopeType, required: false })
    @IsOptional()
    @IsEnum(ScopeType)
    default_scope?: ScopeType;

    @ApiProperty({ enum: ModuleKey, isArray: true, required: false })
    @IsOptional()
    @IsArray()
    @IsEnum(ModuleKey, { each: true })
    modules?: ModuleKey[];

    @ApiProperty({ type: [RolePermissionInput], required: false, description: 'Full permission set (replaces the current one)' })
    @IsOptional()
    @IsArray()
    @ArrayMaxSize(2000)
    @ValidateNested({ each: true })
    @Type(() => RolePermissionInput)
    permissions?: RolePermissionInput[];
}

export class CreateRoleDto extends RoleFieldsDto {
    @ApiProperty({ required: false, description: 'Clone permissions from this template or role' })
    @IsOptional()
    @IsUUID()
    template_role_id?: string;
}

export class UpdateRoleDto extends PartialType(RoleFieldsDto) { }

export class PublishRoleDto {
    @ApiProperty({ required: false, description: 'What changed in this version' })
    @IsOptional()
    @IsString()
    @MaxLength(500)
    note?: string;
}

export const RoleQuerySchema = BaseListQuerySchema.extend({
    type: z.nativeEnum(RoleType).optional(),
    status: z.nativeEnum(RoleStatus).optional(),
    /** `templates` = system templates only, `custom` = the organization's own roles. */
    source: z.enum(['templates', 'custom']).optional(),
    limit: z.coerce.number().int().min(1).max(200).optional().default(100),
});
export type RoleQuery = z.infer<typeof RoleQuerySchema>;

export const CreateRoleSchema = z.object({
    name: z.string().min(2).max(80),
    description: z.string().max(500).optional(),
    template_role_id: z.string().uuid().optional(),
    default_scope: z.nativeEnum(ScopeType).optional(),
    permissions: z.array(z.object({ key: z.string(), effect: z.nativeEnum(PermissionEffect).optional() })).optional(),
});
