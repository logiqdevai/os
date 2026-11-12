import { z } from 'zod';
import { OrganizationRetentionAction, OrganizationRetentionDataClass } from 'generated/prisma';

/** Actions that make sense per data class (audit events are evidence: they are never deleted, 01 §100). */
export const RETENTION_ACTIONS: Record<OrganizationRetentionDataClass, OrganizationRetentionAction[]> = {
    AUDIT_EVENTS: [OrganizationRetentionAction.ARCHIVE, OrganizationRetentionAction.ANONYMIZE],
    SESSIONS: [OrganizationRetentionAction.DELETE],
    INVITATIONS: [OrganizationRetentionAction.DELETE],
    WEBHOOK_DELIVERIES: [OrganizationRetentionAction.DELETE],
};

/** Minimum period per class, so an admin cannot wipe recent history by mistake. */
export const RETENTION_MIN_DAYS: Record<OrganizationRetentionDataClass, number> = {
    AUDIT_EVENTS: 365,
    SESSIONS: 30,
    INVITATIONS: 30,
    WEBHOOK_DELIVERIES: 7,
};

export const DataClassParamSchema = z.nativeEnum(OrganizationRetentionDataClass);

export const UpdateRetentionPolicySchema = z
    .object({
        /** null = keep indefinitely. */
        retention_days: z.number().int().max(3650).nullable().optional(),
        action: z.nativeEnum(OrganizationRetentionAction).optional(),
        legal_hold: z.boolean().optional(),
        legal_hold_reason: z.string().trim().max(500).nullable().optional(),
    })
    .strict();
export type UpdateRetentionPolicyInput = z.infer<typeof UpdateRetentionPolicySchema>;
