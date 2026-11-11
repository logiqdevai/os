import { ApiProperty, PartialType } from '@nestjs/swagger';
import { IsBoolean, IsEmail, IsEnum, IsInt, IsOptional, IsString, IsUUID, Matches, Max, MaxLength, Min, MinLength, ValidateIf } from 'class-validator';
import { BranchKind, BranchStatus } from 'generated/prisma';
import { z } from 'zod';
import { BaseListQuerySchema, boolish } from '@/shared/utils/pagination/pagination.utils';

export class CreateBranchDto {
    @ApiProperty({ example: 'Athens office' })
    @IsString()
    @MinLength(1)
    @MaxLength(120)
    name: string;

    @ApiProperty({ required: false, example: 'ATH' })
    @IsOptional()
    @Matches(/^[A-Za-z0-9_-]{1,20}$/, { message: 'code must be 1–20 letters, digits, - or _' })
    code?: string;

    @ApiProperty({ enum: BranchKind, required: false })
    @IsOptional()
    @IsEnum(BranchKind)
    kind?: BranchKind;

    @ApiProperty({ enum: BranchStatus, required: false })
    @IsOptional()
    @IsEnum(BranchStatus)
    status?: BranchStatus;

    @ApiProperty({ required: false, nullable: true })
    @IsOptional()
    @ValidateIf((_, v) => v !== null)
    @IsUUID()
    parent_branch_id?: string | null;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsBoolean()
    is_headquarters?: boolean;

    @ApiProperty({ required: false, example: 'GR' })
    @IsOptional()
    @IsString()
    @MaxLength(2)
    country?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    @MaxLength(120)
    region?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    @MaxLength(120)
    city?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    @MaxLength(40)
    phone?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @ValidateIf((_, v) => v !== '')
    @IsEmail()
    email?: string;

    @ApiProperty({ required: false, example: 'Europe/Athens' })
    @IsOptional()
    @IsString()
    @MaxLength(64)
    timezone?: string;

    @ApiProperty({ required: false, example: 'EUR' })
    @IsOptional()
    @Matches(/^[A-Z]{3}$/, { message: 'currency must be a 3-letter ISO code' })
    currency?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    @MaxLength(40)
    cost_center_code?: string;

    @ApiProperty({ required: false, description: '1 = Monday … 7 = Sunday' })
    @IsOptional()
    @IsInt()
    @Min(1)
    @Max(7)
    week_start?: number;
}

export class UpdateBranchDto extends PartialType(CreateBranchDto) { }

export const CreateBranchSchema = z.object({
    name: z.string().min(1).max(120),
    code: z.string().regex(/^[A-Za-z0-9_-]{1,20}$/).optional(),
    kind: z.nativeEnum(BranchKind).optional(),
    parent_branch_id: z.string().uuid().optional(),
    country: z.string().max(2).optional(),
    city: z.string().max(120).optional(),
    timezone: z.string().max(64).optional(),
});

export const BranchQuerySchema = BaseListQuerySchema.extend({
    status: z.nativeEnum(BranchStatus).optional(),
    kind: z.nativeEnum(BranchKind).optional(),
    archived: boolish,
    limit: z.coerce.number().int().min(1).max(500).optional().default(200),
});
export type BranchQuery = z.infer<typeof BranchQuerySchema>;
