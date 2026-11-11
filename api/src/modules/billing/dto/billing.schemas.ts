import { z } from 'zod';
import {
    BillingInterval, BillingModel, CollectionMethod, CouponDuration, DiscountType, DunningAction, FinanceApprovalEntityType, InvoiceStatus, LedgerRecordType,
    PaymentLinkStatus, PaymentMethodType, PaymentProvider, PaymentStatus, PriceType, ProductType, SubscriptionStatus, TaxBehavior,
} from 'generated/prisma';
import { BaseListQuerySchema, boolish, csv } from '@/shared/utils/pagination/pagination.utils';
import { currency, dateStr, money, moneyPos, percent } from '@/modules/ledger/dto/ledger.schemas';

/** 08 Billing schemas — one per action, used by REST (ZodBodyPipe) and MCP tools alike. */
const uuid = z.string().uuid();
const optUuid = uuid.nullable().optional();
const optText = (max = 2000) => z.string().max(max).nullable().optional();
const address = z.object({ line1: z.string().max(200).optional(), line2: z.string().max(200).optional(), city: z.string().max(120).optional(), postal_code: z.string().max(20).optional(), region: z.string().max(120).optional(), country: z.string().max(2).optional() }).nullable().optional();

// --- Catalog -------------------------------------------------------------------------------------------
export const PriceSchema = z.object({
    name: optText(120),
    currency: currency,
    unit_amount: moneyPos,
    type: z.nativeEnum(PriceType).optional(),
    interval: z.nativeEnum(BillingInterval).nullable().optional(),
    interval_count: z.number().int().min(1).max(36).nullable().optional(),
    trial_days: z.number().int().min(0).max(365).nullable().optional(),
    setup_fee: moneyPos.nullable().optional(),
    is_active: z.boolean().optional(),
});
export type PriceDto = z.infer<typeof PriceSchema>;
export const CreateProductSchema = z.object({
    name: z.string().trim().min(1).max(160),
    type: z.nativeEnum(ProductType).optional(),
    description: optText(2000),
    unit: optText(40),
    default_tax_rate_id: optUuid,
    is_active: z.boolean().optional(),
    prices: z.array(PriceSchema).max(20).optional(),
});
export const UpdateProductSchema = CreateProductSchema.partial().omit({ prices: true });
export type CreateProductDto = z.infer<typeof CreateProductSchema>;
export type UpdateProductDto = z.infer<typeof UpdateProductSchema>;
export const ProductQuerySchema = BaseListQuerySchema.extend({ type: z.nativeEnum(ProductType).optional(), active: boolish, archived: boolish });
export type ProductQuery = z.infer<typeof ProductQuerySchema>;

export const CreateTaxRateSchema = z.object({
    name: z.string().trim().min(1).max(120),
    percentage: percent,
    country: z.string().max(2).nullable().optional(),
    region: optText(120),
    behavior: z.nativeEnum(TaxBehavior).optional(),
    is_default: z.boolean().optional(),
    is_active: z.boolean().optional(),
    is_reverse_charge: z.boolean().optional(),
    tax_category: optText(40),
    invoice_note: optText(500),
});
export const UpdateTaxRateSchema = CreateTaxRateSchema.partial();
export type CreateTaxRateDto = z.infer<typeof CreateTaxRateSchema>;
export type UpdateTaxRateDto = z.infer<typeof UpdateTaxRateSchema>;

export const CreateCouponSchema = z.object({
    name: z.string().trim().min(1).max(120),
    code: z.string().trim().max(40).regex(/^[A-Za-z0-9_-]*$/, 'letters, digits, - and _ only').nullable().optional(),
    type: z.nativeEnum(DiscountType),
    value: moneyPos,
    currency: currency.nullable().optional(),
    duration: z.nativeEnum(CouponDuration).optional(),
    duration_months: z.number().int().min(1).max(60).nullable().optional(),
    max_redemptions: z.number().int().min(1).nullable().optional(),
    valid_from: dateStr.nullable().optional(),
    valid_until: dateStr.nullable().optional(),
    is_active: z.boolean().optional(),
}).refine((v) => v.type !== 'PERCENTAGE' || Number(v.value) <= 100, { message: 'A percentage discount is at most 100', path: ['value'] })
    .refine((v) => v.type !== 'FIXED' || !!v.currency, { message: 'A fixed discount needs a currency', path: ['currency'] });
export type CreateCouponDto = z.infer<typeof CreateCouponSchema>;

// --- Billing profiles ---------------------------------------------------------------------------------------
export const CreateBillingProfileSchema = z.object({
    company_id: uuid,
    legal_name: z.string().trim().min(1).max(200),
    billing_email: z.string().email().nullable().optional(),
    billing_contact_ids: z.array(uuid).max(20).optional(),
    billing_address: address,
    shipping_address: address,
    tax_id: optText(40),
    vat_number: optText(40),
    tax_exempt: z.boolean().optional(),
    reverse_charge: z.boolean().optional(),
    currency: currency.optional(),
    payment_terms_days: z.number().int().min(0).max(365).optional(),
    dunning_policy_id: optUuid,
    preferred_provider_connection_id: optUuid,
    custom_pricing: z.record(z.string(), z.union([z.number(), z.string()])).nullable().optional(),
    notes: optText(5000),
});
export const UpdateBillingProfileSchema = CreateBillingProfileSchema.partial().omit({ company_id: true });
export type CreateBillingProfileDto = z.infer<typeof CreateBillingProfileSchema>;
export type UpdateBillingProfileDto = z.infer<typeof UpdateBillingProfileSchema>;
export const BillingProfileQuerySchema = BaseListQuerySchema.extend({ with_balance: boolish });
export type BillingProfileQuery = z.infer<typeof BillingProfileQuerySchema>;

// --- Invoices ---------------------------------------------------------------------------------------------------
export const InvoiceLineSchema = z.object({
    product_id: optUuid,
    price_id: optUuid,
    description: z.string().trim().min(1).max(1000),
    quantity: money.refine((v) => Number(v) > 0, 'must be more than zero'),
    unit: optText(40),
    unit_amount: money,
    discount_amount: moneyPos.optional(),
    tax_rate_id: optUuid,
    /** Explicit percentage when no tax rate is chosen. */
    tax_percent: percent.nullable().optional(),
    milestone_id: optUuid,
    adjustment_amount: money.optional(),
    adjustment_reason: optText(500),
    period_start: dateStr.nullable().optional(),
    period_end: dateStr.nullable().optional(),
});
export type InvoiceLineDto = z.infer<typeof InvoiceLineSchema>;

export const CreateInvoiceSchema = z.object({
    billing_profile_id: uuid,
    project_id: optUuid,
    contract_id: optUuid,
    subscription_id: optUuid,
    branch_id: optUuid,
    billing_model: z.nativeEnum(BillingModel).nullable().optional(),
    currency: currency.optional(),
    issue_date: dateStr.nullable().optional(),
    due_date: dateStr.nullable().optional(),
    period_start: dateStr.nullable().optional(),
    period_end: dateStr.nullable().optional(),
    coupon_id: optUuid,
    collection_method: z.nativeEnum(CollectionMethod).optional(),
    accepted_methods: z.array(z.nativeEnum(PaymentMethodType)).max(7).optional(),
    notes: optText(5000),
    payment_instructions: optText(2000),
    footer: optText(2000),
    template_id: optUuid,
    provider_connection_id: optUuid,
    scheduled_send_at: z.string().datetime().nullable().optional(),
    lines: z.array(InvoiceLineSchema).min(1).max(200),
});
export const UpdateInvoiceSchema = CreateInvoiceSchema.partial().omit({ billing_profile_id: true });
export type CreateInvoiceDto = z.infer<typeof CreateInvoiceSchema>;
export type UpdateInvoiceDto = z.infer<typeof UpdateInvoiceSchema>;

export const InvoiceQuerySchema = BaseListQuerySchema.extend({
    status: csv(z.nativeEnum(InvoiceStatus)),
    company_id: z.string().uuid().optional(),
    billing_profile_id: z.string().uuid().optional(),
    project_id: z.string().uuid().optional(),
    subscription_id: z.string().uuid().optional(),
    from: dateStr.optional(),
    to: dateStr.optional(),
    overdue: boolish,
    needs_approval: boolish,
});
export type InvoiceQuery = z.infer<typeof InvoiceQuerySchema>;

export const SendInvoiceSchema = z.object({ to: z.array(z.string().email()).max(10).optional(), message: optText(5000), create_payment_link: z.boolean().optional() });
export type SendInvoiceDto = z.infer<typeof SendInvoiceSchema>;
export const ApproveSchema = z.object({ comment: optText(1000) });
export const ReasonSchema = z.object({ reason: z.string().trim().min(1).max(1000) });
export const WriteOffSchema = z.object({ reason: z.string().trim().min(1).max(1000), amount: moneyPos.optional() });
export const RemindSchema = z.object({ message: optText(5000) });

// --- Payments --------------------------------------------------------------------------------------------------------
export const AllocationSchema = z.object({ invoice_id: uuid, amount: moneyPos.refine((v) => Number(v) > 0, 'must be more than zero') });
export const RecordPaymentSchema = z.object({
    billing_profile_id: optUuid,
    method_type: z.nativeEnum(PaymentMethodType).optional(),
    provider: z.enum([PaymentProvider.MANUAL, PaymentProvider.BANK]).optional(),
    currency: currency.optional(),
    amount: moneyPos.refine((v) => Number(v) > 0, 'must be more than zero'),
    fee_amount: moneyPos.optional(),
    tax_amount: moneyPos.optional(),
    received_at: dateStr.optional(),
    reference: optText(200),
    kind: z.enum(['deposit', 'milestone', 'invoice', 'subscription', 'one_time']).nullable().optional(),
    allocations: z.array(AllocationSchema).max(50).optional(),
    notes: optText(2000),
});
export type RecordPaymentDto = z.infer<typeof RecordPaymentSchema>;
/** Shortcut on an invoice: amount defaults to the amount due. */
export const InvoicePaymentSchema = z.object({
    amount: moneyPos.optional(),
    method_type: z.nativeEnum(PaymentMethodType).optional(),
    received_at: dateStr.optional(),
    reference: optText(200),
    fee_amount: moneyPos.optional(),
});
export type InvoicePaymentDto = z.infer<typeof InvoicePaymentSchema>;
export const PaymentQuerySchema = BaseListQuerySchema.extend({
    status: csv(z.nativeEnum(PaymentStatus)),
    provider: z.nativeEnum(PaymentProvider).optional(),
    billing_profile_id: z.string().uuid().optional(),
    company_id: z.string().uuid().optional(),
    from: dateStr.optional(),
    to: dateStr.optional(),
    unallocated: boolish,
});
export type PaymentQuery = z.infer<typeof PaymentQuerySchema>;
export const RefundSchema = z.object({ amount: moneyPos.refine((v) => Number(v) > 0, 'must be more than zero'), reason: z.string().trim().min(1).max(500) });
export type RefundDto = z.infer<typeof RefundSchema>;

// --- Credit notes ----------------------------------------------------------------------------------------------------
export const CreditLineSchema = z.object({ description: z.string().min(1).max(500), quantity: money.optional(), unit_amount: money, tax_percent: percent.optional() });
export const CreateCreditNoteSchema = z.object({
    invoice_id: uuid,
    reason: z.string().trim().min(1).max(1000),
    /** Omit to credit the full invoice. */
    lines: z.array(CreditLineSchema).max(100).optional(),
    issue: z.boolean().optional(),
});
export type CreateCreditNoteDto = z.infer<typeof CreateCreditNoteSchema>;
export const CreditNoteQuerySchema = BaseListQuerySchema.extend({ status: csv(z.enum(['DRAFT', 'ISSUED', 'APPLIED', 'VOID'])), invoice_id: z.string().uuid().optional() });
export type CreditNoteQuery = z.infer<typeof CreditNoteQuerySchema>;

// --- Subscriptions ----------------------------------------------------------------------------------------------------
export const SubscriptionItemSchema = z.object({ product_id: optUuid, price_id: optUuid, description: optText(500), quantity: money.optional(), unit_amount: moneyPos.optional() });
export const CreateSubscriptionSchema = z.object({
    billing_profile_id: uuid,
    project_id: optUuid,
    contract_id: optUuid,
    currency: currency.optional(),
    interval: z.nativeEnum(BillingInterval).optional(),
    interval_count: z.number().int().min(1).max(36).optional(),
    collection_method: z.nativeEnum(CollectionMethod).optional(),
    coupon_id: optUuid,
    start_date: dateStr.optional(),
    trial_days: z.number().int().min(0).max(365).optional(),
    setup_fee: moneyPos.nullable().optional(),
    provider_connection_id: optUuid,
    items: z.array(SubscriptionItemSchema).min(1).max(50),
});
export type CreateSubscriptionDto = z.infer<typeof CreateSubscriptionSchema>;
export const ChangePlanSchema = z.object({ items: z.array(SubscriptionItemSchema).min(1).max(50), interval: z.nativeEnum(BillingInterval).optional(), interval_count: z.number().int().min(1).max(36).optional() });
export type ChangePlanDto = z.infer<typeof ChangePlanSchema>;
export const CancelSubscriptionSchema = z.object({ at: z.enum(['now', 'period_end', 'date']).optional(), date: dateStr.optional(), reason: optText(1000) });
export type CancelSubscriptionDto = z.infer<typeof CancelSubscriptionSchema>;
export const PauseSubscriptionSchema = z.object({ resume_at: dateStr.nullable().optional() });
export const SubscriptionQuerySchema = BaseListQuerySchema.extend({ status: csv(z.nativeEnum(SubscriptionStatus)), company_id: z.string().uuid().optional(), billing_profile_id: z.string().uuid().optional() });
export type SubscriptionQuery = z.infer<typeof SubscriptionQuerySchema>;

// --- Payment links, dunning, approvals ------------------------------------------------------------------------------
export const CreatePaymentLinkSchema = z.object({
    title: z.string().trim().min(1).max(160),
    description: optText(1000),
    invoice_id: optUuid,
    price_id: optUuid,
    billing_profile_id: optUuid,
    amount: moneyPos.nullable().optional(),
    currency: currency.optional(),
    allow_custom_amount: z.boolean().optional(),
    provider_connection_id: optUuid,
    accepted_methods: z.array(z.nativeEnum(PaymentMethodType)).max(7).optional(),
    expires_at: z.string().datetime().nullable().optional(),
    max_uses: z.number().int().min(1).nullable().optional(),
});
export type CreatePaymentLinkDto = z.infer<typeof CreatePaymentLinkSchema>;
export const PaymentLinkQuerySchema = BaseListQuerySchema.extend({ status: z.nativeEnum(PaymentLinkStatus).optional(), invoice_id: z.string().uuid().optional() });
export type PaymentLinkQuery = z.infer<typeof PaymentLinkQuerySchema>;

export const DunningStepSchema = z.object({ offset_days: z.number().int().min(-60).max(365), action: z.nativeEnum(DunningAction), template_key: z.string().max(80).optional() });
export const DunningPolicySchema = z.object({ name: z.string().trim().min(1).max(120), is_default: z.boolean().optional(), steps: z.array(DunningStepSchema).min(1).max(20), max_payment_retries: z.number().int().min(0).max(10).optional() });
export type DunningPolicyDto = z.infer<typeof DunningPolicySchema>;

export const ApprovalStepSchema = z.object({ step: z.number().int().min(1).optional(), name: z.string().max(120).optional(), approver: z.object({ membership_id: z.string().uuid().optional(), role_id: z.string().uuid().optional() }).optional() });
export const ApprovalRuleSchema = z.object({
    name: z.string().trim().min(1).max(120),
    entity_type: z.nativeEnum(FinanceApprovalEntityType),
    record_type: z.nativeEnum(LedgerRecordType).nullable().optional(),
    min_amount: moneyPos.optional(),
    max_amount: moneyPos.nullable().optional(),
    currency: currency.nullable().optional(),
    branch_id: optUuid,
    steps: z.array(ApprovalStepSchema).min(1).max(5),
    require_distinct_user: z.boolean().optional(),
    priority: z.number().int().min(0).max(10000).optional(),
    enabled: z.boolean().optional(),
});
export type ApprovalRuleDto = z.infer<typeof ApprovalRuleSchema>;

// --- Providers --------------------------------------------------------------------------------------------------------
export const ConnectProviderSchema = z.object({
    provider: z.enum([PaymentProvider.STRIPE, PaymentProvider.VIVA_WALLET]),
    display_name: z.string().trim().min(1).max(120),
    mode: z.enum(['live', 'test']).optional(),
    /** Reuse credentials already saved in Admin → Integrations … */
    integration_connection_id: optUuid,
    /** … or enter them here once (write-only, stored encrypted in an IntegrationConnection). */
    credentials: z.object({ secret_key: z.string().min(10).max(300), webhook_signing_secret: z.string().max(300).optional(), publishable_key: z.string().max(300).optional() }).optional(),
    currencies: z.array(currency).max(20).optional(),
    method_types: z.array(z.nativeEnum(PaymentMethodType)).max(7).optional(),
    priority: z.number().int().min(0).max(1000).optional(),
    is_default: z.boolean().optional(),
    branch_id: optUuid,
    ledger_payment_method_id: optUuid,
});
export type ConnectProviderDto = z.infer<typeof ConnectProviderSchema>;
export const UpdateProviderSchema = ConnectProviderSchema.partial().omit({ provider: true, integration_connection_id: true });
export type UpdateProviderDto = z.infer<typeof UpdateProviderSchema>;
export const CheckoutSchema = z.object({ provider_connection_id: optUuid, success_url: z.string().url().optional(), cancel_url: z.string().url().optional() });
export type CheckoutDto = z.infer<typeof CheckoutSchema>;

// --- Dashboard & reports ------------------------------------------------------------------------------------------------
export const FinanceRangeSchema = z.object({ from: dateStr.optional(), to: dateStr.optional(), branch_id: z.string().uuid().optional(), connection_id: z.string().uuid().optional(), format: z.enum(['json', 'csv']).optional() });
export type FinanceRange = z.infer<typeof FinanceRangeSchema>;

export const ProjectBillingSchema = z.object({
    billing_model: z.nativeEnum(BillingModel),
    currency: currency.nullable().optional(),
    fixed_amount: moneyPos.nullable().optional(),
    retainer_interval: z.nativeEnum(BillingInterval).nullable().optional(),
    hourly_rate: moneyPos.nullable().optional(),
    default_product_id: optUuid,
    auto_invoice_milestones: z.boolean().optional(),
    auto_invoice_time: z.boolean().optional(),
    billing_interval: z.nativeEnum(BillingInterval).nullable().optional(),
    billing_day: z.number().int().min(1).max(31).nullable().optional(),
    budget_alert_percent: z.number().int().min(1).max(200).nullable().optional(),
});
export type ProjectBillingDto = z.infer<typeof ProjectBillingSchema>;
