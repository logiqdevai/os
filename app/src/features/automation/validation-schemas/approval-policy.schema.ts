import { z } from "zod";

/** Hours as typed text ("" = not set); converted to a number on submit. */
const hours = z.string().trim().refine((v) => v === "" || (/^\d+$/.test(v) && Number(v) >= 1 && Number(v) <= 2160), "Whole hours between 1 and 2160");

/** Approval policy form (20 §4). At least one approver, team or role; escalation needs a target. */
export const approvalPolicySchema = z
    .object({
        name: z.string().trim().min(1, "Give the policy a name").max(120),
        description: z.string().max(1000).optional(),
        approver_membership_ids: z.array(z.string()),
        approver_team_ids: z.array(z.string()),
        approver_role_ids: z.array(z.string()),
        allow_rule_owner: z.boolean(),
        expires_after_hours: hours,
        escalate_after_hours: hours,
        escalate_to_membership_id: z.string().nullable(),
        delegate_when_out_of_office: z.boolean(),
    })
    .refine((v) => v.approver_membership_ids.length + v.approver_team_ids.length + v.approver_role_ids.length > 0, { message: "Add at least one approver, team or role", path: ["approver_membership_ids"] })
    .refine((v) => v.escalate_after_hours === "" || !!v.escalate_to_membership_id, { message: "Choose who the request escalates to", path: ["escalate_to_membership_id"] });

export type ApprovalPolicyFormValues = z.infer<typeof approvalPolicySchema>;
