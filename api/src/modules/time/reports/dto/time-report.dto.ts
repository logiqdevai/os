import { z } from 'zod';
import { boolish } from '@/shared/utils/pagination/pagination.utils';

const DATE = /^\d{4}-\d{2}-\d{2}$/;

export const TimeReportQuerySchema = z.object({
    from: z.string().regex(DATE).optional(),
    to: z.string().regex(DATE).optional(),
    group_by: z.enum(['project', 'member', 'customer', 'activity', 'day', 'task']).optional().default('project'),
    scope: z.enum(['mine', 'team', 'all']).optional(),
    project_id: z.string().uuid().optional(),
    membership_id: z.string().uuid().optional(),
    activity_type_id: z.string().uuid().optional(),
    company_id: z.string().uuid().optional(),
    billable: boolish,
});
export type TimeReportQuery = z.infer<typeof TimeReportQuerySchema>;

export const UnbilledQuerySchema = z.object({
    company_id: z.string().uuid().optional(),
    project_id: z.string().uuid().optional(),
    to: z.string().regex(DATE).optional(),
});
export type UnbilledQuery = z.infer<typeof UnbilledQuerySchema>;
