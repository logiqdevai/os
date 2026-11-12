import { z } from "zod";

/** Retention policy form (17 §13). Days stay text until submit; "__any" = no category / scope filter. */
export const retentionPolicySchema = z
    .object({
        name: z.string().trim().min(1, "Give the policy a name").max(120),
        description: z.string().max(1000),
        category_id: z.string(),
        scope: z.string(),
        keep_forever: z.boolean(),
        retain_days: z.string().trim(),
        anchor: z.enum(["CREATED", "LAST_MODIFIED", "ARCHIVED", "RECORD_CLOSED"]),
        action: z.enum(["ARCHIVE", "SOFT_DELETE", "PERMANENT_DELETE"]),
        is_active: z.boolean(),
    })
    .refine((v) => v.keep_forever || (/^\d+$/.test(v.retain_days) && Number(v.retain_days) >= 1 && Number(v.retain_days) <= 36_500), { message: "Whole days between 1 and 36 500", path: ["retain_days"] });

export type RetentionPolicyFormValues = z.infer<typeof retentionPolicySchema>;
