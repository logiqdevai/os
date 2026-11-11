import { z } from "zod";

export const dealFormSchema = z.object({
    name: z.string().trim().min(1, "Enter a deal name").max(200),
    pipeline_id: z.string().optional(),
    stage_id: z.string().optional(),
    company_id: z.string().optional(),
    company_label: z.string().optional(),
    primary_contact_id: z.string().optional(),
    contact_label: z.string().optional(),
    owner_membership_id: z.string().optional(),
    value: z.string().trim().regex(/^(\d+(\.\d{1,2})?)?$/, "Enter an amount, e.g. 12000").optional(),
    currency: z.string().trim().regex(/^([A-Za-z]{3})?$/, "3-letter code, e.g. EUR").optional(),
    expected_close_date: z.string().optional(),
    deal_type: z.string().trim().max(60).optional(),
    lead_source_id: z.string().optional(),
    next_step: z.string().trim().max(500).optional(),
    description: z.string().trim().max(5000).optional(),
});
export type DealFormValues = z.infer<typeof dealFormSchema>;

export const dealLostSchema = z.object({
    lost_reason_id: z.string().min(1, "Pick a reason"),
    lost_reason: z.string().trim().max(1000).optional(),
    competitor: z.string().trim().max(120).optional(),
});
export type DealLostValues = z.infer<typeof dealLostSchema>;

export const dealWonSchema = z.object({
    won_note: z.string().trim().max(1000).optional(),
    actual_close_date: z.string().optional(),
    set_customer: z.boolean(),
});
export type DealWonValues = z.infer<typeof dealWonSchema>;

export const lineItemsSchema = z.object({
    discount_percent: z.string().trim().regex(/^(\d{1,2}(\.\d{1,2})?|100)?$/, "0–100").optional(),
    items: z.array(z.object({
        name: z.string().trim().min(1, "Name required").max(200),
        quantity: z.string().trim().regex(/^\d+(\.\d{1,3})?$/, "Qty"),
        unit_price: z.string().trim().regex(/^\d+(\.\d{1,2})?$/, "Price"),
        discount_percent: z.string().trim().regex(/^(\d{1,2}(\.\d{1,2})?|100)?$/, "0–100").optional(),
        tax_percent: z.string().trim().regex(/^(\d{1,2}(\.\d{1,2})?|100)?$/, "0–100").optional(),
        is_recurring: z.boolean(),
        billing_frequency: z.string().optional(),
    })),
});
export type LineItemsValues = z.infer<typeof lineItemsSchema>;
