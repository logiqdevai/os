import { z } from "zod";

export const pipelineFormSchema = z.object({
    name: z.string().trim().min(1, "Enter a name").max(80),
    description: z.string().trim().max(500).optional(),
    currency: z.string().trim().regex(/^([A-Za-z]{3})?$/, "3-letter code").optional(),
    is_default: z.boolean(),
});
export type PipelineFormValues = z.infer<typeof pipelineFormSchema>;

/** Ordered stage list: exactly one won and one lost stage (validated again by the API). */
export const stagesFormSchema = z.object({
    stages: z
        .array(z.object({
            id: z.string().optional(),
            name: z.string().trim().min(1, "Name required").max(80),
            probability: z.string().trim().regex(/^(\d{1,2}|100)$/, "0–100"),
            is_won: z.boolean(),
            is_lost: z.boolean(),
            stale_after_days: z.string().trim().regex(/^(\d{1,3})?$/, "Days").optional(),
            color: z.string().optional(),
        }))
        .refine((s) => s.filter((x) => !x.is_won && !x.is_lost).length >= 1, "Add at least one open stage"),
});
export type StagesFormValues = z.infer<typeof stagesFormSchema>;
