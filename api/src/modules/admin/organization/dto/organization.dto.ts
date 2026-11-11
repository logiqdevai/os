import { ApiProperty, PartialType } from '@nestjs/swagger';
import { IsBoolean, IsEmail, IsInt, IsOptional, IsString, IsUrl, Matches, Max, MaxLength, Min, MinLength, ValidateIf } from 'class-validator';
import { z } from 'zod';

class OrganizationFieldsDto {
    @ApiProperty() @IsString() @MinLength(2) @MaxLength(200) legal_name: string;
    @ApiProperty() @IsString() @MinLength(2) @MaxLength(120) display_name: string;
    @ApiProperty() @IsString() @MaxLength(40) short_name: string;

    @ApiProperty()
    @ValidateIf((_, v) => v !== '')
    @IsUrl({ require_protocol: true }, { message: 'website must be a full URL (https://…)' })
    website: string;

    @ApiProperty() @IsString() @MaxLength(2) country: string;

    @ApiProperty()
    @ValidateIf((_, v) => v !== '')
    @IsEmail()
    contact_email: string;

    @ApiProperty() @IsString() @MaxLength(40) contact_phone: string;
    @ApiProperty({ example: 'EUR' }) @Matches(/^[A-Z]{3}$/, { message: 'default_currency must be a 3-letter ISO code' }) default_currency: string;
    @ApiProperty({ example: 'Europe/Athens' }) @IsString() @MaxLength(64) default_timezone: string;
    @ApiProperty({ example: 'en' }) @IsString() @MaxLength(16) default_language: string;
    @ApiProperty({ example: 'dd/MM/yyyy' }) @IsString() @MaxLength(32) date_format: string;
    @ApiProperty({ description: '1 = Monday … 7 = Sunday' }) @IsInt() @Min(1) @Max(7) week_start: number;
}

export class UpdateOrganizationDto extends PartialType(OrganizationFieldsDto) { }

export class UpdateBrandingDto {
    @ApiProperty({ required: false, example: '#2563eb' })
    @IsOptional()
    @ValidateIf((_, v) => v !== '')
    @Matches(/^#[0-9a-fA-F]{6}$/, { message: 'primary_color must be a hex color like #2563eb' })
    primary_color?: string;

    @ApiProperty({ required: false, example: '#0ea5e9' })
    @IsOptional()
    @ValidateIf((_, v) => v !== '')
    @Matches(/^#[0-9a-fA-F]{6}$/, { message: 'accent_color must be a hex color like #0ea5e9' })
    accent_color?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @ValidateIf((_, v) => v !== '')
    @IsUrl({ require_protocol: true }, { message: 'logo_url must be a full URL (https://…)' })
    logo_url?: string;

    @ApiProperty({ required: false, description: 'Logo for dark backgrounds' })
    @IsOptional()
    @ValidateIf((_, v) => v !== '')
    @IsUrl({ require_protocol: true }, { message: 'logo_dark_url must be a full URL (https://…)' })
    logo_dark_url?: string;

    @ApiProperty({ required: false, description: 'Footer text on customer-facing documents and emails' })
    @IsOptional()
    @IsString()
    @MaxLength(300)
    email_footer?: string;

    @ApiProperty({ required: false, description: 'Use the branding in the customer portal and documents' })
    @IsOptional()
    @IsBoolean()
    apply_to_portal?: boolean;
}

export class ModuleToggleDto {
    @ApiProperty()
    @IsBoolean()
    enabled: boolean;
}

export const UpdateOrganizationSchema = z.object({
    display_name: z.string().min(2).max(120).optional(),
    legal_name: z.string().min(2).max(200).optional(),
    website: z.string().url().optional(),
    contact_email: z.string().email().optional(),
    default_currency: z.string().regex(/^[A-Z]{3}$/).optional(),
    default_timezone: z.string().max(64).optional(),
});
