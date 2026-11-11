import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsEnum, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';
import { AttendanceBreakKind, AttendanceSource, AttendanceStatus, EmployeeWorkLocation } from 'generated/prisma';
import { z } from 'zod';
import { BaseListQuerySchema } from '@/shared/utils/pagination/pagination.utils';

export class ClockInDto {
    @ApiPropertyOptional({ enum: EmployeeWorkLocation }) @IsOptional() @IsEnum(EmployeeWorkLocation) work_location?: EmployeeWorkLocation;
    @ApiPropertyOptional({ enum: AttendanceSource }) @IsOptional() @IsEnum(AttendanceSource) source?: AttendanceSource;
    @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500) note?: string;
}

export class ClockOutDto {
    @ApiPropertyOptional({ enum: AttendanceSource }) @IsOptional() @IsEnum(AttendanceSource) source?: AttendanceSource;
    @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500) note?: string;
}

export class BreakDto {
    @ApiPropertyOptional({ enum: AttendanceBreakKind }) @IsOptional() @IsEnum(AttendanceBreakKind) kind?: AttendanceBreakKind;
}

export class ManualAttendanceDto {
    @ApiProperty() @IsUUID() employee_id: string;
    @ApiProperty() @IsDateString() clock_in_at: string;
    @ApiProperty() @IsDateString() clock_out_at: string;
    @ApiPropertyOptional({ enum: EmployeeWorkLocation }) @IsOptional() @IsEnum(EmployeeWorkLocation) work_location?: EmployeeWorkLocation;
    @ApiProperty({ description: 'Why the record is entered by hand (audited)' }) @IsString() @MinLength(3) @MaxLength(500) reason: string;
}

export class EditSessionDto {
    @ApiPropertyOptional() @IsOptional() @IsDateString() clock_in_at?: string;
    @ApiPropertyOptional() @IsOptional() @IsDateString() clock_out_at?: string;
    @ApiProperty() @IsString() @MinLength(3) @MaxLength(500) reason: string;
}

export class EditRecordDto {
    @ApiPropertyOptional({ enum: AttendanceStatus }) @IsOptional() @IsEnum(AttendanceStatus) status?: AttendanceStatus;
    @ApiPropertyOptional({ enum: EmployeeWorkLocation }) @IsOptional() @IsEnum(EmployeeWorkLocation) work_location?: EmployeeWorkLocation;
    @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(1000) note?: string;
    @ApiProperty() @IsString() @MinLength(3) @MaxLength(500) reason: string;
}

export const AttendanceQuerySchema = BaseListQuerySchema.extend({
    from: z.string().date().optional(),
    to: z.string().date().optional(),
    employee_id: z.string().uuid().optional(),
    status: z.nativeEnum(AttendanceStatus).optional(),
    team_id: z.string().uuid().optional(),
});
export type AttendanceQuery = z.infer<typeof AttendanceQuerySchema>;

export const AttendanceBoardQuerySchema = z.object({ date: z.string().date().optional(), team_id: z.string().uuid().optional() });
export type AttendanceBoardQuery = z.infer<typeof AttendanceBoardQuerySchema>;
