import { z } from "zod";

const amount = z.string().trim().regex(/^(\d+(\.\d{1,2})?)?$/, "Enter an amount, e.g. 25000").optional();

export const companyFormSchema = z.object({
    name: z.string().trim().min(1, "Enter a name").max(200),
    type: z.enum(["PROSPECT", "CUSTOMER", "PARTNER", "VENDOR", "OTHER"]),
    website: z.string().trim().max(300).optional(),
    email: z.union([z.literal(""), z.string().trim().email("Enter a valid email")]).optional(),
    phone: z.string().trim().max(40).optional(),
    industry: z.string().trim().max(120).optional(),
    company_size: z.string().trim().max(40).optional(),
    country: z.string().trim().max(2, "Use a 2-letter code").optional(),
    vat_number: z.string().trim().max(60).optional(),
    lifecycle_stage_id: z.string().optional(),
    lead_source_id: z.string().optional(),
    owner_membership_id: z.string().optional(),
    annual_revenue: amount,
    description: z.string().trim().max(5000).optional(),
});
export type CompanyFormValues = z.infer<typeof companyFormSchema>;
