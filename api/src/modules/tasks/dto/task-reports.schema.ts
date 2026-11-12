import { z } from 'zod';

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD');

/** GET /tasks/reports — 06 §11 flow metrics, computed from TaskStatusHistory and Task dates (never stored by hand). */
export const TaskReportQuerySchema = z.object({
    team_id: z.string().uuid().optional(),
    project_id: z.string().uuid().optional(),
    /** Range of the report (default: the last 8 weeks). */
    from: date.optional(),
    to: date.optional(),
    /** Cycle for the burn-up chart (default: the team's active cycle when team_id is given). */
    cycle_id: z.string().uuid().optional(),
});
export type TaskReportQuery = z.infer<typeof TaskReportQuerySchema>;
