import { ApiProperty, PartialType } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsInt, IsOptional, IsString, IsUUID, MaxLength, Min, MinLength } from 'class-validator';
import { DocumentDeletionStatus, DocumentRetentionAction, DocumentRetentionAnchor, DocumentScope } from 'generated/prisma';
import { z } from 'zod';
import { BaseListQuerySchema } from '@/shared/utils/pagination/pagination.utils';

export class CreateRetentionPolicyDto {
    @ApiProperty({ example: 'Invoices — 7 years' })
    @IsString()
    @MinLength(1)
    @MaxLength(120)
    name: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    @MaxLength(1000)
    description?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsUUID()
    category_id?: string;

    @ApiProperty({ enum: DocumentScope, required: false })
    @IsOptional()
    @IsEnum(DocumentScope)
    scope?: DocumentScope;

    @ApiProperty({ required: false, description: 'Null = retain indefinitely' })
    @IsOptional()
    @IsInt()
    @Min(1)
    retain_days?: number;

    @ApiProperty({ enum: DocumentRetentionAnchor, required: false })
    @IsOptional()
    @IsEnum(DocumentRetentionAnchor)
    anchor?: DocumentRetentionAnchor;

    @ApiProperty({ enum: DocumentRetentionAction, required: false })
    @IsOptional()
    @IsEnum(DocumentRetentionAction)
    action?: DocumentRetentionAction;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsBoolean()
    is_active?: boolean;
}

export class UpdateRetentionPolicyDto extends PartialType(CreateRetentionPolicyDto) { }

export class RequestDeletionDto {
    @ApiProperty()
    @IsUUID()
    document_id: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    @MaxLength(1000)
    reason?: string;
}

export class RejectDeletionDto {
    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    @MaxLength(1000)
    reason?: string;
}

export const DeletionQuerySchema = BaseListQuerySchema.extend({
    status: z.nativeEnum(DocumentDeletionStatus).optional(),
});
export type DeletionQuery = z.infer<typeof DeletionQuerySchema>;
