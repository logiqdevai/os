import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
    ArrayMaxSize, IsArray, IsBoolean, IsDateString, IsEnum, IsIn, IsInt, IsOptional, IsString, IsUUID, Matches, Max, MaxLength, Min, MinLength, ValidateIf, ValidateNested,
} from 'class-validator';
import { CalendarEventVisibility, CalendarKind, CalendarReminderMethod, CalendarShareRole } from 'generated/prisma';
import { z } from 'zod';

/** Kinds created from this screen; PERSONAL needs only calendar.events.create, the others calendar.calendars.manage. EXTERNAL / RESOURCE are created by sync / resources. */
export const CREATABLE_KINDS = [CalendarKind.PERSONAL, CalendarKind.TEAM, CalendarKind.PROJECT, CalendarKind.CUSTOMER, CalendarKind.BRANCH, CalendarKind.ORGANIZATION] as const;

export class CreateCalendarDto {
    @ApiProperty({ enum: CREATABLE_KINDS }) @IsIn(CREATABLE_KINDS as unknown as string[]) kind: CalendarKind;
    @ApiProperty({ example: 'Web team' }) @IsString() @MinLength(1) @MaxLength(120) name: string;
    @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(1000) description?: string;
    @ApiPropertyOptional({ description: 'Token name: info, success, warning, danger, violet, neutral' }) @IsOptional() @IsString() @MaxLength(20) color?: string;
    @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(64) timezone?: string;
    @ApiPropertyOptional({ description: 'TEAM scope' }) @IsOptional() @IsUUID() team_id?: string;
    @ApiPropertyOptional({ description: 'PROJECT scope' }) @IsOptional() @IsUUID() project_id?: string;
    @ApiPropertyOptional({ description: 'CUSTOMER scope' }) @IsOptional() @IsUUID() company_id?: string;
    @ApiPropertyOptional({ description: 'BRANCH scope' }) @IsOptional() @IsUUID() branch_id?: string;
    @ApiPropertyOptional({ enum: CalendarEventVisibility }) @IsOptional() @IsEnum(CalendarEventVisibility) default_visibility?: CalendarEventVisibility;
    @ApiPropertyOptional() @IsOptional() @IsBoolean() free_busy_only?: boolean;
}

export class UpdateCalendarDto extends PartialType(CreateCalendarDto) { }

export class ShareCalendarDto {
    @ApiPropertyOptional() @IsOptional() @IsUUID() membership_id?: string;
    @ApiPropertyOptional() @IsOptional() @IsUUID() team_id?: string;
    @ApiProperty({ enum: CalendarShareRole }) @IsEnum(CalendarShareRole) role: CalendarShareRole;
    @ApiPropertyOptional({ nullable: true }) @IsOptional() @ValidateIf((_, v) => v !== null) @IsDateString() expires_at?: string | null;
}

export class ReminderDefaultDto {
    @ApiProperty() @IsInt() @Min(0) @Max(40320) minutes_before: number;
    @ApiPropertyOptional({ enum: CalendarReminderMethod }) @IsOptional() @IsEnum(CalendarReminderMethod) method?: CalendarReminderMethod;
}

export class CreateEventTypeDto {
    @ApiProperty({ example: 'Workshop' }) @IsString() @MinLength(1) @MaxLength(80) name: string;
    @ApiPropertyOptional({ example: 'workshop' }) @IsOptional() @Matches(/^[a-z0-9][a-z0-9-]{1,59}$/, { message: 'Lowercase letters, digits and dashes' }) slug?: string;
    @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500) description?: string;
    @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(20) color?: string;
    @ApiPropertyOptional() @IsOptional() @IsInt() @Min(5) @Max(1440) default_duration_minutes?: number;
    @ApiPropertyOptional({ enum: CalendarEventVisibility }) @IsOptional() @IsEnum(CalendarEventVisibility) default_visibility?: CalendarEventVisibility;
    @ApiPropertyOptional() @IsOptional() @IsBoolean() shows_as_busy?: boolean;
    @ApiPropertyOptional() @IsOptional() @IsBoolean() is_customer_facing?: boolean;
    @ApiPropertyOptional({ type: [ReminderDefaultDto] }) @IsOptional() @IsArray() @ArrayMaxSize(5) @ValidateNested({ each: true }) @Type(() => ReminderDefaultDto) default_reminders?: ReminderDefaultDto[];
}

export class UpdateEventTypeDto extends PartialType(CreateEventTypeDto) { }

export class UpdateCalendarPreferenceDto {
    @ApiPropertyOptional({ nullable: true }) @IsOptional() @ValidateIf((_, v) => v !== null) @IsUUID() default_calendar_id?: string | null;
    @ApiPropertyOptional({ nullable: true }) @IsOptional() @ValidateIf((_, v) => v !== null) @IsString() @MaxLength(64) timezone?: string | null;
    @ApiPropertyOptional({ enum: ['day', 'week', 'month', 'agenda'] }) @IsOptional() @IsIn(['day', 'week', 'month', 'agenda']) default_view?: string;
    @ApiPropertyOptional({ nullable: true }) @IsOptional() @ValidateIf((_, v) => v !== null) @IsInt() @Min(0) @Max(6) week_start?: number | null;
    @ApiPropertyOptional() @IsOptional() @IsBoolean() show_weekends?: boolean;
    @ApiPropertyOptional() @IsOptional() @IsBoolean() show_declined_events?: boolean;
    @ApiPropertyOptional() @IsOptional() @IsInt() @Min(5) @Max(480) default_event_duration?: number;
    @ApiPropertyOptional({ type: [ReminderDefaultDto] }) @IsOptional() @IsArray() @ArrayMaxSize(5) @ValidateNested({ each: true }) @Type(() => ReminderDefaultDto) default_reminders?: ReminderDefaultDto[];
    @ApiPropertyOptional({ type: [String] }) @IsOptional() @IsArray() @ArrayMaxSize(50) @IsUUID('all', { each: true }) overlay_calendar_ids?: string[];
    @ApiPropertyOptional({ nullable: true }) @IsOptional() @ValidateIf((_, v) => v !== null) @IsUUID() availability_schedule_id?: string | null;
}

export const CalendarListQuerySchema = z.object({
    kind: z.nativeEnum(CalendarKind).optional(),
    search: z.string().trim().max(120).optional(),
    archived: z.preprocess((v) => v === 'true' || v === true, z.boolean()).optional(),
});
export type CalendarListQuery = z.infer<typeof CalendarListQuerySchema>;

export const PeopleQuerySchema = z.object({
    search: z.string().trim().max(120).optional(),
    team_id: z.string().uuid().optional(),
    limit: z.coerce.number().int().min(1).max(100).optional().default(50),
});
export type PeopleQuery = z.infer<typeof PeopleQuerySchema>;
