import { ApiProperty, ApiPropertyOptional, OmitType, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
    IsArray, IsBoolean, IsDateString, IsEmail, IsEnum, IsInt, IsNumber, IsObject, IsOptional, IsString, IsUUID, Max, MaxLength, Min, MinLength, ValidateNested,
} from 'class-validator';
import {
    EmployeeAvailabilityStatus, EmployeePositionChangeReason, EmployeeSeniorityLevel, EmployeeTerminationKind, EmployeeWorkLocation, EmploymentStatus, EmploymentType,
} from 'generated/prisma';
import { z } from 'zod';

export class NewHireDto {
    @ApiProperty({ example: 'ana.costa@logiqdev.test' }) @IsEmail() email: string;
    @ApiProperty({ example: 'Ana' }) @IsString() @MinLength(1) @MaxLength(80) first_name: string;
    @ApiProperty({ example: 'Costa' }) @IsString() @MinLength(1) @MaxLength(80) last_name: string;
}

export class CreateEmployeeDto {
    @ApiPropertyOptional({ description: 'Existing member to link (01 Membership). Either this or new_hire.' })
    @IsOptional() @IsUUID() membership_id?: string;

    @ApiPropertyOptional({ type: NewHireDto, description: 'Create a pending member for someone who has not joined yet.' })
    @IsOptional() @ValidateNested() @Type(() => NewHireDto) new_hire?: NewHireDto;

    @ApiPropertyOptional({ description: 'Allocated from number_sequences (EMP-0001) when omitted.' })
    @IsOptional() @IsString() @MaxLength(40) employee_number?: string;

    @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(120) preferred_name?: string;
    @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(120) legal_first_name?: string;
    @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(120) legal_last_name?: string;
    @ApiPropertyOptional() @IsOptional() @IsDateString() date_of_birth?: string;
    @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(40) gender?: string;
    @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(80) nationality?: string;
    @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(80) national_id_number?: string;
    @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(80) tax_id?: string;
    @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(80) social_security_number?: string;
    @ApiPropertyOptional() @IsOptional() @IsObject() bank_details?: Record<string, unknown>;
    @ApiPropertyOptional() @IsOptional() @IsEmail() work_email?: string;
    @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(40) work_phone?: string;
    @ApiPropertyOptional() @IsOptional() @IsEmail() personal_email?: string;
    @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(40) personal_phone?: string;
    @ApiPropertyOptional() @IsOptional() @IsObject() address?: Record<string, unknown>;

    @ApiPropertyOptional({ example: 'Senior Developer' }) @IsOptional() @IsString() @MaxLength(120) job_title?: string;
    @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(120) position?: string;
    @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(120) role?: string;
    @ApiPropertyOptional({ enum: EmployeeSeniorityLevel }) @IsOptional() @IsEnum(EmployeeSeniorityLevel) seniority_level?: EmployeeSeniorityLevel;
    @ApiPropertyOptional() @IsOptional() @IsUUID() department_team_id?: string;
    @ApiPropertyOptional() @IsOptional() @IsUUID() primary_branch_id?: string;
    @ApiPropertyOptional() @IsOptional() @IsUUID() manager_employee_id?: string;
    @ApiPropertyOptional({ enum: EmploymentStatus }) @IsOptional() @IsEnum(EmploymentStatus) employment_status?: EmploymentStatus;
    @ApiPropertyOptional({ enum: EmploymentType }) @IsOptional() @IsEnum(EmploymentType) employment_type?: EmploymentType;
    @ApiPropertyOptional({ enum: EmployeeWorkLocation }) @IsOptional() @IsEnum(EmployeeWorkLocation) work_location?: EmployeeWorkLocation;
    @ApiPropertyOptional() @IsOptional() @IsDateString() hire_date?: string;
    @ApiPropertyOptional() @IsOptional() @IsDateString() probation_end_date?: string;
    @ApiPropertyOptional() @IsOptional() @IsDateString() contract_end_date?: string;
    @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) @Max(365) notice_period_days?: number;
    @ApiPropertyOptional({ type: [String] }) @IsOptional() @IsArray() @IsString({ each: true }) responsibilities?: string[];
    @ApiPropertyOptional({ type: [String] }) @IsOptional() @IsArray() @IsString({ each: true }) areas_of_expertise?: string[];
    @ApiPropertyOptional({ type: [String] }) @IsOptional() @IsArray() @IsString({ each: true }) technical_stack?: string[];
    @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(4000) bio?: string;
    @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) @Max(80) weekly_capacity_hours?: number;
    @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) @Max(200) target_utilization_percent?: number;
    @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(60) timezone?: string;
    @ApiPropertyOptional() @IsOptional() @IsBoolean() directory_visible?: boolean;
}

export class UpdateEmployeeDto extends PartialType(OmitType(CreateEmployeeDto, ['membership_id', 'new_hire'] as const)) { }

/** Self-service edit: only fields in EmployeeHrSettings.self_service_editable_fields (or the default list). */
export class UpdateOwnProfileDto {
    @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(120) preferred_name?: string;
    @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(40) work_phone?: string;
    @ApiPropertyOptional() @IsOptional() @IsEmail() personal_email?: string;
    @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(40) personal_phone?: string;
    @ApiPropertyOptional() @IsOptional() @IsObject() address?: Record<string, unknown>;
    @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(4000) bio?: string;
    @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(60) timezone?: string;
    @ApiPropertyOptional({ type: [String] }) @IsOptional() @IsArray() @IsString({ each: true }) areas_of_expertise?: string[];
    @ApiPropertyOptional({ type: [String] }) @IsOptional() @IsArray() @IsString({ each: true }) technical_stack?: string[];
    @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500) availability_note?: string;
    @ApiPropertyOptional() @IsOptional() @IsObject() bank_details?: Record<string, unknown>;
    @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(80) nationality?: string;
    @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(40) gender?: string;
    @ApiPropertyOptional({ description: 'Note to HR when the change needs approval' }) @IsOptional() @IsString() @MaxLength(1000) employee_note?: string;
}

export class ChangePositionDto {
    @ApiProperty() @IsString() @MinLength(1) @MaxLength(120) job_title: string;
    @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(120) position?: string;
    @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(120) role?: string;
    @ApiPropertyOptional({ enum: EmployeeSeniorityLevel }) @IsOptional() @IsEnum(EmployeeSeniorityLevel) seniority_level?: EmployeeSeniorityLevel;
    @ApiPropertyOptional({ enum: EmploymentType }) @IsOptional() @IsEnum(EmploymentType) employment_type?: EmploymentType;
    @ApiPropertyOptional() @IsOptional() @IsUUID() department_team_id?: string;
    @ApiPropertyOptional() @IsOptional() @IsUUID() branch_id?: string;
    @ApiPropertyOptional({ nullable: true }) @IsOptional() @IsUUID() manager_employee_id?: string | null;
    @ApiProperty() @IsDateString() effective_from: string;
    @ApiPropertyOptional({ enum: EmployeePositionChangeReason }) @IsOptional() @IsEnum(EmployeePositionChangeReason) reason?: EmployeePositionChangeReason;
    @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(1000) note?: string;
}

export class StartOffboardingDto {
    @ApiProperty() @IsDateString() termination_date: string;
    @ApiProperty({ enum: EmployeeTerminationKind }) @IsEnum(EmployeeTerminationKind) termination_kind: EmployeeTerminationKind;
    @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(2000) termination_reason?: string;
    @ApiPropertyOptional() @IsOptional() @IsBoolean() rehire_eligible?: boolean;
}

export class SetAvailabilityDto {
    @ApiProperty({ enum: EmployeeAvailabilityStatus }) @IsEnum(EmployeeAvailabilityStatus) status: EmployeeAvailabilityStatus;
    @ApiPropertyOptional({ description: 'Start (ISO). Omit with ends_at to only set the current status.' }) @IsOptional() @IsDateString() starts_at?: string;
    @ApiPropertyOptional() @IsOptional() @IsDateString() ends_at?: string;
    @ApiPropertyOptional() @IsOptional() @IsBoolean() all_day?: boolean;
    @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500) note?: string;
}

export class DecideChangeRequestDto {
    @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(1000) decision_note?: string;
}

/** Zod twins for MCP tools (same rules as the class DTOs). */
export const CreateEmployeeSchema = z.object({
    membership_id: z.string().uuid().optional(),
    new_hire: z.object({ email: z.string().email(), first_name: z.string().min(1).max(80), last_name: z.string().min(1).max(80) }).optional(),
    employee_number: z.string().max(40).optional(),
    preferred_name: z.string().max(120).optional(),
    job_title: z.string().max(120).optional(),
    seniority_level: z.nativeEnum(EmployeeSeniorityLevel).optional(),
    department_team_id: z.string().uuid().optional(),
    primary_branch_id: z.string().uuid().optional(),
    manager_employee_id: z.string().uuid().optional(),
    employment_status: z.nativeEnum(EmploymentStatus).optional(),
    employment_type: z.nativeEnum(EmploymentType).optional(),
    work_location: z.nativeEnum(EmployeeWorkLocation).optional(),
    hire_date: z.string().date().optional(),
    work_email: z.string().email().optional(),
    weekly_capacity_hours: z.number().min(0).max(80).optional(),
});

export const UpdateEmployeeSchema = CreateEmployeeSchema.omit({ membership_id: true, new_hire: true }).extend({ id: z.string().uuid() });
