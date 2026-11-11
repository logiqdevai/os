import { ApiProperty } from '@nestjs/swagger';
import { ArrayMaxSize, IsArray, IsDateString, IsEnum, IsOptional, IsString, IsUUID, Matches, MaxLength, MinLength } from 'class-validator';
import { ScopeType } from 'generated/prisma';
import { z } from 'zod';
import { BaseListQuerySchema } from '@/shared/utils/pagination/pagination.utils';

export class CreateApiKeyDto {
    @ApiProperty({ example: 'Zapier sync' })
    @IsString()
    @MinLength(2)
    @MaxLength(80)
    name: string;

    @ApiProperty({ required: false, description: 'Owner service account; omit to own the key yourself' })
    @IsOptional()
    @IsUUID()
    service_account_id?: string;

    @ApiProperty({ type: [String], required: false, description: 'Permission keys or `prefix.*` globs that narrow the owner. Empty = the owner\'s full permissions.' })
    @IsOptional()
    @IsArray()
    @ArrayMaxSize(500)
    @Matches(/^[a-z0-9_.]+(\.\*)?$|^[a-z0-9_]+\.\*$/, { each: true, message: 'each scope must be a permission key or a prefix glob like crm.*' })
    scopes?: string[];

    @ApiProperty({ enum: ScopeType, required: false })
    @IsOptional()
    @IsEnum(ScopeType)
    scope_type?: ScopeType;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsUUID()
    scope_id?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsDateString()
    expires_at?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsDateString()
    rotation_due_at?: string;

    @ApiProperty({ type: [String], required: false, description: 'IPv4 addresses or CIDR ranges' })
    @IsOptional()
    @IsArray()
    @ArrayMaxSize(50)
    @Matches(/^\d{1,3}(\.\d{1,3}){3}(\/\d{1,2})?$/, { each: true, message: 'each range must be an IPv4 address or CIDR, e.g. 10.0.0.0/24' })
    allowed_ip_ranges?: string[];
}

export const ApiKeyQuerySchema = BaseListQuerySchema.extend({
    status: z.enum(['active', 'revoked', 'expired']).optional(),
    service_account_id: z.string().uuid().optional(),
});
export type ApiKeyQuery = z.infer<typeof ApiKeyQuerySchema>;
