import { z } from 'zod';
import { ProposalEventType, ProposalStatus } from 'generated/prisma';
import { BaseListQuerySchema, boolish, csv } from '@/shared/utils/pagination/pagination.utils';

export const ProposalQuerySchema = BaseListQuerySchema.extend({
    status: csv(z.nativeEnum(ProposalStatus)),
    owner_membership_id: z.string().uuid().optional(),
    /** `me` = proposals owned by the caller. */
    owner: z.enum(['me']).optional(),
    company_id: z.string().uuid().optional(),
    deal_id: z.string().uuid().optional(),
    project_id: z.string().uuid().optional(),
    /** Sent / viewed proposals whose valid_until falls within N days. */
    expiring_within_days: z.coerce.number().int().min(1).max(365).optional(),
    archived: boolish,
});
export type ProposalQuery = z.infer<typeof ProposalQuerySchema>;

export const ProposalTemplateQuerySchema = BaseListQuerySchema.extend({
    archived: boolish,
    work_type: z.string().optional(),
    language: z.string().optional(),
});
export type ProposalTemplateQuery = z.infer<typeof ProposalTemplateQuerySchema>;

export const ProposalAnalyticsQuerySchema = z.object({
    from: z.string().optional(),
    to: z.string().optional(),
    owner_membership_id: z.string().uuid().optional(),
});
export type ProposalAnalyticsQuery = z.infer<typeof ProposalAnalyticsQuerySchema>;

export const ProposalEventQuerySchema = BaseListQuerySchema.extend({
    type: csv(z.nativeEnum(ProposalEventType)),
    proposal_id: z.string().uuid().optional(),
});
export type ProposalEventQuery = z.infer<typeof ProposalEventQuerySchema>;

/** /proposals/tracking — customer activity feed across proposals (dates are YYYY-MM-DD, default last 30 days). */
export const ProposalTrackingQuerySchema = BaseListQuerySchema.extend({
    type: csv(z.nativeEnum(ProposalEventType)),
    proposal_id: z.string().uuid().optional(),
    from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});
export type ProposalTrackingQuery = z.infer<typeof ProposalTrackingQuerySchema>;

export const LookupQuerySchema = z.object({
    kind: z.enum(['companies', 'contacts', 'deals', 'members', 'projects']),
    search: z.string().trim().optional(),
    company_id: z.string().uuid().optional(),
    limit: z.coerce.number().int().min(1).max(50).optional().default(20),
});
export type LookupQuery = z.infer<typeof LookupQuerySchema>;
