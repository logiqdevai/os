import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsObject, IsOptional, IsString, IsUUID, MaxLength, MinLength, ValidateIf } from 'class-validator';
import { IntegrationCategory, IntegrationMode, IntegrationProvider, IntegrationStatus } from 'generated/prisma';
import { z } from 'zod';
import { BaseListQuerySchema } from '@/shared/utils/pagination/pagination.utils';

export class CreateIntegrationDto {
    @ApiProperty({ enum: IntegrationProvider })
    @IsEnum(IntegrationProvider)
    provider: IntegrationProvider;

    @ApiProperty({ example: 'OpenAI production' })
    @IsString()
    @MinLength(2)
    @MaxLength(80)
    name: string;

    @ApiProperty({ enum: IntegrationMode, required: false })
    @IsOptional()
    @IsEnum(IntegrationMode)
    mode?: IntegrationMode;

    @ApiProperty({ description: 'Secret fields of the provider (write-only, stored encrypted)', example: { api_key: 'sk-…' } })
    @IsObject()
    secrets: Record<string, string>;

    @ApiProperty({ required: false, description: 'Non-secret settings of the provider' })
    @IsOptional()
    @IsObject()
    config?: Record<string, string>;

    @ApiProperty({ required: false, description: 'Restrict to one branch' })
    @IsOptional()
    @IsUUID()
    branch_id?: string;

    @ApiProperty({ required: false, description: 'Make it the default connection of its category' })
    @IsOptional()
    @IsBoolean()
    make_default?: boolean;
}

export class UpdateIntegrationDto {
    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    @MinLength(2)
    @MaxLength(80)
    name?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsObject()
    config?: Record<string, string>;

    @ApiProperty({ required: false, nullable: true })
    @IsOptional()
    @ValidateIf((_, v) => v !== null)
    @IsUUID()
    branch_id?: string | null;

    @ApiProperty({ required: false, description: 'e.g. { monthly_spend_limit_usd, requests_per_minute }' })
    @IsOptional()
    @IsObject()
    usage_limits?: Record<string, number>;
}

export class ReplaceSecretsDto {
    @ApiProperty({ description: 'New secret values (only the fields being replaced)' })
    @IsObject()
    secrets: Record<string, string>;
}

export const IntegrationQuerySchema = BaseListQuerySchema.extend({
    category: z.nativeEnum(IntegrationCategory).optional(),
    provider: z.nativeEnum(IntegrationProvider).optional(),
    status: z.nativeEnum(IntegrationStatus).optional(),
    include_disconnected: z.preprocess((v) => v === 'true', z.boolean()).optional(),
});
export type IntegrationQuery = z.infer<typeof IntegrationQuerySchema>;
