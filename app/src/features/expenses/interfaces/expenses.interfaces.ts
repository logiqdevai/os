import type { PaginationMeta } from "@/components/ui/data-table";

/** 09 Income & expense (ledger) API shapes. Money = decimal string from Prisma or number in reports. */
export type Money = string | number;
export interface Paginated<T> { data: T[]; pagination: PaginationMeta & { has_next: boolean; has_prev: boolean } }

export type LedgerRecordType = "INCOME" | "EXPENSE";
export type LedgerRecordStatus = "DRAFT" | "PENDING_REVIEW" | "POSTED" | "VOIDED";
export type LedgerPaymentStatus = "UNPAID" | "PARTIALLY_PAID" | "PAID" | "OVERDUE" | "CANCELLED" | "REFUNDED";
export type LedgerRecordSource = "MANUAL" | "INVOICE_SYNC" | "PAYMENT_SYNC" | "SUBSCRIPTION_SYNC" | "SUPPLIER_INVOICE_IMPORT" | "RECURRING_EXPENSE" | "PAYROLL" | "API";
export type LedgerVatTreatment = "STANDARD" | "REDUCED" | "ZERO_RATED" | "EXEMPT" | "REVERSE_CHARGE" | "OUT_OF_SCOPE";
export type TaxBehavior = "INCLUSIVE" | "EXCLUSIVE";
export type LedgerSettlementKind = "PAYMENT" | "REFUND" | "WRITE_OFF" | "ADJUSTMENT";
export type LedgerPlLine = "REVENUE" | "COST_OF_OPERATIONS" | "EMPLOYEE_EXPENSES" | "OFFICE_EXPENSES" | "SOFTWARE_EXPENSES" | "MARKETING_EXPENSES" | "PROFESSIONAL_EXPENSES" | "OTHER_OPERATING_EXPENSES";
export type RecurringExpenseStatus = "ACTIVE" | "PAUSED" | "ENDED" | "CANCELLED";
export type ExpenseClaimStatus = "DRAFT" | "SUBMITTED" | "APPROVED" | "REJECTED" | "PAID";
export type FinancialPeriodStatus = "OPEN" | "CLOSED" | "LOCKED";
export type ReportBasis = "ACCRUAL" | "CASH";
export type BillingInterval = "DAY" | "WEEK" | "MONTH" | "QUARTER" | "YEAR";
export type PaymentMethodType = "CARD" | "BANK_TRANSFER" | "SEPA_DEBIT" | "CASH" | "CHECK" | "WALLET" | "OTHER";

export interface Ref { id: string; name: string }
export interface UserRef { id?: string; email?: string | null; display_name?: string | null; first_name?: string | null; last_name?: string | null }

export interface LedgerCategory {
    id: string; kind: LedgerRecordType; name: string; slug: string; parent_category_id: string | null; description: string | null; color: string | null; system_key: string | null;
    pl_line: LedgerPlLine | null; default_tax_rate_id: string | null; default_vat_treatment: LedgerVatTreatment | null; is_operating: boolean; sort_order: number; archived_at: string | null;
    default_tax_rate?: { id: string; name: string; percentage: Money } | null; _count?: { records: number };
}

export interface LedgerPaymentMethod {
    id: string; name: string; type: PaymentMethodType; track_balance: boolean; currency: string | null; iban_last4: string | null; opening_balance: Money | null; opening_date: string | null; is_default: boolean; archived_at: string | null;
}

export interface LedgerSettings {
    organization_id: string; reporting_currency: string | null; effective_reporting_currency: string; default_income_tax_rate_id: string | null; default_expense_tax_rate_id: string | null;
    default_pricing_mode: TaxBehavior; fiscal_year_start_month: number; approval_threshold_amount: Money | null; auto_sync_invoices: boolean; auto_sync_payments: boolean;
    auto_categorize_suppliers: boolean; duplicate_detection_enabled: boolean; upcoming_expense_reminder_days: number; ai_enabled: boolean;
}

export interface LedgerSettlement { id: string; kind: LedgerSettlementKind; amount: Money; currency: string; settled_on: string; reference: string | null; notes: string | null; payment_method?: Ref | null }

export interface LedgerRecord {
    id: string; number: string; type: LedgerRecordType; status: LedgerRecordStatus; source: LedgerRecordSource; is_manual: boolean; description: string; reference_number: string | null;
    transaction_date: string; due_date: string | null; payment_date: string | null; currency: string; net_amount: Money; vat_percent: Money; vat_amount: Money; gross_amount: Money;
    vat_treatment: LedgerVatTreatment; pricing_mode: TaxBehavior; amounts_overridden: boolean; payment_status: LedgerPaymentStatus; amount_paid: Money; amount_remaining: Money;
    category_id: string | null; subcategory_id: string | null; category_path_snapshot: string | null; company_id: string | null; counterparty_name: string | null; project_id: string | null;
    payment_method_id: string | null; tax_rate_id: string | null; notes: string | null; invoice_id: string | null; created_at: string; branch_id: string | null; flagged_unusual: boolean;
    category?: (Ref & { color?: string | null }) | null; subcategory?: Ref | null; company?: Ref | null; project?: Ref | null; payment_method?: Ref | null;
    _count?: { attachments: number; settlements: number };
}

export interface LedgerRecordDetail extends LedgerRecord {
    tax_rate?: { id: string; name: string; percentage: Money } | null;
    invoice?: { id: string; number: string; status: string } | null;
    recurring_expense?: Ref | null;
    created_by?: { id: string; user: UserRef } | null;
    approved_by?: { id: string; user: UserRef } | null;
    approved_at: string | null; posted_at: string | null; voided_at: string | null; void_reason: string | null;
    period?: { id: string; name: string; status: FinancialPeriodStatus } | null;
    settlements: LedgerSettlement[];
    attachments: { id: string; document_id: string; kind: string; title: string | null; created_at: string }[];
    line_items: { description: string; quantity?: string; unit_price?: string; net?: string; vat?: string; gross?: string }[] | null;
    history: { id: string; event_type: string; created_at: string; metadata: Record<string, unknown> | null; actor_user?: UserRef | null }[];
    approvals: { id: string; step: number; decision: string; comment: string | null; rejection_reason: string | null; requested_at: string; decided_at: string | null }[];
    can_edit_amounts: boolean;
}

export interface LedgerRecordList extends Paginated<LedgerRecord> {
    totals: { type: LedgerRecordType; gross: Money; net: Money; vat: Money; remaining: Money }[];
}

export interface LedgerRecordInput {
    type: LedgerRecordType; description: string; category_id?: string | null; subcategory_id?: string | null; reference_number?: string | null; transaction_date: string; due_date?: string | null;
    payment_date?: string | null; currency?: string; net_amount?: string; gross_amount?: string; vat_percent?: string; vat_amount?: string; amounts_overridden?: boolean; pricing_mode?: TaxBehavior;
    tax_rate_id?: string | null; vat_treatment?: LedgerVatTreatment; payment_method_id?: string | null; company_id?: string | null; project_id?: string | null; notes?: string | null;
    status?: "DRAFT" | "POSTED"; mark_paid?: boolean;
}

export interface LedgerDashboard {
    currency: string; basis: ReportBasis; from: string; to: string;
    can: { income: boolean; expenses: boolean; payroll: boolean; vat: boolean };
    totals: { total_income: number; gross_income: number; total_expenses: number; net_profit: number; margin_percent: number | null; vat_collected: number; vat_paid: number; net_vat: number; payroll_expenses: number; recurring_expenses: number; operating_expenses: number };
    receivables: { amount: number; count: number; overdue_amount: number; overdue_count: number };
    payables: { amount: number; count: number; overdue_amount: number; overdue_count: number };
    pending_review: number;
    trend: { month: string; income: number; expenses: number; profit: number }[];
    expenses_by_category: { category_id: string | null; name: string; amount: number; vat: number }[];
    income_by_category: { category_id: string | null; name: string; amount: number; vat: number }[];
    cash_position: { id: string; name: string; type: string; currency: string | null; balance: number }[];
    upcoming_expenses: { id: string; name: string; next_occurrence_date: string; expected_gross_amount: Money; currency: string }[];
}

export interface RecurringExpense {
    id: string; name: string; description: string | null; status: RecurringExpenseStatus; category_id: string | null; company_id: string | null; project_id: string | null; payment_method_id: string | null;
    currency: string; expected_net_amount: Money; vat_percent: Money; expected_vat_amount: Money; expected_gross_amount: Money; tax_rate_id: string | null; interval: BillingInterval; interval_count: number;
    start_date: string; end_date: string | null; day_of_month: number | null; due_days: number | null; next_occurrence_date: string | null; occurrences_generated: number; auto_generate: boolean; notes: string | null;
    category?: Ref | null; company?: Ref | null; project?: Ref | null; payment_method?: Ref | null;
}
export interface RecurringExpenseDetail extends RecurringExpense {
    records: { id: string; number: string; transaction_date: string; gross_amount: Money; status: LedgerRecordStatus; payment_status: LedgerPaymentStatus; currency: string }[];
    preview: { date: string; gross: string }[];
}

export interface Supplier {
    id: string; name: string; type: string; email: string | null; vat_number: string | null; country: string | null;
    ledger_supplier_profile: { id: string; payment_terms_days: number | null; default_category: Ref | null; default_tax_rate: { id: string; name: string; percentage: Money } | null; vat_number: string | null } | null;
    spend_ytd: Money; outstanding: Money; records_ytd: number; last_expense_at: string | null;
}
export interface SupplierDetail {
    id: string; name: string; legal_name: string | null; type: string; email: string | null; vat_number: string | null; country: string | null;
    ledger_supplier_profile: { id: string; default_category_id: string | null; default_tax_rate_id: string | null; default_vat_treatment: LedgerVatTreatment | null; payment_terms_days: number | null; matching_aliases: string[]; vat_number: string | null; notes: string | null; bank_details: Record<string, string> | null } | null;
    totals: { spend: Money; outstanding: Money; vat: Money; records: number };
    spend_by_month: { month: string; amount: number }[];
}

export interface ExpenseClaimLine { id?: string; expense_date: string; category_id: string | null; project_id: string | null; description: string; merchant: string | null; gross_amount: Money; vat_amount: Money; category?: Ref | null; project?: Ref | null }
export interface ExpenseClaim {
    id: string; number: string; employee_id: string; employee_name_snapshot: string | null; title: string; status: ExpenseClaimStatus; currency: string; total_amount: Money; vat_total: Money;
    submitted_at: string | null; decided_at: string | null; rejection_reason: string | null; paid_at: string | null; notes: string | null; created_at: string; _count?: { lines: number };
}
export interface ExpenseClaimDetail extends ExpenseClaim {
    lines: ExpenseClaimLine[];
    payroll_entry: { id: string; status: string; ledger_record_id: string | null } | null;
    approvals: { id: string; step: number; decision: string; decided_at: string | null; rejection_reason: string | null }[];
}
export interface ClaimList extends Paginated<ExpenseClaim> { employee_profile: boolean; my_employee_id?: string | null }

export interface Budget {
    id: string; name: string; fiscal_year: number; scope: "CATEGORY" | "PROJECT" | "DEPARTMENT"; basis: ReportBasis; currency: string; status: "DRAFT" | "ACTIVE" | "CLOSED"; warn_percent: number;
    planned_total: number; actual_total: number; used_percent: number | null; subjects: number; notes: string | null;
}
export interface BudgetSubject { subject_key: string; label: string; months: { month: number; planned: number; actual: number }[]; planned_total: number; actual_total: number; used_percent: number | null; over_warn: boolean }
export interface BudgetDetail extends Omit<Budget, "subjects" | "planned_total" | "actual_total" | "used_percent"> {
    subjects: BudgetSubject[];
    lines: { id: string; subject_key: string; category_id: string | null; month: number; planned_amount: Money; category?: Ref | null }[];
}

export interface FinancialPeriod {
    id: string; type: string; name: string; fiscal_year: number | null; start_date: string; end_date: string; status: FinancialPeriodStatus; closed_at: string | null; locked_at: string | null;
    closed_by?: { id: string; user: UserRef } | null; _count?: { records: number };
}

export interface ProfitLoss {
    currency: string; basis: ReportBasis; from: string; to: string;
    lines: { line: LedgerPlLine; amount: number; categories: { category_id: string | null; name: string; amount: number }[] }[];
    revenue: number; total_expenses: number; net_operating_result: number; margin_percent: number | null;
    comparison: { lines: { line: LedgerPlLine; amount: number }[]; revenue: number; total_expenses: number; net_operating_result: number } | null;
    compare_range: { from: string; to: string } | null;
}

export interface VatReport {
    currency: string; basis: ReportBasis; from: string; to: string; group_by: string; vat_collected: number; vat_paid: number; net_vat: number;
    groups: { key: string; label: string; income_net: number; vat_collected: number; expense_net: number; vat_paid: number; net_vat: number }[];
    returns: { id: string; status: "DRAFT" | "FILED" | "PAID"; net_vat: Money; currency: string; authority_reference: string | null; filed_at: string | null; period: { id: string; name: string; start_date: string; end_date: string; status: FinancialPeriodStatus } }[];
}

export interface Profitability {
    scope: "PROJECT" | "CUSTOMER"; currency: string; from: string; to: string; employee_cost_detail: boolean;
    totals: { revenue: number; direct_expenses: number; employee_costs: number; total_cost: number; gross_profit: number };
    items: { id: string; name: string; customer: string | null; revenue: number; payments_received: number; outstanding_revenue: number; direct_expenses: number; employee_costs: number; hours: number; total_cost: number; gross_profit: number; margin_percent: number | null }[];
}

export interface LedgerInsight { id: string; kind: string; status: string; severity: string | null; title: string; body: string | null; created_at: string; record?: { id: string; number: string; description: string; gross_amount: Money; currency: string; type: LedgerRecordType } | null }
export interface LedgerApprovals { records: (LedgerRecord & { created_by?: { id: string; user: UserRef } | null })[]; claims: ExpenseClaim[] }
