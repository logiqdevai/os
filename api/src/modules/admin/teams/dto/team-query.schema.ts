import { z } from 'zod';
import { TeamKind } from 'generated/prisma';
import { BaseListQuerySchema, boolish } from '@/shared/utils/pagination/pagination.utils';

export const TeamQuerySchema = BaseListQuerySchema.extend({
    kind: z.nativeEnum(TeamKind).optional(),
    branch_id: z.string().uuid().optional(),
    archived: boolish,
});

export type TeamQuery = z.infer<typeof TeamQuerySchema>;
