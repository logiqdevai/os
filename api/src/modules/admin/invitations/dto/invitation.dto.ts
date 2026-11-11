import { ApiProperty } from '@nestjs/swagger';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsDateString, IsEmail, IsEnum, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';
import { InvitationStatus, MembershipType, ModuleKey, ScopeType } from 'generated/prisma';
import { z } from 'zod';
import { BaseListQuerySchema } from '@/shared/utils/pagination/pagination.utils';

export class CreateInvitationDto {
    @ApiProperty({ type: [String], example: ['ana@agency.com'] })
    @IsArray()
    @ArrayMinSize(1)
    @ArrayMaxSize(50)
    @IsEmail({}, { each: true })
    emails: string[];

    @ApiProperty({ enum: MembershipType, required: false })
    @IsOptional()
    @IsEnum(MembershipType)
    type?: MembershipType;

    @ApiProperty({ required: false, description: 'Role assigned on acceptance' })
    @IsOptional()
    @IsUUID()
    role_id?: string;

    @ApiProperty({ enum: ScopeType, required: false, description: 'Where the role applies' })
    @IsOptional()
    @IsEnum(ScopeType)
    scope_type?: ScopeType;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsUUID()
    scope_id?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsUUID()
    branch_id?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsUUID()
    team_id?: string;

    @ApiProperty({ enum: ModuleKey, isArray: true, required: false })
    @IsOptional()
    @IsArray()
    @IsEnum(ModuleKey, { each: true })
    modules?: ModuleKey[];

    @ApiProperty({ required: false, description: 'Access granted by this invitation ends at this date' })
    @IsOptional()
    @IsDateString()
    valid_until?: string;

    @ApiProperty({ required: false, default: 7 })
    @IsOptional()
    @IsInt()
    @Min(1)
    @Max(30)
    expires_in_days?: number;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    @MaxLength(1000)
    message?: string;
}

export const CreateInvitationSchema = z.object({
    emails: z.array(z.string().email()).min(1).max(50),
    type: z.nativeEnum(MembershipType).optional(),
    role_id: z.string().uuid().optional(),
    scope_type: z.nativeEnum(ScopeType).optional(),
    scope_id: z.string().uuid().optional(),
    branch_id: z.string().uuid().optional(),
    team_id: z.string().uuid().optional(),
    modules: z.array(z.nativeEnum(ModuleKey)).optional(),
    valid_until: z.string().datetime().optional(),
    expires_in_days: z.number().int().min(1).max(30).optional(),
    message: z.string().max(1000).optional(),
});

export const InvitationQuerySchema = BaseListQuerySchema.extend({
    status: z.nativeEnum(InvitationStatus).optional(),
});
export type InvitationQuery = z.infer<typeof InvitationQuerySchema>;
