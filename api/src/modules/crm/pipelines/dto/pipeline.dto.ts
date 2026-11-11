import { ApiProperty, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsBoolean, IsEnum, IsInt, IsOptional, IsString, IsUUID, Length, Max, MaxLength, Min, MinLength, ValidateNested } from 'class-validator';
import { CrmForecastCategory } from 'generated/prisma';
import { z } from 'zod';

export class PipelineStageInputDto {
    @ApiProperty({ required: false, description: 'Existing stage id (omit for a new stage)' }) @IsOptional() @IsUUID() id?: string;
    @ApiProperty() @IsString() @MinLength(1) @MaxLength(80) name: string;
    @ApiProperty({ minimum: 0, maximum: 100 }) @IsInt() @Min(0) @Max(100) probability: number;
    @ApiProperty({ enum: CrmForecastCategory, required: false }) @IsOptional() @IsEnum(CrmForecastCategory) forecast_category?: CrmForecastCategory;
    @ApiProperty({ required: false }) @IsOptional() @IsBoolean() is_won?: boolean;
    @ApiProperty({ required: false }) @IsOptional() @IsBoolean() is_lost?: boolean;
    @ApiProperty({ required: false }) @IsOptional() @IsInt() @Min(1) @Max(365) stale_after_days?: number;
    @ApiProperty({ required: false, description: 'Semantic tone: neutral|info|success|warning|danger|violet' }) @IsOptional() @IsString() @MaxLength(20) color?: string;
}

export class CreatePipelineDto {
    @ApiProperty({ example: 'Retainers' }) @IsString() @MinLength(1) @MaxLength(80) name: string;
    @ApiProperty({ required: false }) @IsOptional() @IsString() @MaxLength(500) description?: string;
    @ApiProperty({ required: false }) @IsOptional() @IsString() @Length(3, 3) currency?: string;
    @ApiProperty({ required: false }) @IsOptional() @IsUUID() team_id?: string;
    @ApiProperty({ required: false }) @IsOptional() @IsBoolean() is_default?: boolean;
    @ApiProperty({ type: [PipelineStageInputDto], required: false, description: 'Defaults to the standard 8 stages' })
    @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => PipelineStageInputDto)
    stages?: PipelineStageInputDto[];
}

export class UpdatePipelineDto extends PartialType(CreatePipelineDto) { }

export class ReplaceStagesDto {
    @ApiProperty({ type: [PipelineStageInputDto], description: 'Ordered list; exactly one won and one lost stage' })
    @IsArray() @ArrayMinSize(3) @ValidateNested({ each: true }) @Type(() => PipelineStageInputDto)
    stages: PipelineStageInputDto[];
}

export const PipelineStageInputSchema = z.object({
    id: z.string().uuid().optional(),
    name: z.string().min(1).max(80),
    probability: z.number().int().min(0).max(100),
    forecast_category: z.nativeEnum(CrmForecastCategory).optional(),
    is_won: z.boolean().optional(),
    is_lost: z.boolean().optional(),
    stale_after_days: z.number().int().min(1).max(365).optional(),
    color: z.string().max(20).optional(),
});
export const CreatePipelineSchema = z.object({
    name: z.string().min(1).max(80),
    description: z.string().max(500).optional(),
    currency: z.string().length(3).optional(),
    team_id: z.string().uuid().optional(),
    is_default: z.boolean().optional(),
    stages: z.array(PipelineStageInputSchema).optional(),
});
