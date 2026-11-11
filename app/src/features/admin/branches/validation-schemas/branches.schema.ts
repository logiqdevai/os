import { z } from "zod";

export const branchFormSchema = z.object({
    name: z.string().trim().min(1, "Enter a name").max(120),
    code: z.string().trim().regex(/^([A-Za-z0-9_-]{1,20})?$/, "1–20 letters, digits, - or _"),
    kind: z.enum(["OPERATIONAL", "OFFICE", "REGIONAL_UNIT", "SUBSIDIARY_REFERENCE", "SERVICE_CENTER", "REMOTE"]),
    status: z.enum(["ACTIVE", "PLANNED", "TEMPORARILY_CLOSED", "SUSPENDED"]),
    parent_branch_id: z.string(),
    is_headquarters: z.boolean(),
    country: z.string(),
    city: z.string().trim().max(120),
    email: z.union([z.literal(""), z.string().trim().email("Enter a valid email")]),
    phone: z.string().trim().max(40),
    timezone: z.string(),
    currency: z.string().trim().toUpperCase().regex(/^([A-Z]{3})?$/, "3-letter code, e.g. EUR"),
});
export type BranchFormValues = z.infer<typeof branchFormSchema>;
