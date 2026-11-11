import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsDateString, IsEnum, IsIn, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';
import { CommChannel, CommMessageKind, CommMessageSource, CommMessageStatus, CommTemplateCategory } from 'generated/prisma';
import { z } from 'zod';
import { BaseListQuerySchema, boolish, csv } from '@/shared/utils/pagination/pagination.utils';

export class SendMessageDto {
    @ApiProperty({ enum: CommChannel })
    @IsEnum(CommChannel)
    channel: CommChannel;

    @ApiProperty({ required: false, description: 'Email or E.164 phone. Optional when contact_id is given (the contact address is used).' })
    @IsOptional()
    @IsString()
    @MaxLength(254)
    to_address?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    @MaxLength(160)
    to_name?: string;

    @ApiProperty({ required: false, description: 'CRM contact (02) — personalization values and history' })
    @IsOptional()
    @IsUUID()
    contact_id?: string;

    @ApiProperty({ required: false, description: 'Use the published version of this template' })
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
    @MaxLength(254)
    reply_to_address?: string;

    @ApiProperty({ required: false, enum: [CommMessageKind.CUSTOMER, CommMessageKind.TRANSACTIONAL], default: 'CUSTOMER' })
    @IsOptional()
    @IsIn([CommMessageKind.CUSTOMER, CommMessageKind.TRANSACTIONAL])
    kind?: CommMessageKind;

    @ApiProperty({ required: false, enum: CommTemplateCategory })
    @IsOptional()
    @IsEnum(CommTemplateCategory)
    category?: CommTemplateCategory;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsUUID()
    company_id?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsUUID()
    project_id?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsUUID()
    branch_id?: string;

    @ApiProperty({ required: false, description: 'Send later (ISO date-time)' })
    @IsOptional()
    @IsDateString()
    scheduled_at?: string;

    @ApiProperty({ required: false, default: true, description: 'false = save as draft' })
    @IsOptional()
    @IsBoolean()
    send?: boolean;
}

export class CancelMessageDto {
    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    @MinLength(1)
    @MaxLength(500)
    reason?: string;
}

export const MessageQuerySchema = BaseListQuerySchema.extend({
    channel: z.nativeEnum(CommChannel).optional(),
    kind: csv(z.nativeEnum(CommMessageKind)),
    source: z.nativeEnum(CommMessageSource).optional(),
    status: csv(z.nativeEnum(CommMessageStatus)),
    campaign_id: z.string().uuid().optional(),
    contact_id: z.string().uuid().optional(),
    company_id: z.string().uuid().optional(),
    project_id: z.string().uuid().optional(),
    from: z.string().datetime({ offset: true }).optional().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()),
    to: z.string().datetime({ offset: true }).optional().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()),
    include_tests: boolish,
    archived: boolish,
});
export type MessageQuery = z.infer<typeof MessageQuerySchema>;

export const SendMessageSchema = z.object({
    channel: z.nativeEnum(CommChannel),
    to_address: z.string().max(254).optional(),
    to_name: z.string().max(160).optional(),
    contact_id: z.string().uuid().optional(),
    template_id: z.string().uuid().optional(),
    subject: z.string().max(300).optional(),
    body_html: z.string().max(500_000).optional(),
    body_text: z.string().max(100_000).optional(),
    sender_identity_id: z.string().uuid().optional(),
    kind: z.enum([CommMessageKind.CUSTOMER, CommMessageKind.TRANSACTIONAL]).optional(),
    company_id: z.string().uuid().optional(),
    project_id: z.string().uuid().optional(),
    scheduled_at: z.string().datetime().optional(),
    send: z.boolean().optional(),
});
