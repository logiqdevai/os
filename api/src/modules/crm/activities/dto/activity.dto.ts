import { ApiProperty, PartialType } from '@nestjs/swagger';
import { IsArray, IsDateString, IsEnum, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min, MinLength } from 'class-validator';
import { CrmActivityDirection, CrmActivityStatus, CrmActivityType, CrmPriority } from 'generated/prisma';
import { z } from 'zod';
import { BaseListQuerySchema, csv } from '@/shared/utils/pagination/pagination.utils';

export class CreateActivityDto {
    @ApiProperty({ enum: CrmActivityType }) @IsEnum(CrmActivityType) type: CrmActivityType;
    @ApiProperty({ example: 'Discovery call' }) @IsString() @MinLength(1) @MaxLength(200) title: string;
    @ApiProperty({ enum: CrmActivityStatus, required: false, description: 'PLANNED (default) or COMPLETED to log a past activity' }) @IsOptional() @IsEnum(CrmActivityStatus) status?: CrmActivityStatus;
    @ApiProperty({ enum: CrmPriority, required: false }) @IsOptional() @IsEnum(CrmPriority) priority?: CrmPriority;
    @ApiProperty({ enum: CrmActivityDirection, required: false }) @IsOptional() @IsEnum(CrmActivityDirection) direction?: CrmActivityDirection;
    @ApiProperty({ required: false }) @IsOptional() @IsString() @MaxLength(5000) description?: string;
    @ApiProperty({ required: false }) @IsOptional() @IsUUID() company_id?: string;
    @ApiProperty({ required: false }) @IsOptional() @IsUUID() contact_id?: string;
    @ApiProperty({ required: false }) @IsOptional() @IsUUID() lead_id?: string;
    @ApiProperty({ required: false }) @IsOptional() @IsUUID() deal_id?: string;
    @ApiProperty({ required: false, description: 'Defaults to the caller' }) @IsOptional() @IsUUID() owner_membership_id?: string;
    @ApiProperty({ required: false, description: 'Due / start time' }) @IsOptional() @IsDateString() starts_at?: string;
    @ApiProperty({ required: false }) @IsOptional() @IsDateString() ends_at?: string;
    @ApiProperty({ required: false }) @IsOptional() @IsInt() @Min(0) @Max(1440) duration_minutes?: number;
    @ApiProperty({ required: false }) @IsOptional() @IsString() @MaxLength(300) location?: string;
    @ApiProperty({ required: false }) @IsOptional() @IsString() @MaxLength(500) meeting_url?: string;
    @ApiProperty({ required: false }) @IsOptional() @IsString() @MaxLength(2000) outcome?: string;
    @ApiProperty({ required: false, type: [String], description: 'Internal participants (membership ids)' }) @IsOptional() @IsArray() @IsUUID('4', { each: true }) participant_membership_ids?: string[];
    @ApiProperty({ required: false, type: [String], description: 'Contact participants' }) @IsOptional() @IsArray() @IsUUID('4', { each: true }) participant_contact_ids?: string[];
}

export class UpdateActivityDto extends PartialType(CreateActivityDto) { }

export class CompleteActivityDto {
    @ApiProperty({ required: false }) @IsOptional() @IsString() @MaxLength(2000) outcome?: string;
}

export const CreateActivitySchema = z.object({
    type: z.nativeEnum(CrmActivityType),
    title: z.string().min(1).max(200),
    status: z.nativeEnum(CrmActivityStatus).optional(),
    priority: z.nativeEnum(CrmPriority).optional(),
    direction: z.nativeEnum(CrmActivityDirection).optional(),
    description: z.string().max(5000).optional(),
    company_id: z.string().uuid().optional(),
    contact_id: z.string().uuid().optional(),
    lead_id: z.string().uuid().optional(),
    deal_id: z.string().uuid().optional(),
    owner_membership_id: z.string().uuid().optional(),
    starts_at: z.string().optional().describe('ISO date-time; due date for follow-ups'),
    ends_at: z.string().optional(),
    duration_minutes: z.number().int().min(0).max(1440).optional(),
    location: z.string().max(300).optional(),
    meeting_url: z.string().max(500).optional(),
    outcome: z.string().max(2000).optional(),
    participant_membership_ids: z.array(z.string().uuid()).optional(),
    participant_contact_ids: z.array(z.string().uuid()).optional(),
});

export const ActivityQuerySchema = BaseListQuerySchema.extend({
    type: csv(z.nativeEnum(CrmActivityType)),
    status: csv(z.nativeEnum(CrmActivityStatus)),
    owner: z.string().optional(),
    company_id: z.string().uuid().optional(),
    contact_id: z.string().uuid().optional(),
    lead_id: z.string().uuid().optional(),
    deal_id: z.string().uuid().optional(),
    /** overdue = planned and due before now · today · upcoming · open = all planned */
    due: z.enum(['overdue', 'today', 'upcoming', 'open']).optional(),
    from: z.string().optional(),
    to: z.string().optional(),
});
export type ActivityQuery = z.infer<typeof ActivityQuerySchema>;
