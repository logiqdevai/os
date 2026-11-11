import { z } from "zod";

export const memberProfileSchema = z.object({
    job_title: z.string().trim().max(120),
    type: z.enum(["INTERNAL", "EXTERNAL_COLLABORATOR", "GUEST"]),
    default_branch_id: z.string(),
});
export type MemberProfileFormValues = z.infer<typeof memberProfileSchema>;
