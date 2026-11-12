import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { z } from 'zod';
import { BaseListQuerySchema } from '@/shared/utils/pagination/pagination.utils';

/** GET /sessions — active sessions of the organization's members (01 §72). */
export const SessionQuerySchema = BaseListQuerySchema.extend({
    member_id: z.string().uuid().optional(),
});
export type SessionQuery = z.infer<typeof SessionQuerySchema>;

export class RevokeSessionDto {
    @ApiProperty({ required: false, example: 'Lost laptop' })
    @IsOptional()
    @IsString()
    @MaxLength(200)
    reason?: string;
}

export class RevokeAllSessionsDto extends RevokeSessionDto {
    @ApiProperty({ required: false, description: 'Only this member’s sessions; omit for every session in your scope (your own current session is kept).' })
    @IsOptional()
    @IsUUID()
    member_id?: string;
}

/** Zod twins for the MCP tools. */
export const RevokeSessionSchema = z.object({ id: z.string().uuid(), reason: z.string().max(200).optional() });
export const RevokeAllSessionsSchema = z.object({ member_id: z.string().uuid().optional(), reason: z.string().max(200).optional() });
