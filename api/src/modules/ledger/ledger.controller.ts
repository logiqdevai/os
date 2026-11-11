import { Body, Controller, Delete, ForbiddenException, Get, Header, Param, ParseUUIDPipe, Patch, Post, Put, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { LedgerRecordType, LedgerReportBasis } from 'generated/prisma';
import { JwtGuard } from '@/shared/guards/jwt.guard';
import { PermissionsGuard } from '@/shared/authorization/guards/permissions.guard';
import { CurrentOrg, RequireAnyPermission, RequirePermission } from '@/shared/authorization/decorators/require-permission.decorator';
import { OrgContext } from '@/shared/authorization/interfaces/org-context.interface';
import { ZodValidationPipe } from '@/shared/pipes/zod.validation.pipe';
import { ZBody } from '@/modules/finance-shared/zod-body.pipe';
import { LedgerRecordsService, recordKey } from './services/ledger-records.service';
import { LedgerConfigService } from './services/ledger-config.service';
import { LedgerSuppliersService } from './services/ledger-suppliers.service';
import { RecurringExpensesService } from './services/recurring-expenses.service';
import { ExpenseClaimsService } from './services/expense-claims.service';
import { LedgerPlanningService } from './services/ledger-planning.service';
import { LedgerReportsService } from './services/ledger-reports.service';
import * as S from './dto/ledger.schemas';

const READ_ANY = ['finance.income.read', 'finance.expenses.read'];
const CREATE_ANY = ['finance.income.create', 'finance.expenses.create'];
const UPDATE_ANY = ['finance.income.update', 'finance.expenses.update'];

/** 09 ledger records — REST adapter over LedgerRecordsService (the MCP tools call the same methods). */
@ApiTags('Ledger · Records')
@ApiBearerAuth()
@Controller('ledger')
@UseGuards(JwtGuard, PermissionsGuard)
export class LedgerRecordsController {
    constructor(
        private readonly records: LedgerRecordsService,
        private readonly reports: LedgerReportsService,
        private readonly claims: ExpenseClaimsService,
    ) { }

    @Get('records')
    @RequireAnyPermission(...READ_ANY)
    @ApiOperation({ summary: 'List income and expense records (types limited to the caller\'s read keys)' })
    findAll(@CurrentOrg() ctx: OrgContext, @Query(new ZodValidationPipe(S.LedgerRecordQuerySchema)) query: S.LedgerRecordQuery) {
        return this.records.findAll(ctx, query);
    }

    @Get('records/export')
    @RequireAnyPermission('finance.income.export', 'finance.expenses.export')
    @Header('Content-Type', 'text/csv; charset=utf-8')
    @Header('Content-Disposition', 'attachment; filename="ledger.csv"')
    @ApiOperation({ summary: 'Export records as CSV (filters as the list)' })
    async export(@CurrentOrg() ctx: OrgContext, @Query(new ZodValidationPipe(S.LedgerRecordQuerySchema)) query: S.LedgerRecordQuery) {
        const rows = await this.records.exportRows(ctx, query);
        return this.reports.toCsv(
            ['Number', 'Type', 'Status', 'Date', 'Description', 'Category', 'Counterparty', 'Reference', 'Currency', 'Net', 'VAT %', 'VAT', 'Gross', 'Paid', 'Remaining', 'Payment status'],
            rows.map((r) => [r.number, r.type, r.status, r.transaction_date.toISOString().slice(0, 10), r.description, r.category_path_snapshot ?? r.category?.name, r.counterparty_name ?? r.company?.name, r.reference_number, r.currency, r.net_amount.toString(), r.vat_percent.toString(), r.vat_amount.toString(), r.gross_amount.toString(), r.amount_paid.toString(), r.amount_remaining.toString(), r.payment_status]),
        );
    }

    @Get('records/:id')
    @RequireAnyPermission(...READ_ANY)
    @ApiOperation({ summary: 'Get a record (id or number) with settlements, attachments, approvals and history' })
    findOne(@CurrentOrg() ctx: OrgContext, @Param('id') id: string) {
        return this.records.findOne(ctx, id);
    }

    @Post('records')
    @RequireAnyPermission(...CREATE_ANY)
    @ApiOperation({ summary: 'Create an income or expense record (VAT computed; may go to review)' })
    create(@CurrentOrg() ctx: OrgContext, @Body(ZBody(S.CreateLedgerRecordSchema)) dto: S.CreateLedgerRecordDto) {
        return this.records.create(ctx, dto);
    }

    @Patch('records/:id')
    @RequireAnyPermission(...UPDATE_ANY)
    @ApiOperation({ summary: 'Update a record (synced income: classification only)' })
    update(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Body(ZBody(S.UpdateLedgerRecordSchema)) dto: S.UpdateLedgerRecordDto) {
        return this.records.update(ctx, id, dto);
    }

    @Post('records/:id/post')
    @RequireAnyPermission(...UPDATE_ANY)
    @ApiOperation({ summary: 'Post a draft (or submit it for approval)' })
    post(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.records.post(ctx, id);
    }

    @Post('records/:id/approve')
    @RequirePermission('finance.expenses.approve')
    @ApiOperation({ summary: 'Approve a record waiting for review (never your own)' })
    approve(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Body(ZBody(S.PostLedgerRecordSchema)) dto: { comment?: string | null }) {
        return this.records.approve(ctx, id, dto.comment);
    }

    @Post('records/:id/reject')
    @RequirePermission('finance.expenses.approve')
    @ApiOperation({ summary: 'Reject a record back to draft' })
    reject(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Body(ZBody(S.RejectSchema)) dto: { reason: string }) {
        return this.records.reject(ctx, id, dto.reason);
    }

    @Post('records/:id/void')
    @RequireAnyPermission(...UPDATE_ANY)
    @ApiOperation({ summary: 'Void a record (kept for audit)' })
    void(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Body(ZBody(S.VoidSchema)) dto: { reason: string }) {
        return this.records.void(ctx, id, dto.reason);
    }

    @Delete('records/:id')
    @RequireAnyPermission('finance.income.delete', 'finance.expenses.delete')
    @ApiOperation({ summary: 'Delete a draft record (soft delete)' })
    remove(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.records.remove(ctx, id);
    }

    @Post('records/:id/settlements')
    @RequireAnyPermission(...UPDATE_ANY)
    @ApiOperation({ summary: 'Record a payment, refund or write-off against a record' })
    settle(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Body(ZBody(S.CreateSettlementSchema)) dto: S.CreateSettlementDto) {
        return this.records.addSettlement(ctx, id, dto);
    }

    @Post('records/:id/attachments')
    @RequireAnyPermission(...UPDATE_ANY)
    @ApiOperation({ summary: 'Attach a document (17) to a record' })
    attach(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Body(ZBody(S.CreateAttachmentSchema)) dto: S.CreateAttachmentDto) {
        return this.records.addAttachment(ctx, id, dto);
    }

    @Delete('records/:id/attachments/:attachmentId')
    @RequireAnyPermission(...UPDATE_ANY)
    @ApiOperation({ summary: 'Remove an attachment' })
    detach(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Param('attachmentId', ParseUUIDPipe) attachmentId: string) {
        return this.records.removeAttachment(ctx, id, attachmentId);
    }

    @Get('approvals')
    @RequireAnyPermission('finance.expenses.approve', 'finance.expense_claims.approve')
    @ApiOperation({ summary: 'Items waiting for the caller\'s approval (records and expense claims)' })
    async approvals(@CurrentOrg() ctx: OrgContext) {
        const [records, claims] = await Promise.all([ctx.can('finance.expenses.approve') ? this.records.pendingApprovals(ctx) : [], this.claims.pendingForApproval(ctx)]);
        return { records, claims };
    }
}

/** 09 settings, categories, payment methods and suppliers. */
@ApiTags('Ledger · Setup')
@ApiBearerAuth()
@Controller('ledger')
@UseGuards(JwtGuard, PermissionsGuard)
export class LedgerSetupController {
    constructor(
        private readonly config: LedgerConfigService,
        private readonly suppliers: LedgerSuppliersService,
    ) { }

    @Get('settings')
    @RequireAnyPermission(...READ_ANY, 'finance.ledger_settings.manage')
    @ApiOperation({ summary: 'Ledger settings (VAT defaults, approval threshold, automation)' })
    settings(@CurrentOrg() ctx: OrgContext) {
        return this.config.getSettings(ctx);
    }

    @Patch('settings')
    @RequirePermission('finance.ledger_settings.manage')
    @ApiOperation({ summary: 'Update ledger settings' })
    updateSettings(@CurrentOrg() ctx: OrgContext, @Body(ZBody(S.UpdateLedgerSettingsSchema)) dto: S.UpdateLedgerSettingsDto) {
        return this.config.updateSettings(ctx, dto);
    }

    @Get('categories')
    @RequireAnyPermission(...READ_ANY, 'finance.categories.manage')
    @ApiOperation({ summary: 'Income and expense categories (default tree created on first use)' })
    categories(@CurrentOrg() ctx: OrgContext, @Query(new ZodValidationPipe(S.LedgerCategoryQuerySchema)) query: S.LedgerCategoryQuery) {
        return this.config.listCategories(ctx, query);
    }

    @Post('categories')
    @RequirePermission('finance.categories.manage')
    createCategory(@CurrentOrg() ctx: OrgContext, @Body(ZBody(S.CreateLedgerCategorySchema)) dto: S.CreateLedgerCategoryDto) {
        return this.config.createCategory(ctx, dto);
    }

    @Patch('categories/:id')
    @RequirePermission('finance.categories.manage')
    updateCategory(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Body(ZBody(S.UpdateLedgerCategorySchema)) dto: S.UpdateLedgerCategoryDto) {
        return this.config.updateCategory(ctx, id, dto);
    }

    @Post('categories/:id/archive')
    @RequirePermission('finance.categories.manage')
    archiveCategory(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.config.archiveCategory(ctx, id, true);
    }

    @Post('categories/:id/restore')
    @RequirePermission('finance.categories.manage')
    restoreCategory(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.config.archiveCategory(ctx, id, false);
    }

    @Get('payment-methods')
    @RequireAnyPermission(...READ_ANY, 'finance.categories.manage')
    paymentMethods(@CurrentOrg() ctx: OrgContext, @Query('archived') archived?: string) {
        return this.config.listPaymentMethods(ctx, archived === 'true');
    }

    @Post('payment-methods')
    @RequirePermission('finance.categories.manage')
    createPaymentMethod(@CurrentOrg() ctx: OrgContext, @Body(ZBody(S.CreateLedgerPaymentMethodSchema)) dto: S.CreateLedgerPaymentMethodDto) {
        return this.config.createPaymentMethod(ctx, dto);
    }

    @Patch('payment-methods/:id')
    @RequirePermission('finance.categories.manage')
    updatePaymentMethod(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Body(ZBody(S.UpdateLedgerPaymentMethodSchema)) dto: S.UpdateLedgerPaymentMethodDto) {
        return this.config.updatePaymentMethod(ctx, id, dto);
    }

    @Post('payment-methods/:id/archive')
    @RequirePermission('finance.categories.manage')
    archivePaymentMethod(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.config.updatePaymentMethod(ctx, id, {}, true);
    }

    @Get('suppliers')
    @RequirePermission('finance.expenses.read')
    @ApiOperation({ summary: 'Suppliers (CRM vendors) with ledger defaults and spend' })
    listSuppliers(@CurrentOrg() ctx: OrgContext, @Query(new ZodValidationPipe(S.SupplierQuerySchema)) query: S.SupplierQuery) {
        return this.suppliers.findAll(ctx, query);
    }

    @Get('suppliers/:companyId')
    @RequirePermission('finance.expenses.read')
    supplier(@CurrentOrg() ctx: OrgContext, @Param('companyId', ParseUUIDPipe) companyId: string) {
        return this.suppliers.findOne(ctx, companyId);
    }

    @Put('suppliers/:companyId/profile')
    @RequirePermission('finance.expenses.update')
    @ApiOperation({ summary: 'Set supplier ledger defaults (category, VAT, terms, bank details)' })
    upsertSupplier(@CurrentOrg() ctx: OrgContext, @Param('companyId', ParseUUIDPipe) companyId: string, @Body(ZBody(S.SupplierProfileSchema)) dto: S.SupplierProfileDto) {
        return this.suppliers.upsertProfile(ctx, companyId, dto);
    }
}

/** 09 recurring expenses and expense claims. */
@ApiTags('Ledger · Recurring & claims')
@ApiBearerAuth()
@Controller('ledger')
@UseGuards(JwtGuard, PermissionsGuard)
export class LedgerRecurringController {
    constructor(
        private readonly recurring: RecurringExpensesService,
        private readonly claims: ExpenseClaimsService,
    ) { }

    @Get('recurring')
    @RequirePermission('finance.recurring_expenses.read')
    list(@CurrentOrg() ctx: OrgContext, @Query(new ZodValidationPipe(S.RecurringQuerySchema)) query: S.RecurringQuery) {
        return this.recurring.findAll(ctx, query);
    }

    @Get('recurring/upcoming')
    @RequirePermission('finance.recurring_expenses.read')
    upcoming(@CurrentOrg() ctx: OrgContext, @Query('days') days?: string) {
        return this.recurring.upcoming(ctx, Math.min(366, Math.max(1, Number(days) || 30)));
    }

    @Get('recurring/:id')
    @RequirePermission('finance.recurring_expenses.read')
    get(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.recurring.findOne(ctx, id);
    }

    @Post('recurring')
    @RequirePermission('finance.recurring_expenses.manage')
    create(@CurrentOrg() ctx: OrgContext, @Body(ZBody(S.CreateRecurringExpenseSchema)) dto: S.CreateRecurringExpenseDto) {
        return this.recurring.create(ctx, dto);
    }

    @Patch('recurring/:id')
    @RequirePermission('finance.recurring_expenses.manage')
    update(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Body(ZBody(S.UpdateRecurringExpenseSchema)) dto: S.UpdateRecurringExpenseDto) {
        return this.recurring.update(ctx, id, dto);
    }

    @Post('recurring/:id/:action')
    @RequirePermission('finance.recurring_expenses.manage')
    @ApiOperation({ summary: 'pause | resume | end | generate-now' })
    action(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Param('action') action: string) {
        if (action === 'generate-now') {
            if (!ctx.can('finance.expenses.create')) throw new ForbiddenException({ message: 'You do not have permission to do this (finance.expenses.create)', code: 'permission_denied' });
            return this.recurring.generateNow(ctx, id);
        }
        const parsed = z.enum(['pause', 'resume', 'end']).parse(action);
        return this.recurring.setStatus(ctx, id, parsed);
    }

    @Get('claims')
    @RequireAnyPermission('finance.expense_claims.read', 'finance.expense_claims.read_own')
    claimsList(@CurrentOrg() ctx: OrgContext, @Query(new ZodValidationPipe(S.ClaimQuerySchema)) query: S.ClaimQuery) {
        return this.claims.findAll(ctx, query);
    }

    @Get('claims/:id')
    @RequireAnyPermission('finance.expense_claims.read', 'finance.expense_claims.read_own')
    claim(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.claims.findOne(ctx, id);
    }

    @Post('claims')
    @RequireAnyPermission('finance.expense_claims.create_own', 'finance.expense_claims.approve')
    createClaim(@CurrentOrg() ctx: OrgContext, @Body(ZBody(S.CreateExpenseClaimSchema)) dto: S.CreateExpenseClaimDto) {
        return this.claims.create(ctx, dto);
    }

    @Patch('claims/:id')
    @RequireAnyPermission('finance.expense_claims.create_own', 'finance.expense_claims.approve')
    updateClaim(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Body(ZBody(S.UpdateExpenseClaimSchema)) dto: S.UpdateExpenseClaimDto) {
        return this.claims.update(ctx, id, dto);
    }

    @Post('claims/:id/submit')
    @RequireAnyPermission('finance.expense_claims.create_own', 'finance.expense_claims.approve')
    submit(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.claims.submit(ctx, id);
    }

    @Post('claims/:id/approve')
    @RequirePermission('finance.expense_claims.approve')
    approveClaim(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.claims.decide(ctx, id, true);
    }

    @Post('claims/:id/reject')
    @RequirePermission('finance.expense_claims.approve')
    rejectClaim(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Body(ZBody(S.RejectSchema)) dto: { reason: string }) {
        return this.claims.decide(ctx, id, false, dto.reason);
    }

    @Post('claims/:id/pay')
    @RequirePermission('finance.expense_claims.approve')
    pay(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Body(ZBody(S.PayClaimSchema)) dto: z.infer<typeof S.PayClaimSchema>) {
        return this.claims.pay(ctx, id, dto);
    }
}

/** 09 budgets, periods, VAT returns, insights and reports. */
@ApiTags('Ledger · Reports & planning')
@ApiBearerAuth()
@Controller('ledger')
@UseGuards(JwtGuard, PermissionsGuard)
export class LedgerReportsController {
    constructor(
        private readonly planning: LedgerPlanningService,
        private readonly reports: LedgerReportsService,
    ) { }

    @Get('dashboard')
    @RequireAnyPermission(...READ_ANY)
    @ApiOperation({ summary: 'Income & expense overview: totals, trend, categories, cash position' })
    dashboard(@CurrentOrg() ctx: OrgContext, @Query(new ZodValidationPipe(S.ReportRangeSchema)) q: S.ReportRange) {
        return this.reports.dashboard(ctx, q);
    }

    @Get('reports/profit-loss')
    @RequirePermission('finance.profit_loss.read')
    async profitLoss(@CurrentOrg() ctx: OrgContext, @Query(new ZodValidationPipe(S.ReportRangeSchema)) q: S.ReportRange) {
        return this.reports.profitLoss(ctx, q);
    }

    @Get('reports/vat')
    @RequirePermission('finance.vat.read')
    vat(@CurrentOrg() ctx: OrgContext, @Query(new ZodValidationPipe(S.ReportRangeSchema)) q: S.ReportRange) {
        return this.reports.vat(ctx, q);
    }

    @Get('reports/cash-flow')
    @RequirePermission('finance.income.read', 'finance.expenses.read')
    cashFlow(@CurrentOrg() ctx: OrgContext, @Query(new ZodValidationPipe(S.ReportRangeSchema)) q: S.ReportRange) {
        return this.reports.cashFlow(ctx, q);
    }

    @Get('reports/aging/:type')
    @RequireAnyPermission(...READ_ANY)
    aging(@CurrentOrg() ctx: OrgContext, @Param('type') type: string) {
        return this.reports.aging(ctx, z.nativeEnum(LedgerRecordType).parse(type.toUpperCase()));
    }

    @Get('profitability')
    @RequirePermission('finance.profitability.read')
    profitability(@CurrentOrg() ctx: OrgContext, @Query(new ZodValidationPipe(S.ProfitabilityQuerySchema)) q: S.ProfitabilityQuery) {
        return this.reports.profitability(ctx, q);
    }

    @Get('budgets')
    @RequirePermission('finance.budgets.read')
    budgets(@CurrentOrg() ctx: OrgContext, @Query(new ZodValidationPipe(S.BudgetQuerySchema)) q: z.infer<typeof S.BudgetQuerySchema>) {
        return this.planning.listBudgets(ctx, q.year, q.status);
    }

    @Get('budgets/:id')
    @RequirePermission('finance.budgets.read')
    budget(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.planning.getBudget(ctx, id);
    }

    @Post('budgets')
    @RequirePermission('finance.budgets.manage')
    createBudget(@CurrentOrg() ctx: OrgContext, @Body(ZBody(S.CreateBudgetSchema)) dto: S.CreateBudgetDto) {
        return this.planning.createBudget(ctx, dto);
    }

    @Patch('budgets/:id')
    @RequirePermission('finance.budgets.manage')
    updateBudget(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Body(ZBody(S.UpdateBudgetSchema)) dto: S.UpdateBudgetDto) {
        return this.planning.updateBudget(ctx, id, dto);
    }

    @Delete('budgets/:id')
    @RequirePermission('finance.budgets.manage')
    deleteBudget(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.planning.deleteBudget(ctx, id);
    }

    @Get('periods')
    @RequireAnyPermission(...READ_ANY)
    periods(@CurrentOrg() ctx: OrgContext, @Query(new ZodValidationPipe(S.PeriodQuerySchema)) q: z.infer<typeof S.PeriodQuerySchema>) {
        return this.planning.listPeriods(ctx, q);
    }

    @Get('periods/:id')
    @RequireAnyPermission(...READ_ANY)
    period(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Query('basis') basis?: string) {
        return this.planning.getPeriod(ctx, id, basis === 'CASH' ? LedgerReportBasis.CASH : LedgerReportBasis.ACCRUAL);
    }

    @Post('periods')
    @RequirePermission('finance.periods.manage')
    createPeriod(@CurrentOrg() ctx: OrgContext, @Body(ZBody(S.CreatePeriodSchema)) dto: z.infer<typeof S.CreatePeriodSchema>) {
        return this.planning.createPeriod(ctx, dto);
    }

    @Post('periods/generate')
    @RequirePermission('finance.periods.manage')
    generatePeriods(@CurrentOrg() ctx: OrgContext, @Body(ZBody(S.GeneratePeriodsSchema)) dto: z.infer<typeof S.GeneratePeriodsSchema>) {
        return this.planning.generatePeriods(ctx, dto);
    }

    @Post('periods/:id/:action')
    @RequirePermission('finance.periods.manage')
    @ApiOperation({ summary: 'close | reopen | lock' })
    periodAction(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Param('action') action: string) {
        return this.planning.setPeriodStatus(ctx, id, z.enum(['close', 'reopen', 'lock']).parse(action));
    }

    @Post('vat-returns')
    @RequirePermission('finance.vat.manage')
    createVatReturn(@CurrentOrg() ctx: OrgContext, @Body(ZBody(z.object({ period_id: z.string().uuid(), basis: z.nativeEnum(LedgerReportBasis).optional() }))) dto: { period_id: string; basis?: LedgerReportBasis }) {
        return this.planning.createVatReturn(ctx, dto.period_id, dto.basis);
    }

    @Post('vat-returns/:id/:action')
    @RequirePermission('finance.vat.manage')
    vatReturnAction(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Param('action') action: string, @Body(ZBody(z.object({ authority_reference: z.string().max(120).nullable().optional(), document_id: z.string().uuid().nullable().optional(), notes: z.string().max(2000).nullable().optional() }))) dto: { authority_reference?: string | null; document_id?: string | null; notes?: string | null }) {
        return this.planning.updateVatReturn(ctx, id, z.enum(['file', 'paid']).parse(action), dto);
    }

    @Get('insights')
    @RequireAnyPermission(...READ_ANY)
    insights(@CurrentOrg() ctx: OrgContext, @Query(new ZodValidationPipe(S.InsightQuerySchema)) q: S.InsightQuery) {
        return this.planning.listInsights(ctx, q);
    }

    @Post('insights/detect')
    @RequireAnyPermission(...UPDATE_ANY)
    detect(@CurrentOrg() ctx: OrgContext) {
        return this.planning.detectInsights(ctx);
    }

    @Post('insights/:id/:action')
    @RequireAnyPermission(...UPDATE_ANY)
    resolve(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Param('action') action: string) {
        return this.planning.resolveInsight(ctx, id, z.enum(['accept', 'dismiss']).parse(action) === 'accept');
    }
}
