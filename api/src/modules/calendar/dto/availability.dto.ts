import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsBoolean, IsDateString, IsEnum, IsInt, IsOptional, IsString, IsUUID, Matches, Max, MaxLength, Min, MinLength, ValidateIf, ValidateNested } from 'class-validator';
import { CalendarAvailabilityOverrideKind, CalendarResourceKind } from 'generated/prisma';
import { z } from 'zod';

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$|^24:00$/;

export class AvailabilityRuleDto {
    @ApiProperty({ description: '0 = Sunday … 6 = Saturday' }) @IsInt() @Min(0) @Max(6) weekday: number;
    @ApiProperty({ example: '09:00' }) @Matches(HHMM, { message: 'Use HH:MM' }) start_time: string;
    @ApiProperty({ example: '17:00' }) @Matches(HHMM, { message: 'Use HH:MM' }) end_time: string;
}

export class AvailabilityOverrideDto {
    @ApiProperty({ example: '2026-12-24' }) @IsDateString() date: string;
    @ApiPropertyOptional({ enum: CalendarAvailabilityOverrideKind }) @IsOptional() @IsEnum(CalendarAvailabilityOverrideKind) kind?: CalendarAvailabilityOverrideKind;
    @ApiPropertyOptional({ nullable: true }) @IsOptional() @ValidateIf((_, v) => v !== null) @Matches(HHMM) start_time?: string | null;
    @ApiPropertyOptional({ nullable: true }) @IsOptional() @ValidateIf((_, v) => v !== null) @Matches(HHMM) end_time?: string | null;
    @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(200) reason?: string;
}

export class CreateAvailabilityScheduleDto {
    @ApiProperty({ example: 'Working hours' }) @IsString() @MinLength(1) @MaxLength(80) name: string;
    @ApiProperty({ example: 'Europe/Athens' }) @IsString() @MaxLength(64) timezone: string;
    @ApiPropertyOptional() @IsOptional() @IsBoolean() is_default?: boolean;
    @ApiPropertyOptional() @IsOptional() @IsBoolean() honor_holidays?: boolean;
    @ApiPropertyOptional() @IsOptional() @IsBoolean() honor_leave?: boolean;
    @ApiProperty({ type: [AvailabilityRuleDto] }) @IsArray() @ArrayMaxSize(70) @ValidateNested({ each: true }) @Type(() => AvailabilityRuleDto) rules: AvailabilityRuleDto[];
    @ApiPropertyOptional({ type: [AvailabilityOverrideDto] }) @IsOptional() @IsArray() @ArrayMaxSize(366) @ValidateNested({ each: true }) @Type(() => AvailabilityOverrideDto) overrides?: AvailabilityOverrideDto[];
}

export class UpdateAvailabilityScheduleDto extends PartialType(CreateAvailabilityScheduleDto) { }

export class CreateResourceDto {
    @ApiProperty({ example: 'Aegean room' }) @IsString() @MinLength(1) @MaxLength(120) name: string;
    @ApiPropertyOptional({ enum: CalendarResourceKind }) @IsOptional() @IsEnum(CalendarResourceKind) kind?: CalendarResourceKind;
    @ApiPropertyOptional({ example: 'ATH-1' }) @IsOptional() @IsString() @MaxLength(30) code?: string;
    @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(1000) description?: string;
    @ApiPropertyOptional() @IsOptional() @IsInt() @Min(1) @Max(10000) capacity?: number;
    @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(200) location?: string;
    @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(20) color?: string;
    @ApiPropertyOptional() @IsOptional() @IsBoolean() requires_approval?: boolean;
    @ApiPropertyOptional({ nullable: true }) @IsOptional() @ValidateIf((_, v) => v !== null) @IsUUID() branch_id?: string | null;
}

export class UpdateResourceDto extends PartialType(CreateResourceDto) { }

const csvUuids = z.preprocess((v) => (typeof v === 'string' ? v.split(',').filter(Boolean) : v), z.array(z.string().uuid()).min(1).max(30));

export const FreeBusyQuerySchema = z.object({
    membership_ids: csvUuids,
    from: z.string().datetime({ offset: true }),
    to: z.string().datetime({ offset: true }),
});
export type FreeBusyQuery = z.infer<typeof FreeBusyQuerySchema>;

export const SuggestQuerySchema = FreeBusyQuerySchema.extend({
    duration: z.coerce.number().int().min(5).max(480).optional().default(30),
    limit: z.coerce.number().int().min(1).max(50).optional().default(10),
});
export type SuggestQuery = z.infer<typeof SuggestQuerySchema>;

export const ResourceQuerySchema = z.object({
    kind: z.nativeEnum(CalendarResourceKind).optional(),
    search: z.string().trim().max(120).optional(),
    archived: z.preprocess((v) => v === 'true' || v === true, z.boolean()).optional(),
});
export type ResourceQuery = z.infer<typeof ResourceQuerySchema>;
