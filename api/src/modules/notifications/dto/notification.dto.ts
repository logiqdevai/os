import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsBoolean, IsDateString, IsEnum, IsIn, IsOptional, IsString, IsUUID, MaxLength, ValidateIf } from 'class-validator';
import { ModuleKey, NotificationCategory } from 'generated/prisma';
import { z } from 'zod';
import { BaseListQuerySchema } from '@/shared/utils/pagination/pagination.utils';

/** Inbox tabs (14 §7): unread · read · all (not archived) · archived · snoozed · action (waiting on you). */
export const NOTIFICATION_STATES = ['unread', 'read', 'all', 'archived', 'snoozed', 'action'] as const;
export type NotificationState = (typeof NOTIFICATION_STATES)[number];

export const NotificationQuerySchema = BaseListQuerySchema.extend({
    state: z.enum(NOTIFICATION_STATES).optional().default('all'),
    module: z.nativeEnum(ModuleKey).optional(),
    category: z.nativeEnum(NotificationCategory).optional(),
});
export type NotificationQuery = z.infer<typeof NotificationQuerySchema>;

export class UpdateNotificationDto {
    @ApiPropertyOptional({ description: 'true = mark read, false = mark unread' })
    @IsOptional()
    @IsBoolean()
    read?: boolean;

    @ApiPropertyOptional({ description: 'true = archive, false = move back to the inbox' })
    @IsOptional()
    @IsBoolean()
    archived?: boolean;

    @ApiPropertyOptional({ description: 'Hide until this moment (ISO); null = unsnooze', nullable: true })
    @IsOptional()
    @ValidateIf((_, v) => v !== null)
    @IsDateString()
    snoozed_until?: string | null;
}

export const NOTIFICATION_BULK_ACTIONS = ['read', 'unread', 'archive', 'unarchive'] as const;
export type NotificationBulkAction = (typeof NOTIFICATION_BULK_ACTIONS)[number];

export class BulkNotificationDto {
    @ApiProperty({ type: [String] })
    @IsArray()
    @ArrayMinSize(1)
    @ArrayMaxSize(200)
    @IsUUID('all', { each: true })
    ids: string[];

    @ApiProperty({ enum: NOTIFICATION_BULK_ACTIONS })
    @IsIn(NOTIFICATION_BULK_ACTIONS as unknown as string[])
    action: NotificationBulkAction;
}

export class ReadAllNotificationsDto {
    @ApiPropertyOptional({ enum: ModuleKey, description: 'Only notifications of this module' })
    @IsOptional()
    @IsEnum(ModuleKey)
    module?: ModuleKey;
}

export class NotificationActionDto {
    @ApiProperty({ example: 'acknowledge' })
    @IsString()
    @MaxLength(60)
    action: string;
}

/** Zod twins for MCP tools (same rules as the REST bodies). */
export const UpdateNotificationSchema = z.object({
    id: z.string().uuid(),
    read: z.boolean().optional(),
    archived: z.boolean().optional(),
    snoozed_until: z.string().datetime().nullable().optional(),
});
export const ReadAllNotificationsSchema = z.object({ module: z.nativeEnum(ModuleKey).optional() });
