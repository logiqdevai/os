import { z } from 'zod';
import {
    BillingInterval, ExpenseClaimStatus, FinancialPeriodStatus, FinancialPeriodType, LedgerAttachmentKind, LedgerBudgetScope, LedgerBudgetStatus,
    LedgerCategoryKind, LedgerInsightKind, LedgerInsightStatus, LedgerPaymentStatus, LedgerPlLine, LedgerRecordSource, LedgerRecordStatus,
    LedgerRecordType, LedgerReportBasis, LedgerSettlementKind, LedgerVatTreatment, PaymentMethodType, RecurringExpenseStatus, TaxBehavior,
} from 'generated/prisma';
import { BaseListQuerySchema, boolish, csv } from '@/shared/utils/pagination/pagination.utils';

/** One schema per action, shared by REST bodies (ZodBodyPipe) and MCP tools (roles-and-permissions rule §5). */
export const money = z.union([z.number(), z.string().regex(/^-?\d+(\.\d{1,4})?$/, 'must be a decimal amount')]).transform((v) => String(v));
export const moneyPos = money.refine((v) => Number(v) >= 0, 'must be zero or more');
export const percent = z.union([z.number(), z.string()]).transform((v) => String(v)).refine((v) => !Number.isNaN(Number(v)) && Number(v) >= 0 && Number(v) <= 100, 'must be between 0 and 100');
export const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}/, 'must be a date (YYYY-MM-DD)');
export const currency = z.string().length(3).transform((v) => v.toUpperCase());
const uuid = z.string().uuid();
const optUuid = uuid.nullable().optional();
const optText = (max = 2000) => z.string().max(max).nullable().optional();

// --- Settings ----------------------------------------------------------------------------
export const UpdateLedgerSettingsSchema = z.object({
    reporting_currency: currency.nullable().optional(),
    default_income_tax_rate_id: optUuid,
    default_expense_tax_rate_id: optUuid,
    default_pricing_mode: z.nativeEnum(TaxBehavior).optional(),
    fiscal_year_start_month: z.number().int().min(1).max(12).optional(),
    approval_threshold_amount: money.nullable().optional(),
    require_approval_for_imports: z.boolean().optional(),
    auto_sync_invoices: z.boolean().optional(),
    auto_sync_payments: z.boolean().optional(),
    auto_sync_subscriptions: z.boolean().optional(),
    auto_categorize_suppliers: z.boolean().optional(),
    duplicate_detection_enabled: z.boolean().optional(),
    upcoming_expense_reminder_days: z.number().int().min(0).max(90).optional(),
    overdue_check_enabled: z.boolean().optional(),
    monthly_summary_enabled: z.boolean().optional(),
    ai_enabled: z.boolean().optional(),
    ai_auto_categorize: z.boolean().optional(),
});
export type UpdateLedgerSettingsDto = z.infer<typeof UpdateLedgerSettingsSchema>;

// --- Categories & payment methods --------------------------------------------------------
export const CreateLedgerCategorySchema = z.object({
    kind: z.nativeEnum(LedgerCategoryKind),
    name: z.string().trim().min(1).max(120),
    parent_category_id: optUuid,
    description: optText(500),
    color: z.string().max(32).nullable().optional(),
    pl_line: z.nativeEnum(LedgerPlLine).nullable().optional(),
    default_tax_rate_id: optUuid,
    default_vat_treatment: z.nativeEnum(LedgerVatTreatment).nullable().optional(),
    is_operating: z.boolean().optional(),
    sort_order: z.number().int().optional(),
});
export const UpdateLedgerCategorySchema = CreateLedgerCategorySchema.partial().omit({ kind: true });
export type CreateLedgerCategoryDto = z.infer<typeof CreateLedgerCategorySchema>;
export type UpdateLedgerCategoryDto = z.infer<typeof UpdateLedgerCategorySchema>;
export const LedgerCategoryQuerySchema = z.object({ kind: z.nativeEnum(LedgerCategoryKind).optional(), archived: boolish });
export type LedgerCategoryQuery = z.infer<typeof LedgerCategoryQuerySchema>;

export const CreateLedgerPaymentMethodSchema = z.object({
    name: z.string().trim().min(1).max(120),
    type: z.nativeEnum(PaymentMethodType).optional(),
    track_balance: z.boolean().optional(),
    currency: currency.nullable().optional(),
    iban_last4: z.string().regex(/^\d{4}$/).nullable().optional(),
    opening_balance: money.nullable().optional(),
    opening_date: dateStr.nullable().optional(),
    is_default: z.boolean().optional(),
});
export const UpdateLedgerPaymentMethodSchema = CreateLedgerPaymentMethodSchema.partial();
export type CreateLedgerPaymentMethodDto = z.infer<typeof CreateLedgerPaymentMethodSchema>;
export type UpdateLedgerPaymentMethodDto = z.infer<typeof UpdateLedgerPaymentMethodSchema>;

// --- Records ------------------------------------------------------------------------------
export const LedgerLineItemSchema = z.object({
    description: z.string().min(1).max(500),
    quantity: money.optional(),
    unit_price: money.optional(),
    net: money.optional(),
    vat: money.optional(),
    gross: money.optional(),
});

const RecordFields = {
    description: z.string().trim().min(1).max(500),
    category_id: optUuid,
    subcategory_id: optUuid,
    reference_number: optText(120),
    transaction_date: dateStr,
    due_date: dateStr.nullable().optional(),
    payment_date: dateStr.nullable().optional(),
    currency: currency.optional(),
    fx_rate: money.nullable().optional(),
    /** Entered amount: net for EXCLUSIVE pricing, gross for INCLUSIVE. */
    net_amount: moneyPos.optional(),
    gross_amount: moneyPos.optional(),
    vat_percent: percent.optional(),
    /** Only with amounts_overridden: authorized manual VAT. */
    vat_amount: moneyPos.optional(),
    amounts_overridden: z.boolean().optional(),
    tax_rate_id: optUuid,
    vat_treatment: z.nativeEnum(LedgerVatTreatment).optional(),
    pricing_mode: z.nativeEnum(TaxBehavior).optional(),
    payment_method_id: optUuid,
    company_id: optUuid,
    counterparty_name: optText(200),
    project_id: optUuid,
    contract_id: optUuid,
    employee_id: optUuid,
    department_id: optUuid,
    branch_id: optUuid,
    notes: optText(5000),
    line_items: z.array(LedgerLineItemSchema).max(200).nullable().optional(),
};

export const CreateLedgerRecordSchema = z
    .object({
        type: z.nativeEnum(LedgerRecordType),
        ...RecordFields,
        /** DRAFT keeps it out of reports; POSTED posts it (or sends it to review when approval is required). */
        status: z.enum(['DRAFT', 'POSTED']).optional(),
        /** Record the full gross amount as paid on payment_date (or transaction_date). */
        mark_paid: z.boolean().optional(),
    })
    .refine((v) => v.net_amount !== undefined || v.gross_amount !== undefined, { message: 'Enter the net or gross amount', path: ['net_amount'] });
export type CreateLedgerRecordDto = z.infer<typeof CreateLedgerRecordSchema>;

export const UpdateLedgerRecordSchema = z.object({ ...RecordFields }).partial();
export type UpdateLedgerRecordDto = z.infer<typeof UpdateLedgerRecordSchema>;

export const LedgerRecordQuerySchema = BaseListQuerySchema.extend({
    type: z.nativeEnum(LedgerRecordType).optional(),
    status: csv(z.nativeEnum(LedgerRecordStatus)),
    payment_status: csv(z.nativeEnum(LedgerPaymentStatus)),
    source: csv(z.nativeEnum(LedgerRecordSource)),
    category_id: z.string().uuid().optional(),
    company_id: z.string().uuid().optional(),
    project_id: z.string().uuid().optional(),
    branch_id: z.string().uuid().optional(),
    recurring_expense_id: z.string().uuid().optional(),
    from: dateStr.optional(),
    to: dateStr.optional(),
    manual: boolish,
    include_voided: boolish,
});
export type LedgerRecordQuery = z.infer<typeof LedgerRecordQuerySchema>;

export const PostLedgerRecordSchema = z.object({ comment: optText(1000) });
export const RejectSchema = z.object({ reason: z.string().trim().min(1).max(1000) });
export const VoidSchema = z.object({ reason: z.string().trim().min(1).max(1000) });

export const CreateSettlementSchema = z.object({
    kind: z.nativeEnum(LedgerSettlementKind).optional(),
    amount: moneyPos.refine((v) => Number(v) > 0, 'must be more than zero'),
    settled_on: dateStr,
    payment_method_id: optUuid,
    reference: optText(200),
    document_id: optUuid,
    notes: optText(1000),
});
export type CreateSettlementDto = z.infer<typeof CreateSettlementSchema>;

export const CreateAttachmentSchema = z.object({
    document_id: uuid,
    kind: z.nativeEnum(LedgerAttachmentKind).optional(),
    title: optText(200),
    is_original: z.boolean().optional(),
});
export type CreateAttachmentDto = z.infer<typeof CreateAttachmentSchema>;

// --- Suppliers ----------------------------------------------------------------------------
export const SupplierProfileSchema = z.object({
    default_category_id: optUuid,
    default_tax_rate_id: optUuid,
    default_vat_treatment: z.nativeEnum(LedgerVatTreatment).nullable().optional(),
    default_pricing_mode: z.nativeEnum(TaxBehavior).nullable().optional(),
    payment_terms_days: z.number().int().min(0).max(365).nullable().optional(),
    matching_aliases: z.array(z.string().max(200)).max(20).optional(),
    vat_number: optText(40),
    bank_details: z.object({ iban: z.string().max(40).optional(), bank: z.string().max(120).optional(), bic: z.string().max(20).optional() }).nullable().optional(),
    notes: optText(2000),
});
export type SupplierProfileDto = z.infer<typeof SupplierProfileSchema>;
export const SupplierQuerySchema = BaseListQuerySchema.extend({ category_id: z.string().uuid().optional() });
export type SupplierQuery = z.infer<typeof SupplierQuerySchema>;

// --- Recurring expenses ---------------------------------------------------------------------
export const CreateRecurringExpenseSchema = z.object({
    name: z.string().trim().min(1).max(160),
    description: optText(1000),
    category_id: optUuid,
    subcategory_id: optUuid,
    company_id: optUuid,
    project_id: optUuid,
    department_id: optUuid,
    branch_id: optUuid,
    payment_method_id: optUuid,
    currency: currency.optional(),
    expected_net_amount: moneyPos,
    vat_percent: percent.optional(),
    tax_rate_id: optUuid,
    vat_treatment: z.nativeEnum(LedgerVatTreatment).optional(),
    pricing_mode: z.nativeEnum(TaxBehavior).optional(),
    interval: z.nativeEnum(BillingInterval).optional(),
    interval_count: z.number().int().min(1).max(36).optional(),
    start_date: dateStr,
    end_date: dateStr.nullable().optional(),
    day_of_month: z.number().int().min(1).max(31).nullable().optional(),
    due_days: z.number().int().min(0).max(180).nullable().optional(),
    auto_generate: z.boolean().optional(),
    reminder_days_before: z.number().int().min(0).max(60).nullable().optional(),
    notes: optText(2000),
});
export const UpdateRecurringExpenseSchema = CreateRecurringExpenseSchema.partial();
export type CreateRecurringExpenseDto = z.infer<typeof CreateRecurringExpenseSchema>;
export type UpdateRecurringExpenseDto = z.infer<typeof UpdateRecurringExpenseSchema>;
export const RecurringQuerySchema = BaseListQuerySchema.extend({ status: csv(z.nativeEnum(RecurringExpenseStatus)) });
export type RecurringQuery = z.infer<typeof RecurringQuerySchema>;

// --- Expense claims ----------------------------------------------------------------------------
export const ClaimLineSchema = z.object({
    expense_date: dateStr,
    category_id: optUuid,
    project_id: optUuid,
    description: z.string().trim().min(1).max(500),
    merchant: optText(200),
    gross_amount: moneyPos.refine((v) => Number(v) > 0, 'must be more than zero'),
    vat_amount: moneyPos.optional(),
    document_id: optUuid,
});
export const CreateExpenseClaimSchema = z.object({
    title: z.string().trim().min(1).max(200),
    currency: currency.optional(),
    notes: optText(2000),
    /** Only finance users (finance.expense_claims.approve) may file a claim for another employee. */
    employee_id: optUuid,
    lines: z.array(ClaimLineSchema).min(1).max(100),
    submit: z.boolean().optional(),
});
export const UpdateExpenseClaimSchema = CreateExpenseClaimSchema.partial().omit({ employee_id: true });
export type CreateExpenseClaimDto = z.infer<typeof CreateExpenseClaimSchema>;
export type UpdateExpenseClaimDto = z.infer<typeof UpdateExpenseClaimSchema>;
export const ClaimQuerySchema = BaseListQuerySchema.extend({ status: csv(z.nativeEnum(ExpenseClaimStatus)), mine: boolish });
export type ClaimQuery = z.infer<typeof ClaimQuerySchema>;
export const PayClaimSchema = z.object({ payment_method_id: optUuid, paid_on: dateStr.optional(), reference: optText(200) });

// --- Budgets ---------------------------------------------------------------------------------------
export const BudgetLineSchema = z.object({
    category_id: optUuid,
    project_id: optUuid,
    department_id: optUuid,
    month: z.number().int().min(1).max(12),
    planned_amount: moneyPos,
});
export const CreateBudgetSchema = z.object({
    name: z.string().trim().min(1).max(160),
    fiscal_year: z.number().int().min(2000).max(2100),
    scope: z.nativeEnum(LedgerBudgetScope).optional(),
    basis: z.nativeEnum(LedgerReportBasis).optional(),
    currency: currency.optional(),
    status: z.nativeEnum(LedgerBudgetStatus).optional(),
    warn_percent: z.number().int().min(1).max(200).optional(),
    notes: optText(2000),
    lines: z.array(BudgetLineSchema).max(2000).optional(),
});
export const UpdateBudgetSchema = CreateBudgetSchema.partial();
export type CreateBudgetDto = z.infer<typeof CreateBudgetSchema>;
export type UpdateBudgetDto = z.infer<typeof UpdateBudgetSchema>;
export const BudgetQuerySchema = z.object({ year: z.coerce.number().int().optional(), status: z.nativeEnum(LedgerBudgetStatus).optional() });

// --- Periods -----------------------------------------------------------------------------------------
export const CreatePeriodSchema = z.object({
    type: z.nativeEnum(FinancialPeriodType),
    name: z.string().trim().min(1).max(120),
    fiscal_year: z.number().int().nullable().optional(),
    start_date: dateStr,
    end_date: dateStr,
    notes: optText(1000),
});
export const GeneratePeriodsSchema = z.object({ fiscal_year: z.number().int().min(2000).max(2100), type: z.enum(['MONTH', 'QUARTER', 'YEAR']).optional() });
export const PeriodQuerySchema = z.object({ year: z.coerce.number().int().optional(), type: z.nativeEnum(FinancialPeriodType).optional(), status: z.nativeEnum(FinancialPeriodStatus).optional() });

// --- Reports -------------------------------------------------------------------------------------------
export const ReportRangeSchema = z.object({
    from: dateStr.optional(),
    to: dateStr.optional(),
    basis: z.nativeEnum(LedgerReportBasis).optional(),
    branch_id: z.string().uuid().optional(),
    project_id: z.string().uuid().optional(),
    company_id: z.string().uuid().optional(),
    category_id: z.string().uuid().optional(),
    department_id: z.string().uuid().optional(),
    group_by: z.enum(['rate', 'category', 'counterparty', 'month']).optional(),
    compare: z.enum(['previous_period', 'previous_year']).optional(),
    format: z.enum(['json', 'csv']).optional(),
});
export type ReportRange = z.infer<typeof ReportRangeSchema>;
export const ProfitabilityQuerySchema = ReportRangeSchema.extend({ scope: z.enum(['PROJECT', 'CUSTOMER']).optional() });
export type ProfitabilityQuery = z.infer<typeof ProfitabilityQuerySchema>;

// --- Insights -------------------------------------------------------------------------------------------
export const InsightQuerySchema = BaseListQuerySchema.extend({ status: z.nativeEnum(LedgerInsightStatus).optional(), kind: z.nativeEnum(LedgerInsightKind).optional() });
export type InsightQuery = z.infer<typeof InsightQuerySchema>;

export const IdSchema = z.object({ id: uuid });
