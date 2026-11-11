import { z } from "zod";

const channel = z.enum(["IN_APP", "EMAIL", "SMS", "PUSH", "DESKTOP"]);

export const eventTypeFormSchema = z.object({
    key: z.string().trim().regex(/^[a-z][a-z0-9_]*(\.[a-z0-9_]+)+$/, "Lowercase and dot-separated, e.g. agency.client_review_due").max(120),
    module: z.string().min(1, "Choose a module"),
    name: z.string().trim().min(1, "Enter a name").max(120),
    description: z.string().max(1000).optional(),
    category: z.string().min(1),
    priority: z.enum(["LOW", "NORMAL", "IMPORTANT", "CRITICAL"]),
    default_channels: z.array(channel),
    mandatory_by_default: z.boolean(),
    supports_digest: z.boolean(),
    customer_visible: z.boolean(),
    is_active: z.boolean(),
});
export type EventTypeFormValues = z.infer<typeof eventTypeFormSchema>;

export const templateFormSchema = z.object({
    event_type_id: z.string().min(1, "Choose an event"),
    channel: z.enum(["IN_APP", "EMAIL"]),
    locale: z.string().trim().regex(/^([a-z]{2}(-[A-Z]{2})?)?$/, "e.g. en or el, or leave empty for every language"),
    subject: z.string().max(250).optional(),
    title: z.string().trim().min(1, "Enter a title").max(300),
    body: z.string().max(10000),
    cta_label: z.string().max(60).optional(),
    cta_url: z.string().max(500).optional(),
    is_active: z.boolean(),
});
export type TemplateFormValues = z.infer<typeof templateFormSchema>;

export const ruleFormSchema = z
    .object({
        name: z.string().trim().min(1, "Enter a name").max(120),
        kind: z.enum(["DEDUPLICATE", "COALESCE", "THROTTLE", "SUPPRESS"]),
        target: z.enum(["all", "module", "event"]),
        module: z.string().optional(),
        event_type_id: z.string().optional(),
        channel: z.enum(["any", "IN_APP", "EMAIL"]),
        window_minutes: z.string().regex(/^\d*$/, "Whole minutes"),
        max_per_window: z.string().regex(/^\d*$/, "Whole number"),
        coalesce_key: z.enum(["RECORD", "RECORD_AND_ACTOR", "EVENT_TYPE", "RECIPIENT"]),
        priority: z.string().regex(/^\d+$/, "Whole number"),
        is_active: z.boolean(),
    })
    .superRefine((v, ctx) => {
        if (v.target === "module" && !v.module) ctx.addIssue({ code: "custom", message: "Choose a module", path: ["module"] });
        if (v.target === "event" && !v.event_type_id) ctx.addIssue({ code: "custom", message: "Choose an event", path: ["event_type_id"] });
        if (v.kind !== "SUPPRESS" && !(Number(v.window_minutes) > 0)) ctx.addIssue({ code: "custom", message: "Set a window in minutes", path: ["window_minutes"] });
        if (v.kind === "THROTTLE" && !(Number(v.max_per_window) > 0)) ctx.addIssue({ code: "custom", message: "Set the maximum", path: ["max_per_window"] });
    });
export type RuleFormValues = z.infer<typeof ruleFormSchema>;
