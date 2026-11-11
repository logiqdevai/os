import type { PaginationMeta } from "@/components/ui/data-table";

/** 08 Billing — API shapes. Money fields are decimal strings (Prisma Decimal) unless noted. */
export type Money = string | number;

export interface Paginated<T> {
    data: T[];
    pagination: PaginationMeta & { has_next: boolean; has_prev: boolean };
}

export const InvoiceStatuses = {
    DRAFT: "DRAFT", SCHEDULED: "SCHEDULED", OPEN: "OPEN", PENDING: "PENDING", PAID: "PAID", PARTIALLY_PAID: "PARTIALLY_PAID",
    OVERDUE: "OVERDUE", REFUNDED: "REFUNDED", CANCELLED: "CANCELLED", VOID: "VOID",
} as const;
export type InvoiceStatus = (typeof InvoiceStatuses)[keyof typeof InvoiceStatuses];
export type PaymentStatus = "PENDING" | "PROCESSING" | "SUCCEEDED" | "FAILED" | "CANCELLED" | "REFUNDED" | "PARTIALLY_REFUNDED";
export type PaymentMethodType = "CARD" | "BANK_TRANSFER" | "SEPA_DEBIT" | "CASH" | "CHECK" | "WALLET" | "OTHER";
export type SubscriptionStatus = "INCOMPLETE" | "TRIALING" | "ACTIVE" | "PAST_DUE" | "PAUSED" | "CANCELLED" | "EXPIRED";
export type BillingInterval = "DAY" | "WEEK" | "MONTH" | "QUARTER" | "YEAR";
export type ProductType = "SERVICE" | "PACKAGE" | "DEVELOPMENT_HOURS" | "MAINTENANCE_PLAN" | "SUPPORT_PLAN" | "SUBSCRIPTION" | "LICENSE" | "OTHER";
export type CreditNoteStatus = "DRAFT" | "ISSUED" | "APPLIED" | "VOID";
export type TaxBehavior = "INCLUSIVE" | "EXCLUSIVE";
export type DiscountType = "PERCENTAGE" | "FIXED";
export type ProviderConnectionStatus = "PENDING" | "ACTIVE" | "ERROR" | "DISCONNECTED";
export type PaymentLinkStatus = "ACTIVE" | "EXPIRED" | "DISABLED" | "COMPLETED";

export interface Ref { id: string; name: string }
export interface UserRef { id?: string; email?: string | null; display_name?: string | null; first_name?: string | null; last_name?: string | null }

export interface TaxRate {
    id: string; name: string; percentage: Money; country: string | null; region: string | null; behavior: TaxBehavior; is_default: boolean; is_active: boolean;
    is_reverse_charge: boolean; tax_category: string | null; invoice_note: string | null; _count?: { line_items: number; products: number };
}

export interface Price {
    id: string; product_id: string; name: string | null; currency: string; unit_amount: Money; type: "ONE_TIME" | "RECURRING"; interval: BillingInterval | null;
    interval_count: number | null; trial_days: number | null; setup_fee: Money | null; is_active: boolean;
}

export interface Product {
    id: string; name: string; slug: string; type: ProductType; description: string | null; unit: string | null; default_tax_rate_id: string | null; is_active: boolean;
    archived_at: string | null; prices: Price[]; default_tax_rate?: Pick<TaxRate, "id" | "name" | "percentage" | "behavior"> | null;
}

export interface Coupon {
    id: string; name: string; code: string | null; type: DiscountType; value: Money; currency: string | null; duration: string; max_redemptions: number | null;
    redemptions: number; valid_from: string | null; valid_until: string | null; is_active: boolean;
}

export interface Address { line1?: string; line2?: string; city?: string; postal_code?: string; region?: string; country?: string }

export interface BillingProfile {
    id: string; company_id: string; legal_name: string; billing_email: string | null; billing_address: Address | null; tax_id: string | null; vat_number: string | null;
    tax_exempt: boolean; reverse_charge: boolean; vat_validation_status: string; currency: string; payment_terms_days: number; notes: string | null;
    dunning_policy_id: string | null; preferred_provider_connection_id: string | null;
    company?: { id: string; name: string; type?: string; email?: string | null } | null;
    outstanding?: Money; lifetime_paid?: Money | null; _count?: { invoices: number; subscriptions: number };
}

export interface BillingProfileDetail extends BillingProfile {
    balance: { outstanding: Money; open_invoices: number; invoiced: Money; paid: Money | null };
    recent_invoices: Pick<Invoice, "id" | "number" | "status" | "total" | "amount_due" | "currency" | "issue_date" | "due_date">[];
    subscriptions: { id: string; status: SubscriptionStatus; period_amount: Money; currency: string; interval: BillingInterval; interval_count: number; current_period_end: string | null }[];
    recent_payments: { id: string; amount: Money; currency: string; status: PaymentStatus; method_type: PaymentMethodType; received_at: string | null; reference: string | null; provider: string }[];
    payment_methods: { id: string; type: PaymentMethodType; provider: string; brand: string | null; last4: string | null; is_default: boolean }[];
    dunning_policy?: Ref | null;
    preferred_provider_connection?: { id: string; display_name: string; provider: string } | null;
}

export interface InvoiceLine {
    id?: string; product_id: string | null; price_id: string | null; description: string; quantity: Money; unit: string | null; unit_amount: Money; discount_amount: Money;
    tax_rate_id: string | null; tax_percent: Money | null; net_amount: Money; tax_amount: Money; gross_amount: Money; period_start?: string | null; period_end?: string | null;
    adjustment_amount?: Money; adjustment_reason?: string | null;
    tax_rate?: { id: string; name: string; percentage: Money; behavior: TaxBehavior; invoice_note: string | null } | null;
    product?: { id: string; name: string; type: ProductType } | null;
}

export interface Invoice {
    id: string; number: string; status: InvoiceStatus; billing_profile_id: string; company_id: string; project_id: string | null; branch_id: string | null; currency: string;
    issue_date: string | null; due_date: string | null; period_start: string | null; period_end: string | null; subtotal: Money; discount_total: Money; tax_total: Money;
    total: Money; amount_paid: Money; amount_due: Money; coupon_id: string | null; collection_method: string; accepted_methods: PaymentMethodType[]; notes: string | null;
    payment_instructions: string | null; footer: string | null; hosted_invoice_url: string | null; sent_at: string | null; viewed_at: string | null; paid_at: string | null;
    voided_at: string | null; uncollectible_at: string | null; uncollectible_reason: string | null; written_off_amount: Money; reminder_count: number; last_reminder_at: string | null;
    approved_at: string | null; created_at: string; subscription_id: string | null; provider_connection_id: string | null;
    company?: Ref | null; billing_profile?: { id: string; legal_name: string; billing_email: string | null } | null; project?: Ref | null; _count?: { line_items: number };
}

export interface ApprovalRow { id: string; step: number; decision: "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED"; comment: string | null; rejection_reason: string | null; requested_at: string; decided_at: string | null }
export interface TimelineRow { id: string; event_type: string; created_at: string; metadata: Record<string, unknown> | null; actor_user?: UserRef | null }

export interface InvoiceDetail extends Invoice {
    billing_profile: { id: string; legal_name: string; billing_email: string | null; billing_address: Address | null; vat_number: string | null; tax_id: string | null; payment_terms_days: number; reverse_charge: boolean; currency: string };
    line_items: InvoiceLine[];
    allocations: { id: string; amount: Money; payment: { id: string; amount: Money; currency: string; status: PaymentStatus; method_type: PaymentMethodType; provider: string; reference: string | null; received_at: string | null; refunded_amount: Money } }[];
    credit_notes: { id: string; number: string; status: CreditNoteStatus; total: Money; currency: string; reason: string | null; issued_at: string | null; applied_at: string | null }[];
    reminders: { id: string; action: string; offset_days: number | null; sent_at: string }[];
    payment_links: { id: string; url: string; title: string; status: PaymentLinkStatus; created_at: string }[];
    coupon?: { id: string; name: string; code: string | null; type: DiscountType; value: Money } | null;
    contract?: { id: string; title: string } | null;
    branch?: Ref | null;
    provider_connection?: { id: string; display_name: string; provider: string } | null;
    ledger_record?: { id: string; number: string; payment_status: string } | null;
    credited_amount: Money;
    created_by: UserRef | null;
    approved_by: UserRef | null;
    approval: { required: boolean; approved: boolean; rule: { id: string; name: string; require_distinct_user: boolean } | null; history: ApprovalRow[] };
    seller: { legal_name: string; display_name: string; logo_url: string | null; country: string | null; default_currency: string } | null;
    timeline: TimelineRow[];
}

export interface InvoiceListResponse extends Paginated<Invoice> {
    summary: { status: InvoiceStatus; count: number; amount_due: Money; total: Money }[];
}

export interface InvoiceLineInput {
    product_id?: string | null; price_id?: string | null; description: string; quantity: string; unit?: string | null; unit_amount: string; discount_amount?: string;
    tax_rate_id?: string | null; tax_percent?: string | null;
}
export interface InvoiceInput {
    billing_profile_id: string; project_id?: string | null; currency?: string; issue_date?: string | null; due_date?: string | null; coupon_id?: string | null;
    notes?: string | null; payment_instructions?: string | null; footer?: string | null; accepted_methods?: PaymentMethodType[]; lines: InvoiceLineInput[];
}

export interface Payment {
    id: string; billing_profile_id: string | null; provider: string; provider_payment_id: string | null; method_type: PaymentMethodType; status: PaymentStatus; currency: string;
    amount: Money; fee_amount: Money; tax_amount: Money; net_amount: Money | null; refunded_amount: Money; kind: string | null; reference: string | null; received_at: string | null;
    created_at: string; billing_profile?: { id: string; legal_name: string; company_id: string } | null;
    allocations: { id: string; amount: Money; invoice: { id: string; number: string; total?: Money; amount_due?: Money; status?: InvoiceStatus; currency?: string } }[];
    provider_connection?: { id: string; display_name: string } | null; _count?: { refunds: number };
}
export interface Refund { id: string; amount: Money; reason: string | null; status: "PENDING" | "SUCCEEDED" | "FAILED" | "CANCELLED"; processed_at: string | null; created_at: string; provider_refund_id: string | null }
export interface PaymentDetail extends Payment {
    refunds: Refund[]; allocated_amount: Money; unallocated_amount: Money; refundable_amount: Money; timeline: TimelineRow[];
    origin_ledger_record?: { id: string; number: string } | null;
}
export interface PaymentListResponse extends Paginated<Payment> { totals: { amount: Money; fees: Money; refunded: Money } }

export interface CreditNote {
    id: string; number: string; status: CreditNoteStatus; currency: string; subtotal: Money; tax_total: Money; total: Money; reason: string | null; issued_at: string | null;
    applied_at: string | null; created_at: string; invoice?: { id: string; number: string } | null; billing_profile?: { id: string; legal_name: string } | null;
}

export interface SubscriptionItem { id: string; product_id: string | null; price_id: string | null; description: string | null; quantity: Money; unit_amount: Money; product?: Ref | null }
export interface Subscription {
    id: string; billing_profile_id: string; company_id: string; status: SubscriptionStatus; currency: string; interval: BillingInterval; interval_count: number;
    current_period_start: string | null; current_period_end: string | null; trial_end: string | null; started_at: string | null; cancel_at: string | null; cancel_at_period_end: boolean;
    cancelled_at: string | null; paused_at: string | null; resume_at: string | null; period_amount: Money; setup_fee: Money | null; created_at: string;
    company?: Ref | null; items: SubscriptionItem[];
}
export interface SubscriptionDetail extends Subscription {
    billing_profile: { id: string; legal_name: string; billing_email: string | null };
    project?: Ref | null; coupon?: { id: string; name: string } | null; mrr: Money; next_invoice_date: string | null; cancellation_reason?: string | null;
    invoices: Pick<Invoice, "id" | "number" | "status" | "total" | "amount_due" | "currency" | "period_start" | "period_end" | "issue_date">[];
    history: TimelineRow[];
}
export interface SubscriptionListResponse extends Paginated<Subscription> { mrr: Money; arr: Money; active: number }

export interface ProviderConnection {
    id: string; provider: "STRIPE" | "VIVA_WALLET"; display_name: string; status: ProviderConnectionStatus; provider_account_id: string | null; mode: string;
    config: Record<string, string | null> | null; capabilities: Record<string, boolean> | null; currencies: string[]; method_types: PaymentMethodType[]; priority: number;
    is_default: boolean; branch_id: string | null; last_checked_at: string | null; last_error: string | null; connected_at: string | null; webhook_url: string;
    integration_connection?: { id: string; name: string; status: string; secret_hints: Record<string, string> | null } | null;
    branch?: Ref | null; volume?: Money; fees?: Money; payments?: number;
    webhook_events?: { id: string; event_type: string; provider_event_id: string; received_at: string; processed_at: string | null; error: string | null }[];
    disconnect_blockers?: { kind: string; count: number; message: string }[];
}

export interface PaymentLink {
    id: string; title: string; description: string | null; amount: Money | null; currency: string; url: string; status: PaymentLinkStatus; uses: number; max_uses: number | null;
    expires_at: string | null; created_at: string; invoice?: { id: string; number: string } | null; billing_profile?: { id: string; legal_name: string } | null;
    provider_connection?: { id: string; display_name: string } | null;
}

export interface FinanceDashboard {
    currency: string;
    kpis: {
        outstanding: number; outstanding_count: number; overdue: number; overdue_count: number; mrr: number; arr: number; active_subscriptions: number; trialing_subscriptions: number;
        collected_this_month: number | null; fees_this_month: number | null; payments_this_month: number; revenue_ytd: number; arpu_ytd: number | null; refunds_ytd: number | null; payment_success_rate: number | null;
    };
    monthly: { month: string; invoiced: number; collected: number }[];
    aging: { bucket: string; amount: number }[];
    status_counts: { status: InvoiceStatus; count: number }[];
    top_customers: { company_id: string; name: string; invoiced: number; paid: number | null }[];
    other_currencies: { currency: string; outstanding: number; count: number }[];
    recent_payments: { id: string; amount: Money; currency: string; status: PaymentStatus; method_type: PaymentMethodType; received_at: string | null; billing_profile?: { legal_name: string } | null }[];
}

export interface FinanceReport {
    report: string; from: string; to: string;
    columns: { key: string; label: string; type?: "money" | "date" | "number" | "text" }[];
    rows: Record<string, string | number | null>[];
}

export interface CompanyLookup { id: string; name: string; type: string; currency: string | null }
export interface ProjectLookup { id: string; name: string }
export interface ApprovalInbox {
    items: { id: string; entity_type: string; entity_id: string; step: number; requested_at: string; amount: Money | null; currency: string | null; rule?: { name: string } | null; invoice?: { id: string; number: string; total: Money; currency: string; company?: { name: string } | null } | null; refund?: { id: string; amount: Money; reason: string | null; payment: { id: string; currency: string; billing_profile?: { legal_name: string } | null } } | null }[];
    invoices_awaiting: { id: string; number: string; total: Money; currency: string; company?: { name: string } | null; mine: boolean; created_at: string }[];
}
