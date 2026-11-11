import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
    ArrayMaxSize, IsArray, IsBoolean, IsDateString, IsEmail, IsEnum, IsIn, IsInt, IsOptional, IsString, IsUrl, IsUUID, Max, MaxLength, Min, ValidateIf, ValidateNested,
} from 'class-validator';
import { CalendarAttendeeResponse, CalendarAttendeeRole, CalendarEventStatus, CalendarEventVisibility, CalendarReminderMethod } from 'generated/prisma';
import { z } from 'zod';

export class RecurrenceDto {
    @ApiProperty({ enum: ['DAILY', 'WEEKLY', 'MONTHLY'] }) @IsIn(['DAILY', 'WEEKLY', 'MONTHLY']) freq: 'DAILY' | 'WEEKLY' | 'MONTHLY';
    @ApiPropertyOptional({ default: 1 }) @IsOptional() @IsInt() @Min(1) @Max(99) interval?: number;
    @ApiPropertyOptional({ description: 'Number of occurrences' }) @IsOptional() @ValidateIf((_, v) => v !== null) @IsInt() @Min(1) @Max(730) count?: number | null;
    @ApiPropertyOptional({ description: 'Last day (ISO)' }) @IsOptional() @ValidateIf((_, v) => v !== null) @IsDateString() until?: string | null;
    @ApiPropertyOptional({ type: [Number], description: 'Weekly: 0 = Sunday … 6 = Saturday' })
    @IsOptional() @IsArray() @ArrayMaxSize(7) @IsInt({ each: true }) @Min(0, { each: true }) @Max(6, { each: true }) byday?: number[];
}

export class EventAttendeeInputDto {
    @ApiPropertyOptional({ description: 'Member attendee' }) @IsOptional() @IsUUID() membership_id?: string;
    @ApiPropertyOptional({ description: 'External guest email (when no membership_id)' }) @IsOptional() @IsEmail() email?: string;
    @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(120) name?: string;
    @ApiPropertyOptional({ enum: CalendarAttendeeRole }) @IsOptional() @IsEnum(CalendarAttendeeRole) role?: CalendarAttendeeRole;
}

export class EventReminderInputDto {
    @ApiProperty({ example: 10 }) @IsInt() @Min(0) @Max(40320) minutes_before: number;
    @ApiPropertyOptional({ enum: CalendarReminderMethod }) @IsOptional() @IsEnum(CalendarReminderMethod) method?: CalendarReminderMethod;
}

export class CreateCalendarEventDto {
    @ApiPropertyOptional({ description: 'Target calendar; default = my personal calendar' }) @IsOptional() @IsUUID() calendar_id?: string;
    @ApiPropertyOptional() @IsOptional() @IsUUID() event_type_id?: string;
    @ApiPropertyOptional({ example: 'Design review', description: 'Empty saves as "(No title)"' }) @IsOptional() @IsString() @MaxLength(300) title?: string;
    @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(20000) description?: string;
    @ApiPropertyOptional({ enum: [CalendarEventStatus.CONFIRMED, CalendarEventStatus.TENTATIVE] }) @IsOptional() @IsIn([CalendarEventStatus.CONFIRMED, CalendarEventStatus.TENTATIVE]) status?: CalendarEventStatus;
    @ApiProperty() @IsDateString() starts_at: string;
    @ApiProperty() @IsDateString() ends_at: string;
    @ApiPropertyOptional() @IsOptional() @IsBoolean() all_day?: boolean;
    @ApiPropertyOptional({ example: 'Europe/Athens' }) @IsOptional() @IsString() @MaxLength(64) timezone?: string;
    @ApiPropertyOptional({ type: RecurrenceDto, nullable: true }) @IsOptional() @ValidateIf((_, v) => v !== null) @ValidateNested() @Type(() => RecurrenceDto) recurrence?: RecurrenceDto | null;
    @ApiPropertyOptional({ enum: CalendarEventVisibility }) @IsOptional() @IsEnum(CalendarEventVisibility) visibility?: CalendarEventVisibility;
    @ApiPropertyOptional() @IsOptional() @IsBoolean() shows_as_busy?: boolean;
    @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500) location?: string;
    @ApiPropertyOptional() @IsOptional() @ValidateIf((_, v) => v !== '' && v !== null) @IsUrl({ require_protocol: true }) meeting_url?: string;
    @ApiPropertyOptional({ description: 'Token name: info, success, warning, danger, violet, neutral' }) @IsOptional() @IsString() @MaxLength(20) color?: string;
    @ApiPropertyOptional() @IsOptional() @IsUUID() project_id?: string;
    @ApiPropertyOptional() @IsOptional() @IsUUID() company_id?: string;
    @ApiPropertyOptional() @IsOptional() @IsBoolean() guests_can_see_guests?: boolean;
    @ApiPropertyOptional({ type: [EventAttendeeInputDto] }) @IsOptional() @IsArray() @ArrayMaxSize(200) @ValidateNested({ each: true }) @Type(() => EventAttendeeInputDto) attendees?: EventAttendeeInputDto[];
    @ApiPropertyOptional({ type: [EventReminderInputDto] }) @IsOptional() @IsArray() @ArrayMaxSize(10) @ValidateNested({ each: true }) @Type(() => EventReminderInputDto) reminders?: EventReminderInputDto[];
    @ApiPropertyOptional({ type: [String], description: 'Rooms / equipment to book' }) @IsOptional() @IsArray() @ArrayMaxSize(10) @IsUUID('all', { each: true }) resource_ids?: string[];
}

export class UpdateCalendarEventDto extends PartialType(CreateCalendarEventDto) { }

export class CancelCalendarEventDto {
    @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(1000) reason?: string;
    @ApiPropertyOptional({ description: 'Cancel only this occurrence of a series (its start, ISO)' }) @IsOptional() @IsDateString() occurrence_start?: string;
}

export class RespondCalendarEventDto {
    @ApiProperty({ enum: [CalendarAttendeeResponse.ACCEPTED, CalendarAttendeeResponse.TENTATIVE, CalendarAttendeeResponse.DECLINED] })
    @IsIn([CalendarAttendeeResponse.ACCEPTED, CalendarAttendeeResponse.TENTATIVE, CalendarAttendeeResponse.DECLINED])
    response: CalendarAttendeeResponse;
    @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(1000) comment?: string;
}

const isoRange = { from: z.string().datetime({ offset: true }), to: z.string().datetime({ offset: true }) };
const csvUuids = z.preprocess((v) => (typeof v === 'string' ? v.split(',').filter(Boolean) : v), z.array(z.string().uuid())).optional();

/** GET /calendar/events — occurrences overlapping [from, to) (series expanded server-side). */
export const CalendarEventQuerySchema = z.object({
    ...isoRange,
    calendar_ids: csvUuids,
    event_type_id: z.string().uuid().optional(),
    project_id: z.string().uuid().optional(),
    search: z.string().trim().max(200).optional(),
    include_cancelled: z.preprocess((v) => v === 'true' || v === true, z.boolean()).optional(),
    /** Only events I organize or attend. */
    mine: z.preprocess((v) => v === 'true' || v === true, z.boolean()).optional(),
});
export type CalendarEventQuery = z.infer<typeof CalendarEventQuerySchema>;

/** Zod twins for MCP tools. */
export const CreateCalendarEventSchema = z.object({
    calendar_id: z.string().uuid().optional(),
    event_type_id: z.string().uuid().optional(),
    title: z.string().max(300).optional(),
    description: z.string().max(20000).optional(),
    starts_at: z.string().datetime({ offset: true }),
    ends_at: z.string().datetime({ offset: true }),
    all_day: z.boolean().optional(),
    timezone: z.string().max(64).optional(),
    visibility: z.nativeEnum(CalendarEventVisibility).optional(),
    location: z.string().max(500).optional(),
    meeting_url: z.string().url().optional(),
    project_id: z.string().uuid().optional(),
    company_id: z.string().uuid().optional(),
    recurrence: z.object({ freq: z.enum(['DAILY', 'WEEKLY', 'MONTHLY']), interval: z.number().int().min(1).max(99).optional(), count: z.number().int().min(1).max(730).nullable().optional(), until: z.string().nullable().optional(), byday: z.array(z.number().int().min(0).max(6)).optional() }).nullable().optional(),
    attendees: z.array(z.object({ membership_id: z.string().uuid().optional(), email: z.string().email().optional(), name: z.string().max(120).optional() })).max(200).optional(),
    reminders: z.array(z.object({ minutes_before: z.number().int().min(0).max(40320) })).max(10).optional(),
});
