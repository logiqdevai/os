import { ApiProperty, PartialType } from '@nestjs/swagger';
import { IsBoolean, IsDateString, IsEnum, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { MembershipType, ModuleKey, ScopeType } from 'generated/prisma';
import { z } from 'zod';

class MemberFieldsDto {
    @ApiProperty({ required: false, example: 'Senior developer' })
    @IsOptional()
    @IsString()
    @MaxLength(120)
    job_title?: string;

    @ApiProperty({ enum: MembershipType, required: false })
    @IsOptional()
    @IsEnum(MembershipType)
    type?: MembershipType;

    @ApiProperty({ required: false, description: 'Default branch for navigation and new records (never restricts permissions)' })
    @IsOptional()
    @IsUUID()
    default_branch_id?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsUUID()
    default_team_id?: string;
}

export class UpdateMemberDto extends PartialType(MemberFieldsDto) { }

export class AssignRoleDto {
    @ApiProperty()
    @IsUUID()
    role_id: string;

    @ApiProperty({ enum: ScopeType, required: false, default: ScopeType.ORGANIZATION })
    @IsOptional()
    @IsEnum(ScopeType)
    scope_type?: ScopeType;

    @ApiProperty({ required: false, description: 'Branch / team / project / customer / resource id for non-organization scopes' })
    @IsOptional()
    @IsUUID()
    scope_id?: string;

    @ApiProperty({ required: false, description: 'Temporary access ends at this time (01 §93)' })
    @IsOptional()
    @IsDateString()
    valid_until?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    @MaxLength(500)
    reason?: string;
}

export class MemberBranchDto {
    @ApiProperty()
    @IsUUID()
    branch_id: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsBoolean()
    is_primary?: boolean;

    @ApiProperty({ required: false, description: 'Access cascades to child branches (01 §91)' })
    @IsOptional()
    @IsBoolean()
    include_children?: boolean;
}

export class ModuleAccessDto {
    @ApiProperty({ description: 'false blocks the module for this member even when the organization has it enabled' })
    @IsBoolean()
    enabled: boolean;
}

export class OffboardMemberDto {
    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    @MaxLength(500)
    reason?: string;
}

export const ModuleKeyParam = z.nativeEnum(ModuleKey);

/** Zod twins for MCP tools (same rules as the class-validator DTOs). */
export const AssignRoleSchema = z.object({
    membership_id: z.string().uuid(),
    role_id: z.string().uuid(),
    scope_type: z.nativeEnum(ScopeType).optional(),
    scope_id: z.string().uuid().optional(),
    valid_until: z.string().datetime().optional(),
    reason: z.string().max(500).optional(),
});
