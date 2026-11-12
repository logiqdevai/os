import { CommChannel, CommConsentStatus } from 'generated/prisma';
import { z } from 'zod';
import { BaseListQuerySchema, boolish } from '@/shared/utils/pagination/pagination.utils';

/** Preference-center topics (11 "Customer Communication", "Recipients"). One zod schema per body, shared by REST and MCP. */
export const CreateTopicSchema = z.object({
    name: z.string().trim().min(1).max(120),
    slug: z.string().trim().regex(/^[a-z0-9-]+$/, 'Use lower-case letters, digits and dashes').max(60).optional(),
    description: z.string().max(500).optional().nullable(),
    channel: z.nativeEnum(CommChannel).optional().nullable(),
    default_opt_in: z.boolean().optional(),
    sort_order: z.number().int().min(0).max(1000).optional(),
});
export type CreateTopicInput = z.infer<typeof CreateTopicSchema>;

export const UpdateTopicSchema = CreateTopicSchema.partial();
export type UpdateTopicInput = z.infer<typeof UpdateTopicSchema>;

export const TopicQuerySchema = BaseListQuerySchema.extend({ archived: boolish, channel: z.nativeEnum(CommChannel).optional() });
export type TopicQuery = z.infer<typeof TopicQuerySchema>;

export const SetSubscriptionsSchema = z.object({
    subscriptions: z.array(z.object({ topic_id: z.string().uuid(), status: z.nativeEnum(CommConsentStatus) })).min(1).max(100),
});
export type SetSubscriptionsInput = z.infer<typeof SetSubscriptionsSchema>;
