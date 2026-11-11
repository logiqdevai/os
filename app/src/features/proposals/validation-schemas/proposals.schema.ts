import { z } from "zod";

const optionalId = z.string().uuid().nullable().optional();

export const proposalFormSchema = z.object({
    title: z.string().trim().min(1, "Enter a title").max(300),
    company_id: optionalId,
    contact_id: optionalId,
    deal_id: optionalId,
    project_id: optionalId,
    owner_membership_id: optionalId,
    branch_id: z.string().optional(),
    template_id: z.string().optional(),
    currency: z.string().length(3),
    language: z.string().min(2).max(10),
    requires_contract: z.boolean(),
});
export type ProposalFormValues = z.infer<typeof proposalFormSchema>;

export const templateFormSchema = z.object({
    name: z.string().trim().min(1, "Enter a name").max(200),
    description: z.string().max(2000).optional(),
    work_type: z.string().max(60).optional(),
    language: z.string().min(2).max(10),
    default_validity_days: z.number({ message: "Enter a number of days" }).int().min(1, "At least 1 day").max(365),
    payment_terms: z.string().max(4000).optional(),
    is_default: z.boolean(),
});
export type TemplateFormValues = z.infer<typeof templateFormSchema>;

export const publicDecisionSchema = z.object({
    signer_name: z.string().trim().min(2, "Enter your full name").max(200),
    signer_email: z.string().trim().email("Enter a valid email"),
    signer_title: z.string().max(200).optional(),
    terms_accepted: z.boolean(),
    feedback: z.string().max(10000).optional(),
});
export type PublicDecisionFormValues = z.infer<typeof publicDecisionSchema>;
