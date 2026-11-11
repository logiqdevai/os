import { z } from "zod";

const amount = (label: string) => z.string().trim().regex(/^\d+(\.\d{1,2})?$/, `${label} must be a number`);
const optAmount = (label: string) => z.string().trim().regex(/^(\d+(\.\d{1,2})?)?$/, `${label} must be a number`).optional();

export const recordFormSchema = z.object({
    type: z.enum(["INCOME", "EXPENSE"]),
    description: z.string().trim().min(1, "Describe the record").max(500),
    category_id: z.string().optional(),
    reference_number: z.string().max(120).optional(),
    transaction_date: z.string().min(1, "Pick a date"),
    due_date: z.string().optional(),
    amount: amount("Amount"),
    pricing_mode: z.enum(["EXCLUSIVE", "INCLUSIVE"]),
    tax_rate_id: z.string().optional(),
    vat_percent: z.string().regex(/^(\d+(\.\d{1,2})?)?$/, "VAT % must be a number").optional(),
    vat_treatment: z.string().optional(),
    override_vat: z.boolean(),
    vat_amount: optAmount("VAT"),
    currency: z.string().length(3, "3-letter currency"),
    company_id: z.string().nullable().optional(),
    project_id: z.string().nullable().optional(),
    payment_method_id: z.string().optional(),
    mark_paid: z.boolean(),
    payment_date: z.string().optional(),
    notes: z.string().max(5000).optional(),
});
export type RecordFormValues = z.infer<typeof recordFormSchema>;

export const settlementSchema = z.object({
    kind: z.enum(["PAYMENT", "REFUND", "WRITE_OFF", "ADJUSTMENT"]),
    amount: amount("Amount").refine((v) => Number(v) > 0, "Must be more than zero"),
    settled_on: z.string().min(1, "Pick a date"),
    payment_method_id: z.string().optional(),
    reference: z.string().max(200).optional(),
});
export type SettlementFormValues = z.infer<typeof settlementSchema>;

export const recurringFormSchema = z.object({
    name: z.string().trim().min(1, "Enter a name").max(160),
    category_id: z.string().optional(),
    company_id: z.string().nullable().optional(),
    payment_method_id: z.string().optional(),
    expected_net_amount: amount("Amount"),
    vat_percent: z.string().regex(/^(\d+(\.\d{1,2})?)?$/, "VAT % must be a number").optional(),
    currency: z.string().length(3, "3-letter currency"),
    interval: z.string().min(1),
    interval_count: z.string().regex(/^[1-9]\d*$/, "Whole number"),
    start_date: z.string().min(1, "Pick a start date"),
    end_date: z.string().optional(),
    due_days: z.string().regex(/^\d*$/, "Whole number").optional(),
    auto_generate: z.boolean(),
});
export type RecurringFormValues = z.infer<typeof recurringFormSchema>;

export const claimFormSchema = z.object({
    title: z.string().trim().min(1, "Enter a title").max(200),
    currency: z.string().length(3, "3-letter currency"),
    notes: z.string().max(2000).optional(),
    lines: z.array(z.object({
        expense_date: z.string().min(1, "Date"),
        category_id: z.string().optional(),
        description: z.string().trim().min(1, "Describe it"),
        merchant: z.string().max(200).optional(),
        gross_amount: amount("Amount").refine((v) => Number(v) > 0, "More than zero"),
        vat_amount: optAmount("VAT"),
    })).min(1, "Add at least one receipt"),
});
export type ClaimFormValues = z.infer<typeof claimFormSchema>;

export const categoryFormSchema = z.object({
    kind: z.enum(["INCOME", "EXPENSE"]),
    name: z.string().trim().min(1, "Enter a name").max(120),
    parent_category_id: z.string().optional(),
    pl_line: z.string().optional(),
    default_tax_rate_id: z.string().optional(),
    is_operating: z.boolean(),
});
export type CategoryFormValues = z.infer<typeof categoryFormSchema>;

export const paymentMethodFormSchema = z.object({
    name: z.string().trim().min(1, "Enter a name").max(120),
    type: z.string().min(1),
    track_balance: z.boolean(),
    currency: z.string().max(3).optional(),
    opening_balance: z.string().regex(/^(-?\d+(\.\d{1,2})?)?$/, "Must be a number").optional(),
    opening_date: z.string().optional(),
});
export type PaymentMethodFormValues = z.infer<typeof paymentMethodFormSchema>;

export const supplierProfileSchema = z.object({
    default_category_id: z.string().optional(),
    default_tax_rate_id: z.string().optional(),
    payment_terms_days: z.string().regex(/^\d*$/, "Whole number").optional(),
    vat_number: z.string().max(40).optional(),
    iban: z.string().max(40).optional(),
    notes: z.string().max(2000).optional(),
});
export type SupplierProfileFormValues = z.infer<typeof supplierProfileSchema>;
