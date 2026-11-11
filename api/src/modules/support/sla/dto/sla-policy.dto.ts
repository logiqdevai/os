import { ApiProperty, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsBoolean, IsEnum, IsInt, IsNumber, IsObject, IsOptional, IsString, IsUUID, Max, MaxLength, Min, MinLength, ValidateNested } from 'class-validator';
import { TicketPriority } from 'generated/prisma';
import { z } from 'zod';

export class SlaTargetDto {
    @ApiProperty({ enum: TicketPriority })
    @IsEnum(TicketPriority)
    priority: TicketPriority;

    @ApiProperty({ required: false, nullable: true, description: 'Minutes; null = not tracked' })
    @IsOptional()
    @IsInt()
    @Min(1)
    @Max(525600)
    first_response_minutes?: number | null;

    @ApiProperty({ required: false, nullable: true })
    @IsOptional()
    @IsInt()
    @Min(1)
    @Max(525600)
    next_response_minutes?: number | null;

    @ApiProperty({ required: false, nullable: true })
    @IsOptional()
    @IsInt()
    @Min(1)
    @Max(525600)
    resolution_minutes?: number | null;
}

export class CreateSlaPolicyDto {
    @ApiProperty({ example: 'Premium clients' })
    @IsString()
    @MinLength(1)
    @MaxLength(120)
    name: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    @MaxLength(2000)
    description?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsBoolean()
    is_default?: boolean;

    @ApiProperty({ required: false, description: 'Count only organization business hours' })
    @IsOptional()
    @IsBoolean()
    use_business_hours?: boolean;

    @ApiProperty({ required: false, description: '{ categories, channel_types, company_ids, ticket_types, priorities } — empty = any' })
    @IsOptional()
    @IsObject()
    conditions?: Record<string, string[]>;

    @ApiProperty({ required: false, example: 80 })
    @IsOptional()
    @IsNumber()
    @Min(1)
    @Max(100)
    at_risk_threshold_percent?: number;

    @ApiProperty({ required: false, type: [String] })
    @IsOptional()
    @IsArray()
    @IsUUID('all', { each: true })
    escalation_rule_ids?: string[];

    @ApiProperty({ type: [SlaTargetDto] })
    @IsArray()
    @ArrayMaxSize(4)
    @ValidateNested({ each: true })
    @Type(() => SlaTargetDto)
    targets: SlaTargetDto[];
}

export class UpdateSlaPolicyDto extends PartialType(CreateSlaPolicyDto) { }

export const SlaPolicySchema = z.object({
    name: z.string().min(1).max(120),
    description: z.string().max(2000).optional(),
    is_default: z.boolean().optional(),
    use_business_hours: z.boolean().optional(),
    conditions: z.record(z.string(), z.array(z.string())).optional(),
    at_risk_threshold_percent: z.number().min(1).max(100).optional(),
    targets: z.array(z.object({
        priority: z.nativeEnum(TicketPriority),
        first_response_minutes: z.number().int().min(1).nullable().optional(),
        next_response_minutes: z.number().int().min(1).nullable().optional(),
        resolution_minutes: z.number().int().min(1).nullable().optional(),
    })).max(4),
});
