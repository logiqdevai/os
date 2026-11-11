import { ApiProperty, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsBoolean, IsDateString, IsEnum, IsInt, IsObject, IsOptional, IsString, IsUUID, Max, MaxLength, Min, MinLength, ValidateNested } from 'class-validator';
import { CampaignAudienceMode, CampaignStatus, CommChannel } from 'generated/prisma';
import { z } from 'zod';
import { BaseListQuerySchema, boolish, csv } from '@/shared/utils/pagination/pagination.utils';

export class CampaignAudienceInputDto {
    @ApiProperty({ enum: CampaignAudienceMode, required: false, default: 'INCLUDE' })
    @IsOptional()
    @IsEnum(CampaignAudienceMode)
    mode?: CampaignAudienceMode;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsUUID()
    list_id?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsUUID()
    segment_id?: string;
}

export class CreateCampaignDto {
    @ApiProperty({ example: 'November newsletter' })
    @IsString()
    @MinLength(1)
    @MaxLength(200)
    name: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    @MaxLength(2000)
    description?: string;

    @ApiProperty({ enum: CommChannel })
    @IsEnum(CommChannel)
    channel: CommChannel;

    @ApiProperty({ required: false, example: 'newsletter' })
    @IsOptional()
    @IsString()
    @MaxLength(60)
    campaign_type?: string;

    @ApiProperty({ required: false, description: 'Use the published version of this template as content' })
    @IsOptional()
    @IsUUID()
    template_id?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    @MaxLength(300)
    subject?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    @MaxLength(300)
    preheader?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    @MaxLength(500_000)
    body_html?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    @MaxLength(100_000)
    body_text?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsUUID()
    sender_identity_id?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    @MaxLength(120)
    from_name?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    @MaxLength(254)
    reply_to_address?: string;

    @ApiProperty({ required: false, default: true })
    @IsOptional()
    @IsBoolean()
    tracking_enabled?: boolean;

    @ApiProperty({ required: false, default: true, description: 'Only send to contacts who opted in on this channel' })
    @IsOptional()
    @IsBoolean()
    require_consent?: boolean;

    @ApiProperty({ required: false, example: { utm_source: 'newsletter', utm_medium: 'email' } })
    @IsOptional()
    @IsObject()
    utm?: Record<string, string>;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsUUID()
    branch_id?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsUUID()
    topic_id?: string;

    @ApiProperty({ required: false, description: 'Max messages per hour; omit for no throttling' })
    @IsOptional()
    @IsInt()
    @Min(10)
    @Max(1_000_000)
    send_rate_per_hour?: number;

    @ApiProperty({ required: false, example: 'Europe/Athens' })
    @IsOptional()
    @IsString()
    @MaxLength(60)
    schedule_timezone?: string;

    @ApiProperty({ type: [CampaignAudienceInputDto], required: false })
    @IsOptional()
    @IsArray()
    @ArrayMaxSize(50)
    @ValidateNested({ each: true })
    @Type(() => CampaignAudienceInputDto)
    audiences?: CampaignAudienceInputDto[];
}

export class UpdateCampaignDto extends PartialType(CreateCampaignDto) { }

export class SetAudienceDto {
    @ApiProperty({ type: [CampaignAudienceInputDto] })
    @IsArray()
    @ArrayMaxSize(50)
    @ValidateNested({ each: true })
    @Type(() => CampaignAudienceInputDto)
    audiences: CampaignAudienceInputDto[];
}

export class ScheduleCampaignDto {
    @ApiProperty({ required: false, description: 'ISO date-time; omit to send now' })
    @IsOptional()
    @IsDateString()
    scheduled_at?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    @MaxLength(60)
    schedule_timezone?: string;
}

export class SubmitCampaignDto {
    @ApiProperty({ required: false, type: [String], description: 'Members asked to review; anyone holding communications.campaigns.approve may decide' })
    @IsOptional()
    @IsArray()
    @ArrayMaxSize(10)
    @IsUUID('all', { each: true })
    approver_membership_ids?: string[];

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    @MaxLength(2000)
    comment?: string;
}

export class CampaignDecisionDto {
    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    @MaxLength(2000)
    comment?: string;
}

export class TestSendDto {
    @ApiProperty({ type: [String], example: ['me@agency.com'] })
    @IsArray()
    @ArrayMaxSize(5)
    @IsString({ each: true })
    addresses: string[];
}

export const CampaignQuerySchema = BaseListQuerySchema.extend({
    status: csv(z.nativeEnum(CampaignStatus)),
    channel: z.nativeEnum(CommChannel).optional(),
    owner_membership_id: z.string().uuid().optional(),
    archived: boolish,
});
export type CampaignQuery = z.infer<typeof CampaignQuerySchema>;

export const CampaignRecipientQuerySchema = BaseListQuerySchema.extend({ status: z.string().optional() });
export type CampaignRecipientQuery = z.infer<typeof CampaignRecipientQuerySchema>;

const AudienceInputSchema = z.object({ mode: z.nativeEnum(CampaignAudienceMode).optional(), list_id: z.string().uuid().optional(), segment_id: z.string().uuid().optional() });

export const CreateCampaignSchema = z.object({
    name: z.string().min(1).max(200),
    description: z.string().max(2000).optional(),
    channel: z.nativeEnum(CommChannel),
    campaign_type: z.string().max(60).optional(),
    template_id: z.string().uuid().optional(),
    subject: z.string().max(300).optional(),
    preheader: z.string().max(300).optional(),
    body_html: z.string().max(500_000).optional(),
    body_text: z.string().max(100_000).optional(),
    sender_identity_id: z.string().uuid().optional(),
    from_name: z.string().max(120).optional(),
    reply_to_address: z.string().max(254).optional(),
    tracking_enabled: z.boolean().optional(),
    require_consent: z.boolean().optional(),
    branch_id: z.string().uuid().optional(),
    send_rate_per_hour: z.number().int().min(10).optional(),
    audiences: z.array(AudienceInputSchema).max(50).optional(),
});
export const SetAudienceSchema = z.object({ id: z.string().uuid(), audiences: z.array(AudienceInputSchema).max(50) });
