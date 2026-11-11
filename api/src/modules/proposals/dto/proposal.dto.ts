import { ApiProperty, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
    ArrayMaxSize, IsArray, IsBoolean, IsDateString, IsEmail, IsEnum, IsIn, IsInt, IsNumber, IsOptional, IsString, IsUUID, Max, MaxLength, Min, MinLength, ValidateNested,
} from 'class-validator';
import {
    ProposalApprovalDecision, ProposalCustomerDecision, ProposalDeliveryChannel, ProposalLinkAccessMode, ProposalLostReason, ProposalPaymentTrigger, ProposalSectionType,
} from 'generated/prisma';
import { z } from 'zod';

const FREQUENCIES = ['monthly', 'quarterly', 'annual', 'custom'] as const;

// --- Content -----------------------------------------------------------------------------------

export class ProposalSectionInputDto {
    @ApiProperty({ required: false, description: 'Existing section id (kept for comments); omit for a new section' })
    @IsOptional() @IsUUID()
    id?: string;

    @ApiProperty({ enum: ProposalSectionType })
    @IsEnum(ProposalSectionType)
    type: ProposalSectionType;

    @ApiProperty({ example: 'Executive summary' })
    @IsString() @MinLength(1) @MaxLength(200)
    title: string;

    @ApiProperty({ required: false, description: 'Markdown body. {{variables}} are resolved on render.' })
    @IsOptional() @IsString() @MaxLength(100000)
    body?: string | null;

    @ApiProperty({ required: false })
    @IsOptional() @IsBoolean()
    is_internal?: boolean;

    @ApiProperty({ required: false })
    @IsOptional() @IsBoolean()
    is_ai_generated?: boolean;
}

export class ProposalLineItemInputDto {
    @ApiProperty({ required: false, description: 'Finance catalog product (08)' })
    @IsOptional() @IsUUID()
    product_id?: string | null;

    @ApiProperty({ required: false, example: 'Design' })
    @IsOptional() @IsString() @MaxLength(120)
    group_name?: string | null;

    @ApiProperty({ example: 'Marketing website redesign' })
    @IsString() @MinLength(1) @MaxLength(300)
    name: string;

    @ApiProperty({ required: false })
    @IsOptional() @IsString() @MaxLength(4000)
    description?: string | null;

    @ApiProperty({ example: 1 })
    @Type(() => Number) @IsNumber({ maxDecimalPlaces: 3 }) @Min(0) @Max(1_000_000)
    quantity: number;

    @ApiProperty({ required: false, example: 'project' })
    @IsOptional() @IsString() @MaxLength(40)
    unit?: string | null;

    @ApiProperty({ example: 24000 })
    @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) @Max(1_000_000_000)
    unit_price: number;

    @ApiProperty({ required: false, description: 'Discount in percent (wins over discount_amount)' })
    @IsOptional() @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) @Max(100)
    discount_percent?: number | null;

    @ApiProperty({ required: false, description: 'Fixed discount amount for the line' })
    @IsOptional() @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0)
    discount_amount?: number | null;

    @ApiProperty({ required: false, example: 24 })
    @IsOptional() @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) @Max(100)
    tax_percent?: number | null;

    @ApiProperty({ required: false })
    @IsOptional() @IsBoolean()
    is_recurring?: boolean;

    @ApiProperty({ required: false, enum: FREQUENCIES })
    @IsOptional() @IsIn(FREQUENCIES)
    billing_frequency?: (typeof FREQUENCIES)[number] | null;

    @ApiProperty({ required: false })
    @IsOptional() @IsBoolean()
    is_optional?: boolean;
}

export class ProposalPaymentInputDto {
    @ApiProperty({ example: 'Deposit' })
    @IsString() @MinLength(1) @MaxLength(200)
    name: string;

    @ApiProperty({ enum: ProposalPaymentTrigger })
    @IsEnum(ProposalPaymentTrigger)
    trigger: ProposalPaymentTrigger;

    @ApiProperty({ required: false, description: 'Share of the base gross total' })
    @IsOptional() @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) @Max(100)
    percentage?: number | null;

    @ApiProperty({ required: false })
    @IsOptional() @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0)
    amount?: number | null;

    @ApiProperty({ required: false })
    @IsOptional() @IsDateString()
    due_date?: string | null;

    @ApiProperty({ required: false })
    @IsOptional() @IsString() @MaxLength(200)
    milestone_name?: string | null;

    @ApiProperty({ required: false, enum: FREQUENCIES })
    @IsOptional() @IsIn(FREQUENCIES)
    frequency?: string | null;
}

/** Replace the content of a DRAFT version. Every part is optional; a part that is sent replaces the stored one. */
export class SaveProposalContentDto {
    @ApiProperty({ required: false, type: [ProposalSectionInputDto] })
    @IsOptional() @IsArray() @ArrayMaxSize(100) @ValidateNested({ each: true }) @Type(() => ProposalSectionInputDto)
    sections?: ProposalSectionInputDto[];

    @ApiProperty({ required: false, type: [ProposalLineItemInputDto] })
    @IsOptional() @IsArray() @ArrayMaxSize(300) @ValidateNested({ each: true }) @Type(() => ProposalLineItemInputDto)
    line_items?: ProposalLineItemInputDto[];

    @ApiProperty({ required: false, type: [ProposalPaymentInputDto] })
    @IsOptional() @IsArray() @ArrayMaxSize(50) @ValidateNested({ each: true }) @Type(() => ProposalPaymentInputDto)
    payment_schedule?: ProposalPaymentInputDto[];

    @ApiProperty({ required: false, example: 'Net 14' })
    @IsOptional() @IsString() @MaxLength(4000)
    payment_terms?: string | null;

    @ApiProperty({ required: false, example: 30 })
    @IsOptional() @IsInt() @Min(1) @Max(365)
    validity_days?: number | null;

    @ApiProperty({ required: false })
    @IsOptional() @IsString() @MaxLength(500)
    change_summary?: string | null;
}

// --- Proposal record -----------------------------------------------------------------------------

export class CreateProposalDto {
    @ApiProperty({ example: 'Acme Rebrand phase 2' })
    @IsString() @MinLength(1) @MaxLength(300)
    title: string;

    @ApiProperty({ example: 'EUR' })
    @IsOptional() @IsString() @MinLength(3) @MaxLength(3)
    currency?: string;

    @ApiProperty({ required: false, example: 'en' })
    @IsOptional() @IsString() @MaxLength(10)
    language?: string;

    @ApiProperty({ required: false })
    @IsOptional() @IsUUID()
    company_id?: string | null;

    @ApiProperty({ required: false })
    @IsOptional() @IsUUID()
    contact_id?: string | null;

    @ApiProperty({ required: false })
    @IsOptional() @IsUUID()
    deal_id?: string | null;

    @ApiProperty({ required: false })
    @IsOptional() @IsUUID()
    project_id?: string | null;

    @ApiProperty({ required: false, description: 'Defaults to the caller' })
    @IsOptional() @IsUUID()
    owner_membership_id?: string | null;

    @ApiProperty({ required: false })
    @IsOptional() @IsUUID()
    branch_id?: string | null;

    @ApiProperty({ required: false, description: 'Copy sections and defaults from this template' })
    @IsOptional() @IsUUID()
    template_id?: string | null;

    @ApiProperty({ required: false })
    @IsOptional() @IsBoolean()
    requires_contract?: boolean;

    @ApiProperty({ required: false, description: 'Initial content (otherwise template sections or a cover section)' })
    @IsOptional() @ValidateNested() @Type(() => SaveProposalContentDto)
    content?: SaveProposalContentDto;
}

export class UpdateProposalDto extends PartialType(CreateProposalDto) {
    @ApiProperty({ required: false })
    @IsOptional() @IsDateString()
    valid_until?: string | null;

    @ApiProperty({ required: false, type: [Number], example: [7, 2] })
    @IsOptional() @IsArray() @ArrayMaxSize(5) @IsInt({ each: true }) @Min(1, { each: true }) @Max(90, { each: true })
    reminder_days?: number[];

    @ApiProperty({ required: false, enum: ProposalLinkAccessMode })
    @IsOptional() @IsEnum(ProposalLinkAccessMode)
    link_access_mode?: ProposalLinkAccessMode;
}

export class CreateVersionDto {
    @ApiProperty({ required: false, description: 'Copy this version (default: the current version). Used for "Restore".' })
    @IsOptional() @IsUUID()
    from_version_id?: string;

    @ApiProperty({ required: false })
    @IsOptional() @IsString() @MaxLength(500)
    change_summary?: string;
}

export class MarkLostDto {
    @ApiProperty({ enum: ProposalLostReason })
    @IsEnum(ProposalLostReason)
    lost_reason: ProposalLostReason;

    @ApiProperty({ required: false })
    @IsOptional() @IsString() @MaxLength(2000)
    note?: string;
}

// --- Review & approval ---------------------------------------------------------------------------

export class SubmitForReviewDto {
    @ApiProperty({ required: false, type: [String], description: 'Extra approvers requested manually (added after the rule steps)' })
    @IsOptional() @IsArray() @ArrayMaxSize(10) @IsUUID('all', { each: true })
    approver_membership_ids?: string[];

    @ApiProperty({ required: false })
    @IsOptional() @IsString() @MaxLength(2000)
    note?: string;

    @ApiProperty({ required: false })
    @IsOptional() @IsDateString()
    due_at?: string;
}

export class ApprovalDecisionDto {
    @ApiProperty({ enum: [ProposalApprovalDecision.APPROVED, ProposalApprovalDecision.REJECTED, ProposalApprovalDecision.CHANGES_REQUESTED] })
    @IsIn([ProposalApprovalDecision.APPROVED, ProposalApprovalDecision.REJECTED, ProposalApprovalDecision.CHANGES_REQUESTED])
    decision: ProposalApprovalDecision;

    @ApiProperty({ required: false })
    @IsOptional() @IsString() @MaxLength(4000)
    comment?: string;
}

// --- Send --------------------------------------------------------------------------------------

export class SendProposalDto {
    @ApiProperty({ required: false, description: 'Version to send (default: current version)' })
    @IsOptional() @IsUUID()
    version_id?: string;

    @ApiProperty({ enum: ProposalDeliveryChannel, isArray: true, example: ['EMAIL', 'LINK'] })
    @IsArray() @ArrayMaxSize(4) @IsEnum(ProposalDeliveryChannel, { each: true })
    channels: ProposalDeliveryChannel[];

    @ApiProperty({ required: false, type: [String] })
    @IsOptional() @IsArray() @ArrayMaxSize(20) @IsUUID('all', { each: true })
    recipient_contact_ids?: string[];

    @ApiProperty({ required: false, type: [String] })
    @IsOptional() @IsArray() @ArrayMaxSize(20) @IsEmail({}, { each: true })
    extra_emails?: string[];

    @ApiProperty({ required: false })
    @IsOptional() @IsString() @MaxLength(300)
    subject?: string;

    @ApiProperty({ required: false })
    @IsOptional() @IsString() @MaxLength(10000)
    message?: string;

    @ApiProperty({ required: false, description: 'Defaults to today + validity_days' })
    @IsOptional() @IsDateString()
    valid_until?: string;

    @ApiProperty({ required: false, type: [Number] })
    @IsOptional() @IsArray() @ArrayMaxSize(5) @IsInt({ each: true }) @Min(1, { each: true }) @Max(90, { each: true })
    reminder_days?: number[];

    @ApiProperty({ required: false, enum: ProposalLinkAccessMode })
    @IsOptional() @IsEnum(ProposalLinkAccessMode)
    link_access_mode?: ProposalLinkAccessMode;
}

// --- Comments & conversion -----------------------------------------------------------------------

export class CreateProposalCommentDto {
    @ApiProperty()
    @IsString() @MinLength(1) @MaxLength(10000)
    body: string;

    @ApiProperty({ required: false })
    @IsOptional() @IsUUID()
    version_id?: string;

    @ApiProperty({ required: false })
    @IsOptional() @IsUUID()
    section_id?: string;

    @ApiProperty({ required: false })
    @IsOptional() @IsUUID()
    parent_comment_id?: string;

    @ApiProperty({ required: false, default: true, description: 'Internal comments are never shown to the customer' })
    @IsOptional() @IsBoolean()
    is_internal?: boolean;
}

export class ResolveCommentDto {
    @ApiProperty()
    @IsBoolean()
    resolved: boolean;
}

export class ConvertProposalDto {
    @ApiProperty({ required: false, description: 'Contract template to use for the draft contract (04)' })
    @IsOptional() @IsUUID()
    contract_template_id?: string;

    @ApiProperty({ required: false })
    @IsOptional() @IsUUID()
    contract_type_id?: string;

    @ApiProperty({ required: false })
    @IsOptional() @IsString() @MaxLength(300)
    contract_title?: string;
}

// --- Public customer actions ---------------------------------------------------------------------

export class PublicSelectionDto {
    @ApiProperty({ type: [String] })
    @IsArray() @ArrayMaxSize(300) @IsUUID('all', { each: true })
    selected_optional_item_ids: string[];
}

export class PublicDecisionDto {
    @ApiProperty({ enum: ProposalCustomerDecision })
    @IsEnum(ProposalCustomerDecision)
    decision: ProposalCustomerDecision;

    @ApiProperty({ example: 'Lena Kovac' })
    @IsString() @MinLength(2) @MaxLength(200)
    signer_name: string;

    @ApiProperty({ example: 'lena@acme.example' })
    @IsEmail()
    signer_email: string;

    @ApiProperty({ required: false })
    @IsOptional() @IsString() @MaxLength(200)
    signer_title?: string;

    @ApiProperty({ required: false })
    @IsOptional() @IsBoolean()
    terms_accepted?: boolean;

    @ApiProperty({ required: false })
    @IsOptional() @IsString() @MaxLength(10000)
    feedback?: string;

    @ApiProperty({ required: false, type: [String] })
    @IsOptional() @IsArray() @ArrayMaxSize(300) @IsUUID('all', { each: true })
    selected_optional_item_ids?: string[];
}

export class PublicCommentDto {
    @ApiProperty()
    @IsString() @MinLength(1) @MaxLength(5000)
    body: string;

    @ApiProperty()
    @IsString() @MinLength(2) @MaxLength(200)
    author_name: string;

    @ApiProperty({ required: false })
    @IsOptional() @IsUUID()
    section_id?: string;
}

export class PublicVerifyDto {
    @ApiProperty({ example: '123456' })
    @IsString() @MinLength(4) @MaxLength(10)
    code: string;
}

export class PublicSendCodeDto {
    @ApiProperty({ example: 'lena@acme.example' })
    @IsEmail()
    email: string;
}

// --- Zod twins for MCP tools (same rules as the DTOs) --------------------------------------------

const money = z.number().min(0);
export const SectionSchema = z.object({
    id: z.string().uuid().optional(),
    type: z.nativeEnum(ProposalSectionType),
    title: z.string().min(1).max(200),
    body: z.string().max(100000).nullish(),
    is_internal: z.boolean().optional(),
    is_ai_generated: z.boolean().optional(),
});
export const LineItemSchema = z.object({
    product_id: z.string().uuid().nullish(),
    group_name: z.string().max(120).nullish(),
    name: z.string().min(1).max(300),
    description: z.string().max(4000).nullish(),
    quantity: money.max(1_000_000),
    unit: z.string().max(40).nullish(),
    unit_price: money,
    discount_percent: z.number().min(0).max(100).nullish(),
    discount_amount: money.nullish(),
    tax_percent: z.number().min(0).max(100).nullish(),
    is_recurring: z.boolean().optional(),
    billing_frequency: z.enum(FREQUENCIES).nullish(),
    is_optional: z.boolean().optional(),
});
export const PaymentSchema = z.object({
    name: z.string().min(1).max(200),
    trigger: z.nativeEnum(ProposalPaymentTrigger),
    percentage: z.number().min(0).max(100).nullish(),
    amount: money.nullish(),
    due_date: z.string().nullish(),
    milestone_name: z.string().max(200).nullish(),
    frequency: z.string().nullish(),
});
export const ContentSchema = z.object({
    sections: z.array(SectionSchema).max(100).optional(),
    line_items: z.array(LineItemSchema).max(300).optional(),
    payment_schedule: z.array(PaymentSchema).max(50).optional(),
    payment_terms: z.string().max(4000).nullish(),
    validity_days: z.number().int().min(1).max(365).nullish(),
    change_summary: z.string().max(500).nullish(),
});
export const CreateProposalSchema = z.object({
    title: z.string().min(1).max(300),
    currency: z.string().length(3).optional(),
    language: z.string().max(10).optional(),
    company_id: z.string().uuid().nullish(),
    contact_id: z.string().uuid().nullish(),
    deal_id: z.string().uuid().nullish(),
    project_id: z.string().uuid().nullish(),
    owner_membership_id: z.string().uuid().nullish(),
    branch_id: z.string().uuid().nullish(),
    template_id: z.string().uuid().nullish(),
    requires_contract: z.boolean().optional(),
    content: ContentSchema.optional(),
});
export const SendProposalSchema = z.object({
    version_id: z.string().uuid().optional(),
    channels: z.array(z.nativeEnum(ProposalDeliveryChannel)).min(1).max(4),
    recipient_contact_ids: z.array(z.string().uuid()).max(20).optional(),
    extra_emails: z.array(z.string().email()).max(20).optional(),
    subject: z.string().max(300).optional(),
    message: z.string().max(10000).optional(),
    valid_until: z.string().optional(),
    reminder_days: z.array(z.number().int().min(1).max(90)).max(5).optional(),
    link_access_mode: z.nativeEnum(ProposalLinkAccessMode).optional(),
});
