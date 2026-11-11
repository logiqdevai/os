import { z } from 'zod';
import { DeliverableStatus, ProjectHealth, ProjectIssueKind, ProjectItemStatus, ProjectPriority, ProjectStatusCategory, RiskStatus, Severity } from 'generated/prisma';
import { BaseListQuerySchema, boolish, csv } from '@/shared/utils/pagination/pagination.utils';

const uuidOrMe = z.union([z.string().uuid(), z.literal('me')]);

export const ProjectQuerySchema = BaseListQuerySchema.extend({
    status_id: z.string().uuid().optional(),
    status_category: csv(z.nativeEnum(ProjectStatusCategory)),
    health: csv(z.nativeEnum(ProjectHealth)),
    priority: csv(z.nativeEnum(ProjectPriority)),
    type_id: z.string().uuid().optional(),
    owner_id: uuidOrMe.optional(),
    member_id: uuidOrMe.optional(),
    company_id: z.string().uuid().optional(),
    team_id: z.string().uuid().optional(),
    favorites: boolish,
    archived: boolish,
    /** Hide COMPLETED / CANCELLED projects unless asked. */
    include_closed: boolish,
});
export type ProjectQuery = z.infer<typeof ProjectQuerySchema>;

export const LookupQuerySchema = z.object({
    search: z.string().trim().optional(),
    company_id: z.string().uuid().optional(),
    limit: z.coerce.number().int().min(1).max(50).optional().default(20),
});
export type LookupQuery = z.infer<typeof LookupQuerySchema>;

export const MilestoneQuerySchema = BaseListQuerySchema.extend({
    project_id: z.string().uuid().optional(),
    status: csv(z.nativeEnum(ProjectItemStatus)),
    billing: boolish,
    customer_visible: boolish,
    overdue: boolish,
    from: z.string().optional(),
    to: z.string().optional(),
});
export type MilestoneQuery = z.infer<typeof MilestoneQuerySchema>;

export const RaidQuerySchema = BaseListQuerySchema.extend({
    kind: z.enum(['risks', 'issues', 'decisions', 'dependencies']).optional().default('risks'),
    project_id: z.string().uuid().optional(),
    severity: csv(z.nativeEnum(Severity)),
    risk_status: csv(z.nativeEnum(RiskStatus)),
    issue_kind: z.nativeEnum(ProjectIssueKind).optional(),
    owner_id: uuidOrMe.optional(),
    /** Only open items (risks not resolved/closed, issues not resolved/closed/cancelled). */
    open: boolish,
});
export type RaidQuery = z.infer<typeof RaidQuerySchema>;

export const WorkloadQuerySchema = z.object({
    from: z.string().optional(),
    to: z.string().optional(),
    team_id: z.string().uuid().optional(),
    project_id: z.string().uuid().optional(),
});
export type WorkloadQuery = z.infer<typeof WorkloadQuerySchema>;

export const DeliverableQuerySchema = z.object({
    status: csv(z.nativeEnum(DeliverableStatus)),
});
