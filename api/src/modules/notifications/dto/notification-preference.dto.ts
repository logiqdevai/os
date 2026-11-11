import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ArrayMaxSize, IsArray, IsBoolean, IsDateString, IsEnum, IsIn, IsInt, IsOptional, IsString, IsUUID, Matches, Max, MaxLength, Min, ValidateIf } from 'class-validator';
import { NotificationChannel, NotificationDeliveryMode, NotificationDigestFrequency, NotificationLevel, RecordEntityType } from 'generated/prisma';
import { z } from 'zod';

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

/** NotificationRecipientSettings (preference layer 3): own row only. */
export class UpdateRecipientSettingsDto {
    @ApiPropertyOptional({ enum: NotificationLevel }) @IsOptional() @IsEnum(NotificationLevel) level?: NotificationLevel;
    @ApiPropertyOptional() @IsOptional() @IsBoolean() in_app_enabled?: boolean;
    @ApiPropertyOptional() @IsOptional() @IsBoolean() email_enabled?: boolean;
    @ApiPropertyOptional() @IsOptional() @IsBoolean() sms_enabled?: boolean;
    @ApiPropertyOptional() @IsOptional() @IsBoolean() push_enabled?: boolean;
    @ApiPropertyOptional() @IsOptional() @IsBoolean() desktop_enabled?: boolean;
    @ApiPropertyOptional() @IsOptional() @IsBoolean() sound_enabled?: boolean;
    @ApiPropertyOptional() @IsOptional() @IsBoolean() show_previews?: boolean;
    @ApiPropertyOptional() @IsOptional() @IsBoolean() dnd_enabled?: boolean;
    @ApiPropertyOptional({ example: '22:00', nullable: true }) @IsOptional() @ValidateIf((_, v) => v !== null) @Matches(HHMM, { message: 'Use HH:MM' }) dnd_start_time?: string | null;
    @ApiPropertyOptional({ example: '07:00', nullable: true }) @IsOptional() @ValidateIf((_, v) => v !== null) @Matches(HHMM, { message: 'Use HH:MM' }) dnd_end_time?: string | null;
    @ApiPropertyOptional({ type: [Number], description: '0 = Sunday … 6 = Saturday; empty = every day' })
    @IsOptional() @IsArray() @ArrayMaxSize(7) @IsInt({ each: true }) @Min(0, { each: true }) @Max(6, { each: true })
    dnd_weekdays?: number[];
    @ApiPropertyOptional({ nullable: true }) @IsOptional() @ValidateIf((_, v) => v !== null) @IsDateString() dnd_until?: string | null;
    @ApiPropertyOptional({ nullable: true, example: 'Europe/Athens' }) @IsOptional() @ValidateIf((_, v) => v !== null) @IsString() @MaxLength(64) timezone?: string | null;
    @ApiPropertyOptional() @IsOptional() @IsBoolean() dnd_allow_critical?: boolean;
    @ApiPropertyOptional({ enum: NotificationDigestFrequency }) @IsOptional() @IsEnum(NotificationDigestFrequency) digest_frequency?: NotificationDigestFrequency;
    @ApiPropertyOptional({ nullable: true }) @IsOptional() @ValidateIf((_, v) => v !== null) @IsInt() @Min(0) @Max(23) digest_hour?: number | null;
    @ApiPropertyOptional({ nullable: true }) @IsOptional() @ValidateIf((_, v) => v !== null) @IsInt() @Min(0) @Max(6) digest_weekday?: number | null;
    @ApiPropertyOptional({ nullable: true }) @IsOptional() @ValidateIf((_, v) => v !== null) @IsString() @MaxLength(10) language?: string | null;
}

/** Per event type + channel switch (preference layer 2). */
export class SetEventPreferenceDto {
    @ApiProperty({ enum: NotificationChannel }) @IsEnum(NotificationChannel) channel: NotificationChannel;
    @ApiProperty() @IsBoolean() enabled: boolean;
    @ApiPropertyOptional({ enum: NotificationDeliveryMode }) @IsOptional() @IsEnum(NotificationDeliveryMode) delivery_mode?: NotificationDeliveryMode;
}

/** Follow / mute a record (preference layer 1). The same API every module's "Follow" / "Mute" button calls. */
export class SetSubscriptionDto {
    @ApiProperty({ enum: RecordEntityType }) @IsEnum(RecordEntityType) entity_type: RecordEntityType;
    @ApiProperty() @IsUUID() entity_id: string;
    @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(200) entity_label?: string;
    @ApiProperty({ enum: ['follow', 'mute'] }) @IsIn(['follow', 'mute']) state: 'follow' | 'mute';
    @ApiPropertyOptional({ nullable: true, description: 'Temporary mute' }) @IsOptional() @ValidateIf((_, v) => v !== null) @IsDateString() muted_until?: string | null;
}

export const UpdateRecipientSettingsSchema = z.object({
    level: z.nativeEnum(NotificationLevel).optional(),
    in_app_enabled: z.boolean().optional(),
    email_enabled: z.boolean().optional(),
    push_enabled: z.boolean().optional(),
    sound_enabled: z.boolean().optional(),
    show_previews: z.boolean().optional(),
    dnd_enabled: z.boolean().optional(),
    dnd_start_time: z.string().regex(HHMM).nullable().optional(),
    dnd_end_time: z.string().regex(HHMM).nullable().optional(),
    dnd_weekdays: z.array(z.number().int().min(0).max(6)).max(7).optional(),
    dnd_until: z.string().datetime().nullable().optional(),
    timezone: z.string().max(64).nullable().optional(),
    digest_frequency: z.nativeEnum(NotificationDigestFrequency).optional(),
});
