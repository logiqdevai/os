import { z } from "zod";

export const leadFormSchema = z.object({
    name: z.string().trim().min(1, "Enter a name for the lead").max(200),
    company_name: z.string().trim().max(200).optional(),
    contact_name: z.string().trim().max(200).optional(),
    email: z.union([z.literal(""), z.string().trim().email("Enter a valid email")]).optional(),
    phone: z.string().trim().max(40).optional(),
    website: z.string().trim().max(300).optional(),
    industry: z.string().trim().max(120).optional(),
    estimated_value: z.string().trim().regex(/^(\d+(\.\d{1,2})?)?$/, "Enter an amount").optional(),
    status_id: z.string().optional(),
    lead_source_id: z.string().optional(),
    owner_membership_id: z.string().optional(),
    manual_score: z.string().trim().regex(/^(\d{1,2}|100)?$/, "0–100").optional(),
    next_follow_up_at: z.string().optional(),
    description: z.string().trim().max(5000).optional(),
});
export type LeadFormValues = z.infer<typeof leadFormSchema>;

export const leadLostSchema = z.object({
    lost_reason_id: z.string().min(1, "Pick a reason"),
    lost_reason: z.string().trim().max(1000).optional(),
});
export type LeadLostValues = z.infer<typeof leadLostSchema>;

/** Lead conversion wizard (02 §7). `*_mode`: new | existing | none. */
export const convertLeadSchema = z
    .object({
        company_mode: z.enum(["new", "existing", "none"]),
        company_existing_id: z.string().optional(),
        company_label: z.string().optional(),
        company_name: z.string().trim().max(200).optional(),
        company_website: z.string().trim().max(300).optional(),
        contact_mode: z.enum(["new", "existing", "none"]),
        contact_existing_id: z.string().optional(),
        contact_label: z.string().optional(),
        contact_first_name: z.string().trim().max(100).optional(),
        contact_last_name: z.string().trim().max(100).optional(),
        contact_email: z.union([z.literal(""), z.string().trim().email("Enter a valid email")]).optional(),
        create_deal: z.boolean(),
        deal_name: z.string().trim().max(200).optional(),
        deal_pipeline_id: z.string().optional(),
        deal_stage_id: z.string().optional(),
        deal_value: z.string().trim().regex(/^(\d+(\.\d{1,2})?)?$/, "Enter an amount").optional(),
        deal_close_date: z.string().optional(),
    })
    .superRefine((v, ctx) => {
        if (v.company_mode === "new" && !v.company_name) ctx.addIssue({ code: "custom", path: ["company_name"], message: "Enter the company name" });
        if (v.company_mode === "existing" && !v.company_existing_id) ctx.addIssue({ code: "custom", path: ["company_existing_id"], message: "Pick a company" });
        if (v.contact_mode === "new" && !v.contact_first_name) ctx.addIssue({ code: "custom", path: ["contact_first_name"], message: "Enter a first name" });
        if (v.contact_mode === "existing" && !v.contact_existing_id) ctx.addIssue({ code: "custom", path: ["contact_existing_id"], message: "Pick a contact" });
        if (v.create_deal && !v.deal_name) ctx.addIssue({ code: "custom", path: ["deal_name"], message: "Enter a deal name" });
    });
export type ConvertLeadValues = z.infer<typeof convertLeadSchema>;
