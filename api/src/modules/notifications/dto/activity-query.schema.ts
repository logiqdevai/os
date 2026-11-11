import { z } from 'zod';
import { ModuleKey, RecordEntityType } from 'generated/prisma';
import { BaseListQuerySchema } from '@/shared/utils/pagination/pagination.utils';

/** GET /activity — organization feed (scope-limited), or one project / customer. */
export const ActivityQuerySchema = BaseListQuerySchema.extend({
    scope: z.enum(['organization', 'project', 'customer']).optional().default('organization'),
    project_id: z.string().uuid().optional(),
    company_id: z.string().uuid().optional(),
    module: z.nativeEnum(ModuleKey).optional(),
    actor_membership_id: z.string().uuid().optional(),
    entity_type: z.nativeEnum(RecordEntityType).optional(),
    entity_id: z.string().uuid().optional(),
    from: z.string().datetime({ offset: true }).optional(),
    to: z.string().datetime({ offset: true }).optional(),
});
export type ActivityQuery = z.infer<typeof ActivityQuerySchema>;

/** GET /activity/mine — the caller's own recent actions (Home → Recent). */
export const MyActivityQuerySchema = BaseListQuerySchema.extend({
    module: z.nativeEnum(ModuleKey).optional(),
});
export type MyActivityQuery = z.infer<typeof MyActivityQuerySchema>;
