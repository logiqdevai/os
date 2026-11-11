import { ApiProperty } from '@nestjs/swagger';
import { ArrayMaxSize, IsArray, IsDateString, IsEmail, IsEnum, IsIn, IsOptional, IsString, IsUUID, MaxLength, MinLength, ValidateIf } from 'class-validator';
import { SupportChannelType, SupportConversationStatus, SupportParticipantRole, TicketPriority } from 'generated/prisma';
import { z } from 'zod';
import { BaseListQuerySchema, csv } from '@/shared/utils/pagination/pagination.utils';

export const CONVERSATION_VIEWS = ['all', 'mine', 'unassigned', 'mentions', 'participating'] as const;

export const ConversationQuerySchema = BaseListQuerySchema.extend({
    view: z.enum(CONVERSATION_VIEWS).optional().default('all'),
    status: csv(z.nativeEnum(SupportConversationStatus)),
    inbox_id: z.string().uuid().optional(),
    channel_type: z.nativeEnum(SupportChannelType).optional(),
    priority: z.nativeEnum(TicketPriority).optional(),
    assignee_membership_id: z.string().uuid().optional(),
    company_id: z.string().uuid().optional(),
    contact_id: z.string().uuid().optional(),
    team_id: z.string().uuid().optional(),
});
export type ConversationQuery = z.infer<typeof ConversationQuerySchema>;

export class CreateConversationDto {
    @ApiProperty({ enum: SupportChannelType, example: 'EMAIL' })
    @IsEnum(SupportChannelType)
    channel_type: SupportChannelType;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsUUID()
    inbox_id?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    @MaxLength(300)
    subject?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsUUID()
    contact_id?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsUUID()
    company_id?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    @MaxLength(200)
    customer_name?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsEmail()
    customer_email?: string;

    @ApiProperty({ required: false, enum: TicketPriority })
    @IsOptional()
    @IsEnum(TicketPriority)
    priority?: TicketPriority;

    @ApiProperty({ description: 'First message (markdown)' })
    @IsString()
    @MinLength(1)
    @MaxLength(50000)
    body: string;

    @ApiProperty({ required: false, enum: ['AGENT', 'CUSTOMER'], description: 'AGENT = outbound message to the customer; CUSTOMER = log an inbound message (phone, walk-in)' })
    @IsOptional()
    @IsIn(['AGENT', 'CUSTOMER'])
    first_message_kind?: 'AGENT' | 'CUSTOMER';
}

export class PostMessageDto {
    @ApiProperty({ enum: ['AGENT', 'INTERNAL_NOTE'], description: 'AGENT = public reply to the customer; INTERNAL_NOTE = private note (never shown to customers)' })
    @IsIn(['AGENT', 'INTERNAL_NOTE'])
    kind: 'AGENT' | 'INTERNAL_NOTE';

    @ApiProperty()
    @IsString()
    @MinLength(1)
    @MaxLength(50000)
    body: string;

    @ApiProperty({ required: false, type: [String], description: 'Membership ids @mentioned (internal notes)' })
    @IsOptional()
    @IsArray()
    @ArrayMaxSize(50)
    @IsUUID('all', { each: true })
    mentions?: string[];

    @ApiProperty({ required: false })
    @IsOptional()
    @IsUUID()
    canned_response_id?: string;

    @ApiProperty({ required: false, enum: ['OPEN', 'PENDING', 'RESOLVED'], description: 'Send and set the conversation status' })
    @IsOptional()
    @IsIn(['OPEN', 'PENDING', 'RESOLVED'])
    then_status?: 'OPEN' | 'PENDING' | 'RESOLVED';
}

export class AssignConversationDto {
    @ApiProperty({ nullable: true, description: 'null = unassign' })
    @ValidateIf((_, v) => v !== null)
    @IsUUID()
    assignee_membership_id: string | null;

    @ApiProperty({ required: false, nullable: true })
    @IsOptional()
    @ValidateIf((_, v) => v !== null)
    @IsUUID()
    team_id?: string | null;
}

export class SnoozeConversationDto {
    @ApiProperty({ example: '2026-11-12T09:00:00Z' })
    @IsDateString()
    until: string;
}

export class UpdateConversationDto {
    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    @MaxLength(300)
    subject?: string;

    @ApiProperty({ required: false, enum: TicketPriority })
    @IsOptional()
    @IsEnum(TicketPriority)
    priority?: TicketPriority;

    @ApiProperty({ required: false, description: 'Transfer to another inbox' })
    @IsOptional()
    @IsUUID()
    inbox_id?: string;

    @ApiProperty({ required: false, nullable: true })
    @IsOptional()
    @ValidateIf((_, v) => v !== null)
    @IsUUID()
    team_id?: string | null;

    @ApiProperty({ required: false, nullable: true })
    @IsOptional()
    @ValidateIf((_, v) => v !== null)
    @IsUUID()
    company_id?: string | null;

    @ApiProperty({ required: false, nullable: true })
    @IsOptional()
    @ValidateIf((_, v) => v !== null)
    @IsUUID()
    contact_id?: string | null;
}

export class AddParticipantDto {
    @ApiProperty()
    @IsUUID()
    membership_id: string;

    @ApiProperty({ required: false, enum: SupportParticipantRole })
    @IsOptional()
    @IsEnum(SupportParticipantRole)
    role?: SupportParticipantRole;
}

export class MergeConversationDto {
    @ApiProperty()
    @IsUUID()
    into_conversation_id: string;
}

export const PostMessageSchema = z.object({
    id: z.string().uuid(),
    kind: z.enum(['AGENT', 'INTERNAL_NOTE']),
    body: z.string().min(1).max(50000),
    mentions: z.array(z.string().uuid()).max(50).optional(),
    then_status: z.enum(['OPEN', 'PENDING', 'RESOLVED']).optional(),
});
