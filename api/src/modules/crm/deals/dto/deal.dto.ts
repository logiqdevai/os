import { ApiProperty, OmitType, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsBoolean, IsDateString, IsInt, IsNumber, IsOptional, IsString, IsUUID, Length, Max, MaxLength, Min, MinLength, ValidateNested } from 'class-validator';
import { CrmDealStatus } from 'generated/prisma';
import { z } from 'zod';
import { BaseListQuerySchema, boolish, csv } from '@/shared/utils/pagination/pagination.utils';

export class CreateDealDto {
    @ApiProperty({ example: 'Acme — website redesign' }) @IsString() @MinLength(1) @MaxLength(200) name: string;
    @ApiProperty({ required: false, description: 'Defaults to the default pipeline' }) @IsOptional() @IsUUID() pipeline_id?: string;
    @ApiProperty({ required: false, description: 'Defaults to the first stage' }) @IsOptional() @IsUUID() stage_id?: string;
    @ApiProperty({ required: false }) @IsOptional() @IsUUID() company_id?: string;
    @ApiProperty({ required: false }) @IsOptional() @IsUUID() primary_contact_id?: string;
    @ApiProperty({ required: false, description: 'Defaults to the caller' }) @IsOptional() @IsUUID() owner_membership_id?: string;
    @ApiProperty({ required: false }) @IsOptional() @IsUUID() secondary_owner_membership_id?: string;
    @ApiProperty({ required: false }) @IsOptional() @IsUUID() project_manager_membership_id?: string;
    @ApiProperty({ required: false }) @IsOptional() @IsUUID() team_id?: string;
    @ApiProperty({ required: false }) @IsOptional() @IsUUID() branch_id?: string;
    @ApiProperty({ required: false, description: 'Ignored once line items exist (totals derive from them)' }) @IsOptional() @IsNumber() @Min(0) value?: number;
    @ApiProperty({ required: false }) @IsOptional() @IsString() @Length(3, 3) currency?: string;
    @ApiProperty({ required: false }) @IsOptional() @IsInt() @Min(0) @Max(100) probability?: number;
    @ApiProperty({ required: false, example: '2026-12-31' }) @IsOptional() @IsDateString() expected_close_date?: string;
    @ApiProperty({ required: false, example: 'new_business' }) @IsOptional() @IsString() @MaxLength(60) deal_type?: string;
    @ApiProperty({ required: false }) @IsOptional() @IsUUID() lead_source_id?: string;
    @ApiProperty({ required: false }) @IsOptional() @IsString() @MaxLength(120) competitor?: string;
    @ApiProperty({ required: false }) @IsOptional() @IsString() @MaxLength(500) next_step?: string;
    @ApiProperty({ required: false }) @IsOptional() @IsString() @MaxLength(5000) description?: string;
    @ApiProperty({ required: false, type: [String], description: 'Additional contacts' }) @IsOptional() @IsArray() @IsUUID('4', { each: true }) contact_ids?: string[];
}

export class UpdateDealDto extends PartialType(OmitType(CreateDealDto, ['pipeline_id', 'stage_id', 'contact_ids'] as const)) { }

export class ChangeStageDto {
    @ApiProperty() @IsUUID() stage_id: string;
    @ApiProperty({ required: false, description: 'Override the stage default probability' }) @IsOptional() @IsInt() @Min(0) @Max(100) probability?: number;
    @ApiProperty({ required: false, description: 'Required when moving to the lost stage' }) @IsOptional() @IsUUID() lost_reason_id?: string;
    @ApiProperty({ required: false }) @IsOptional() @IsString() @MaxLength(1000) lost_reason?: string;
    @ApiProperty({ required: false }) @IsOptional() @IsString() @MaxLength(120) competitor?: string;
    @ApiProperty({ required: false }) @IsOptional() @IsString() @MaxLength(1000) won_note?: string;
    @ApiProperty({ required: false }) @IsOptional() @IsDateString() actual_close_date?: string;
    @ApiProperty({ required: false, description: 'Won: mark a prospect company as customer (default true)' }) @IsOptional() @IsBoolean() set_customer?: boolean;
}

export class WonDealDto {
    @ApiProperty({ required: false }) @IsOptional() @IsString() @MaxLength(1000) won_note?: string;
    @ApiProperty({ required: false }) @IsOptional() @IsDateString() actual_close_date?: string;
    @ApiProperty({ required: false }) @IsOptional() @IsBoolean() set_customer?: boolean;
}

export class LostDealDto {
    @ApiProperty() @IsUUID() lost_reason_id: string;
    @ApiProperty({ required: false }) @IsOptional() @IsString() @MaxLength(1000) lost_reason?: string;
    @ApiProperty({ required: false }) @IsOptional() @IsString() @MaxLength(120) competitor?: string;
    @ApiProperty({ required: false }) @IsOptional() @IsDateString() actual_close_date?: string;
}

export class ReopenDealDto {
    @ApiProperty({ required: false, description: 'Open stage to return to (defaults to the last open stage)' }) @IsOptional() @IsUUID() stage_id?: string;
}

export class LineItemInputDto {
    @ApiProperty({ required: false }) @IsOptional() @IsUUID() product_id?: string;
    @ApiProperty() @IsString() @MinLength(1) @MaxLength(200) name: string;
    @ApiProperty({ required: false }) @IsOptional() @IsString() @MaxLength(2000) description?: string;
    @ApiProperty() @IsNumber() @Min(0) quantity: number;
    @ApiProperty() @IsNumber() @Min(0) unit_price: number;
    @ApiProperty({ required: false }) @IsOptional() @IsNumber() @Min(0) @Max(100) discount_percent?: number;
    @ApiProperty({ required: false }) @IsOptional() @IsNumber() @Min(0) @Max(100) tax_percent?: number;
    @ApiProperty({ required: false }) @IsOptional() @IsBoolean() is_recurring?: boolean;
    @ApiProperty({ required: false, description: 'monthly | quarterly | annual | custom' }) @IsOptional() @IsString() @MaxLength(20) billing_frequency?: string;
}

export class ReplaceLineItemsDto {
    @ApiProperty({ type: [LineItemInputDto] }) @IsArray() @ValidateNested({ each: true }) @Type(() => LineItemInputDto) items: LineItemInputDto[];
    @ApiProperty({ required: false, description: 'Order-level discount %; above your policy limit needs crm.deals.approve_discount' }) @IsOptional() @IsNumber() @Min(0) @Max(100) discount_percent?: number;
}

export class DealContactDto {
    @ApiProperty() @IsUUID() contact_id: string;
    @ApiProperty({ required: false }) @IsOptional() @IsString() @MaxLength(60) role?: string;
}

// ---- Zod twins (MCP) and query schemas -------------------------------------------

export const CreateDealSchema = z.object({
    name: z.string().min(1).max(200),
    pipeline_id: z.string().uuid().optional(),
    stage_id: z.string().uuid().optional(),
    company_id: z.string().uuid().optional(),
    primary_contact_id: z.string().uuid().optional(),
    owner_membership_id: z.string().uuid().optional(),
    secondary_owner_membership_id: z.string().uuid().optional(),
    project_manager_membership_id: z.string().uuid().optional(),
    team_id: z.string().uuid().optional(),
    branch_id: z.string().uuid().optional(),
    value: z.number().min(0).optional(),
    currency: z.string().length(3).optional(),
    probability: z.number().int().min(0).max(100).optional(),
    expected_close_date: z.string().optional().describe('YYYY-MM-DD'),
    deal_type: z.string().max(60).optional(),
    lead_source_id: z.string().uuid().optional(),
    competitor: z.string().max(120).optional(),
    next_step: z.string().max(500).optional(),
    description: z.string().max(5000).optional(),
    contact_ids: z.array(z.string().uuid()).optional(),
});
export const UpdateDealSchema = CreateDealSchema.omit({ pipeline_id: true, stage_id: true, contact_ids: true }).partial().extend({ id: z.string().uuid() });
export const ChangeStageSchema = z.object({
    id: z.string().uuid(),
    stage_id: z.string().uuid(),
    probability: z.number().int().min(0).max(100).optional(),
    lost_reason_id: z.string().uuid().optional(),
    lost_reason: z.string().max(1000).optional(),
    competitor: z.string().max(120).optional(),
    won_note: z.string().max(1000).optional(),
    actual_close_date: z.string().optional(),
    set_customer: z.boolean().optional(),
});

export const DealQuerySchema = BaseListQuerySchema.extend({
    pipeline_id: z.string().uuid().optional(),
    stage_id: z.string().uuid().optional(),
    status: csv(z.nativeEnum(CrmDealStatus)),
    owner: z.string().optional(),
    company_id: z.string().uuid().optional(),
    contact_id: z.string().uuid().optional(),
    team_id: z.string().uuid().optional(),
    branch_id: z.string().uuid().optional(),
    close_from: z.string().optional(),
    close_to: z.string().optional(),
    tag_id: z.string().uuid().optional(),
    archived: boolish,
});
export type DealQuery = z.infer<typeof DealQuerySchema>;

export const BoardQuerySchema = z.object({
    pipeline_id: z.string().uuid().optional(),
    owner: z.string().optional(),
    team_id: z.string().uuid().optional(),
    search: z.string().trim().optional(),
    /** Cards per column. */
    per_stage: z.coerce.number().int().min(1).max(200).optional().default(50),
    /** Won/lost columns show deals closed in the last N days. */
    closed_days: z.coerce.number().int().min(0).max(365).optional().default(30),
});
export type BoardQuery = z.infer<typeof BoardQuerySchema>;
