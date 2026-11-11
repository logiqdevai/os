import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
    ArrayMaxSize, IsArray, IsBoolean, IsDateString, IsEmail, IsEnum, IsInt, IsNumber, IsOptional, IsString, IsUUID, Matches, Max, MaxLength, Min, MinLength, ValidateNested,
} from 'class-validator';
import {
    CompensationComponentKind, CompensationFrequency, EmployeeDocumentCategory, EmployeeDocumentStatus, EmployeeEquipmentCondition, EmployeeEquipmentType, EmployeePayType,
    EmployeeScheduleType, EmployeeWorkLocation, EmploymentType, HrNoteCategory, HrNoteSeverity, HrNoteVisibility, LanguageProficiency,
} from 'generated/prisma';

export class EmergencyContactDto {
    @ApiProperty() @IsString() @MinLength(1) @MaxLength(120) name: string;
    @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(60) relationship?: string;
    @ApiProperty() @IsString() @MinLength(3) @MaxLength(40) phone: string;
    @ApiPropertyOptional() @IsOptional() @IsEmail() email?: string;
    @ApiPropertyOptional() @IsOptional() @IsBoolean() is_primary?: boolean;
}
export class UpdateEmergencyContactDto extends PartialType(EmergencyContactDto) { }

export class CompensationComponentDto {
    @ApiProperty({ enum: CompensationComponentKind }) @IsEnum(CompensationComponentKind) kind: CompensationComponentKind;
    @ApiProperty() @IsString() @MaxLength(120) name: string;
    @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) amount?: number;
    @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) @Max(100) percent_of_base?: number;
    @ApiPropertyOptional({ enum: CompensationFrequency }) @IsOptional() @IsEnum(CompensationFrequency) frequency?: CompensationFrequency;
    @ApiPropertyOptional() @IsOptional() @IsBoolean() paid_to_employee?: boolean;
}

export class CompensationDto {
    @ApiProperty() @IsDateString() effective_from: string;
    @ApiProperty({ enum: EmploymentType }) @IsEnum(EmploymentType) employment_type: EmploymentType;
    @ApiProperty({ enum: EmployeePayType }) @IsEnum(EmployeePayType) pay_type: EmployeePayType;
    @ApiProperty({ example: 4200 }) @IsNumber() @Min(0) base_amount: number;
    @ApiProperty({ example: 'EUR' }) @Matches(/^[A-Z]{3}$/) currency: string;
    @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) employer_cost_monthly?: number;
    @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) cost_rate_hourly?: number;
    @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) billing_rate_default?: number;
    @ApiPropertyOptional() @IsOptional() @Matches(/^[A-Z]{3}$/) billing_currency?: string;
    @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) @Max(80) contracted_weekly_hours?: number;
    @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(2000) bonus_scheme?: string;
    @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(2000) commission_scheme?: string;
    @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500) reason?: string;
    @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(2000) notes?: string;
    @ApiPropertyOptional({ type: [CompensationComponentDto] }) @IsOptional() @IsArray() @ArrayMaxSize(30) @ValidateNested({ each: true }) @Type(() => CompensationComponentDto) components?: CompensationComponentDto[];
}

export class EquipmentDto {
    @ApiProperty({ enum: EmployeeEquipmentType }) @IsEnum(EmployeeEquipmentType) asset_type: EmployeeEquipmentType;
    @ApiProperty() @IsString() @MinLength(1) @MaxLength(120) name: string;
    @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(120) serial_number?: string;
    @ApiProperty() @IsDateString() assigned_on: string;
    @ApiPropertyOptional() @IsOptional() @IsDateString() expected_return_on?: string;
    @ApiPropertyOptional({ enum: EmployeeEquipmentCondition }) @IsOptional() @IsEnum(EmployeeEquipmentCondition) condition?: EmployeeEquipmentCondition;
    @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(2000) notes?: string;
}
export class UpdateEquipmentDto extends PartialType(EquipmentDto) {
    @ApiPropertyOptional() @IsOptional() @IsDateString() returned_on?: string;
}

export class EmployeeDocumentDto {
    @ApiProperty({ enum: EmployeeDocumentCategory }) @IsEnum(EmployeeDocumentCategory) category: EmployeeDocumentCategory;
    @ApiProperty() @IsString() @MinLength(1) @MaxLength(200) title: string;
    @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(2000) description?: string;
    @ApiPropertyOptional({ enum: EmployeeDocumentStatus }) @IsOptional() @IsEnum(EmployeeDocumentStatus) status?: EmployeeDocumentStatus;
    @ApiPropertyOptional({ description: '17 Document id of the file' }) @IsOptional() @IsUUID() document_id?: string;
    @ApiPropertyOptional() @IsOptional() @IsDateString() due_date?: string;
    @ApiPropertyOptional() @IsOptional() @IsDateString() valid_from?: string;
    @ApiPropertyOptional() @IsOptional() @IsDateString() expires_on?: string;
    @ApiPropertyOptional() @IsOptional() @IsBoolean() employee_visible?: boolean;
    @ApiPropertyOptional() @IsOptional() @IsBoolean() is_confidential?: boolean;
    @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(2000) note?: string;
}
export class UpdateEmployeeDocumentDto extends PartialType(EmployeeDocumentDto) {
    @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(1000) rejection_reason?: string;
}

export class HrNoteDto {
    @ApiPropertyOptional({ enum: HrNoteCategory }) @IsOptional() @IsEnum(HrNoteCategory) category?: HrNoteCategory;
    @ApiPropertyOptional({ enum: HrNoteVisibility }) @IsOptional() @IsEnum(HrNoteVisibility) visibility?: HrNoteVisibility;
    @ApiPropertyOptional({ enum: HrNoteSeverity }) @IsOptional() @IsEnum(HrNoteSeverity) severity?: HrNoteSeverity;
    @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(200) title?: string;
    @ApiProperty() @IsString() @MinLength(1) @MaxLength(20000) body: string;
    @ApiPropertyOptional() @IsOptional() @IsDateString() occurred_on?: string;
    @ApiPropertyOptional() @IsOptional() @IsBoolean() requires_acknowledgement?: boolean;
    @ApiPropertyOptional() @IsOptional() @IsBoolean() pinned?: boolean;
}
export class UpdateHrNoteDto extends PartialType(HrNoteDto) { }

export class LanguageDto {
    @ApiProperty({ example: 'Portuguese' }) @IsString() @MinLength(1) @MaxLength(60) language: string;
    @ApiPropertyOptional({ enum: LanguageProficiency }) @IsOptional() @IsEnum(LanguageProficiency) proficiency?: LanguageProficiency;
    @ApiPropertyOptional() @IsOptional() @IsBoolean() is_primary?: boolean;
}

export class ScheduleDayDto {
    @ApiProperty({ description: '0 = Sunday … 6 = Saturday' }) @IsInt() @Min(0) @Max(6) weekday: number;
    @ApiPropertyOptional({ example: '09:00' }) @IsOptional() @Matches(/^\d{2}:\d{2}$/) starts_at?: string;
    @ApiPropertyOptional({ example: '17:30' }) @IsOptional() @Matches(/^\d{2}:\d{2}$/) ends_at?: string;
    @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) @Max(240) break_minutes?: number;
    @ApiProperty() @IsNumber() @Min(0) @Max(24) hours: number;
    @ApiPropertyOptional({ enum: EmployeeWorkLocation }) @IsOptional() @IsEnum(EmployeeWorkLocation) work_location?: EmployeeWorkLocation;
}

export class WorkScheduleDto {
    @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(80) name?: string;
    @ApiPropertyOptional({ enum: EmployeeScheduleType }) @IsOptional() @IsEnum(EmployeeScheduleType) schedule_type?: EmployeeScheduleType;
    @ApiProperty() @IsDateString() effective_from: string;
    @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(60) timezone?: string;
    @ApiPropertyOptional({ enum: EmployeeWorkLocation }) @IsOptional() @IsEnum(EmployeeWorkLocation) work_location?: EmployeeWorkLocation;
    @ApiProperty({ type: [ScheduleDayDto] }) @IsArray() @ArrayMaxSize(7) @ValidateNested({ each: true }) @Type(() => ScheduleDayDto) days: ScheduleDayDto[];
}
