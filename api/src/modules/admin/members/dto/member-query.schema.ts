import { z } from 'zod';
import { MembershipStatus, MembershipType } from 'generated/prisma';
import { BaseListQuerySchema } from '@/shared/utils/pagination/pagination.utils';

export const MemberQuerySchema = BaseListQuerySchema.extend({
    status: z.nativeEnum(MembershipStatus).optional(),
    type: z.nativeEnum(MembershipType).optional(),
    branch_id: z.string().uuid().optional(),
    team_id: z.string().uuid().optional(),
    role_id: z.string().uuid().optional(),
});

export type MemberQuery = z.infer<typeof MemberQuerySchema>;
