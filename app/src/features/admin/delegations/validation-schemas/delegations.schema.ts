import { z } from "zod";

export const delegationFormSchema = z
    .object({
        delegate_membership_id: z.string().min(1, "Pick who receives the responsibilities"),
        delegator_membership_id: z.string(),
        permission_keys: z.array(z.string()),
        role_ids: z.array(z.string()),
        scope_type: z.enum(["ORGANIZATION", "BRANCH", "BRANCH_HIERARCHY", "TEAM", "PROJECT", "RESOURCE", "CUSTOMER"]),
        scope_id: z.string().optional(),
        starts_at: z.string().min(1, "Pick a start date"),
        ends_at: z.string().min(1, "Pick an end date"),
        reason: z.string().trim().min(1, "Say why (kept in the audit history)").max(500),
    })
    .refine((v) => v.permission_keys.length + v.role_ids.length > 0, { message: "Pick at least one permission or role", path: ["permission_keys"] })
    .refine((v) => !v.starts_at || !v.ends_at || v.ends_at >= v.starts_at, { message: "The end must be on or after the start", path: ["ends_at"] })
    .refine((v) => v.scope_type === "ORGANIZATION" || !!v.scope_id, { message: "Pick where this applies", path: ["scope_id"] })
    .refine((v) => v.delegate_membership_id !== v.delegator_membership_id, { message: "A member cannot delegate to themselves", path: ["delegate_membership_id"] });
export type DelegationFormValues = z.infer<typeof delegationFormSchema>;
