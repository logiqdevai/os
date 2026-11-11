import { z } from 'zod';
import { TimeEntrySource, TimeEntryStatus } from 'generated/prisma';
import { BaseListQuerySchema, boolish, csv } from '@/shared/utils/pagination/pagination.utils';

const DATE = /^\d{4}-\d{2}-\d{2}$/;

export const TimeEntryQuerySchema = BaseListQuerySchema.extend({
    scope: z.enum(['mine', 'team', 'all']).optional(),
    from: z.string().regex(DATE).optional(),
    to: z.string().regex(DATE).optional(),
    membership_id: z.string().uuid().optional(),
    project_id: z.string().uuid().optional(),
    task_id: z.string().uuid().optional(),
    activity_type_id: z.string().uuid().optional(),
    timesheet_id: z.string().uuid().optional(),
    status: csv(z.nativeEnum(TimeEntryStatus)),
    source: z.nativeEnum(TimeEntrySource).optional(),
    billable: boolish,
    invoiced: boolish,
    no_project: boolish,
});

export type TimeEntryQuery = z.infer<typeof TimeEntryQuerySchema>;
