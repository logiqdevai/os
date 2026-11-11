import { ApiProperty, OmitType, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsBoolean, IsDateString, IsEnum, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min, MinLength, ValidateNested } from 'class-validator';
import { WikiChecklistAssigneeKind, WikiChecklistKind, WikiChecklistRunStatus } from 'generated/prisma';
import { z } from 'zod';
import { BaseListQuerySchema, boolish } from '@/shared/utils/pagination/pagination.utils';

export class ChecklistItemInputDto {
    @ApiProperty({ required: false, description: 'Existing item id (omit for a new item)' })
    @IsOptional()
    @IsUUID()
    id?: string;

    @ApiProperty()
    @IsString()
    @MinLength(1)
    @MaxLength(200)
    title: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    @MaxLength(2000)
    description?: string;

    @ApiProperty({ required: false, description: 'Required reading page' })
    @IsOptional()
    @IsUUID()
    page_id?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsBoolean()
    requires_acknowledgement?: boolean;

    @ApiProperty({ required: false, description: 'Form to fill' })
    @IsOptional()
    @IsUUID()
    form_id?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsInt()
    @Min(0)
    @Max(365)
    due_offset_days?: number;

    @ApiProperty({ enum: WikiChecklistAssigneeKind, required: false })
    @IsOptional()
    @IsEnum(WikiChecklistAssigneeKind)
    assignee_kind?: WikiChecklistAssigneeKind;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsUUID()
    assignee_membership_id?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsBoolean()
    is_required?: boolean;
}

export class CreateChecklistDto {
    @ApiProperty({ enum: WikiChecklistKind })
    @IsEnum(WikiChecklistKind)
    kind: WikiChecklistKind;

    @ApiProperty({ example: 'Developer onboarding' })
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
    @IsUUID()
    department_id?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsUUID()
    role_id?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsUUID()
    team_id?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsUUID()
    branch_id?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsUUID()
    guide_page_id?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsUUID()
    owner_membership_id?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsBoolean()
    auto_assign?: boolean;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsBoolean()
    is_active?: boolean;

    @ApiProperty({ type: [ChecklistItemInputDto], required: false })
    @IsOptional()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => ChecklistItemInputDto)
    items?: ChecklistItemInputDto[];
}

export class UpdateChecklistDto extends PartialType(OmitType(CreateChecklistDto, ['items'] as const)) { }

export class ReplaceChecklistItemsDto {
    @ApiProperty({ type: [ChecklistItemInputDto] })
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => ChecklistItemInputDto)
    items: ChecklistItemInputDto[];
}

export class StartChecklistRunDto {
    @ApiProperty()
    @IsUUID()
    subject_membership_id: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsDateString()
    due_at?: string;
}

export class SkipRunItemDto {
    @ApiProperty()
    @IsString()
    @MinLength(1)
    @MaxLength(500)
    reason: string;
}

export const ChecklistQuerySchema = BaseListQuerySchema.extend({
    kind: z.nativeEnum(WikiChecklistKind).optional(),
    department_id: z.string().uuid().optional(),
    role_id: z.string().uuid().optional(),
    is_active: boolish,
    archived: boolish,
});
export type ChecklistQuery = z.infer<typeof ChecklistQuerySchema>;

export const RunQuerySchema = BaseListQuerySchema.extend({
    status: z.nativeEnum(WikiChecklistRunStatus).optional(),
    checklist_id: z.string().uuid().optional(),
    subject_id: z.string().uuid().optional(),
    kind: z.nativeEnum(WikiChecklistKind).optional(),
    mine: boolish,
});
export type RunQuery = z.infer<typeof RunQuerySchema>;

export const StartChecklistRunSchema = z.object({
    checklist_id: z.string().uuid(),
    subject_membership_id: z.string().uuid(),
    due_at: z.string().optional(),
});
