import { z } from 'zod';

/** Modules whose dates the calendar can overlay (19 §5); stored in CalendarPreference.projected_modules. */
export const PROJECTED_MODULES = ['projects', 'tasks', 'leave'] as const;
export type ProjectedModule = (typeof PROJECTED_MODULES)[number];

/** GET /calendar/projected — read-only milestones, task due dates and approved leave in [from, to). */
export const ProjectedQuerySchema = z.object({
    from: z.string().datetime({ offset: true }),
    to: z.string().datetime({ offset: true }),
    /** Subset of projects,tasks,leave (default: every module the caller may read). */
    modules: z.preprocess((v) => (typeof v === 'string' ? v.split(',').filter(Boolean) : v), z.array(z.enum(PROJECTED_MODULES))).optional(),
    /** Task due dates: only tasks assigned to me (default) or every task I can read. */
    tasks: z.enum(['mine', 'all']).optional(),
});
export type ProjectedQuery = z.infer<typeof ProjectedQuerySchema>;
