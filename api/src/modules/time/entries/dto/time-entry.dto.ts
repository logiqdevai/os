import { ApiProperty, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsBoolean, IsDateString, IsEnum, IsInt, IsObject, IsOptional, IsString, IsUUID, Matches, Max, MaxLength, Min, MinLength, ValidateIf, ValidateNested } from 'class-validator';
import { TimeNonBillableCategory } from 'generated/prisma';
import { z } from 'zod';

const DATE = /^\d{4}-\d{2}-\d{2}$/;

export class CreateTimeEntryDto {
    @ApiProperty({ example: '2026-11-11' }) @Matches(DATE, { message: 'date must be YYYY-MM-DD' }) date: string;
    @ApiProperty({ required: false, description: 'ISO date-time; with end_at the duration is computed' }) @IsOptional() @IsDateString() start_at?: string;
    @ApiProperty({ required: false }) @IsOptional() @IsDateString() end_at?: string;
    @ApiProperty({ required: false, example: 90 }) @IsOptional() @IsInt() @Min(1) @Max(1440) duration_minutes?: number;
    @ApiProperty({ required: false }) @IsOptional() @ValidateIf((_, v) => v !== null) @IsUUID() project_id?: string | null;
    @ApiProperty({ required: false }) @IsOptional() @ValidateIf((_, v) => v !== null) @IsUUID() task_id?: string | null;
    @ApiProperty({ required: false }) @IsOptional() @ValidateIf((_, v) => v !== null) @IsUUID() activity_type_id?: string | null;
    @ApiProperty({ required: false }) @IsOptional() @ValidateIf((_, v) => v !== null) @IsString() @MaxLength(2000) description?: string | null;
    @ApiProperty({ required: false, description: 'Omit to use the default (activity → project → organization)' }) @IsOptional() @IsBoolean() is_billable?: boolean;
    @ApiProperty({ required: false }) @IsOptional() @IsString() @MaxLength(500) billable_override_reason?: string;
    @ApiProperty({ enum: TimeNonBillableCategory, required: false }) @IsOptional() @ValidateIf((_, v) => v !== null) @IsEnum(TimeNonBillableCategory) non_billable_category?: TimeNonBillableCategory | null;
    @ApiProperty({ required: false, description: 'Log for another member (time.entries.create_team)' }) @IsOptional() @IsUUID() membership_id?: string;
}

export class UpdateTimeEntryDto extends PartialType(CreateTimeEntryDto) { }

export class ReasonDto {
    @ApiProperty() @IsString() @MinLength(3) @MaxLength(1000) reason: string;
}

export class OptionalReasonDto {
    @ApiProperty({ required: false }) @IsOptional() @IsString() @MaxLength(1000) reason?: string;
}

export class WeekGridRowDto {
    @ApiProperty({ required: false }) @IsOptional() @ValidateIf((_, v) => v !== null) @IsUUID() project_id?: string | null;
    @ApiProperty({ required: false }) @IsOptional() @ValidateIf((_, v) => v !== null) @IsUUID() task_id?: string | null;
    @ApiProperty({ required: false }) @IsOptional() @ValidateIf((_, v) => v !== null) @IsUUID() activity_type_id?: string | null;
    @ApiProperty() @IsBoolean() is_billable: boolean;
    @ApiProperty({ required: false }) @IsOptional() @IsString() @MaxLength(2000) description?: string;
    @ApiProperty({ description: '{ "2026-11-09": 120, … } — minutes per day; 0 removes the cell', example: { '2026-11-09': 120 } }) @IsObject() days: Record<string, number>;
}

export class WeekGridDto {
    @ApiProperty({ example: '2026-11-09' }) @Matches(DATE) period_start: string;
    @ApiProperty({ required: false, description: 'Another member (time.entries.update_team + create_team)' }) @IsOptional() @IsUUID() membership_id?: string;
    @ApiProperty({ type: [WeekGridRowDto] }) @IsArray() @ArrayMaxSize(100) @ValidateNested({ each: true }) @Type(() => WeekGridRowDto) rows: WeekGridRowDto[];
}

export class MarkInvoicedDto {
    @ApiProperty({ type: [String] }) @IsArray() @ArrayMaxSize(1000) @IsUUID('all', { each: true }) entry_ids: string[];
    @ApiProperty() @IsUUID() invoice_id: string;
    @ApiProperty({ required: false }) @IsOptional() @IsUUID() invoice_line_item_id?: string;
}

const nullableUuid = z.string().uuid().nullable().optional();

/** Zod twin of CreateTimeEntryDto for MCP tools. */
export const CreateTimeEntrySchema = z.object({
    date: z.string().regex(DATE),
    start_at: z.string().datetime().optional(),
    end_at: z.string().datetime().optional(),
    duration_minutes: z.number().int().min(1).max(1440).optional(),
    project_id: nullableUuid,
    task_id: nullableUuid,
    activity_type_id: nullableUuid,
    description: z.string().max(2000).nullable().optional(),
    is_billable: z.boolean().optional(),
    billable_override_reason: z.string().max(500).optional(),
    non_billable_category: z.nativeEnum(TimeNonBillableCategory).nullable().optional(),
    membership_id: z.string().uuid().optional(),
});

export const UpdateTimeEntrySchema = CreateTimeEntrySchema.partial().extend({ id: z.string().uuid() });
