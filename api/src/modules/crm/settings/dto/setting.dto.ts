import { ApiProperty, PartialType } from '@nestjs/swagger';
import { ArrayMinSize, IsArray, IsBoolean, IsEnum, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';
import { CrmLossReasonScope } from 'generated/prisma';

export const SETTING_KINDS = ['lead-sources', 'lead-statuses', 'lifecycle-stages', 'loss-reasons'] as const;
export type SettingKind = (typeof SETTING_KINDS)[number];

/** One option of a CRM configuration list. Flags only apply to their own kind (ignored elsewhere). */
export class CreateSettingItemDto {
    @ApiProperty() @IsString() @MinLength(1) @MaxLength(80) name: string;
    @ApiProperty({ required: false, description: 'lead-statuses: semantic tone' }) @IsOptional() @IsString() @MaxLength(20) color?: string;
    @ApiProperty({ required: false, description: 'lead-sources, lead-statuses, lifecycle-stages' }) @IsOptional() @IsBoolean() is_default?: boolean;
    @ApiProperty({ required: false, description: 'lead-statuses' }) @IsOptional() @IsBoolean() is_converted?: boolean;
    @ApiProperty({ required: false, description: 'lead-statuses' }) @IsOptional() @IsBoolean() is_lost?: boolean;
    @ApiProperty({ required: false, description: 'lifecycle-stages' }) @IsOptional() @IsBoolean() is_customer?: boolean;
    @ApiProperty({ required: false, enum: CrmLossReasonScope, description: 'loss-reasons' }) @IsOptional() @IsEnum(CrmLossReasonScope) applies_to?: CrmLossReasonScope;
}

export class UpdateSettingItemDto extends PartialType(CreateSettingItemDto) { }

export class ReorderSettingDto {
    @ApiProperty({ type: [String] }) @IsArray() @ArrayMinSize(1) @IsUUID('4', { each: true }) ids: string[];
}
