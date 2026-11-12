import { z } from 'zod';
import { DelegationStatus, ScopeType } from 'generated/prisma';
import { BaseListQuerySchema, boolish } from '@/shared/utils/pagination/pagination.utils';

export const CreateDelegationSchema = z
    .object({
        delegate_membership_id: z.string().uuid(),
        /** On behalf of another member (needs organization-wide users.delegations.manage). Default: the caller. */
        delegator_membership_id: z.string().uuid().optional(),
        permission_keys: z.array(z.string().trim().min(3).max(150)).max(100).default([]),
        role_ids: z.array(z.string().uuid()).max(20).default([]),
        scope_type: z.enum([ScopeType.ORGANIZATION, ScopeType.BRANCH, ScopeType.BRANCH_HIERARCHY, ScopeType.TEAM, ScopeType.PROJECT, ScopeType.CUSTOMER]).default(ScopeType.ORGANIZATION),
        scope_id: z.string().uuid().optional(),
        starts_at: z.coerce.date(),
        ends_at: z.coerce.date(),
        reason: z.string().trim().min(1, 'Say why (kept in the audit history)').max(500),
    })
    .strict()
    .refine((v) => v.permission_keys.length + v.role_ids.length > 0, { message: 'Pick at least one permission or role to delegate', path: ['permission_keys'] })
    .refine((v) => v.ends_at > v.starts_at, { message: 'The end must be after the start', path: ['ends_at'] });
export type CreateDelegationInput = z.infer<typeof CreateDelegationSchema>;

export const RevokeDelegationSchema = z.object({ reason: z.string().trim().max(500).optional() }).strict();
export type RevokeDelegationInput = z.infer<typeof RevokeDelegationSchema>;

export const DelegationQuerySchema = BaseListQuerySchema.extend({
    status: z.nativeEnum(DelegationStatus).optional(),
    /** Only delegations I gave or received. */
    mine: boolish,
    membership_id: z.string().uuid().optional(),
});
export type DelegationQuery = z.infer<typeof DelegationQuerySchema>;
