import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, IsUUID, MaxLength, ValidateIf } from 'class-validator';
import { z } from 'zod';

export class StartTimerDto {
    @ApiProperty({ required: false }) @IsOptional() @ValidateIf((_, v) => v !== null) @IsUUID() project_id?: string | null;
    @ApiProperty({ required: false }) @IsOptional() @ValidateIf((_, v) => v !== null) @IsUUID() task_id?: string | null;
    @ApiProperty({ required: false }) @IsOptional() @ValidateIf((_, v) => v !== null) @IsUUID() activity_type_id?: string | null;
    @ApiProperty({ required: false }) @IsOptional() @ValidateIf((_, v) => v !== null) @IsString() @MaxLength(2000) description?: string | null;
    @ApiProperty({ required: false }) @IsOptional() @ValidateIf((_, v) => v !== null) @IsBoolean() is_billable?: boolean | null;
    @ApiProperty({ required: false, description: 'Stop the running timer (saving it as an entry) before starting this one' }) @IsOptional() @IsBoolean() stop_current?: boolean;
    @ApiProperty({ required: false }) @IsOptional() @IsString() @MaxLength(80) device?: string;
}

export class UpdateTimerDto {
    @ApiProperty({ required: false }) @IsOptional() @ValidateIf((_, v) => v !== null) @IsUUID() project_id?: string | null;
    @ApiProperty({ required: false }) @IsOptional() @ValidateIf((_, v) => v !== null) @IsUUID() task_id?: string | null;
    @ApiProperty({ required: false }) @IsOptional() @ValidateIf((_, v) => v !== null) @IsUUID() activity_type_id?: string | null;
    @ApiProperty({ required: false }) @IsOptional() @ValidateIf((_, v) => v !== null) @IsString() @MaxLength(2000) description?: string | null;
    @ApiProperty({ required: false }) @IsOptional() @ValidateIf((_, v) => v !== null) @IsBoolean() is_billable?: boolean | null;
}

export const StartTimerSchema = z.object({
    project_id: z.string().uuid().nullable().optional(),
    task_id: z.string().uuid().nullable().optional(),
    activity_type_id: z.string().uuid().nullable().optional(),
    description: z.string().max(2000).nullable().optional(),
    is_billable: z.boolean().nullable().optional(),
    stop_current: z.boolean().optional(),
});
