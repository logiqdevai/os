import { ApiProperty, PartialType } from '@nestjs/swagger';
import { IsEnum, IsObject, IsOptional, IsString, IsUUID, Matches, MaxLength, MinLength, ValidateIf } from 'class-validator';
import { SupportCannedResponseScope } from 'generated/prisma';
import { z } from 'zod';
import { BaseListQuerySchema } from '@/shared/utils/pagination/pagination.utils';

export const CannedQuerySchema = BaseListQuerySchema.extend({
    scope: z.nativeEnum(SupportCannedResponseScope).optional(),
    category: z.string().max(80).optional(),
});
export type CannedQuery = z.infer<typeof CannedQuerySchema>;

export class CreateCannedResponseDto {
    @ApiProperty({ example: 'Refund policy' })
    @IsString()
    @MinLength(1)
    @MaxLength(120)
    name: string;

    @ApiProperty({ required: false, example: '/refund' })
    @IsOptional()
    @Matches(/^\/[a-z0-9-]{1,40}$/, { message: 'Shortcut must look like /refund (lowercase letters, digits, dashes)' })
    shortcut?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    @MaxLength(80)
    category?: string;

    @ApiProperty({ description: 'Markdown with {{customer.first_name}}, {{customer.name}}, {{ticket.reference}}, {{agent.name}}, {{organization.name}}' })
    @IsString()
    @MinLength(1)
    @MaxLength(20000)
    body: string;

    @ApiProperty({ required: false, enum: SupportCannedResponseScope })
    @IsOptional()
    @IsEnum(SupportCannedResponseScope)
    scope?: SupportCannedResponseScope;

    @ApiProperty({ required: false, nullable: true })
    @IsOptional()
    @ValidateIf((_, v) => v !== null)
    @IsUUID()
    team_id?: string | null;

    @ApiProperty({ required: false, description: 'Macro actions: { status_slug, priority, assignee_membership_id, category_id }' })
    @IsOptional()
    @IsObject()
    actions?: Record<string, unknown>;
}

export class UpdateCannedResponseDto extends PartialType(CreateCannedResponseDto) { }

export class RenderCannedResponseDto {
    @ApiProperty({ required: false })
    @IsOptional()
    @IsUUID()
    conversation_id?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsUUID()
    ticket_id?: string;
}
