import { z } from 'zod';
import { CrmCompanyType } from 'generated/prisma';
import { BaseListQuerySchema, boolish, csv } from '@/shared/utils/pagination/pagination.utils';

export const CompanyQuerySchema = BaseListQuerySchema.extend({
    type: csv(z.nativeEnum(CrmCompanyType)),
    lifecycle_stage_id: z.string().uuid().optional(),
    /** membership id, `me` or `unassigned` */
    owner: z.string().optional(),
    team_id: z.string().uuid().optional(),
    branch_id: z.string().uuid().optional(),
    country: z.string().max(2).optional(),
    tag_id: z.string().uuid().optional(),
    archived: boolish,
});
export type CompanyQuery = z.infer<typeof CompanyQuerySchema>;

export const LookupQuerySchema = z.object({
    search: z.string().trim().optional(),
    limit: z.coerce.number().int().min(1).max(50).optional().default(20),
    /** Restrict contacts to one company. */
    company_id: z.string().uuid().optional(),
    type: csv(z.nativeEnum(CrmCompanyType)),
});
export type LookupQuery = z.infer<typeof LookupQuerySchema>;
