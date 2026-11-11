import { z } from "zod";

const optionalText = (max: number) => z.string().trim().max(max).optional();

export const campaignFormSchema = z
    .object({
        name: z.string().trim().min(1, "Give the campaign a name").max(200),
        description: optionalText(2000),
        channel: z.enum(["EMAIL", "SMS"]),
        audiences: z.array(z.object({ mode: z.enum(["INCLUDE", "EXCLUDE"]), list_id: z.string().optional(), segment_id: z.string().optional() })),
        template_id: z.string().optional(),
        subject: optionalText(300),
        preheader: optionalText(300),
        body_html: z.string().max(500_000).optional(),
        body_text: z.string().max(100_000).optional(),
        sender_identity_id: z.string().optional(),
        from_name: optionalText(120),
        reply_to_address: z.union([z.literal(""), z.string().trim().email("Enter a valid email")]).optional(),
        tracking_enabled: z.boolean(),
        require_consent: z.boolean(),
        /** Messages per hour as typed in the input; empty = no throttling. */
        send_rate_per_hour: z.string().regex(/^(|[1-9]\d{1,6})$/, "Enter a number of at least 10").optional(),
        send_mode: z.enum(["now", "later"]),
        scheduled_at: z.string().optional(),
    })
    .superRefine((v, ctx) => {
        if (v.send_mode === "later") {
            if (!v.scheduled_at) ctx.addIssue({ code: "custom", path: ["scheduled_at"], message: "Pick a date and time" });
            else if (new Date(v.scheduled_at).getTime() < Date.now()) ctx.addIssue({ code: "custom", path: ["scheduled_at"], message: "The time is in the past" });
        }
    });
export type CampaignFormValues = z.infer<typeof campaignFormSchema>;

export const templateFormSchema = z.object({
    name: z.string().trim().min(1, "Give the template a name").max(160),
    description: optionalText(2000),
    channel: z.enum(["EMAIL", "SMS"]),
    category: z.string().min(1),
    language: z.string().trim().min(2).max(12),
    subject: optionalText(300),
    preheader: optionalText(300),
    body_html: z.string().max(500_000).optional(),
    body_text: z.string().max(100_000).optional(),
    change_note: optionalText(500),
});
export type TemplateFormValues = z.infer<typeof templateFormSchema>;

export const segmentFormSchema = z.object({
    name: z.string().trim().min(1, "Give the segment a name").max(160),
    description: optionalText(2000),
    entity_type: z.enum(["CRM_CONTACT", "CRM_COMPANY", "MEMBERSHIP"]),
    channel: z.enum(["EMAIL", "SMS", "ANY"]),
    require_consent: z.boolean(),
});
export type SegmentFormValues = z.infer<typeof segmentFormSchema>;

export const listFormSchema = z.object({
    name: z.string().trim().min(1, "Give the list a name").max(160),
    description: optionalText(2000),
    channel: z.enum(["EMAIL", "SMS", "ANY"]),
});
export type ListFormValues = z.infer<typeof listFormSchema>;

export const suppressionFormSchema = z.object({
    channel: z.enum(["EMAIL", "SMS"]),
    address: z.string().trim().min(3, "Enter an email address or phone number").max(254),
    reason: z.enum(["MANUAL", "UNSUBSCRIBE", "HARD_BOUNCE", "SOFT_BOUNCE", "COMPLAINT", "INVALID_ADDRESS", "CONSENT_WITHDRAWN"]),
    notes: optionalText(2000),
    blocks_transactional: z.boolean(),
});
export type SuppressionFormValues = z.infer<typeof suppressionFormSchema>;

export const composeFormSchema = z
    .object({
        channel: z.enum(["EMAIL", "SMS"]),
        to_address: z.string().trim().min(3, "Enter the recipient").max(254),
        to_name: optionalText(160),
        template_id: z.string().optional(),
        subject: optionalText(300),
        body: z.string().max(100_000).optional(),
        kind: z.enum(["CUSTOMER", "TRANSACTIONAL"]),
        sender_identity_id: z.string().optional(),
    })
    .superRefine((v, ctx) => {
        if (!v.template_id && !v.body?.trim()) ctx.addIssue({ code: "custom", path: ["body"], message: "Write a message or pick a template" });
        if (v.channel === "EMAIL" && !v.template_id && !v.subject?.trim()) ctx.addIssue({ code: "custom", path: ["subject"], message: "Add a subject" });
    });
export type ComposeFormValues = z.infer<typeof composeFormSchema>;

export const senderIdentityFormSchema = z.object({
    channel: z.enum(["EMAIL", "SMS"]),
    address: z.string().trim().min(3, "Enter an address").max(254),
    display_name: optionalText(120),
    reply_to_address: z.union([z.literal(""), z.string().trim().email("Enter a valid email")]).optional(),
    is_default: z.boolean(),
});
export type SenderIdentityFormValues = z.infer<typeof senderIdentityFormSchema>;
