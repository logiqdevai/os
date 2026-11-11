import { ApiProperty, PartialType } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, IsUUID, Matches, MaxLength, MinLength } from 'class-validator';
import { TeamKind } from 'generated/prisma';
import { z } from 'zod';

export class CreateTeamDto {
    @ApiProperty({ example: 'Web team' })
    @IsString()
    @MinLength(1)
    @MaxLength(120)
    name: string;

    @ApiProperty({ required: false, example: 'Builds client websites' })
    @IsOptional()
    @IsString()
    @MaxLength(2000)
    description?: string;

    @ApiProperty({ enum: TeamKind, required: false })
    @IsOptional()
    @IsEnum(TeamKind)
    kind?: TeamKind;

    @ApiProperty({ required: false, description: 'Task key prefix (2–6 uppercase letters), e.g. WEB' })
    @IsOptional()
    @Matches(/^[A-Z][A-Z0-9]{1,5}$/, { message: 'task_key must be 2–6 uppercase letters or digits, starting with a letter' })
    task_key?: string;

    @ApiProperty({ required: false, description: 'Restrict the team to one branch' })
    @IsOptional()
    @IsUUID()
    branch_id?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsUUID()
    parent_team_id?: string;
}

export class UpdateTeamDto extends PartialType(CreateTeamDto) { }

export class AddTeamMemberDto {
    @ApiProperty()
    @IsUUID()
    membership_id: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    @MaxLength(60)
    team_role?: string;
}

/** Zod twin of CreateTeamDto for the MCP tool (same rules). */
export const CreateTeamSchema = z.object({
    name: z.string().min(1).max(120),
    description: z.string().max(2000).optional(),
    kind: z.nativeEnum(TeamKind).optional(),
    task_key: z.string().regex(/^[A-Z][A-Z0-9]{1,5}$/).optional(),
    branch_id: z.string().uuid().optional(),
    parent_team_id: z.string().uuid().optional(),
});
