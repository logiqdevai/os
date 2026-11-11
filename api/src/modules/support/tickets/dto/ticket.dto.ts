import { ApiProperty, OmitType, PartialType } from '@nestjs/swagger';
import { IsArray, IsBoolean, IsDateString, IsEmail, IsEnum, IsIn, IsOptional, IsString, IsUUID, MaxLength, MinLength, ValidateIf } from 'class-validator';
import { TicketPriority, TicketRelationType, TicketSource, TicketStatusCategory, TicketType } from 'generated/prisma';
import { z } from 'zod';
import { BaseListQuerySchema, boolish, csv } from '@/shared/utils/pagination/pagination.utils';

export const TicketQuerySchema = BaseListQuerySchema.extend({
    status_id: z.string().uuid().optional(),
    status_category: csv(z.nativeEnum(TicketStatusCategory)),
    /** `open` = every non-resolved category. */
    state: z.enum(['open', 'closed', 'all']).optional(),
    priority: csv(z.nativeEnum(TicketPriority)),
    type: z.nativeEnum(TicketType).optional(),
    source: z.nativeEnum(TicketSource).optional(),
    /** membership id, `me` or `unassigned`. */
    assignee: z.string().optional(),
    inbox_id: z.string().uuid().optional(),
    team_id: z.string().uuid().optional(),
    category_id: z.string().uuid().optional(),
    company_id: z.string().uuid().optional(),
    project_id: z.string().uuid().optional(),
    incident_id: z.string().uuid().optional(),
    sla: z.enum(['breached', 'at_risk', 'ok']).optional(),
    archived: boolish,
});
export type TicketQuery = z.infer<typeof TicketQuerySchema>;

export class CreateTicketDto {
    @ApiProperty({ example: 'Checkout page returns 500' })
    @IsString()
    @MinLength(1)
    @MaxLength(300)
    subject: string;

    @ApiProperty({ required: false, description: 'Markdown' })
    @IsOptional()
    @IsString()
    @MaxLength(50000)
    description?: string;

    @ApiProperty({ required: false, enum: TicketType })
    @IsOptional()
    @IsEnum(TicketType)
    type?: TicketType;

    @ApiProperty({ required: false, enum: TicketPriority })
    @IsOptional()
    @IsEnum(TicketPriority)
    priority?: TicketPriority;

    @ApiProperty({ required: false, enum: TicketSource })
    @IsOptional()
    @IsEnum(TicketSource)
    source?: TicketSource;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsUUID()
    status_id?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsUUID()
    category_id?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsUUID()
    inbox_id?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsUUID()
    team_id?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsUUID()
    assignee_membership_id?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsUUID()
    branch_id?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsUUID()
    requester_contact_id?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsUUID()
    company_id?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsEmail()
    requester_email?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    @MaxLength(200)
    requester_name?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsUUID()
    project_id?: string;

    @ApiProperty({ required: false, description: 'Create the ticket from this conversation (primary thread)' })
    @IsOptional()
    @IsUUID()
    conversation_id?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsUUID()
    sla_policy_id?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsDateString()
    due_at?: string;

    @ApiProperty({ required: false, description: 'Visible to the requester in the portal (default true)' })
    @IsOptional()
    @IsBoolean()
    customer_visible?: boolean;
}

export class UpdateTicketDto extends PartialType(OmitType(CreateTicketDto, ['conversation_id', 'status_id', 'source', 'assignee_membership_id'] as const)) {
    @ApiProperty({ required: false, nullable: true })
    @IsOptional()
    @ValidateIf((_, v) => v !== null)
    @IsString()
    @MaxLength(10000)
    resolution?: string | null;
}

export class ChangeTicketStatusDto {
    @ApiProperty()
    @IsUUID()
    status_id: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    @MaxLength(1000)
    reason?: string;

    @ApiProperty({ required: false, description: 'Resolution note when resolving' })
    @IsOptional()
    @IsString()
    @MaxLength(10000)
    resolution?: string;
}

export class AssignTicketDto {
    @ApiProperty({ nullable: true })
    @ValidateIf((_, v) => v !== null)
    @IsUUID()
    assignee_membership_id: string | null;

    @ApiProperty({ required: false, nullable: true })
    @IsOptional()
    @ValidateIf((_, v) => v !== null)
    @IsUUID()
    team_id?: string | null;
}

export class EscalateTicketDto {
    @ApiProperty({ required: false })
    @IsOptional()
    @IsUUID()
    to_membership_id?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    @MaxLength(2000)
    note?: string;
}

export class MergeTicketDto {
    @ApiProperty()
    @IsUUID()
    into_ticket_id: string;
}

export class TicketRelationDto {
    @ApiProperty()
    @IsUUID()
    target_ticket_id: string;

    @ApiProperty({ enum: TicketRelationType })
    @IsEnum(TicketRelationType)
    type: TicketRelationType;
}

export class FollowerDto {
    @ApiProperty({ required: false, description: 'Defaults to me' })
    @IsOptional()
    @IsUUID()
    membership_id?: string;
}

export class LinkConversationDto {
    @ApiProperty()
    @IsUUID()
    conversation_id: string;
}

export class TicketReplyDto {
    @ApiProperty({ enum: ['AGENT', 'INTERNAL_NOTE'] })
    @IsIn(['AGENT', 'INTERNAL_NOTE'])
    kind: 'AGENT' | 'INTERNAL_NOTE';

    @ApiProperty()
    @IsString()
    @MinLength(1)
    @MaxLength(50000)
    body: string;

    @ApiProperty({ required: false, type: [String] })
    @IsOptional()
    @IsArray()
    @IsUUID('all', { each: true })
    mentions?: string[];

    @ApiProperty({ required: false })
    @IsOptional()
    @IsUUID()
    canned_response_id?: string;

    @ApiProperty({ required: false, description: 'Also move the ticket to this status' })
    @IsOptional()
    @IsUUID()
    then_status_id?: string;
}

export class ConvertToTaskDto {
    @ApiProperty({ required: false, description: 'Defaults to the ticket subject' })
    @IsOptional()
    @IsString()
    @MaxLength(300)
    title?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    @MaxLength(50000)
    description?: string;

    @ApiProperty({ required: false, description: 'Defaults to the ticket project or the category default project' })
    @IsOptional()
    @IsUUID()
    project_id?: string;

    @ApiProperty({ required: false, description: 'Team whose task key numbers the task' })
    @IsOptional()
    @IsUUID()
    team_id?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsUUID()
    assignee_membership_id?: string;

    @ApiProperty({ required: false, description: 'Make the task visible in the customer portal' })
    @IsOptional()
    @IsBoolean()
    customer_visible?: boolean;
}

export class LinkTaskDto {
    @ApiProperty()
    @IsUUID()
    task_id: string;
}

// --- Zod twins for MCP -------------------------------------------------------------------------

export const CreateTicketSchema = z.object({
    subject: z.string().min(1).max(300),
    description: z.string().max(50000).optional(),
    type: z.nativeEnum(TicketType).optional(),
    priority: z.nativeEnum(TicketPriority).optional(),
    category_id: z.string().uuid().optional(),
    inbox_id: z.string().uuid().optional(),
    team_id: z.string().uuid().optional(),
    assignee_membership_id: z.string().uuid().optional(),
    requester_contact_id: z.string().uuid().optional(),
    company_id: z.string().uuid().optional(),
    requester_email: z.string().email().optional(),
    requester_name: z.string().max(200).optional(),
    project_id: z.string().uuid().optional(),
    conversation_id: z.string().uuid().optional(),
});

export const UpdateTicketSchema = z.object({
    id: z.string().uuid(),
    subject: z.string().min(1).max(300).optional(),
    description: z.string().max(50000).optional(),
    type: z.nativeEnum(TicketType).optional(),
    priority: z.nativeEnum(TicketPriority).optional(),
    category_id: z.string().uuid().optional(),
    team_id: z.string().uuid().optional(),
    project_id: z.string().uuid().optional(),
});
