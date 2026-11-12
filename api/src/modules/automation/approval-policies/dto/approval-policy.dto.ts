import { z } from 'zod';
import { BaseListQuerySchema, boolish } from '@/shared/utils/pagination/pagination.utils';

const ids = z.array(z.string().uuid()).max(100);

/** 20 §4, §6 — reusable approver policy. Shared by REST (ZodValidationPipe) and the MCP tools. */
export const CreateApprovalPolicySchema = z.object({
    name: z.string().trim().min(1).max(120),
    description: z.string().max(1000).nullish(),
    approver_membership_ids: ids.default([]),
    approver_team_ids: ids.default([]),
    approver_role_ids: ids.default([]),
    allow_rule_owner: z.boolean().default(false),
    expires_after_hours: z.number().int().min(1).max(24 * 90).nullish(),
    escalate_after_hours: z.number().int().min(1).max(24 * 90).nullish(),
    escalate_to_membership_id: z.string().uuid().nullish(),
    delegate_when_out_of_office: z.boolean().default(true),
});
export type CreateApprovalPolicyInput = z.infer<typeof CreateApprovalPolicySchema>;

export const UpdateApprovalPolicySchema = CreateApprovalPolicySchema.partial();
export type UpdateApprovalPolicyInput = z.infer<typeof UpdateApprovalPolicySchema>;

export const ApprovalPolicyQuerySchema = BaseListQuerySchema.extend({ archived: boolish });
export type ApprovalPolicyQuery = z.infer<typeof ApprovalPolicyQuerySchema>;
