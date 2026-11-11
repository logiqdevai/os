import { z } from "zod";

export const ticketFormSchema = z.object({
    subject: z.string().trim().min(1, "Enter a subject").max(300),
    description: z.string().trim().max(50000).optional(),
    type: z.enum(["QUESTION", "BUG", "FEATURE_REQUEST", "CHANGE_REQUEST", "BILLING", "ACCOUNT", "INCIDENT", "OTHER"]),
    priority: z.enum(["LOW", "NORMAL", "HIGH", "URGENT"]),
    category_id: z.string().optional(),
    inbox_id: z.string().optional(),
    assignee_membership_id: z.string().nullable().optional(),
    company_id: z.string().nullable().optional(),
    project_id: z.string().nullable().optional(),
    requester_email: z.union([z.literal(""), z.string().trim().email("Enter a valid email")]).optional(),
    requester_name: z.string().trim().max(200).optional(),
});
export type TicketFormValues = z.infer<typeof ticketFormSchema>;

export const articleFormSchema = z.object({
    title: z.string().trim().min(1, "Enter a title").max(200),
    summary: z.string().trim().max(500).optional(),
    body: z.string().max(200000),
    category_id: z.string().optional(),
    visibility: z.enum(["PUBLIC", "CUSTOMERS", "INTERNAL"]),
    is_faq: z.boolean(),
    keywords: z.string().optional(),
    change_note: z.string().max(500).optional(),
});
export type ArticleFormValues = z.infer<typeof articleFormSchema>;

export const cannedFormSchema = z.object({
    name: z.string().trim().min(1, "Enter a name").max(120),
    shortcut: z.union([z.literal(""), z.string().regex(/^\/[a-z0-9-]{1,40}$/, "Like /refund (lowercase, digits, dashes)")]).optional(),
    category: z.string().trim().max(80).optional(),
    body: z.string().trim().min(1, "Write the reply").max(20000),
    scope: z.enum(["ORGANIZATION", "TEAM", "PERSONAL"]),
});
export type CannedFormValues = z.infer<typeof cannedFormSchema>;

const minutes = z.union([z.literal(""), z.coerce.number().int().min(1).max(525600)]).optional();
export const slaFormSchema = z.object({
    name: z.string().trim().min(1, "Enter a name").max(120),
    description: z.string().trim().max(2000).optional(),
    is_default: z.boolean(),
    use_business_hours: z.boolean(),
    at_risk_threshold_percent: z.coerce.number().min(1).max(100),
    targets: z.array(z.object({ priority: z.enum(["URGENT", "HIGH", "NORMAL", "LOW"]), first_response_minutes: minutes, next_response_minutes: minutes, resolution_minutes: minutes })),
});
export type SlaFormValues = z.input<typeof slaFormSchema>;

export const inboxFormSchema = z.object({
    name: z.string().trim().min(1, "Enter a name").max(120),
    description: z.string().trim().max(1000).optional(),
    routing_strategy: z.enum(["MANUAL", "ROUND_ROBIN", "LOAD_BALANCED", "SKILL_BASED"]),
    signature: z.string().max(4000).optional(),
    auto_reply_body: z.string().max(4000).optional(),
});
export type InboxFormValues = z.infer<typeof inboxFormSchema>;

export const channelFormSchema = z
    .object({
        inbox_id: z.string().min(1, "Pick an inbox"),
        type: z.enum(["EMAIL", "LIVE_CHAT", "WIDGET", "PORTAL", "FORM", "API", "PHONE"]),
        name: z.string().trim().min(1, "Enter a name").max(120),
        email_address: z.union([z.literal(""), z.string().trim().email("Enter a valid email")]).optional(),
        allowed_origins: z.string().optional(),
    })
    .refine((v) => v.type !== "EMAIL" || !!v.email_address, { path: ["email_address"], message: "An email channel needs an address" });
export type ChannelFormValues = z.infer<typeof channelFormSchema>;
