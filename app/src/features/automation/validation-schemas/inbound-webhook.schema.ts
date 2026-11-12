import { z } from "zod";

/** Inbound webhook endpoint form (20 §12). Rate limit stays text until submit. */
export const inboundWebhookSchema = z.object({
    name: z.string().trim().min(1, "Required").max(120),
    description: z.string().max(1000),
    slug: z.string().trim().regex(/^([a-z0-9][a-z0-9-]{2,60})?$/, "3–61 lowercase letters, digits or dashes"),
    auth_scheme: z.enum(["HMAC_SHA256", "BEARER_TOKEN", "BASIC", "NONE"]),
    signature_header: z.string().trim().max(100),
    rule_id: z.string().nullable(),
    allowed_ip_ranges: z.string().max(4000),
    rate_limit_per_minute: z.string().trim().refine((v) => v === "" || (/^\d+$/.test(v) && Number(v) >= 1 && Number(v) <= 10000), "1–10000"),
    status: z.enum(["ACTIVE", "PAUSED"]),
});

export type InboundWebhookFormValues = z.infer<typeof inboundWebhookSchema>;
