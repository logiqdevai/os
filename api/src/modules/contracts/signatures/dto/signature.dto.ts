import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMaxSize, Equals, IsArray, IsBoolean, IsEmail, IsEnum, IsIn, IsInt, IsObject, IsOptional, IsString, IsUUID, Matches, Max, MaxLength, Min, MinLength, ValidateNested } from 'class-validator';
import { SignatureRequestStatus, SigningOrder } from 'generated/prisma';
import { z } from 'zod';
import { BaseListQuerySchema, csv } from '@/shared/utils/pagination/pagination.utils';

export class SignerInputDto {
    @ApiProperty({ required: false, description: 'Contract signatory this signer represents' }) @IsOptional() @IsUUID() signatory_id?: string;
    @ApiProperty() @IsString() @MinLength(1) @MaxLength(160) name: string;
    @ApiProperty() @IsEmail() email: string;
    @ApiProperty({ required: false }) @IsOptional() @IsString() @MaxLength(120) title?: string;
    @ApiProperty({ required: false }) @IsOptional() @IsString() @MaxLength(20) phone?: string;
    @ApiProperty({ required: false, description: 'Signing position (sequential); equal values sign in parallel' }) @IsOptional() @IsInt() @Min(1) @Max(20) order?: number;
}

export class CreateSignatureRequestDto {
    @ApiProperty({ enum: SigningOrder, required: false }) @IsOptional() @IsEnum(SigningOrder) signing_order?: SigningOrder;
    @ApiProperty({ type: [SignerInputDto], required: false, description: 'Defaults to the required signatories of the contract parties' })
    @IsOptional() @IsArray() @ArrayMaxSize(20) @ValidateNested({ each: true }) @Type(() => SignerInputDto) signers?: SignerInputDto[];
    @ApiProperty({ required: false }) @IsOptional() @IsString() @MaxLength(4000) message?: string;
    @ApiProperty({ required: false, description: 'Days until the request expires (default 30)' }) @IsOptional() @IsInt() @Min(1) @Max(180) expires_in_days?: number;
    @ApiProperty({ required: false, description: '{ frequency_days, max_reminders }' }) @IsOptional() @IsObject() reminder_settings?: Record<string, unknown>;
}

export class CancelSignatureRequestDto {
    @ApiProperty({ required: false }) @IsOptional() @IsString() @MaxLength(1000) reason?: string;
}

// --- Public signing ---------------------------------------------------------------------

export class SendCodeDto {
    @ApiProperty({ enum: ['EMAIL', 'SMS'], required: false, description: 'Default: SMS when the signer has a phone and the organization has a Twilio connection, else email' }) @IsOptional() @IsIn(['EMAIL', 'SMS']) channel?: 'EMAIL' | 'SMS';
}

export class VerifyCodeDto {
    @ApiProperty({ example: '482913' }) @Matches(/^\d{6}$/, { message: 'Enter the 6-digit code' }) code: string;
}

export class SignDto {
    @ApiProperty({ enum: ['TYPED', 'DRAWN'] }) @IsIn(['TYPED', 'DRAWN']) signature_type: 'TYPED' | 'DRAWN';
    @ApiProperty({ required: false }) @IsOptional() @IsString() @MinLength(2) @MaxLength(160) typed_name?: string;
    @ApiProperty({ required: false, description: 'PNG data URL of the drawn signature' }) @IsOptional() @IsString() @MaxLength(400_000) signature_data_url?: string;
    @ApiProperty() @IsBoolean() @Equals(true, { message: 'You must accept the electronic signature terms' }) consent_accepted: boolean;
    @ApiProperty() @IsUUID() consent_text_id: string;
}

export class DeclineDto {
    @ApiProperty() @IsString() @MinLength(2) @MaxLength(2000) reason: string;
}

export const SignatureRequestQuerySchema = BaseListQuerySchema.extend({
    status: csv(z.nativeEnum(SignatureRequestStatus)),
    contract_id: z.string().uuid().optional(),
});
export type SignatureRequestQuery = z.infer<typeof SignatureRequestQuerySchema>;

export const SendSignatureSchema = z.object({
    contract_id: z.string().uuid(),
    version_id: z.string().uuid(),
    signing_order: z.nativeEnum(SigningOrder).optional(),
    message: z.string().max(4000).optional(),
    expires_in_days: z.number().int().min(1).max(180).optional(),
});
