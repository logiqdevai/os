import { z } from 'zod';
import { AccessReviewDecision, AccessReviewStatus, ModuleKey, ReviewerStrategy, ScopeType } from 'generated/prisma';
import { BaseListQuerySchema } from '@/shared/utils/pagination/pagination.utils';

export const CreateAccessReviewSchema = z
    .object({
        name: z.string().trim().min(1).max(160),
        description: z.string().trim().max(2000).optional(),
        /** Who is reviewed. */
        scope_type: z.enum([ScopeType.ORGANIZATION, ScopeType.BRANCH, ScopeType.BRANCH_HIERARCHY, ScopeType.TEAM]).default(ScopeType.ORGANIZATION),
        scope_id: z.string().uuid().optional(),
        /** Only members with access to these modules. Empty = everyone in scope. */
        modules: z.array(z.nativeEnum(ModuleKey)).max(40).default([]),
        reviewer_strategy: z.nativeEnum(ReviewerStrategy).default(ReviewerStrategy.BRANCH_MANAGERS),
        reviewer_membership_ids: z.array(z.string().uuid()).max(50).default([]),
        starts_at: z.coerce.date().optional(),
        due_at: z.coerce.date(),
        /** Create and start in one step. */
        start: z.boolean().optional(),
    })
    .strict()
    .refine((v) => v.scope_type === ScopeType.ORGANIZATION || !!v.scope_id, { message: 'Pick the branch or team to review', path: ['scope_id'] })
    .refine((v) => v.reviewer_strategy !== ReviewerStrategy.SPECIFIC || v.reviewer_membership_ids.length > 0, { message: 'Pick at least one reviewer', path: ['reviewer_membership_ids'] });
export type CreateAccessReviewInput = z.infer<typeof CreateAccessReviewSchema>;

export const AccessReviewQuerySchema = BaseListQuerySchema.extend({
    status: z.nativeEnum(AccessReviewStatus).optional(),
});
export type AccessReviewQuery = z.infer<typeof AccessReviewQuerySchema>;

export const AccessReviewItemQuerySchema = BaseListQuerySchema.extend({
    decision: z.nativeEnum(AccessReviewDecision).optional(),
    reviewer_membership_id: z.string().uuid().optional(),
    /** Only items assigned to me. */
    mine: z.preprocess((v) => (v === 'true' ? true : v === 'false' ? false : v), z.boolean()).optional(),
});
export type AccessReviewItemQuery = z.infer<typeof AccessReviewItemQuerySchema>;

/** What a MODIFIED decision changes when applied (ids come from the item's access_snapshot). */
export const RequestedChangesSchema = z
    .object({
        remove_role_assignment_ids: z.array(z.string().uuid()).max(50).default([]),
        revoke_grant_ids: z.array(z.string().uuid()).max(100).default([]),
        disable_modules: z.array(z.nativeEnum(ModuleKey)).max(40).default([]),
    })
    .strict();
export type RequestedChanges = z.infer<typeof RequestedChangesSchema>;

export const DecideItemSchema = z
    .object({
        decision: z.enum([AccessReviewDecision.CERTIFIED, AccessReviewDecision.REVOKED, AccessReviewDecision.MODIFIED]),
        comment: z.string().trim().max(1000).optional(),
        changes: RequestedChangesSchema.optional(),
    })
    .strict()
    .refine((v) => v.decision === AccessReviewDecision.CERTIFIED || !!v.comment, { message: 'Add a comment for a revoke or modify decision', path: ['comment'] })
    .refine(
        (v) => v.decision !== AccessReviewDecision.MODIFIED || (!!v.changes && v.changes.remove_role_assignment_ids.length + v.changes.revoke_grant_ids.length + v.changes.disable_modules.length > 0),
        { message: 'Pick what to change', path: ['changes'] },
    );
export type DecideItemInput = z.infer<typeof DecideItemSchema>;

export const ReassignItemSchema = z.object({ reviewer_membership_id: z.string().uuid() }).strict();
export type ReassignItemInput = z.infer<typeof ReassignItemSchema>;
