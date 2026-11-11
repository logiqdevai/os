import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsBoolean, IsDateString, IsIn, IsInt, IsOptional, IsString, IsUUID, Matches, Max, MaxLength, Min, MinLength, ValidateNested } from 'class-validator';
import { z } from 'zod';

export class CreateVersionDto {
    @ApiProperty({ required: false, description: 'Copy from this version (defaults to the current version). Use an older version to restore it as a new draft.' })
    @IsOptional() @IsUUID() from_version_id?: string;
    @ApiProperty({ required: false }) @IsOptional() @IsString() @MaxLength(500) change_summary?: string;
}

export class UpdateVersionDto {
    @ApiProperty({ required: false }) @IsOptional() @IsString() @MaxLength(500) change_summary?: string;
    @ApiProperty({ required: false, description: 'Show this version in the customer portal (04 §24, §61)' }) @IsOptional() @IsBoolean() customer_visible?: boolean;
}

export class SectionInputDto {
    @ApiProperty() @Matches(/^[a-z0-9_]{1,60}$/, { message: 'key must be lowercase letters, digits or _' }) key: string;
    @ApiProperty() @IsString() @MinLength(1) @MaxLength(200) title: string;
    @ApiProperty({ required: false }) @IsOptional() @IsString() @MaxLength(100_000) body?: string;
    @ApiProperty({ required: false }) @IsOptional() @IsUUID() clause_version_id?: string;
    @ApiProperty({ required: false }) @IsOptional() @IsBoolean() is_appendix?: boolean;
}

export class UpdateSectionsDto {
    @ApiProperty({ type: [SectionInputDto], description: 'Full ordered list of sections (replaces the draft content)' })
    @IsArray() @ArrayMaxSize(300) @ValidateNested({ each: true }) @Type(() => SectionInputDto) sections: SectionInputDto[];
}

export class RequestReviewDto {
    @ApiProperty({ type: [String], required: false }) @IsOptional() @IsArray() @IsUUID('all', { each: true }) reviewer_membership_ids?: string[];
    @ApiProperty({ type: [String], required: false, description: 'External (customer) reviewers — CRM contacts' }) @IsOptional() @IsArray() @IsUUID('all', { each: true }) reviewer_contact_ids?: string[];
    @ApiProperty({ required: false }) @IsOptional() @IsDateString() due_at?: string;
    @ApiProperty({ required: false }) @IsOptional() @IsString() @MaxLength(2000) comment?: string;
}

export class ReviewDecisionDto {
    @ApiProperty({ enum: ['APPROVED', 'REJECTED', 'CHANGES_REQUESTED'] }) @IsIn(['APPROVED', 'REJECTED', 'CHANGES_REQUESTED']) decision: 'APPROVED' | 'REJECTED' | 'CHANGES_REQUESTED';
    @ApiProperty({ required: false }) @IsOptional() @IsString() @MaxLength(4000) comment?: string;
}

export class ApprovalStepDto {
    @ApiProperty() @IsInt() @Min(1) @Max(20) step: number;
    @ApiProperty({ required: false }) @IsOptional() @IsString() @MaxLength(80) step_name?: string;
    @ApiProperty() @IsUUID() approver_membership_id: string;
}

export class SubmitApprovalDto {
    @ApiProperty({ type: [ApprovalStepDto], required: false, description: 'Manual steps; when omitted the matching approval rules (or the contract type workflow) decide' })
    @IsOptional() @IsArray() @ArrayMaxSize(20) @ValidateNested({ each: true }) @Type(() => ApprovalStepDto) steps?: ApprovalStepDto[];
    @ApiProperty({ required: false }) @IsOptional() @IsString() @MaxLength(2000) comment?: string;
}

export class ApprovalDecisionDto {
    @ApiProperty({ enum: ['APPROVED', 'REJECTED'] }) @IsIn(['APPROVED', 'REJECTED']) decision: 'APPROVED' | 'REJECTED';
    @ApiProperty({ required: false }) @IsOptional() @IsString() @MaxLength(4000) comment?: string;
}

export class CreateCommentDto {
    @ApiProperty({ required: false, description: 'Defaults to the current version' }) @IsOptional() @IsUUID() version_id?: string;
    @ApiProperty({ required: false }) @IsOptional() @IsUUID() section_id?: string;
    @ApiProperty({ required: false }) @IsOptional() @IsUUID() parent_comment_id?: string;
    @ApiProperty() @IsString() @MinLength(1) @MaxLength(10_000) body: string;
    @ApiProperty({ required: false, description: 'Internal comments never reach the customer (default true)' }) @IsOptional() @IsBoolean() is_internal?: boolean;
    @ApiProperty({ required: false, description: 'Blocks signature until resolved' }) @IsOptional() @IsBoolean() is_blocking?: boolean;
}

export class ResolveCommentDto {
    @ApiProperty() @IsBoolean() resolved: boolean;
}

export const CompareQuerySchema = z.object({ from: z.string().uuid(), to: z.string().uuid() });
export type CompareQuery = z.infer<typeof CompareQuerySchema>;

export const CommentsQuerySchema = z.object({
    version_id: z.string().uuid().optional(),
    section_id: z.string().uuid().optional(),
    resolved: z.preprocess((v) => (v === 'true' ? true : v === 'false' ? false : v), z.boolean()).optional(),
});
export type CommentsQuery = z.infer<typeof CommentsQuerySchema>;

export const ApprovalDecisionSchema = z.object({
    contract_id: z.string().uuid(),
    approval_id: z.string().uuid(),
    decision: z.enum(['APPROVED', 'REJECTED']),
    comment: z.string().max(4000).optional(),
});

export const SubmitApprovalSchema = z.object({
    contract_id: z.string().uuid(),
    version_id: z.string().uuid(),
    comment: z.string().max(2000).optional(),
});
