import { z } from 'zod';
import { boolish } from '@/shared/utils/pagination/pagination.utils';

/** GET /projects/timeline — portfolio Gantt (05 §24–26, §76). */
export const PortfolioTimelineQuerySchema = z.object({
    search: z.string().trim().optional(),
    company_id: z.string().uuid().optional(),
    owner_id: z.union([z.string().uuid(), z.literal('me')]).optional(),
    /** Include completed / cancelled projects (hidden by default). */
    include_closed: boolish,
});
export type PortfolioTimelineQuery = z.infer<typeof PortfolioTimelineQuerySchema>;

/** GET /projects/:id/timeline — one project's workstreams, milestones and dated tasks. */
export const ProjectTimelineQuerySchema = z.object({
    /** Include done / cancelled tasks (hidden by default). */
    include_done: boolish,
});
export type ProjectTimelineQuery = z.infer<typeof ProjectTimelineQuerySchema>;

export const ProjectTimelineToolSchema = ProjectTimelineQuerySchema.extend({ project_id: z.string().uuid() });
