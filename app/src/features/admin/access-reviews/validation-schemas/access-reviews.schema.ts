import { z } from "zod";

export const accessReviewFormSchema = z
    .object({
        name: z.string().trim().min(1, "Enter a name").max(160),
        description: z.string().trim().max(2000).optional(),
        scope_type: z.enum(["ORGANIZATION", "BRANCH", "BRANCH_HIERARCHY", "TEAM", "PROJECT", "RESOURCE", "CUSTOMER"]),
        scope_id: z.string().optional(),
        modules: z.array(z.string()),
        reviewer_strategy: z.enum(["BRANCH_MANAGERS", "TEAM_LEADS", "LINE_MANAGER", "SPECIFIC"]),
        reviewer_membership_ids: z.array(z.string()),
        starts_at: z.string().optional(),
        due_at: z.string().min(1, "Pick a due date"),
    })
    .refine((v) => v.scope_type === "ORGANIZATION" || !!v.scope_id, { message: "Pick the branch or team", path: ["scope_id"] })
    .refine((v) => v.reviewer_strategy !== "SPECIFIC" || v.reviewer_membership_ids.length > 0, { message: "Pick at least one reviewer", path: ["reviewer_membership_ids"] })
    .refine((v) => !v.starts_at || v.starts_at <= v.due_at, { message: "The due date must be after the start", path: ["due_at"] });
export type AccessReviewFormValues = z.infer<typeof accessReviewFormSchema>;
