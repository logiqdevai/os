import { Injectable, OnModuleInit } from '@nestjs/common';
import { ModuleKey } from 'generated/prisma';
import { z } from 'zod';
import { McpRegistry } from '@/core/mcp/mcp.registry';
import { LedgerRecordsService } from './services/ledger-records.service';
import { LedgerConfigService } from './services/ledger-config.service';
import { LedgerSuppliersService } from './services/ledger-suppliers.service';
import { RecurringExpensesService } from './services/recurring-expenses.service';
import { ExpenseClaimsService } from './services/expense-claims.service';
import { LedgerPlanningService } from './services/ledger-planning.service';
import { LedgerReportsService } from './services/ledger-reports.service';
import * as S from './dto/ledger.schemas';

const M = ModuleKey.INCOME_EXPENSE;
const id = z.object({ id: z.string().uuid() });

/**
 * 09 MCP tools — thin adapters over the same services and zod schemas as REST. Record tools are registered under the
 * expense key; the service re-checks the INCOME / EXPENSE key of the actual record type on every call.
 */
@Injectable()
export class LedgerMcp implements OnModuleInit {
    constructor(
        private readonly registry: McpRegistry,
        private readonly records: LedgerRecordsService,
        private readonly config: LedgerConfigService,
        private readonly suppliers: LedgerSuppliersService,
        private readonly recurring: RecurringExpensesService,
        private readonly claims: ExpenseClaimsService,
        private readonly planning: LedgerPlanningService,
        private readonly reports: LedgerReportsService,
    ) { }

    onModuleInit() {
        this.registry.registerMany([
            { name: 'finance_records_read', description: 'List income and expense ledger records (filter by type, status, payment_status, category, company, project, date range).', permission: 'finance.expenses.read', module: M, resource_type: 'ledger_record', input: S.LedgerRecordQuerySchema, handler: (ctx, a) => this.records.findAll(ctx, a) },
            { name: 'finance_income_read', description: 'List income records (invoiced vs received).', permission: 'finance.income.read', module: M, resource_type: 'ledger_record', input: S.LedgerRecordQuerySchema, handler: (ctx, a) => this.records.findAll(ctx, { ...a, type: 'INCOME' }) },
            { name: 'finance_records_get', description: 'Get one ledger record by id or number with payments, attachments and history.', permission: 'finance.expenses.read', module: M, resource_type: 'ledger_record', input: z.object({ id: z.string() }), handler: (ctx, a) => this.records.findOne(ctx, a.id) },
            { name: 'finance_records_create', description: 'Create an expense or income record. VAT is computed from net (exclusive) or gross (inclusive). Records above the approval threshold go to review.', permission: 'finance.expenses.create', module: M, resource_type: 'ledger_record', sensitive: true, input: S.CreateLedgerRecordSchema, handler: (ctx, a) => this.records.create(ctx, a) },
            { name: 'finance_records_update', description: 'Update a ledger record (category, project, notes, amounts of manual records).', permission: 'finance.expenses.update', module: M, resource_type: 'ledger_record', sensitive: true, input: S.UpdateLedgerRecordSchema.extend({ id: z.string().uuid() }), handler: (ctx, { id: rid, ...dto }) => this.records.update(ctx, rid, dto) },
            { name: 'finance_records_approve', description: 'Approve a ledger record waiting for review (never one you created).', permission: 'finance.expenses.approve', module: M, resource_type: 'ledger_record', sensitive: true, input: id.extend({ comment: z.string().max(1000).optional() }), handler: (ctx, a) => this.records.approve(ctx, a.id, a.comment) },
            { name: 'finance_records_void', description: 'Void a ledger record with a reason.', permission: 'finance.expenses.update', module: M, resource_type: 'ledger_record', sensitive: true, input: id.extend(S.VoidSchema.shape), handler: (ctx, a) => this.records.void(ctx, a.id, a.reason) },
            { name: 'finance_settlements_create', description: 'Record a payment / refund / write-off against a ledger record.', permission: 'finance.expenses.update', module: M, resource_type: 'ledger_record', sensitive: true, input: S.CreateSettlementSchema.extend({ id: z.string().uuid() }), handler: (ctx, { id: rid, ...dto }) => this.records.addSettlement(ctx, rid, dto) },
            { name: 'finance_categories_read', description: 'List income and expense categories.', permission: 'finance.expenses.read', module: M, resource_type: 'ledger_category', input: S.LedgerCategoryQuerySchema, handler: (ctx, a) => this.config.listCategories(ctx, a) },
            { name: 'finance_categories_manage', description: 'Create an income or expense category or subcategory.', permission: 'finance.categories.manage', module: M, resource_type: 'ledger_category', input: S.CreateLedgerCategorySchema, handler: (ctx, a) => this.config.createCategory(ctx, a) },
            { name: 'finance_suppliers_read', description: 'List suppliers with spend this year.', permission: 'finance.expenses.read', module: M, resource_type: 'ledger_supplier_profile', input: S.SupplierQuerySchema, handler: (ctx, a) => this.suppliers.findAll(ctx, a) },
            { name: 'finance_suppliers_update', description: 'Set a supplier\'s default category, VAT and payment terms.', permission: 'finance.expenses.update', module: M, resource_type: 'ledger_supplier_profile', input: S.SupplierProfileSchema.omit({ bank_details: true }).extend({ company_id: z.string().uuid() }), handler: (ctx, { company_id, ...dto }) => this.suppliers.upsertProfile(ctx, company_id, dto) },
            { name: 'finance_recurring_expenses_read', description: 'List recurring expenses and the monthly total.', permission: 'finance.recurring_expenses.read', module: M, resource_type: 'recurring_expense', input: S.RecurringQuerySchema, handler: (ctx, a) => this.recurring.findAll(ctx, a) },
            { name: 'finance_recurring_expenses_manage', description: 'Create a recurring expense template (generates expense records on schedule).', permission: 'finance.recurring_expenses.manage', module: M, resource_type: 'recurring_expense', input: S.CreateRecurringExpenseSchema, handler: (ctx, a) => this.recurring.create(ctx, a) },
            { name: 'finance_expense_claims_read', description: 'List expense claims (own claims, or all with finance.expense_claims.read).', permission: 'finance.expense_claims.read_own', module: M, resource_type: 'expense_claim', input: S.ClaimQuerySchema, handler: (ctx, a) => this.claims.findAll(ctx, a) },
            { name: 'finance_expense_claims_create', description: 'File an expense claim for yourself with receipt lines.', permission: 'finance.expense_claims.create_own', module: M, resource_type: 'expense_claim', input: S.CreateExpenseClaimSchema, handler: (ctx, a) => this.claims.create(ctx, a) },
            { name: 'finance_expense_claims_approve', description: 'Approve a submitted expense claim.', permission: 'finance.expense_claims.approve', module: M, resource_type: 'expense_claim', sensitive: true, input: id, handler: (ctx, a) => this.claims.decide(ctx, a.id, true) },
            { name: 'finance_budgets_read', description: 'Budgets with planned vs actual.', permission: 'finance.budgets.read', module: M, resource_type: 'ledger_budget', input: S.BudgetQuerySchema, handler: (ctx, a) => this.planning.listBudgets(ctx, a.year, a.status) },
            { name: 'finance_ledger_dashboard_read', description: 'Income & expense overview: income, expenses, profit, VAT, receivables, payables, monthly trend.', permission: 'finance.expenses.read', module: M, resource_type: 'ledger_record', input: S.ReportRangeSchema, handler: (ctx, a) => this.reports.dashboard(ctx, a) },
            { name: 'finance_profit_loss_read', description: 'Profit & loss for a date range (accrual or cash), optional comparison.', permission: 'finance.profit_loss.read', module: M, resource_type: 'ledger_record', input: S.ReportRangeSchema, handler: (ctx, a) => this.reports.profitLoss(ctx, a) },
            { name: 'finance_vat_read', description: 'VAT collected, paid and net position, grouped by rate, category, counterparty or month.', permission: 'finance.vat.read', module: M, resource_type: 'ledger_record', input: S.ReportRangeSchema, handler: (ctx, a) => this.reports.vat(ctx, a) },
            { name: 'finance_profitability_read', description: 'Profitability per project or customer (revenue, direct expenses, employee cost from approved time).', permission: 'finance.profitability.read', module: M, resource_type: 'ledger_record', input: S.ProfitabilityQuerySchema, handler: (ctx, a) => this.reports.profitability(ctx, a) },
            { name: 'finance_periods_manage', description: 'Close, reopen or lock a financial period.', permission: 'finance.periods.manage', module: M, resource_type: 'financial_period', sensitive: true, input: id.extend({ action: z.enum(['close', 'reopen', 'lock']) }), handler: (ctx, a) => this.planning.setPeriodStatus(ctx, a.id, a.action) },
            { name: 'finance_insights_read', description: 'Open findings: unusual expenses, suspected duplicates, budget alerts.', permission: 'finance.expenses.read', module: M, resource_type: 'ledger_insight', input: S.InsightQuerySchema, handler: (ctx, a) => this.planning.listInsights(ctx, a) },
        ]);
    }
}
