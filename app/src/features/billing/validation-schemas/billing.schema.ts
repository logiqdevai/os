import { z } from "zod";

const decimal = (label: string) => z.string().trim().regex(/^-?\d+(\.\d{1,4})?$/, `${label} must be a number`);
const positive = (label: string) => decimal(label).refine((v) => Number(v) > 0, `${label} must be more than zero`);

export const invoiceLineSchema = z.object({
    product_id: z.string().nullable().optional(),
    price_id: z.string().nullable().optional(),
    description: z.string().trim().min(1, "Describe the line"),
    quantity: positive("Quantity"),
    unit_amount: decimal("Price"),
    discount_amount: z.string().trim().regex(/^(\d+(\.\d{1,2})?)?$/, "Discount must be a number").optional(),
    tax_rate_id: z.string().nullable().optional(),
});
export const invoiceFormSchema = z.object({
    billing_profile_id: z.string().min(1, "Choose a customer"),
    project_id: z.string().nullable().optional(),
    issue_date: z.string().optional(),
    due_date: z.string().optional(),
    coupon_id: z.string().optional(),
    notes: z.string().max(5000).optional(),
    payment_instructions: z.string().max(2000).optional(),
    lines: z.array(invoiceLineSchema).min(1, "Add at least one line"),
});
export type InvoiceFormValues = z.infer<typeof invoiceFormSchema>;

export const recordPaymentSchema = z.object({
    amount: positive("Amount"),
    method_type: z.string().min(1),
    received_at: z.string().min(1, "Pick a date"),
    reference: z.string().max(200).optional(),
    fee_amount: z.string().regex(/^(\d+(\.\d{1,2})?)?$/, "Fee must be a number").optional(),
});
export type RecordPaymentFormValues = z.infer<typeof recordPaymentSchema>;

export const productFormSchema = z.object({
    name: z.string().trim().min(1, "Enter a name").max(160),
    type: z.string().min(1),
    description: z.string().max(2000).optional(),
    unit: z.string().max(40).optional(),
    default_tax_rate_id: z.string().optional(),
    price_amount: z.string().regex(/^(\d+(\.\d{1,2})?)?$/, "Price must be a number").optional(),
    price_currency: z.string().length(3, "3-letter currency"),
    price_interval: z.string().optional(),
});
export type ProductFormValues = z.infer<typeof productFormSchema>;

export const taxRateFormSchema = z.object({
    name: z.string().trim().min(1, "Enter a name").max(120),
    percentage: decimal("Percentage").refine((v) => Number(v) >= 0 && Number(v) <= 100, "Between 0 and 100"),
    country: z.string().max(2).optional(),
    behavior: z.enum(["EXCLUSIVE", "INCLUSIVE"]),
    is_default: z.boolean(),
    is_reverse_charge: z.boolean(),
    invoice_note: z.string().max(500).optional(),
});
export type TaxRateFormValues = z.infer<typeof taxRateFormSchema>;

export const couponFormSchema = z.object({
    name: z.string().trim().min(1, "Enter a name").max(120),
    code: z.string().trim().max(40).regex(/^[A-Za-z0-9_-]*$/, "Letters, digits, - and _ only").optional(),
    type: z.enum(["PERCENTAGE", "FIXED"]),
    value: positive("Value"),
    currency: z.string().optional(),
    max_redemptions: z.string().regex(/^\d*$/, "Whole number").optional(),
}).refine((v) => v.type !== "PERCENTAGE" || Number(v.value) <= 100, { message: "At most 100%", path: ["value"] });
export type CouponFormValues = z.infer<typeof couponFormSchema>;

export const billingProfileFormSchema = z.object({
    company_id: z.string().min(1, "Choose a company"),
    legal_name: z.string().trim().min(1, "Enter the legal name").max(200),
    billing_email: z.string().email("Enter a valid e-mail").or(z.literal("")).optional(),
    vat_number: z.string().max(40).optional(),
    tax_id: z.string().max(40).optional(),
    currency: z.string().length(3, "3-letter currency"),
    payment_terms_days: z.string().regex(/^\d+$/, "Days as a whole number"),
    tax_exempt: z.boolean(),
    reverse_charge: z.boolean(),
    line1: z.string().max(200).optional(),
    city: z.string().max(120).optional(),
    postal_code: z.string().max(20).optional(),
    country: z.string().max(2).optional(),
    notes: z.string().max(5000).optional(),
});
export type BillingProfileFormValues = z.infer<typeof billingProfileFormSchema>;

export const connectProviderSchema = z.object({
    display_name: z.string().trim().min(1, "Enter a name").max(120),
    secret_key: z.string().trim().min(10, "Paste the secret key (sk_…)"),
    webhook_signing_secret: z.string().trim().optional(),
    publishable_key: z.string().trim().optional(),
    currencies: z.string().optional(),
    is_default: z.boolean(),
});
export type ConnectProviderFormValues = z.infer<typeof connectProviderSchema>;

export const subscriptionFormSchema = z.object({
    billing_profile_id: z.string().min(1, "Choose a customer"),
    price_id: z.string().optional(),
    description: z.string().max(500).optional(),
    unit_amount: z.string().regex(/^(\d+(\.\d{1,2})?)?$/, "Amount must be a number").optional(),
    quantity: positive("Quantity"),
    interval: z.string().min(1),
    start_date: z.string().optional(),
    trial_days: z.string().regex(/^\d*$/, "Whole number").optional(),
}).refine((v) => !!v.price_id || !!v.unit_amount, { message: "Choose a price or enter an amount", path: ["unit_amount"] });
export type SubscriptionFormValues = z.infer<typeof subscriptionFormSchema>;

export const paymentLinkSchema = z.object({
    title: z.string().trim().min(1, "Enter a title").max(160),
    amount: positive("Amount"),
    currency: z.string().length(3, "3-letter currency"),
    description: z.string().max(1000).optional(),
    max_uses: z.string().regex(/^\d*$/, "Whole number").optional(),
});
export type PaymentLinkFormValues = z.infer<typeof paymentLinkSchema>;
