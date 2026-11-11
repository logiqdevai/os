import { ApiProperty, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsBoolean, IsDateString, IsEnum, IsObject, IsOptional, IsString, IsUUID, MaxLength, MinLength, ValidateNested } from 'class-validator';
import { CommChannel, CommConsentSource, CommConsentStatus, CommRecipientKind, CommSuppressionReason, SegmentEntityType } from 'generated/prisma';
import { z } from 'zod';
import { BaseListQuerySchema, boolish } from '@/shared/utils/pagination/pagination.utils';
import { SegmentNodeSchema } from '../segment-definition';

// ------------------------------------------------------------------ recipient lists

export class CreateRecipientListDto {
    @ApiProperty({ example: 'Webinar attendees — March' })
    @IsString()
    @MinLength(1)
    @MaxLength(160)
    name: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    @MaxLength(2000)
    description?: string;

    @ApiProperty({ enum: CommChannel, required: false, description: 'Restrict to one channel; omit for both' })
    @IsOptional()
    @IsEnum(CommChannel)
    channel?: CommChannel;
}
export class UpdateRecipientListDto extends PartialType(CreateRecipientListDto) { }

export class ListMemberInputDto {
    @ApiProperty({ enum: CommRecipientKind })
    @IsEnum(CommRecipientKind)
    kind: CommRecipientKind;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsUUID()
    contact_id?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsUUID()
    membership_id?: string;

    @ApiProperty({ required: false, description: 'Email or E.164 phone (EXTERNAL), or an override address' })
    @IsOptional()
    @IsString()
    @MaxLength(254)
    address?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    @MaxLength(160)
    name?: string;
}

export class AddListMembersDto {
    @ApiProperty({ type: [ListMemberInputDto] })
    @IsArray()
    @ArrayMaxSize(5000)
    @ValidateNested({ each: true })
    @Type(() => ListMemberInputDto)
    members: ListMemberInputDto[];
}

export const ListQuerySchema = BaseListQuerySchema.extend({ channel: z.nativeEnum(CommChannel).optional(), archived: boolish });
export type ListQuery = z.infer<typeof ListQuerySchema>;

export const CreateRecipientListSchema = z.object({ name: z.string().min(1).max(160), description: z.string().max(2000).optional(), channel: z.nativeEnum(CommChannel).optional() });
export const ListMemberInputSchema = z.object({
    kind: z.nativeEnum(CommRecipientKind),
    contact_id: z.string().uuid().optional(),
    membership_id: z.string().uuid().optional(),
    address: z.string().max(254).optional(),
    name: z.string().max(160).optional(),
});

// ------------------------------------------------------------------ segments

export class CreateSegmentDto {
    @ApiProperty({ example: 'Active customers in Greece' })
    @IsString()
    @MinLength(1)
    @MaxLength(160)
    name: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    @MaxLength(2000)
    description?: string;

    @ApiProperty({ enum: SegmentEntityType, required: false })
    @IsOptional()
    @IsEnum(SegmentEntityType)
    entity_type?: SegmentEntityType;

    @ApiProperty({ description: 'Filter tree: { and: [ { field, op, value }, { or: [...] } ] }', example: { and: [{ field: 'company.type', op: 'eq', value: 'CUSTOMER' }] } })
    @IsObject()
    definition: Record<string, unknown>;

    @ApiProperty({ enum: CommChannel, required: false })
    @IsOptional()
    @IsEnum(CommChannel)
    channel?: CommChannel;

    @ApiProperty({ required: false, default: true })
    @IsOptional()
    @IsBoolean()
    require_consent?: boolean;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsUUID()
    saved_view_id?: string;
}
export class UpdateSegmentDto extends PartialType(CreateSegmentDto) { }

export class PreviewSegmentDto {
    @ApiProperty({ enum: SegmentEntityType, required: false })
    @IsOptional()
    @IsEnum(SegmentEntityType)
    entity_type?: SegmentEntityType;

    @ApiProperty()
    @IsObject()
    definition: Record<string, unknown>;

    @ApiProperty({ enum: CommChannel, required: false })
    @IsOptional()
    @IsEnum(CommChannel)
    channel?: CommChannel;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsBoolean()
    require_consent?: boolean;
}

export const SegmentQuerySchema = BaseListQuerySchema.extend({ entity_type: z.nativeEnum(SegmentEntityType).optional(), channel: z.nativeEnum(CommChannel).optional(), archived: boolish });
export type SegmentQuery = z.infer<typeof SegmentQuerySchema>;

export const CreateSegmentSchema = z.object({
    name: z.string().min(1).max(160),
    description: z.string().max(2000).optional(),
    entity_type: z.nativeEnum(SegmentEntityType).optional(),
    definition: SegmentNodeSchema,
    channel: z.nativeEnum(CommChannel).optional(),
    require_consent: z.boolean().optional(),
});

// ------------------------------------------------------------------ consent & suppression

export class SetConsentDto {
    @ApiProperty({ enum: CommConsentStatus })
    @IsEnum(CommConsentStatus)
    status: CommConsentStatus;

    @ApiProperty({ enum: CommConsentSource, required: false })
    @IsOptional()
    @IsEnum(CommConsentSource)
    source?: CommConsentSource;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    @MaxLength(2000)
    notes?: string;

    @ApiProperty({ required: false, description: 'Evidence: { form_id, ip, consent_text_version, … }' })
    @IsOptional()
    @IsObject()
    evidence?: Record<string, unknown>;
}

export const ConsentQuerySchema = BaseListQuerySchema.extend({
    channel: z.nativeEnum(CommChannel).optional(),
    status: z.nativeEnum(CommConsentStatus).optional(),
    source: z.nativeEnum(CommConsentSource).optional(),
});
export type ConsentQuery = z.infer<typeof ConsentQuerySchema>;

export class CreateSuppressionDto {
    @ApiProperty({ enum: CommChannel })
    @IsEnum(CommChannel)
    channel: CommChannel;

    @ApiProperty({ example: 'someone@example.com' })
    @IsString()
    @MinLength(3)
    @MaxLength(254)
    address: string;

    @ApiProperty({ enum: CommSuppressionReason, required: false, default: 'MANUAL' })
    @IsOptional()
    @IsEnum(CommSuppressionReason)
    reason?: CommSuppressionReason;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    @MaxLength(2000)
    notes?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsDateString()
    expires_at?: string;

    @ApiProperty({ required: false, description: 'Also block transactional messages' })
    @IsOptional()
    @IsBoolean()
    blocks_transactional?: boolean;
}

export class RemoveSuppressionDto {
    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    @MaxLength(2000)
    reason?: string;
}

export const SuppressionQuerySchema = BaseListQuerySchema.extend({
    channel: z.nativeEnum(CommChannel).optional(),
    reason: z.nativeEnum(CommSuppressionReason).optional(),
    removed: boolish,
});
export type SuppressionQuery = z.infer<typeof SuppressionQuerySchema>;

export const CreateSuppressionSchema = z.object({
    channel: z.nativeEnum(CommChannel),
    address: z.string().min(3).max(254),
    reason: z.nativeEnum(CommSuppressionReason).optional(),
    notes: z.string().max(2000).optional(),
    expires_at: z.string().datetime().optional(),
    blocks_transactional: z.boolean().optional(),
});
