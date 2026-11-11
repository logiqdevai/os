import { z } from "zod";

const money = z.string().trim().refine((v) => v === "" || (!Number.isNaN(Number(v)) && Number(v) >= 0), "Enter an amount");
const int = z.string().trim().refine((v) => v === "" || (/^\d+$/.test(v)), "Whole number");

export const contractFormSchema = z
    .object({
        title: z.string().trim().min(1, "Enter a title").max(200),
        type_id: z.string(),
        template_id: z.string(),
        primary_company_id: z.string().nullable(),
        owner_membership_id: z.string().nullable(),
        currency: z.string().length(3),
        start_date: z.string(),
        end_date: z.string(),
        renewal_type: z.enum(["NONE", "MANUAL", "AUTOMATIC", "EVERGREEN"]),
        renewal_term_months: int,
        notice_days: int,
        total_value: money,
        recurring_value: money,
        billing_frequency: z.string(),
        payment_terms: z.string().max(500),
        processes_personal_data: z.boolean(),
    })
    .refine((v) => !v.start_date || !v.end_date || v.end_date >= v.start_date, { path: ["end_date"], message: "Ends before it starts" });
export type ContractFormValues = z.infer<typeof contractFormSchema>;
