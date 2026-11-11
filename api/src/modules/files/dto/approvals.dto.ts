import { ApiProperty } from '@nestjs/swagger';
import { ArrayMinSize, IsArray, IsBoolean, IsDateString, IsEnum, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { DocumentApprovalDecision, DocumentApprovalStatus } from 'generated/prisma';
import { z } from 'zod';
import { BaseListQuerySchema, boolish } from '@/shared/utils/pagination/pagination.utils';

export class CreateApprovalDto {
    @ApiProperty()
    @IsUUID()
    document_id: string;

    @ApiProperty({ required: false, description: 'Defaults to the current version' })
    @IsOptional()
    @IsUUID()
    version_id?: string;

    @ApiProperty({ type: [String], description: 'Membership ids of the approvers' })
    @IsArray()
    @ArrayMinSize(1)
    @IsUUID('all', { each: true })
    approver_membership_ids: string[];

    @ApiProperty({ required: false })
    @IsOptional()
    @IsBoolean()
    require_all?: boolean;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsDateString()
    due_at?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    @MaxLength(200)
    title?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    @MaxLength(2000)
    message?: string;
}

export class ApprovalDecisionDto {
    @ApiProperty({ enum: DocumentApprovalDecision })
    @IsEnum(DocumentApprovalDecision)
    decision: DocumentApprovalDecision;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    @MaxLength(2000)
    comment?: string;
}

export const ApprovalQuerySchema = BaseListQuerySchema.extend({
    status: z.nativeEnum(DocumentApprovalStatus).optional(),
    /** Waiting for the caller's decision. */
    mine: boolish,
    /** Requested by the caller. */
    requested: boolish,
    document_id: z.string().uuid().optional(),
});
export type ApprovalQuery = z.infer<typeof ApprovalQuerySchema>;

export const CreateApprovalSchema = z.object({
    document_id: z.string().uuid(),
    version_id: z.string().uuid().optional(),
    approver_membership_ids: z.array(z.string().uuid()).min(1),
    require_all: z.boolean().optional(),
    due_at: z.string().datetime().optional(),
    title: z.string().max(200).optional(),
    message: z.string().max(2000).optional(),
});

export const ApprovalDecisionSchema = z.object({
    id: z.string().uuid(),
    decision: z.nativeEnum(DocumentApprovalDecision),
    comment: z.string().max(2000).optional(),
});
