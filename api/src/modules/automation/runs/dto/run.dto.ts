import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsObject, IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import { AutomationApprovalDecision, AutomationRunMode, AutomationRunStatus, ModuleKey, PlatformEventSource } from 'generated/prisma';
import { z } from 'zod';
import { BaseListQuerySchema, boolish, csv } from '@/shared/utils/pagination/pagination.utils';

export const RunQuerySchema = BaseListQuerySchema.extend({
    status: csv(z.nativeEnum(AutomationRunStatus)),
    mode: z.nativeEnum(AutomationRunMode).optional(),
    rule_id: z.string().uuid().optional(),
    trigger_key: z.string().optional(),
    entity_id: z.string().optional(),
    from: z.coerce.date().optional(),
    to: z.coerce.date().optional(),
});
export type RunQuery = z.infer<typeof RunQuerySchema>;

export const ApprovalQuerySchema = BaseListQuerySchema.extend({
    decision: z.nativeEnum(AutomationApprovalDecision).optional(),
    mine: boolish,
});
export type ApprovalQuery = z.infer<typeof ApprovalQuerySchema>;

export const EventQuerySchema = BaseListQuerySchema.extend({
    event_key: z.string().optional(),
    module: z.nativeEnum(ModuleKey).optional(),
    source: z.nativeEnum(PlatformEventSource).optional(),
    entity_id: z.string().optional(),
    state: z.enum(['matched', 'unmatched', 'failed', 'pending']).optional(),
    from: z.coerce.date().optional(),
    to: z.coerce.date().optional(),
});
export type EventQuery = z.infer<typeof EventQuerySchema>;

export class DecideApprovalDto {
    @ApiProperty({ enum: [AutomationApprovalDecision.APPROVED, AutomationApprovalDecision.REJECTED] })
    @IsIn([AutomationApprovalDecision.APPROVED, AutomationApprovalDecision.REJECTED])
    decision: 'APPROVED' | 'REJECTED';

    @ApiProperty({ required: false }) @IsOptional() @IsString() @MaxLength(2000)
    comment?: string;
}

export class PublishEventDto {
    @ApiProperty({ example: 'custom.lead_scored', description: 'Must start with `custom.`' })
    @Matches(/^custom\.[a-z0-9_.-]{1,120}$/, { message: 'event_key must look like custom.<name>' })
    event_key: string;

    @ApiProperty({ required: false }) @IsOptional() @IsObject()
    payload?: Record<string, unknown>;

    @ApiProperty({ required: false }) @IsOptional() @IsString() @MaxLength(100)
    entity_id?: string;
}

export const PublishEventSchema = z.object({
    event_key: z.string().regex(/^custom\.[a-z0-9_.-]{1,120}$/),
    payload: z.record(z.string(), z.unknown()).optional(),
    entity_id: z.string().max(100).optional(),
});
