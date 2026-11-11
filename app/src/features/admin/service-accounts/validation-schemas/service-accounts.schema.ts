import { z } from "zod";

export const serviceAccountFormSchema = z.object({
    name: z.string().trim().min(2, "Use at least 2 characters").max(80),
    purpose: z.string().trim().max(500),
    expires_at: z.string(),
    role_id: z.string(),
});
export type ServiceAccountFormValues = z.infer<typeof serviceAccountFormSchema>;
