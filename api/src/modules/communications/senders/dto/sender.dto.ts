import { ApiProperty, PartialType } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsOptional, IsString, IsUUID, Matches, MaxLength, MinLength } from 'class-validator';
import { CommChannel } from 'generated/prisma';
import { z } from 'zod';

export class CreateSenderDomainDto {
    @ApiProperty({ example: 'mail.agency.com' })
    @IsString()
    @Matches(/^(?=.{3,253}$)([a-z0-9-]+\.)+[a-z]{2,}$/i, { message: 'Enter a domain like mail.agency.com' })
    domain: string;

    @ApiProperty({ required: false, example: 'links.agency.com' })
    @IsOptional()
    @IsString()
    @MaxLength(253)
    tracking_domain?: string;
}

export class CreateSenderIdentityDto {
    @ApiProperty({ enum: CommChannel })
    @IsEnum(CommChannel)
    channel: CommChannel;

    @ApiProperty({ description: 'Email address, or E.164 number / alphanumeric sender id for SMS', example: 'hello@agency.com' })
    @IsString()
    @MinLength(3)
    @MaxLength(254)
    address: string;

    @ApiProperty({ required: false, example: 'Agency team' })
    @IsOptional()
    @IsString()
    @MaxLength(120)
    display_name?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    @MaxLength(254)
    reply_to_address?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsUUID()
    branch_id?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsBoolean()
    is_default?: boolean;
}

export class UpdateSenderIdentityDto extends PartialType(CreateSenderIdentityDto) { }

export const CreateSenderIdentitySchema = z.object({
    channel: z.nativeEnum(CommChannel),
    address: z.string().min(3).max(254),
    display_name: z.string().max(120).optional(),
    reply_to_address: z.string().max(254).optional(),
    branch_id: z.string().uuid().optional(),
    is_default: z.boolean().optional(),
});
