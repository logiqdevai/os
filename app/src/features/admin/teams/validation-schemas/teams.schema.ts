import { z } from "zod";

export const teamFormSchema = z.object({
    name: z.string().trim().min(1, "Enter a name").max(120),
    description: z.string().trim().max(2000).optional(),
    kind: z.enum(["TEAM", "DEPARTMENT", "BUSINESS_UNIT", "PROJECT_TEAM"]),
    task_key: z
        .string()
        .trim()
        .toUpperCase()
        .regex(/^([A-Z][A-Z0-9]{1,5})?$/, "2–6 letters or digits, starting with a letter")
        .optional(),
    branch_id: z.string().optional(),
});
export type TeamFormValues = z.infer<typeof teamFormSchema>;
