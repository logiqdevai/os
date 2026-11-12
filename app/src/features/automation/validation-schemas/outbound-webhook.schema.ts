import { z } from "zod";

/** Event key, prefix wildcard (`crm.*`) or `*` (20 §12). */
export const EVENT_PATTERN = /^(\*|[a-z0-9_]+(\.[a-z0-9_]+)*(\.\*)?)$/;

/** Outbound webhook create / edit (Admin → Webhooks). Same limits as CreateOutboundWebhookDto in the API. */
export const outboundWebhookSchema = z.object({
    name: z.string().trim().min(1, "Required").max(120),
    url: z.string().trim().url("Enter a full URL, e.g. https://example.com/hooks/logiqdev").max(2000),
    description: z.string().max(1000).optional(),
    subscribed_events: z.array(z.string().regex(EVENT_PATTERN)).min(1, "Choose at least one event").max(200),
    max_attempts: z.number().int().min(1).max(20),
    timeout_seconds: z.number().int().min(1).max(30),
});
export type OutboundWebhookFormValues = z.infer<typeof outboundWebhookSchema>;
