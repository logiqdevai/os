import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsDateString, IsEnum, IsIn, IsInt, IsOptional, IsString, IsUUID, MaxLength, Min, MinLength, ValidateNested } from 'class-validator';
import { MessageAttachmentKind, MessageVisibility, MessagingPresenceState } from 'generated/prisma';
import { z } from 'zod';

export const MESSAGE_MAX_LENGTH = 40000;

export class MessageAttachmentInputDto {
    @ApiProperty({ description: '17 Document id of the uploaded file.' })
    @IsUUID()
    document_id: string;

    @ApiProperty()
    @IsString()
    @MaxLength(255)
    file_name: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    @MaxLength(150)
    mime_type?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsInt()
    @Min(0)
    size_bytes?: number;

    @ApiProperty({ enum: MessageAttachmentKind, required: false })
    @IsOptional()
    @IsEnum(MessageAttachmentKind)
    kind?: MessageAttachmentKind;
}

/**
 * Message body is Markdown. Mentions use the token `@[Display name](<membership uuid>)`; `@channel`, `@here` and `@everyone`
 * notify every member of the channel (subject to MessagingSettings.broadcast_mention_policy).
 */
export class PostMessageDto {
    @ApiProperty({ example: 'Hi @[Anna Meyer](2b1d…) — the new homepage is up for review.' })
    @IsString()
    @MinLength(1)
    @MaxLength(MESSAGE_MAX_LENGTH)
    body: string;

    @ApiProperty({ required: false, description: 'Reply in the thread of this root message.' })
    @IsOptional()
    @IsUUID()
    parent_message_id?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsUUID()
    quoted_message_id?: string;

    @ApiProperty({ required: false, description: 'Client-generated idempotency key; a retry with the same key returns the first message.' })
    @IsOptional()
    @IsString()
    @MaxLength(100)
    client_message_id?: string;

    @ApiProperty({ enum: MessageVisibility, required: false })
    @IsOptional()
    @IsEnum(MessageVisibility)
    visibility?: MessageVisibility;

    @ApiProperty({ required: false, type: [MessageAttachmentInputDto] })
    @IsOptional()
    @IsArray()
    @ArrayMaxSize(10)
    @ValidateNested({ each: true })
    @Type(() => MessageAttachmentInputDto)
    attachments?: MessageAttachmentInputDto[];
}

export class EditMessageDto {
    @ApiProperty()
    @IsString()
    @MinLength(1)
    @MaxLength(MESSAGE_MAX_LENGTH)
    body: string;
}

export class ReactionDto {
    @ApiProperty({ example: '👍' })
    @IsString()
    @MinLength(1)
    @MaxLength(64)
    emoji: string;
}

export class MarkReadDto {
    @ApiProperty({ required: false, description: 'Last message read; defaults to the newest message of the channel.' })
    @IsOptional()
    @IsUUID()
    message_id?: string;
}

export class SaveDraftDto {
    @ApiProperty()
    @IsString()
    @MaxLength(MESSAGE_MAX_LENGTH)
    body: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsUUID()
    thread_root_message_id?: string;
}

export class SaveMessageDto {
    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    @MaxLength(500)
    note?: string;
}

export const PRESENCE_MANUAL_STATES = ['ACTIVE', 'AWAY', 'DO_NOT_DISTURB'] as const;

export class UpdatePresenceDto {
    @ApiProperty({ enum: PRESENCE_MANUAL_STATES, required: false, nullable: true, description: 'Manual override; null returns to automatic.' })
    @IsOptional()
    @IsIn([...PRESENCE_MANUAL_STATES, null])
    manual_state?: Exclude<MessagingPresenceState, 'OFFLINE'> | null;

    @ApiProperty({ required: false, nullable: true })
    @IsOptional()
    @IsString()
    @MaxLength(100)
    status_text?: string | null;

    @ApiProperty({ required: false, nullable: true })
    @IsOptional()
    @IsString()
    @MaxLength(16)
    status_emoji?: string | null;

    @ApiProperty({ required: false, nullable: true })
    @IsOptional()
    @IsDateString()
    status_expires_at?: string | null;
}

/** Zod twin of PostMessageDto for MCP. */
export const PostMessageSchema = z.object({
    channel_id: z.string().uuid(),
    body: z.string().min(1).max(MESSAGE_MAX_LENGTH),
    parent_message_id: z.string().uuid().optional(),
    client_message_id: z.string().max(100).optional(),
});
