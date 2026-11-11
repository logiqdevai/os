import { ApiProperty, PartialType } from '@nestjs/swagger';
import { ArrayMaxSize, IsArray, IsBoolean, IsEnum, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';
import { SupportIncidentSeverity, SupportIncidentStatus, SupportIncidentUpdateStatus } from 'generated/prisma';
import { z } from 'zod';
import { BaseListQuerySchema } from '@/shared/utils/pagination/pagination.utils';

export const IncidentQuerySchema = BaseListQuerySchema.extend({
    status: z.nativeEnum(SupportIncidentStatus).optional(),
    severity: z.nativeEnum(SupportIncidentSeverity).optional(),
});
export type IncidentQuery = z.infer<typeof IncidentQuerySchema>;

export class CreateIncidentDto {
    @ApiProperty({ example: 'Checkout errors for EU customers' })
    @IsString()
    @MinLength(1)
    @MaxLength(200)
    title: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    @MaxLength(10000)
    description?: string;

    @ApiProperty({ required: false, enum: SupportIncidentSeverity })
    @IsOptional()
    @IsEnum(SupportIncidentSeverity)
    severity?: SupportIncidentSeverity;

    @ApiProperty({ required: false, type: [String] })
    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    affected_services?: string[];

    @ApiProperty({ required: false, type: [String] })
    @IsOptional()
    @IsArray()
    @ArrayMaxSize(500)
    @IsUUID('all', { each: true })
    ticket_ids?: string[];

    @ApiProperty({ required: false })
    @IsOptional()
    @IsUUID()
    owner_membership_id?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsUUID()
    project_id?: string;
}

export class UpdateIncidentDto extends PartialType(CreateIncidentDto) {
    @ApiProperty({ required: false, enum: SupportIncidentStatus })
    @IsOptional()
    @IsEnum(SupportIncidentStatus)
    status?: SupportIncidentStatus;
}

export class IncidentTicketsDto {
    @ApiProperty({ type: [String] })
    @IsArray()
    @ArrayMaxSize(500)
    @IsUUID('all', { each: true })
    ticket_ids: string[];
}

export class IncidentUpdateDto {
    @ApiProperty({ enum: SupportIncidentUpdateStatus })
    @IsEnum(SupportIncidentUpdateStatus)
    status: SupportIncidentUpdateStatus;

    @ApiProperty()
    @IsString()
    @MinLength(1)
    @MaxLength(10000)
    body: string;

    @ApiProperty({ required: false, description: 'Shown in the customer portal (needs support.incidents.publish)' })
    @IsOptional()
    @IsBoolean()
    customer_visible?: boolean;
}
