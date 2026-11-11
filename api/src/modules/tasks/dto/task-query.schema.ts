import { z } from 'zod';
import { CycleStatus, ReleaseStatus, TaskPriority, TaskStatusCategory } from 'generated/prisma';
import { BaseListQuerySchema, boolish, csv } from '@/shared/utils/pagination/pagination.utils';

/** `uuid`, `me` (the caller) or `none` (unset). */
const ref = z.union([z.string().uuid(), z.literal('me'), z.literal('none')]);
const idOrNone = z.union([z.string().uuid(), z.literal('none')]);

export const TaskQuerySchema = BaseListQuerySchema.extend({
    /** Assigned to me (primary or additional assignee). */
    mine: boolish,
    assignee: ref.optional(),
    reporter: ref.optional(),
    status_id: csv(z.string().uuid()),
    status_category: csv(z.nativeEnum(TaskStatusCategory)),
    label_id: csv(z.string().uuid()),
    priority: csv(z.nativeEnum(TaskPriority)),
    type_id: z.string().uuid().optional(),
    team_id: idOrNone.optional(),
    project_id: idOrNone.optional(),
    milestone_id: z.string().uuid().optional(),
    cycle_id: idOrNone.optional(),
    release_id: idOrNone.optional(),
    /** `none` = top-level tasks only. */
    parent_task_id: idOrNone.optional(),
    due: z.enum(['overdue', 'today', 'week', 'none', 'any']).optional(),
    blocked: boolish,
    customer_visible: boolish,
    /** Hide DONE / CANCELLED. */
    open: boolish,
    archived: boolish,
});
export type TaskQuery = z.infer<typeof TaskQuerySchema>;

export const BoardQuerySchema = TaskQuerySchema.omit({ page: true, limit: true }).extend({
    team_id: idOrNone.optional(),
    limit: z.coerce.number().int().min(1).max(1000).optional().default(500),
});
export type BoardQuery = z.infer<typeof BoardQuerySchema>;

export const TaskLookupSchema = z.object({
    search: z.string().trim().optional(),
    project_id: z.string().uuid().optional(),
    open: boolish,
    limit: z.coerce.number().int().min(1).max(50).optional().default(20),
});
export type TaskLookupQuery = z.infer<typeof TaskLookupSchema>;

export const TaskWorkloadSchema = z.object({
    team_id: z.string().uuid().optional(),
    cycle_id: z.string().uuid().optional(),
    project_id: z.string().uuid().optional(),
});
export type TaskWorkloadQuery = z.infer<typeof TaskWorkloadSchema>;

export const StatusQuerySchema = z.object({
    /** Team workflow; omit (or `none`) for the organization-wide workflow. */
    team_id: idOrNone.optional(),
    include_archived: boolish,
});
export type StatusQuery = z.infer<typeof StatusQuerySchema>;

export const CycleQuerySchema = BaseListQuerySchema.extend({
    team_id: z.string().uuid().optional(),
    project_id: z.string().uuid().optional(),
    status: csv(z.nativeEnum(CycleStatus)),
});
export type CycleQuery = z.infer<typeof CycleQuerySchema>;

export const ReleaseQuerySchema = BaseListQuerySchema.extend({
    team_id: z.string().uuid().optional(),
    project_id: z.string().uuid().optional(),
    status: csv(z.nativeEnum(ReleaseStatus)),
});
export type ReleaseQuery = z.infer<typeof ReleaseQuerySchema>;
