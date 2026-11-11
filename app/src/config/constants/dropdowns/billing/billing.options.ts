import type { DropdownOption } from "@/lib/dropdown-option-label.utils";
import type {
    BillingInterval, CreditNoteStatus, DiscountType, InvoiceStatus, PaymentLinkStatus, PaymentMethodType, PaymentStatus, ProductType, ProviderConnectionStatus, SubscriptionStatus, TaxBehavior,
} from "@/features/billing/interfaces/billing.interfaces";

/** 08 Billing enum labels (canonical). Filters spread the form lists. */
export const InvoiceStatusOptions: DropdownOption<InvoiceStatus>[] = [
    { id: "DRAFT", label: "Draft" }, { id: "SCHEDULED", label: "Scheduled" }, { id: "OPEN", label: "Open" }, { id: "PENDING", label: "Payment pending" },
    { id: "PARTIALLY_PAID", label: "Partially paid" }, { id: "PAID", label: "Paid" }, { id: "OVERDUE", label: "Overdue" }, { id: "REFUNDED", label: "Refunded" },
    { id: "CANCELLED", label: "Cancelled" }, { id: "VOID", label: "Void" },
];
export const InvoiceStatusFilterOptions: DropdownOption<InvoiceStatus | "all">[] = [{ id: "all", label: "All statuses" }, ...InvoiceStatusOptions];

export const PaymentStatusOptions: DropdownOption<PaymentStatus>[] = [
    { id: "PENDING", label: "Pending" }, { id: "PROCESSING", label: "Processing" }, { id: "SUCCEEDED", label: "Succeeded" }, { id: "FAILED", label: "Failed" },
    { id: "CANCELLED", label: "Cancelled" }, { id: "REFUNDED", label: "Refunded" }, { id: "PARTIALLY_REFUNDED", label: "Partially refunded" },
];
export const PaymentStatusFilterOptions: DropdownOption<PaymentStatus | "all">[] = [{ id: "all", label: "All statuses" }, ...PaymentStatusOptions];

export const PaymentMethodTypeOptions: DropdownOption<PaymentMethodType>[] = [
    { id: "BANK_TRANSFER", label: "Bank transfer" }, { id: "CARD", label: "Card" }, { id: "SEPA_DEBIT", label: "SEPA debit" }, { id: "CASH", label: "Cash" },
    { id: "CHECK", label: "Check" }, { id: "WALLET", label: "Wallet" }, { id: "OTHER", label: "Other" },
];

export const SubscriptionStatusOptions: DropdownOption<SubscriptionStatus>[] = [
    { id: "INCOMPLETE", label: "Incomplete" }, { id: "TRIALING", label: "Trial" }, { id: "ACTIVE", label: "Active" }, { id: "PAST_DUE", label: "Past due" },
    { id: "PAUSED", label: "Paused" }, { id: "CANCELLED", label: "Cancelled" }, { id: "EXPIRED", label: "Expired" },
];
export const SubscriptionStatusFilterOptions: DropdownOption<SubscriptionStatus | "all">[] = [{ id: "all", label: "All statuses" }, ...SubscriptionStatusOptions];

export const BillingIntervalOptions: DropdownOption<BillingInterval>[] = [
    { id: "MONTH", label: "Monthly" }, { id: "QUARTER", label: "Quarterly" }, { id: "YEAR", label: "Yearly" }, { id: "WEEK", label: "Weekly" }, { id: "DAY", label: "Daily" },
];

export const ProductTypeOptions: DropdownOption<ProductType>[] = [
    { id: "SERVICE", label: "Service" }, { id: "PACKAGE", label: "Package" }, { id: "DEVELOPMENT_HOURS", label: "Development hours" }, { id: "MAINTENANCE_PLAN", label: "Maintenance plan" },
    { id: "SUPPORT_PLAN", label: "Support plan" }, { id: "SUBSCRIPTION", label: "Subscription" }, { id: "LICENSE", label: "License" }, { id: "OTHER", label: "Other" },
];
export const ProductTypeFilterOptions: DropdownOption<ProductType | "all">[] = [{ id: "all", label: "All types" }, ...ProductTypeOptions];

export const CreditNoteStatusOptions: DropdownOption<CreditNoteStatus>[] = [{ id: "DRAFT", label: "Draft" }, { id: "ISSUED", label: "Issued" }, { id: "APPLIED", label: "Applied" }, { id: "VOID", label: "Void" }];
export const CreditNoteStatusFilterOptions: DropdownOption<CreditNoteStatus | "all">[] = [{ id: "all", label: "All statuses" }, ...CreditNoteStatusOptions];

export const TaxBehaviorOptions: DropdownOption<TaxBehavior>[] = [{ id: "EXCLUSIVE", label: "Added on top (exclusive)" }, { id: "INCLUSIVE", label: "Included in price (inclusive)" }];
export const DiscountTypeOptions: DropdownOption<DiscountType>[] = [{ id: "PERCENTAGE", label: "Percentage" }, { id: "FIXED", label: "Fixed amount" }];
export const ProviderStatusOptions: DropdownOption<ProviderConnectionStatus>[] = [{ id: "PENDING", label: "Pending" }, { id: "ACTIVE", label: "Active" }, { id: "ERROR", label: "Error" }, { id: "DISCONNECTED", label: "Disconnected" }];
export const PaymentLinkStatusOptions: DropdownOption<PaymentLinkStatus>[] = [{ id: "ACTIVE", label: "Active" }, { id: "EXPIRED", label: "Expired" }, { id: "DISABLED", label: "Disabled" }, { id: "COMPLETED", label: "Completed" }];
export const CancelAtOptions: DropdownOption<"period_end" | "now">[] = [{ id: "period_end", label: "At the end of the current period" }, { id: "now", label: "Immediately" }];

export const FinanceReportOptions: DropdownOption<"revenue" | "invoices" | "outstanding" | "tax" | "customers" | "payments" | "subscriptions">[] = [
    { id: "revenue", label: "Revenue by month" }, { id: "invoices", label: "Invoices" }, { id: "outstanding", label: "Outstanding balances" }, { id: "tax", label: "Tax collected" },
    { id: "customers", label: "Revenue by customer" }, { id: "payments", label: "Payment history" }, { id: "subscriptions", label: "Subscriptions" },
];

export const AgingBucketOptions: DropdownOption<string>[] = [
    { id: "current", label: "Not due" }, { id: "d1_30", label: "1–30 days" }, { id: "d31_60", label: "31–60 days" }, { id: "d61_90", label: "61–90 days" }, { id: "d90_plus", label: "90+ days" },
];

/** Audit event types shown on invoice / payment timelines. */
export const BillingEventLabelOptions: DropdownOption<string>[] = [
    { id: "finance.invoice.created", label: "Draft created" }, { id: "finance.invoice.updated", label: "Edited" }, { id: "finance.invoice.approved", label: "Approved" },
    { id: "finance.invoice.approval_step", label: "Approval step completed" }, { id: "finance.invoice.rejected", label: "Approval rejected" }, { id: "finance.invoice.sent", label: "Sent" },
    { id: "finance.invoice.voided", label: "Voided" }, { id: "finance.invoice.written_off", label: "Written off" }, { id: "finance.invoice.reminder_sent", label: "Reminder sent" },
    { id: "finance.invoice.payment_recorded", label: "Payment recorded" }, { id: "finance.invoice.overdue", label: "Became overdue" }, { id: "finance.invoice.generated", label: "Generated from subscription" },
    { id: "finance.invoice.checkout_created", label: "Online payment link created" }, { id: "finance.credit_note.created", label: "Credit note drafted" }, { id: "finance.credit_note.issued", label: "Credit note issued" },
    { id: "finance.credit_note.applied", label: "Credit note applied" }, { id: "finance.credit_note.voided", label: "Credit note voided" }, { id: "finance.payment.recorded", label: "Payment recorded" },
    { id: "finance.payment.allocated", label: "Allocated to invoices" }, { id: "finance.refund.requested", label: "Refund requested" }, { id: "finance.refund.succeeded", label: "Refunded" },
    { id: "finance.refund.approved", label: "Refund approved" }, { id: "finance.refund.rejected", label: "Refund rejected" }, { id: "finance.refund.failed", label: "Refund failed" },
    { id: "finance.payment.failed", label: "Online payment failed" },
    { id: "finance.subscription.created", label: "Started" }, { id: "finance.subscription.upgraded", label: "Upgraded" }, { id: "finance.subscription.downgraded", label: "Downgraded" },
    { id: "finance.subscription.changed", label: "Plan changed" }, { id: "finance.subscription.paused", label: "Paused" }, { id: "finance.subscription.resumed", label: "Resumed" },
    { id: "finance.subscription.cancelled", label: "Cancelled" }, { id: "finance.subscription.cancellation_scheduled", label: "Cancellation scheduled" }, { id: "finance.subscription.reactivated", label: "Cancellation undone" },
];
