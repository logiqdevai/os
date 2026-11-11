import type { DropdownOption } from "@/lib/dropdown-option-label.utils";
import type {
    BillingInterval, ExpenseClaimStatus, FinancialPeriodStatus, LedgerPaymentStatus, LedgerPlLine, LedgerRecordSource, LedgerRecordStatus, LedgerRecordType, LedgerSettlementKind,
    LedgerVatTreatment, PaymentMethodType, RecurringExpenseStatus, ReportBasis, TaxBehavior,
} from "@/features/expenses/interfaces/expenses.interfaces";

/** 09 Income & expense enum labels (canonical); filters spread the form lists. */
export const RecordTypeOptions: DropdownOption<LedgerRecordType>[] = [{ id: "EXPENSE", label: "Expense" }, { id: "INCOME", label: "Income" }];
export const RecordTypeFilterOptions: DropdownOption<LedgerRecordType | "all">[] = [{ id: "all", label: "Income and expenses" }, ...RecordTypeOptions];

export const RecordStatusOptions: DropdownOption<LedgerRecordStatus>[] = [{ id: "DRAFT", label: "Draft" }, { id: "PENDING_REVIEW", label: "Waiting for approval" }, { id: "POSTED", label: "Posted" }, { id: "VOIDED", label: "Voided" }];
export const RecordStatusFilterOptions: DropdownOption<LedgerRecordStatus | "all">[] = [{ id: "all", label: "All statuses" }, ...RecordStatusOptions];

export const LedgerPaymentStatusOptions: DropdownOption<LedgerPaymentStatus>[] = [
    { id: "UNPAID", label: "Unpaid" }, { id: "PARTIALLY_PAID", label: "Partially paid" }, { id: "PAID", label: "Paid" }, { id: "OVERDUE", label: "Overdue" }, { id: "CANCELLED", label: "Cancelled" }, { id: "REFUNDED", label: "Refunded" },
];
export const LedgerPaymentStatusFilterOptions: DropdownOption<LedgerPaymentStatus | "all">[] = [{ id: "all", label: "Any payment status" }, ...LedgerPaymentStatusOptions];

export const RecordSourceOptions: DropdownOption<LedgerRecordSource>[] = [
    { id: "MANUAL", label: "Manual" }, { id: "INVOICE_SYNC", label: "Invoice (Billing)" }, { id: "PAYMENT_SYNC", label: "Payment (Billing)" }, { id: "SUBSCRIPTION_SYNC", label: "Subscription (Billing)" },
    { id: "SUPPLIER_INVOICE_IMPORT", label: "Imported supplier invoice" }, { id: "RECURRING_EXPENSE", label: "Recurring expense" }, { id: "PAYROLL", label: "Payroll / reimbursement" }, { id: "API", label: "API" },
];

export const VatTreatmentOptions: DropdownOption<LedgerVatTreatment>[] = [
    { id: "STANDARD", label: "Standard" }, { id: "REDUCED", label: "Reduced" }, { id: "ZERO_RATED", label: "Zero-rated" }, { id: "EXEMPT", label: "Exempt" }, { id: "REVERSE_CHARGE", label: "Reverse charge" }, { id: "OUT_OF_SCOPE", label: "Out of scope" },
];
export const PricingModeOptions: DropdownOption<TaxBehavior>[] = [{ id: "EXCLUSIVE", label: "Amount excludes VAT" }, { id: "INCLUSIVE", label: "Amount includes VAT" }];
export const SettlementKindOptions: DropdownOption<LedgerSettlementKind>[] = [{ id: "PAYMENT", label: "Payment" }, { id: "REFUND", label: "Refund" }, { id: "WRITE_OFF", label: "Write-off" }, { id: "ADJUSTMENT", label: "Adjustment" }];

export const PlLineOptions: DropdownOption<LedgerPlLine>[] = [
    { id: "REVENUE", label: "Revenue" }, { id: "COST_OF_OPERATIONS", label: "Cost of operations" }, { id: "EMPLOYEE_EXPENSES", label: "Employee expenses" }, { id: "OFFICE_EXPENSES", label: "Office expenses" },
    { id: "SOFTWARE_EXPENSES", label: "Software expenses" }, { id: "MARKETING_EXPENSES", label: "Marketing expenses" }, { id: "PROFESSIONAL_EXPENSES", label: "Professional expenses" }, { id: "OTHER_OPERATING_EXPENSES", label: "Other operating expenses" },
];

export const RecurringStatusOptions: DropdownOption<RecurringExpenseStatus>[] = [{ id: "ACTIVE", label: "Active" }, { id: "PAUSED", label: "Paused" }, { id: "ENDED", label: "Ended" }, { id: "CANCELLED", label: "Cancelled" }];
export const RecurringStatusFilterOptions: DropdownOption<RecurringExpenseStatus | "all">[] = [{ id: "all", label: "All statuses" }, ...RecurringStatusOptions];
export const IntervalOptions: DropdownOption<BillingInterval>[] = [{ id: "MONTH", label: "Monthly" }, { id: "QUARTER", label: "Quarterly" }, { id: "YEAR", label: "Yearly" }, { id: "WEEK", label: "Weekly" }, { id: "DAY", label: "Daily" }];

export const ClaimStatusOptions: DropdownOption<ExpenseClaimStatus>[] = [{ id: "DRAFT", label: "Draft" }, { id: "SUBMITTED", label: "Submitted" }, { id: "APPROVED", label: "Approved" }, { id: "REJECTED", label: "Rejected" }, { id: "PAID", label: "Paid" }];
export const ClaimStatusFilterOptions: DropdownOption<ExpenseClaimStatus | "all">[] = [{ id: "all", label: "All statuses" }, ...ClaimStatusOptions];

export const PeriodStatusOptions: DropdownOption<FinancialPeriodStatus>[] = [{ id: "OPEN", label: "Open" }, { id: "CLOSED", label: "Closed" }, { id: "LOCKED", label: "Locked" }];
export const ReportBasisOptions: DropdownOption<ReportBasis>[] = [{ id: "ACCRUAL", label: "Accrual (invoiced)" }, { id: "CASH", label: "Cash (paid)" }];
export const VatGroupOptions: DropdownOption<"rate" | "category" | "counterparty" | "month">[] = [{ id: "rate", label: "By VAT rate" }, { id: "category", label: "By category" }, { id: "counterparty", label: "By customer / supplier" }, { id: "month", label: "By month" }];
export const ProfitabilityScopeOptions: DropdownOption<"PROJECT" | "CUSTOMER">[] = [{ id: "PROJECT", label: "Projects" }, { id: "CUSTOMER", label: "Customers" }];
export const LedgerPaymentMethodTypeOptions: DropdownOption<PaymentMethodType>[] = [
    { id: "BANK_TRANSFER", label: "Bank account" }, { id: "CARD", label: "Card" }, { id: "CASH", label: "Cash" }, { id: "SEPA_DEBIT", label: "SEPA debit" }, { id: "CHECK", label: "Check" }, { id: "WALLET", label: "Wallet" }, { id: "OTHER", label: "Other" },
];
export const PeriodPresetOptions: DropdownOption<"this_month" | "last_month" | "this_quarter" | "this_year" | "last_year">[] = [
    { id: "this_month", label: "This month" }, { id: "last_month", label: "Last month" }, { id: "this_quarter", label: "This quarter" }, { id: "this_year", label: "This year" }, { id: "last_year", label: "Last year" },
];

export const LedgerEventLabelOptions: DropdownOption<string>[] = [
    { id: "ledger.record.created", label: "Created" }, { id: "ledger.record.updated", label: "Edited" }, { id: "ledger.record.posted", label: "Posted" }, { id: "ledger.record.submitted", label: "Submitted for approval" },
    { id: "ledger.record.approved", label: "Approved" }, { id: "ledger.record.approval_step", label: "Approval step completed" }, { id: "ledger.record.rejected", label: "Rejected" }, { id: "ledger.record.voided", label: "Voided" },
    { id: "ledger.record.synced", label: "Synced from Billing" }, { id: "ledger.settlement.created", label: "Payment recorded" }, { id: "ledger.attachment.added", label: "Document attached" }, { id: "ledger.attachment.removed", label: "Document removed" },
];
