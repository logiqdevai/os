import { ApiProperty, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsBoolean, IsEnum, IsInt, IsOptional, IsString, IsUUID, MaxLength, MinLength, ValidateNested } from 'class-validator';
import { WikiPermissionLevel, WikiSpaceKind, WikiVisibility } from 'generated/prisma';
import { z } from 'zod';
import { BaseListQuerySchema, boolish } from '@/shared/utils/pagination/pagination.utils';

export class SpaceMemberInputDto {
    @ApiProperty()
    @IsUUID()
    membership_id: string;

    @ApiProperty({ enum: WikiPermissionLevel, required: false })
    @IsOptional()
    @IsEnum(WikiPermissionLevel)
    level?: WikiPermissionLevel;
}

export class CreateSpaceDto {
    @ApiProperty({ example: 'Engineering handbook' })
    @IsString()
    @MinLength(1)
    @MaxLength(120)
    name: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    @MaxLength(2000)
    description?: string;

    @ApiProperty({ required: false, example: '📘' })
    @IsOptional()
    @IsString()
    @MaxLength(16)
    icon?: string;

    @ApiProperty({ required: false, example: 'blue' })
    @IsOptional()
    @IsString()
    @MaxLength(24)
    color?: string;

    @ApiProperty({ enum: WikiSpaceKind, required: false })
    @IsOptional()
    @IsEnum(WikiSpaceKind)
    kind?: WikiSpaceKind;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsUUID()
    team_id?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsUUID()
    branch_id?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsUUID()
    department_id?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsUUID()
    project_id?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsUUID()
    owner_membership_id?: string;

    @ApiProperty({ enum: WikiVisibility, required: false })
    @IsOptional()
    @IsEnum(WikiVisibility)
    default_visibility?: WikiVisibility;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsBoolean()
    is_private?: boolean;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsBoolean()
    allow_customer_visible?: boolean;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsBoolean()
    members_can_publish?: boolean;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsBoolean()
    require_review_before_publish?: boolean;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsInt()
    sort_order?: number;

    @ApiProperty({ required: false, type: [SpaceMemberInputDto] })
    @IsOptional()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => SpaceMemberInputDto)
    members?: SpaceMemberInputDto[];
}

export class UpdateSpaceDto extends PartialType(CreateSpaceDto) { }

export const CreateSpaceSchema = z.object({
    name: z.string().min(1).max(120),
    description: z.string().max(2000).optional(),
    icon: z.string().max(16).optional(),
    color: z.string().max(24).optional(),
    kind: z.nativeEnum(WikiSpaceKind).optional(),
    team_id: z.string().uuid().optional(),
    branch_id: z.string().uuid().optional(),
    department_id: z.string().uuid().optional(),
    project_id: z.string().uuid().optional(),
    owner_membership_id: z.string().uuid().optional(),
    default_visibility: z.nativeEnum(WikiVisibility).optional(),
    is_private: z.boolean().optional(),
    members: z.array(z.object({ membership_id: z.string().uuid(), level: z.nativeEnum(WikiPermissionLevel).optional() })).optional(),
});

export const SpaceQuerySchema = BaseListQuerySchema.extend({
    kind: z.nativeEnum(WikiSpaceKind).optional(),
    archived: boolish,
});
export type SpaceQuery = z.infer<typeof SpaceQuerySchema>;
