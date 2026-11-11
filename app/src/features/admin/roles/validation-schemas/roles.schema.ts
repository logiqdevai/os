import { z } from "zod";

export const roleFormSchema = z.object({
    name: z.string().trim().min(2, "Use at least 2 characters").max(80),
    description: z.string().trim().max(500),
    type: z.enum(["ORGANIZATION", "BRANCH", "TEAM", "PROJECT"]),
    template_role_id: z.string(),
});
export type RoleFormValues = z.infer<typeof roleFormSchema>;

export const roleDetailsSchema = z.object({
    name: z.string().trim().min(2, "Use at least 2 characters").max(80),
    description: z.string().trim().max(500),
    default_scope: z.enum(["ORGANIZATION", "BRANCH", "BRANCH_HIERARCHY", "TEAM", "PROJECT", "RESOURCE", "CUSTOMER"]),
});
export type RoleDetailsFormValues = z.infer<typeof roleDetailsSchema>;
