import { ApiProperty } from '@nestjs/swagger';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsEmail, IsEnum, IsIn, IsInt, IsObject, IsOptional, IsString, IsUUID, Max, MaxLength, Min, MinLength } from 'class-validator';
import { MembershipStatus, TicketPriority, TicketType } from 'generated/prisma';
import { z } from 'zod';
import { BaseListQuerySchema } from '@/shared/utils/pagination/pagination.utils';

export const PortalListQuerySchema = BaseListQuerySchema.extend({
    status: z.string().max(40).optional(),
    project_id: z.string().uuid().optional(),
});
export type PortalListQuery = z.infer<typeof PortalListQuerySchema>;

export class CreatePortalRequestDto {
    @ApiProperty({ example: 'The contact form does not send emails' })
    @IsString()
    @MinLength(3)
    @MaxLength(300)
    subject: string;

    @ApiProperty()
    @IsString()
    @MinLength(1)
    @MaxLength(20000)
    description: string;

    @ApiProperty({ enum: ['QUESTION', 'BUG', 'FEATURE_REQUEST', 'CHANGE_REQUEST', 'BILLING', 'ACCOUNT', 'OTHER'] })
    @IsIn(['QUESTION', 'BUG', 'FEATURE_REQUEST', 'CHANGE_REQUEST', 'BILLING', 'ACCOUNT', 'OTHER'])
    type: TicketType;

    @ApiProperty({ required: false, enum: TicketPriority })
    @IsOptional()
    @IsEnum(TicketPriority)
    priority?: TicketPriority;

    @ApiProperty({ required: false, description: 'One of your projects' })
    @IsOptional()
    @IsUUID()
    project_id?: string;
}

export class UpdatePortalRequestDto {
    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    @MinLength(3)
    @MaxLength(300)
    subject?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    @MaxLength(20000)
    description?: string;

    @ApiProperty({ required: false, enum: TicketPriority })
    @IsOptional()
    @IsEnum(TicketPriority)
    priority?: TicketPriority;
}

export class PortalMessageDto {
    @ApiProperty()
    @IsString()
    @MinLength(1)
    @MaxLength(20000)
    body: string;
}

export class StartPortalConversationDto {
    @ApiProperty()
    @IsString()
    @MinLength(1)
    @MaxLength(300)
    subject: string;

    @ApiProperty()
    @IsString()
    @MinLength(1)
    @MaxLength(20000)
    body: string;
}

export class PortalRatingDto {
    @ApiProperty({ minimum: 1, maximum: 5 })
    @IsInt()
    @Min(1)
    @Max(5)
    rating: number;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    @MaxLength(4000)
    comment?: string;
}

export class DeliverableReviewDto {
    @ApiProperty({ enum: ['ACCEPTED', 'CHANGES_REQUESTED', 'REJECTED'] })
    @IsIn(['ACCEPTED', 'CHANGES_REQUESTED', 'REJECTED'])
    decision: 'ACCEPTED' | 'CHANGES_REQUESTED' | 'REJECTED';

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    @MaxLength(4000)
    comment?: string;
}

export class ProfileChangeRequestDto {
    @ApiProperty({ required: false, description: 'Edit this contact instead of the company' })
    @IsOptional()
    @IsUUID()
    contact_id?: string;

    @ApiProperty({ description: 'Proposed values, e.g. { "phone": "+30 210 000 0000", "website": "https://…" }' })
    @IsObject()
    changes: Record<string, unknown>;
}

export class PortalTeamInviteDto {
    @ApiProperty({ type: [String] })
    @IsArray()
    @ArrayMinSize(1)
    @ArrayMaxSize(20)
    @IsEmail({}, { each: true })
    emails: string[];

    @ApiProperty({ required: false })
    @IsOptional()
    @IsUUID()
    role_id?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    @MaxLength(2000)
    message?: string;
}

export class PortalTeamUpdateDto {
    @ApiProperty({ required: false })
    @IsOptional()
    @IsUUID()
    role_id?: string;

    @ApiProperty({ required: false, enum: ['ACTIVE', 'DEACTIVATED'] })
    @IsOptional()
    @IsIn(['ACTIVE', 'DEACTIVATED'])
    status?: MembershipStatus;
}
