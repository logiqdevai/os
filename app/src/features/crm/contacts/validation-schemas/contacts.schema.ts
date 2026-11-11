import { z } from "zod";

export const contactFormSchema = z.object({
    first_name: z.string().trim().min(1, "Enter a first name").max(100),
    last_name: z.string().trim().max(100).optional(),
    email: z.union([z.literal(""), z.string().trim().email("Enter a valid email")]).optional(),
    phone: z.string().trim().max(40).optional(),
    mobile: z.string().trim().max(40).optional(),
    job_title: z.string().trim().max(120).optional(),
    company_id: z.string().optional(),
    company_label: z.string().optional(),
    linkedin_url: z.string().trim().max(300).optional(),
    roles: z.array(z.enum(["PRIMARY", "DECISION_MAKER", "TECHNICAL", "BILLING", "PROJECT_STAKEHOLDER", "EXECUTIVE"])),
    lifecycle_stage_id: z.string().optional(),
    owner_membership_id: z.string().optional(),
    email_consent: z.boolean(),
    description: z.string().trim().max(5000).optional(),
});
export type ContactFormValues = z.infer<typeof contactFormSchema>;
