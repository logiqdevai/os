import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
    ArrayMaxSize, ArrayMinSize, IsArray, IsBoolean, IsDateString, IsEmail, IsEnum, IsIn, IsInt, IsObject, IsOptional, IsString, IsUrl, IsUUID, Matches, Max, MaxLength, Min, MinLength, ValidateIf, ValidateNested,
} from 'class-validator';
import { BookingHostAssignment, BookingLinkAudience, BookingLinkStatus, CalendarBookingStatus } from 'generated/prisma';
import { z } from 'zod';
import { BaseListQuerySchema } from '@/shared/utils/pagination/pagination.utils';

export class BookingHostDto {
    @ApiProperty() @IsUUID() membership_id: string;
    @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) @Max(100) priority?: number;
}

export class BookingQuestionDto {
    @ApiProperty({ example: 'company' }) @Matches(/^[a-z][a-z0-9_]{0,39}$/) key: string;
    @ApiProperty({ example: 'Company' }) @IsString() @MaxLength(120) label: string;
    @ApiPropertyOptional({ enum: ['text', 'textarea'] }) @IsOptional() @IsIn(['text', 'textarea']) type?: 'text' | 'textarea';
    @ApiPropertyOptional() @IsOptional() @IsBoolean() required?: boolean;
}

export class CreateBookingLinkDto {
    @ApiProperty({ example: 'intro-call' }) @Matches(/^[a-z0-9][a-z0-9-]{1,59}$/, { message: 'Use 2–60 lowercase letters, digits and dashes' }) slug: string;
    @ApiProperty({ example: 'Intro call' }) @IsString() @MinLength(1) @MaxLength(120) name: string;
    @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(5000) description?: string;
    @ApiPropertyOptional({ enum: BookingLinkStatus }) @IsOptional() @IsEnum(BookingLinkStatus) status?: BookingLinkStatus;
    @ApiPropertyOptional({ enum: BookingLinkAudience }) @IsOptional() @IsEnum(BookingLinkAudience) audience?: BookingLinkAudience;
    @ApiPropertyOptional() @IsOptional() @IsUUID() event_type_id?: string;
    @ApiPropertyOptional() @IsOptional() @IsUUID() company_id?: string;
    @ApiPropertyOptional({ enum: BookingHostAssignment }) @IsOptional() @IsEnum(BookingHostAssignment) host_assignment?: BookingHostAssignment;
    @ApiProperty({ type: [BookingHostDto] }) @IsArray() @ArrayMinSize(1) @ArrayMaxSize(20) @ValidateNested({ each: true }) @Type(() => BookingHostDto) hosts: BookingHostDto[];
    @ApiPropertyOptional({ default: 30 }) @IsOptional() @IsInt() @Min(5) @Max(480) duration_minutes?: number;
    @ApiPropertyOptional({ default: 30 }) @IsOptional() @IsInt() @Min(5) @Max(240) slot_interval_minutes?: number;
    @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) @Max(240) buffer_before_minutes?: number;
    @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) @Max(240) buffer_after_minutes?: number;
    @ApiPropertyOptional({ default: 60 }) @IsOptional() @IsInt() @Min(0) @Max(43200) min_notice_minutes?: number;
    @ApiPropertyOptional({ default: 60 }) @IsOptional() @IsInt() @Min(1) @Max(365) max_days_ahead?: number;
    @ApiPropertyOptional({ nullable: true }) @IsOptional() @ValidateIf((_, v) => v !== null) @IsInt() @Min(1) @Max(100) max_bookings_per_day?: number | null;
    @ApiPropertyOptional() @IsOptional() @IsBoolean() requires_confirmation?: boolean;
    @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(64) timezone?: string;
    @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500) location?: string;
    @ApiPropertyOptional({ type: [BookingQuestionDto] }) @IsOptional() @IsArray() @ArrayMaxSize(10) @ValidateNested({ each: true }) @Type(() => BookingQuestionDto) questions?: BookingQuestionDto[];
    @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(2000) confirmation_message?: string;
    @ApiPropertyOptional() @IsOptional() @ValidateIf((_, v) => !!v) @IsUrl({ require_protocol: true }) redirect_url?: string;
    @ApiPropertyOptional({ nullable: true }) @IsOptional() @ValidateIf((_, v) => v !== null) @IsInt() @Min(0) @Max(43200) cancellation_notice_minutes?: number | null;
}

export class UpdateBookingLinkDto extends PartialType(CreateBookingLinkDto) { }

export class BookingActionDto {
    @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(1000) reason?: string;
}

export class PublicBookingDto {
    @ApiProperty() @IsDateString() starts_at: string;
    @ApiPropertyOptional() @IsOptional() @IsInt() @Min(5) @Max(480) duration?: number;
    @ApiProperty({ example: 'Europe/Athens' }) @IsString() @MaxLength(64) timezone: string;
    @ApiProperty() @IsString() @MinLength(1) @MaxLength(120) name: string;
    @ApiProperty() @IsEmail() email: string;
    @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(40) phone?: string;
    @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(2000) notes?: string;
    @ApiPropertyOptional({ type: Object }) @IsOptional() @IsObject() answers?: Record<string, string>;
}

export const BookingLinkQuerySchema = BaseListQuerySchema.extend({
    status: z.nativeEnum(BookingLinkStatus).optional(),
    audience: z.nativeEnum(BookingLinkAudience).optional(),
});
export type BookingLinkQuery = z.infer<typeof BookingLinkQuerySchema>;

export const BookingQuerySchema = BaseListQuerySchema.extend({
    status: z.nativeEnum(CalendarBookingStatus).optional(),
    booking_link_id: z.string().uuid().optional(),
    upcoming: z.preprocess((v) => v === 'true' || v === true, z.boolean()).optional(),
});
export type BookingQuery = z.infer<typeof BookingQuerySchema>;

export const PublicSlotsQuerySchema = z.object({
    from: z.string().datetime({ offset: true }),
    to: z.string().datetime({ offset: true }),
    duration: z.coerce.number().int().min(5).max(480).optional(),
});
export type PublicSlotsQuery = z.infer<typeof PublicSlotsQuerySchema>;
