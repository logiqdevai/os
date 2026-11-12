import { ApiProperty, PartialType } from '@nestjs/swagger';
import { ArrayMaxSize, IsArray, IsEnum, IsInt, IsObject, IsOptional, IsString, IsUrl, IsUUID, Matches, Max, MaxLength, Min, MinLength, ValidateIf } from 'class-validator';
import { InboundWebhookAuthScheme, InboundWebhookStatus, OutboundWebhookStatus, WebhookDeliveryStatus } from 'generated/prisma';
import { z } from 'zod';
import { BaseListQuerySchema } from '@/shared/utils/pagination/pagination.utils';

export class CreateOutboundWebhookDto {
    @ApiProperty({ example: 'Data warehouse' }) @IsString() @MinLength(1) @MaxLength(120)
    name: string;

    @ApiProperty({ required: false }) @IsOptional() @IsString() @MaxLength(1000)
    description?: string;

    @ApiProperty({ example: 'https://example.com/hooks/logiqdev' }) @IsUrl({ require_tld: false, require_protocol: true, protocols: ['http', 'https'] }) @MaxLength(2000)
    url: string;

    @ApiProperty({ type: [String], example: ['crm.deal.won', 'tasks.*'], description: 'Event keys, prefix wildcards (`crm.*`) or `*`' })
    @IsArray() @ArrayMaxSize(200) @IsString({ each: true })
    subscribed_events: string[];

    @ApiProperty({ required: false, description: 'Static headers added to every delivery' }) @IsOptional() @IsObject()
    headers?: Record<string, string>;

    @ApiProperty({ required: false }) @IsOptional() @IsString() @MaxLength(20)
    api_version?: string;

    @ApiProperty({ required: false, default: 5 }) @IsOptional() @IsInt() @Min(1) @Max(20)
    max_attempts?: number;

    @ApiProperty({ required: false, default: 60 }) @IsOptional() @IsInt() @Min(5) @Max(86400)
    retry_backoff_seconds?: number;

    @ApiProperty({ required: false, default: 10 }) @IsOptional() @IsInt() @Min(1) @Max(30)
    timeout_seconds?: number;

    @ApiProperty({ required: false, nullable: true, default: 50 }) @IsOptional() @ValidateIf((_, v) => v !== null) @IsInt() @Min(1) @Max(10000)
    disable_after_failures?: number | null;
}

export class UpdateOutboundWebhookDto extends PartialType(CreateOutboundWebhookDto) { }

export class CreateInboundWebhookDto {
    @ApiProperty({ example: 'Typeform leads' }) @IsString() @MinLength(1) @MaxLength(120)
    name: string;

    @ApiProperty({ required: false }) @IsOptional() @IsString() @MaxLength(1000)
    description?: string;

    @ApiProperty({ required: false, description: 'Generated when omitted', example: 'typeform-leads' })
    @IsOptional() @Matches(/^[a-z0-9][a-z0-9-]{2,60}$/, { message: 'slug: 3–61 lowercase letters, digits or dashes' })
    slug?: string;

    @ApiProperty({ enum: InboundWebhookAuthScheme, required: false, default: InboundWebhookAuthScheme.HMAC_SHA256 }) @IsOptional() @IsEnum(InboundWebhookAuthScheme)
    auth_scheme?: InboundWebhookAuthScheme;

    @ApiProperty({ required: false, example: 'x-signature' }) @IsOptional() @IsString() @MaxLength(100)
    signature_header?: string;

    @ApiProperty({ required: false, nullable: true, description: 'Workflow started by this endpoint' }) @IsOptional() @ValidateIf((_, v) => v !== null) @IsUUID()
    rule_id?: string | null;

    @ApiProperty({ required: false, type: [String] }) @IsOptional() @IsArray() @ArrayMaxSize(50) @IsString({ each: true })
    allowed_ip_ranges?: string[];

    @ApiProperty({ required: false, nullable: true }) @IsOptional() @ValidateIf((_, v) => v !== null) @IsInt() @Min(1) @Max(10000)
    rate_limit_per_minute?: number | null;
}

export class UpdateInboundWebhookDto extends PartialType(CreateInboundWebhookDto) {
    @ApiProperty({ enum: [InboundWebhookStatus.ACTIVE, InboundWebhookStatus.PAUSED], required: false }) @IsOptional() @IsEnum(InboundWebhookStatus)
    status?: InboundWebhookStatus;
}

export const DeliveryQuerySchema = BaseListQuerySchema.extend({
    webhook_id: z.string().uuid().optional(),
    status: z.nativeEnum(WebhookDeliveryStatus).optional(),
    event_key: z.string().optional(),
});
export type DeliveryQuery = z.infer<typeof DeliveryQuerySchema>;

export const OutboundQuerySchema = BaseListQuerySchema.extend({ status: z.nativeEnum(OutboundWebhookStatus).optional() });
export type OutboundQuery = z.infer<typeof OutboundQuerySchema>;

/** MCP input for editing an inbound endpoint (same fields as UpdateInboundWebhookDto; the slug never changes). */
export const UpdateInboundWebhookSchema = z.object({
    id: z.string().uuid(),
    name: z.string().min(1).max(120).optional(),
    description: z.string().max(1000).optional(),
    auth_scheme: z.nativeEnum(InboundWebhookAuthScheme).optional(),
    signature_header: z.string().max(100).optional(),
    rule_id: z.string().uuid().nullable().optional(),
    allowed_ip_ranges: z.array(z.string().max(60)).max(50).optional(),
    rate_limit_per_minute: z.number().int().min(1).max(10000).nullable().optional(),
    status: z.enum([InboundWebhookStatus.ACTIVE, InboundWebhookStatus.PAUSED]).optional(),
});

/** MCP input for outbound endpoints (same fields and limits as CreateOutboundWebhookDto). */
export const CreateOutboundWebhookSchema = z.object({
    name: z.string().min(1).max(120),
    description: z.string().max(1000).optional(),
    url: z.string().url().max(2000),
    subscribed_events: z.array(z.string().max(200)).max(200).describe('Event keys, prefix wildcards (`crm.*`) or `*`'),
    headers: z.record(z.string(), z.string()).optional(),
    api_version: z.string().max(20).optional(),
    max_attempts: z.number().int().min(1).max(20).optional(),
    retry_backoff_seconds: z.number().int().min(5).max(86400).optional(),
    timeout_seconds: z.number().int().min(1).max(30).optional(),
    disable_after_failures: z.number().int().min(1).max(10000).nullable().optional(),
});
export const UpdateOutboundWebhookSchema = CreateOutboundWebhookSchema.partial().extend({ id: z.string().uuid() });
