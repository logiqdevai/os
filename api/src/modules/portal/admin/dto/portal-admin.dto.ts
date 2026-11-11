import { ApiProperty } from '@nestjs/swagger';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsBoolean, IsEmail, IsEnum, IsInt, IsObject, IsOptional, IsString, IsUUID, Matches, Max, MaxLength, Min, ValidateIf } from 'class-validator';
import { InvitationStatus, MembershipStatus, PortalProfileChangeStatus } from 'generated/prisma';
import { z } from 'zod';
import { BaseListQuerySchema } from '@/shared/utils/pagination/pagination.utils';

export const PortalClientQuerySchema = BaseListQuerySchema.extend({
    portal: z.enum(['enabled', 'disabled', 'not_set_up', 'all']).optional().default('all'),
});
export type PortalClientQuery = z.infer<typeof PortalClientQuerySchema>;

export const PortalUserQuerySchema = BaseListQuerySchema.extend({
    company_id: z.string().uuid().optional(),
    role_id: z.string().uuid().optional(),
    status: z.nativeEnum(MembershipStatus).optional(),
});
export type PortalUserQuery = z.infer<typeof PortalUserQuerySchema>;

export const PortalInvitationQuerySchema = BaseListQuerySchema.extend({
    company_id: z.string().uuid().optional(),
    status: z.nativeEnum(InvitationStatus).optional(),
});
export type PortalInvitationQuery = z.infer<typeof PortalInvitationQuerySchema>;

export const ProfileChangeQuerySchema = BaseListQuerySchema.extend({
    status: z.nativeEnum(PortalProfileChangeStatus).optional(),
    company_id: z.string().uuid().optional(),
});
export type ProfileChangeQuery = z.infer<typeof ProfileChangeQuerySchema>;

export const PortalActivityQuerySchema = BaseListQuerySchema.extend({
    company_id: z.string().uuid().optional(),
});
export type PortalActivityQuery = z.infer<typeof PortalActivityQuerySchema>;

export const PortalApprovalQuerySchema = BaseListQuerySchema.extend({
    company_id: z.string().uuid().optional(),
    state: z.enum(['awaiting', 'changes_requested', 'decided', 'all']).optional().default('awaiting'),
});
export type PortalApprovalQuery = z.infer<typeof PortalApprovalQuerySchema>;

export class UpdatePortalSettingsDto {
    @ApiProperty({ required: false })
    @IsOptional()
    @IsBoolean()
    enabled?: boolean;

    @ApiProperty({ required: false, description: 'Feature toggles { projects, requests, conversations, documents, proposals, contracts, billing, knowledge }' })
    @IsOptional()
    @IsObject()
    features?: Record<string, boolean>;

    @ApiProperty({ required: false, description: 'Branding overrides { primary_color, logo_url, accent_color, portal_name }' })
    @IsOptional()
    @IsObject()
    branding?: Record<string, string>;

    @ApiProperty({ required: false, example: 'customer-viewer' })
    @IsOptional()
    @IsString()
    @MaxLength(80)
    default_role_slug?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsBoolean()
    profile_changes_require_approval?: boolean;

    @ApiProperty({ required: false, nullable: true })
    @IsOptional()
    @ValidateIf((_, v) => v !== null)
    @IsString()
    @MaxLength(2000)
    welcome_message?: string | null;

    @ApiProperty({ required: false, nullable: true })
    @IsOptional()
    @ValidateIf((_, v) => v !== null)
    @IsEmail()
    support_email?: string | null;

    @ApiProperty({ required: false, nullable: true })
    @IsOptional()
    @ValidateIf((_, v) => v !== null)
    @Matches(/^(?=.{3,253}$)([a-z0-9-]+\.)+[a-z]{2,}$/, { message: 'Enter a domain like portal.example.com' })
    custom_domain?: string | null;

    @ApiProperty({ required: false, description: 'Embedded widget { enabled, position, greeting }' })
    @IsOptional()
    @IsObject()
    widget_settings?: Record<string, unknown>;
}

export class InviteEntryDto {
    @ApiProperty()
    @IsEmail()
    email: string;
}

export class EnableClientDto {
    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    @MaxLength(80)
    default_role_slug?: string;

    @ApiProperty({ required: false, nullable: true })
    @IsOptional()
    @ValidateIf((_, v) => v !== null)
    @IsString()
    @MaxLength(2000)
    welcome_message?: string | null;

    @ApiProperty({ required: false, type: [String], description: 'Invite these people right away' })
    @IsOptional()
    @IsArray()
    @ArrayMaxSize(50)
    @IsEmail({}, { each: true })
    emails?: string[];

    @ApiProperty({ required: false, description: 'Customer role for the invitations' })
    @IsOptional()
    @IsUUID()
    role_id?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    @MaxLength(2000)
    message?: string;
}

export class UpdateClientSettingsDto {
    @ApiProperty({ required: false })
    @IsOptional()
    @IsObject()
    features?: Record<string, boolean>;

    @ApiProperty({ required: false, nullable: true })
    @IsOptional()
    @ValidateIf((_, v) => v !== null)
    @IsString()
    @MaxLength(80)
    default_role_slug?: string | null;

    @ApiProperty({ required: false, nullable: true })
    @IsOptional()
    @ValidateIf((_, v) => v !== null)
    @IsString()
    @MaxLength(2000)
    welcome_message?: string | null;
}

export class CreatePortalInvitationDto {
    @ApiProperty()
    @IsUUID()
    company_id: string;

    @ApiProperty({ type: [String] })
    @IsArray()
    @ArrayMinSize(1)
    @ArrayMaxSize(50)
    @IsEmail({}, { each: true })
    emails: string[];

    @ApiProperty({ required: false, description: 'Customer role (defaults to the portal default role)' })
    @IsOptional()
    @IsUUID()
    role_id?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    @MaxLength(2000)
    message?: string;

    @ApiProperty({ required: false, default: 14 })
    @IsOptional()
    @IsInt()
    @Min(1)
    @Max(60)
    expires_in_days?: number;
}

export class UpdatePortalUserDto {
    @ApiProperty({ required: false })
    @IsOptional()
    @IsUUID()
    role_id?: string;

    @ApiProperty({ required: false, enum: ['ACTIVE', 'SUSPENDED', 'DEACTIVATED'] })
    @IsOptional()
    @IsEnum(MembershipStatus)
    status?: MembershipStatus;
}

export class PortalUserProjectsDto {
    @ApiProperty({ type: [String], description: 'Empty = every customer-visible project of the company' })
    @IsArray()
    @ArrayMaxSize(500)
    @IsUUID('all', { each: true })
    project_ids: string[];
}

export class ReviewProfileChangeDto {
    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    @MaxLength(2000)
    review_note?: string;
}
