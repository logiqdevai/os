import { ApiProperty, PartialType } from '@nestjs/swagger';
import { IsDateString, IsEnum, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';
import { ScopeType, ServiceAccountStatus } from 'generated/prisma';
import { z } from 'zod';
import { BaseListQuerySchema } from '@/shared/utils/pagination/pagination.utils';

class ServiceAccountFieldsDto {
    @ApiProperty({ example: 'Support triage agent' })
    @IsString()
    @MinLength(2)
    @MaxLength(80)
    name: string;

    @ApiProperty({ required: false, example: 'Classifies new tickets and drafts replies' })
    @IsOptional()
    @IsString()
    @MaxLength(500)
    purpose?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsDateString()
    expires_at?: string;

    @ApiProperty({ required: false, description: 'Responsible member (defaults to you)' })
    @IsOptional()
    @IsUUID()
    owner_membership_id?: string;
}

export class CreateServiceAccountDto extends ServiceAccountFieldsDto {
    @ApiProperty({ required: false, description: 'Role to assign right away' })
    @IsOptional()
    @IsUUID()
    role_id?: string;

    @ApiProperty({ enum: ScopeType, required: false })
    @IsOptional()
    @IsEnum(ScopeType)
    scope_type?: ScopeType;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsUUID()
    scope_id?: string;
}

export class UpdateServiceAccountDto extends PartialType(ServiceAccountFieldsDto) { }

export class ServiceAccountRoleDto {
    @ApiProperty()
    @IsUUID()
    role_id: string;

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
    valid_until?: string;
}

export const ServiceAccountQuerySchema = BaseListQuerySchema.extend({
    status: z.nativeEnum(ServiceAccountStatus).optional(),
});
export type ServiceAccountQuery = z.infer<typeof ServiceAccountQuerySchema>;
