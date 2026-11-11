import { Body, Controller, Delete, ForbiddenException, Get, Header, Headers, HttpCode, Param, ParseUUIDPipe, Patch, Post, Put, Query, Req, UseGuards } from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import { ApiBearerAuth, ApiExcludeEndpoint, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { z } from 'zod';
import { RefundStatus } from 'generated/prisma';
import { JwtGuard } from '@/shared/guards/jwt.guard';
import { PermissionsGuard } from '@/shared/authorization/guards/permissions.guard';
import { CurrentOrg, Public, RequireAnyPermission, RequirePermission } from '@/shared/authorization/decorators/require-permission.decorator';
import { OrgContext } from '@/shared/authorization/interfaces/org-context.interface';
import { ZodValidationPipe } from '@/shared/pipes/zod.validation.pipe';
import { ZBody } from '@/modules/finance-shared/zod-body.pipe';
import { CatalogService } from './services/catalog.service';
import { BillingProfilesService } from './services/billing-profiles.service';
import { InvoicesService } from './services/invoices.service';
import { PaymentsService } from './services/payments.service';
import { SubscriptionsService } from './services/subscriptions.service';
import { PaymentProvidersService } from './services/payment-providers.service';
import { BillingSetupService } from './services/billing-setup.service';
import { FinanceReportsService } from './services/finance-reports.service';
import * as S from './dto/billing.schemas';

const ParsedQuery = (schema: z.ZodType) => new ZodValidationPipe(schema);

/** 08 catalog (products, prices, tax rates, coupons) and customer billing profiles. */
@ApiTags('Billing · Catalog & customers')
@ApiBearerAuth()
@Controller('finance')
@UseGuards(JwtGuard, PermissionsGuard)
export class CatalogController {
    constructor(
        private readonly catalog: CatalogService,
        private readonly profiles: BillingProfilesService,
    ) { }

    @Get('products')
    @RequirePermission('finance.catalog.read')
    products(@CurrentOrg() ctx: OrgContext, @Query(ParsedQuery(S.ProductQuerySchema)) q: S.ProductQuery) {
        return this.catalog.listProducts(ctx, q);
    }

    @Get('products/:id')
    @RequirePermission('finance.catalog.read')
    product(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.catalog.getProduct(ctx, id);
    }

    @Post('products')
    @RequirePermission('finance.catalog.manage')
    createProduct(@CurrentOrg() ctx: OrgContext, @Body(ZBody(S.CreateProductSchema)) dto: S.CreateProductDto) {
        return this.catalog.createProduct(ctx, dto);
    }

    @Patch('products/:id')
    @RequirePermission('finance.catalog.manage')
    updateProduct(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Body(ZBody(S.UpdateProductSchema)) dto: S.UpdateProductDto) {
        return this.catalog.updateProduct(ctx, id, dto);
    }

    @Post('products/:id/archive')
    @RequirePermission('finance.catalog.manage')
    archiveProduct(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.catalog.archiveProduct(ctx, id, true);
    }

    @Post('products/:id/restore')
    @RequirePermission('finance.catalog.manage')
    restoreProduct(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.catalog.archiveProduct(ctx, id, false);
    }

    @Post('products/:id/prices')
    @RequirePermission('finance.catalog.manage')
    addPrice(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Body(ZBody(S.PriceSchema)) dto: S.PriceDto) {
        return this.catalog.addPrice(ctx, id, dto);
    }

    @Patch('prices/:id')
    @RequirePermission('finance.catalog.manage')
    @ApiOperation({ summary: 'Update a price (a used price is replaced by a new one when the amount changes)' })
    updatePrice(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Body(ZBody(S.PriceSchema.partial())) dto: Partial<S.PriceDto>) {
        return this.catalog.updatePrice(ctx, id, dto);
    }

    @Get('tax-rates')
    @RequireAnyPermission('finance.catalog.read', 'finance.invoices.read', 'finance.expenses.read', 'finance.income.read')
    taxRates(@CurrentOrg() ctx: OrgContext, @Query('include_inactive') inactive?: string) {
        return this.catalog.listTaxRates(ctx, inactive === 'true');
    }

    @Post('tax-rates')
    @RequirePermission('finance.catalog.manage')
    createTaxRate(@CurrentOrg() ctx: OrgContext, @Body(ZBody(S.CreateTaxRateSchema)) dto: S.CreateTaxRateDto) {
        return this.catalog.createTaxRate(ctx, dto);
    }

    @Patch('tax-rates/:id')
    @RequirePermission('finance.catalog.manage')
    updateTaxRate(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Body(ZBody(S.UpdateTaxRateSchema)) dto: S.UpdateTaxRateDto) {
        return this.catalog.updateTaxRate(ctx, id, dto);
    }

    @Get('coupons')
    @RequirePermission('finance.catalog.read')
    coupons(@CurrentOrg() ctx: OrgContext, @Query('include_inactive') inactive?: string) {
        return this.catalog.listCoupons(ctx, inactive === 'true');
    }

    @Post('coupons')
    @RequirePermission('finance.catalog.manage')
    createCoupon(@CurrentOrg() ctx: OrgContext, @Body(ZBody(S.CreateCouponSchema)) dto: S.CreateCouponDto) {
        return this.catalog.createCoupon(ctx, dto);
    }

    @Post('coupons/:id/:action')
    @RequirePermission('finance.catalog.manage')
    couponAction(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Param('action') action: string) {
        return this.catalog.setCouponActive(ctx, id, z.enum(['activate', 'deactivate']).parse(action) === 'activate');
    }

    @Get('billing-profiles')
    @RequirePermission('finance.invoices.read')
    profilesList(@CurrentOrg() ctx: OrgContext, @Query(ParsedQuery(S.BillingProfileQuerySchema)) q: S.BillingProfileQuery) {
        return this.profiles.findAll(ctx, q);
    }

    @Get('billing-profiles/:id')
    @RequirePermission('finance.invoices.read')
    @ApiOperation({ summary: 'Billing profile by id or CRM company id, with balance and history' })
    profile(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.profiles.findOne(ctx, id);
    }

    @Post('billing-profiles')
    @RequirePermission('finance.billing_profiles.manage')
    createProfile(@CurrentOrg() ctx: OrgContext, @Body(ZBody(S.CreateBillingProfileSchema)) dto: S.CreateBillingProfileDto) {
        return this.profiles.create(ctx, dto);
    }

    @Patch('billing-profiles/:id')
    @RequirePermission('finance.billing_profiles.manage')
    updateProfile(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Body(ZBody(S.UpdateBillingProfileSchema)) dto: S.UpdateBillingProfileDto) {
        return this.profiles.update(ctx, id, dto);
    }
}

/** 08 invoices and credit notes. */
@ApiTags('Billing · Invoices')
@ApiBearerAuth()
@Controller('finance')
@UseGuards(JwtGuard, PermissionsGuard)
export class InvoicesController {
    constructor(
        private readonly invoices: InvoicesService,
        private readonly payments: PaymentsService,
        private readonly providers: PaymentProvidersService,
    ) { }

    @Get('invoices')
    @RequirePermission('finance.invoices.read')
    list(@CurrentOrg() ctx: OrgContext, @Query(ParsedQuery(S.InvoiceQuerySchema)) q: S.InvoiceQuery) {
        return this.invoices.findAll(ctx, q);
    }

    @Get('invoices/:id')
    @RequirePermission('finance.invoices.read')
    @ApiOperation({ summary: 'Invoice by id or number with lines, payments, credits, approvals, timeline and seller data (print view)' })
    get(@CurrentOrg() ctx: OrgContext, @Param('id') id: string) {
        return this.invoices.findOne(ctx, id);
    }

    @Post('invoices')
    @RequirePermission('finance.invoices.create')
    create(@CurrentOrg() ctx: OrgContext, @Body(ZBody(S.CreateInvoiceSchema)) dto: S.CreateInvoiceDto) {
        return this.invoices.create(ctx, dto);
    }

    @Patch('invoices/:id')
    @RequirePermission('finance.invoices.update')
    update(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Body(ZBody(S.UpdateInvoiceSchema)) dto: S.UpdateInvoiceDto) {
        return this.invoices.update(ctx, id, dto);
    }

    @Delete('invoices/:id')
    @RequirePermission('finance.invoices.delete')
    remove(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.invoices.remove(ctx, id);
    }

    @Post('invoices/:id/duplicate')
    @RequirePermission('finance.invoices.create')
    duplicate(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.invoices.duplicate(ctx, id);
    }

    @Post('invoices/:id/approve')
    @RequirePermission('finance.invoices.approve')
    @ApiOperation({ summary: 'Approve (and finalize) a draft; the creator cannot approve when a rule requires separation of duties' })
    approve(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Body(ZBody(S.ApproveSchema)) dto: { comment?: string | null }) {
        return this.invoices.approve(ctx, id, dto.comment);
    }

    @Post('invoices/:id/reject')
    @RequirePermission('finance.invoices.approve')
    reject(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Body(ZBody(S.ReasonSchema)) dto: { reason: string }) {
        return this.invoices.reject(ctx, id, dto.reason);
    }

    @Post('invoices/:id/send')
    @RequirePermission('finance.invoices.send')
    send(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Body(ZBody(S.SendInvoiceSchema)) dto: S.SendInvoiceDto) {
        return this.invoices.send(ctx, id, dto);
    }

    @Post('invoices/:id/void')
    @RequirePermission('finance.invoices.void')
    void(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Body(ZBody(S.ReasonSchema)) dto: { reason: string }) {
        return this.invoices.void(ctx, id, dto.reason);
    }

    @Post('invoices/:id/write-off')
    @RequirePermission('finance.adjustments.manage')
    writeOff(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Body(ZBody(S.ReasonSchema)) dto: { reason: string }) {
        return this.invoices.writeOff(ctx, id, dto.reason);
    }

    @Post('invoices/:id/remind')
    @RequirePermission('finance.invoices.send')
    remind(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Body(ZBody(S.RemindSchema)) dto: { message?: string | null }) {
        return this.invoices.remind(ctx, id, dto.message);
    }

    @Post('invoices/:id/payments')
    @RequirePermission('finance.payments.record')
    pay(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Body(ZBody(S.InvoicePaymentSchema)) dto: S.InvoicePaymentDto) {
        return this.payments.recordForInvoice(ctx, id, dto);
    }

    @Post('invoices/:id/checkout')
    @RequirePermission('finance.invoices.send')
    @ApiOperation({ summary: 'Create a hosted checkout (payment link) for the amount due through the routed provider' })
    checkout(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Body(ZBody(S.CheckoutSchema)) dto: S.CheckoutDto) {
        return this.providers.invoiceCheckout(ctx, id, dto);
    }

    @Get('credit-notes')
    @RequirePermission('finance.invoices.read')
    creditNotes(@CurrentOrg() ctx: OrgContext, @Query(ParsedQuery(S.CreditNoteQuerySchema)) q: S.CreditNoteQuery) {
        return this.payments.listCreditNotes(ctx, q);
    }

    @Post('credit-notes')
    @RequirePermission('finance.credit_notes.manage')
    createCreditNote(@CurrentOrg() ctx: OrgContext, @Body(ZBody(S.CreateCreditNoteSchema)) dto: S.CreateCreditNoteDto) {
        return this.payments.createCreditNote(ctx, dto);
    }

    @Post('credit-notes/:id/:action')
    @RequirePermission('finance.credit_notes.manage')
    @ApiOperation({ summary: 'issue | apply | void' })
    creditNoteAction(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Param('action') action: string) {
        return this.payments.creditNoteAction(ctx, id, z.enum(['issue', 'apply', 'void']).parse(action));
    }
}

/** 08 payments, refunds, subscriptions, payment links. */
@ApiTags('Billing · Payments & subscriptions')
@ApiBearerAuth()
@Controller('finance')
@UseGuards(JwtGuard, PermissionsGuard)
export class PaymentsController {
    constructor(
        private readonly payments: PaymentsService,
        private readonly subscriptions: SubscriptionsService,
        private readonly providers: PaymentProvidersService,
    ) { }

    @Get('payments')
    @RequirePermission('finance.payments.read')
    list(@CurrentOrg() ctx: OrgContext, @Query(ParsedQuery(S.PaymentQuerySchema)) q: S.PaymentQuery) {
        return this.payments.findAll(ctx, q);
    }

    @Get('payments/:id')
    @RequirePermission('finance.payments.read')
    get(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.payments.findOne(ctx, id);
    }

    @Get('payments/:id/receipt')
    @RequirePermission('finance.payments.read')
    receipt(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.payments.receipt(ctx, id);
    }

    @Post('payments')
    @RequirePermission('finance.payments.record')
    @ApiOperation({ summary: 'Record a manual / bank payment and allocate it to invoices' })
    record(@CurrentOrg() ctx: OrgContext, @Body(ZBody(S.RecordPaymentSchema)) dto: S.RecordPaymentDto) {
        return this.payments.record(ctx, dto);
    }

    @Post('payments/:id/allocations')
    @RequirePermission('finance.payments.record')
    allocate(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Body(ZBody(z.object({ allocations: z.array(S.AllocationSchema).min(1).max(50) }))) dto: { allocations: { invoice_id: string; amount: string }[] }) {
        return this.payments.allocate(ctx, id, dto.allocations);
    }

    @Post('payments/:id/refunds')
    @RequirePermission('finance.payments.refund')
    refund(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Body(ZBody(S.RefundSchema)) dto: S.RefundDto) {
        return this.payments.refund(ctx, id, dto);
    }

    @Get('refunds')
    @RequirePermission('finance.payments.read')
    refunds(@CurrentOrg() ctx: OrgContext, @Query('status') status?: string) {
        return this.payments.listRefunds(ctx, status ? z.nativeEnum(RefundStatus).parse(status) : undefined);
    }

    @Post('refunds/:id/approve')
    @RequirePermission('finance.refunds.approve')
    approveRefund(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.payments.approveRefund(ctx, id, true);
    }

    @Post('refunds/:id/reject')
    @RequirePermission('finance.refunds.approve')
    rejectRefund(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Body(ZBody(S.ReasonSchema)) dto: { reason: string }) {
        return this.payments.approveRefund(ctx, id, false, dto.reason);
    }

    @Get('subscriptions')
    @RequirePermission('finance.subscriptions.read')
    subs(@CurrentOrg() ctx: OrgContext, @Query(ParsedQuery(S.SubscriptionQuerySchema)) q: S.SubscriptionQuery) {
        return this.subscriptions.findAll(ctx, q);
    }

    @Get('subscriptions/:id')
    @RequirePermission('finance.subscriptions.read')
    sub(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.subscriptions.findOne(ctx, id);
    }

    @Post('subscriptions')
    @RequirePermission('finance.subscriptions.manage')
    createSub(@CurrentOrg() ctx: OrgContext, @Body(ZBody(S.CreateSubscriptionSchema)) dto: S.CreateSubscriptionDto) {
        return this.subscriptions.create(ctx, dto);
    }

    @Post('subscriptions/:id/change-plan')
    @RequirePermission('finance.subscriptions.manage')
    changePlan(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Body(ZBody(S.ChangePlanSchema)) dto: S.ChangePlanDto) {
        return this.subscriptions.changePlan(ctx, id, dto);
    }

    @Post('subscriptions/:id/pause')
    @RequirePermission('finance.subscriptions.manage')
    pause(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Body(ZBody(S.PauseSubscriptionSchema)) dto: { resume_at?: string | null }) {
        return this.subscriptions.pause(ctx, id, dto.resume_at);
    }

    @Post('subscriptions/:id/resume')
    @RequirePermission('finance.subscriptions.manage')
    resume(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.subscriptions.resume(ctx, id);
    }

    @Post('subscriptions/:id/cancel')
    @RequirePermission('finance.subscriptions.manage')
    cancel(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Body(ZBody(S.CancelSubscriptionSchema)) dto: S.CancelSubscriptionDto) {
        return this.subscriptions.cancel(ctx, id, dto);
    }

    @Post('subscriptions/:id/reactivate')
    @RequirePermission('finance.subscriptions.manage')
    reactivate(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.subscriptions.reactivate(ctx, id);
    }

    @Post('subscriptions/:id/invoice-now')
    @RequirePermission('finance.subscriptions.manage', 'finance.invoices.create')
    invoiceNow(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.subscriptions.invoicePeriod(ctx, id);
    }

    @Get('payment-links')
    @RequireAnyPermission('finance.payments.read', 'finance.payment_links.manage')
    links(@CurrentOrg() ctx: OrgContext, @Query(ParsedQuery(S.PaymentLinkQuerySchema)) q: S.PaymentLinkQuery) {
        return this.providers.listLinks(ctx, q);
    }

    @Post('payment-links')
    @RequirePermission('finance.payment_links.manage')
    createLink(@CurrentOrg() ctx: OrgContext, @Body(ZBody(S.CreatePaymentLinkSchema)) dto: S.CreatePaymentLinkDto) {
        return this.providers.createLink(ctx, dto);
    }

    @Post('payment-links/:id/disable')
    @RequirePermission('finance.payment_links.manage')
    disableLink(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.providers.disableLink(ctx, id);
    }
}

/** 08 setup (providers, dunning, approvals, project billing) and dashboard / reports. */
@ApiTags('Billing · Setup & reports')
@ApiBearerAuth()
@Controller('finance')
@UseGuards(JwtGuard, PermissionsGuard)
export class BillingSetupController {
    constructor(
        private readonly providers: PaymentProvidersService,
        private readonly setup: BillingSetupService,
        private readonly reports: FinanceReportsService,
    ) { }

    @Get('dashboard')
    @RequirePermission('finance.dashboard.read')
    dashboard(@CurrentOrg() ctx: OrgContext, @Query(ParsedQuery(S.FinanceRangeSchema)) q: S.FinanceRange) {
        return this.reports.dashboard(ctx, q);
    }

    @Get('reports/:report')
    @RequirePermission('finance.reports.read')
    report(@CurrentOrg() ctx: OrgContext, @Param('report') report: string, @Query(ParsedQuery(S.FinanceRangeSchema)) q: S.FinanceRange) {
        return this.reports.report(ctx, report, q);
    }

    @Get('reports/:report/export')
    @RequirePermission('finance.reports.read', 'finance.reports.export')
    @Header('Content-Type', 'text/csv; charset=utf-8')
    exportReport(@CurrentOrg() ctx: OrgContext, @Param('report') report: string, @Query(ParsedQuery(S.FinanceRangeSchema)) q: S.FinanceRange) {
        return this.reports.exportCsv(ctx, report, q);
    }

    @Get('payment-providers')
    @RequirePermission('finance.payment_providers.manage')
    providersList(@CurrentOrg() ctx: OrgContext) {
        return this.providers.list(ctx);
    }

    @Get('payment-providers/:id')
    @RequirePermission('finance.payment_providers.manage')
    provider(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.providers.get(ctx, id);
    }

    @Post('payment-providers')
    @RequirePermission('finance.payment_providers.manage')
    @ApiOperation({ summary: 'Connect a provider (BYOK: keys are verified, stored encrypted, never returned)' })
    connect(@CurrentOrg() ctx: OrgContext, @Body(ZBody(S.ConnectProviderSchema)) dto: S.ConnectProviderDto) {
        if (ctx.channel === 'mcp') throw new ForbiddenException({ message: 'AI agents cannot connect payment providers', code: 'channel_not_allowed' });
        return this.providers.connect(ctx, dto);
    }

    @Patch('payment-providers/:id')
    @RequirePermission('finance.payment_providers.manage')
    updateProvider(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Body(ZBody(S.UpdateProviderSchema)) dto: S.UpdateProviderDto) {
        return this.providers.update(ctx, id, dto);
    }

    @Post('payment-providers/:id/verify')
    @RequirePermission('finance.payment_providers.manage')
    verify(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.providers.verify(ctx, id);
    }

    @Post('payment-providers/:id/disconnect')
    @RequirePermission('finance.payment_providers.manage')
    disconnect(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.providers.disconnect(ctx, id);
    }

    @Get('dunning-policies')
    @RequireAnyPermission('finance.invoices.read', 'finance.dunning.manage')
    dunning(@CurrentOrg() ctx: OrgContext) {
        return this.setup.listDunning(ctx);
    }

    @Post('dunning-policies')
    @RequirePermission('finance.dunning.manage')
    createDunning(@CurrentOrg() ctx: OrgContext, @Body(ZBody(S.DunningPolicySchema)) dto: S.DunningPolicyDto) {
        return this.setup.saveDunning(ctx, dto);
    }

    @Put('dunning-policies/:id')
    @RequirePermission('finance.dunning.manage')
    updateDunning(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Body(ZBody(S.DunningPolicySchema)) dto: S.DunningPolicyDto) {
        return this.setup.saveDunning(ctx, dto, id);
    }

    @Delete('dunning-policies/:id')
    @RequirePermission('finance.dunning.manage')
    deleteDunning(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.setup.deleteDunning(ctx, id);
    }

    @Get('reminders')
    @RequirePermission('finance.invoices.read')
    reminders(@CurrentOrg() ctx: OrgContext) {
        return this.setup.reminders(ctx);
    }

    @Get('approvals')
    @RequireAnyPermission('finance.invoices.approve', 'finance.refunds.approve', 'finance.adjustments.approve')
    approvals(@CurrentOrg() ctx: OrgContext) {
        return this.setup.inbox(ctx);
    }

    @Get('approval-rules')
    @RequireAnyPermission('finance.approval_rules.manage', 'finance.invoices.approve')
    rules(@CurrentOrg() ctx: OrgContext) {
        return this.setup.listRules(ctx);
    }

    @Post('approval-rules')
    @RequirePermission('finance.approval_rules.manage')
    createRule(@CurrentOrg() ctx: OrgContext, @Body(ZBody(S.ApprovalRuleSchema)) dto: S.ApprovalRuleDto) {
        return this.setup.saveRule(ctx, dto);
    }

    @Put('approval-rules/:id')
    @RequirePermission('finance.approval_rules.manage')
    updateRule(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Body(ZBody(S.ApprovalRuleSchema)) dto: S.ApprovalRuleDto) {
        return this.setup.saveRule(ctx, dto, id);
    }

    @Delete('approval-rules/:id')
    @RequirePermission('finance.approval_rules.manage')
    deleteRule(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.setup.deleteRule(ctx, id);
    }

    @Get('project-billing')
    @RequirePermission('finance.invoices.read')
    projectBilling(@CurrentOrg() ctx: OrgContext, @Query('search') search?: string) {
        return this.setup.listProjectBilling(ctx, search);
    }

    @Put('project-billing/:projectId')
    @RequirePermission('finance.project_billing.manage')
    saveProjectBilling(@CurrentOrg() ctx: OrgContext, @Param('projectId', ParseUUIDPipe) projectId: string, @Body(ZBody(S.ProjectBillingSchema)) dto: S.ProjectBillingDto) {
        return this.setup.saveProjectBilling(ctx, projectId, dto);
    }
}

/** Provider webhooks: public, verified with the connection's own signing secret, idempotent (ProviderWebhookEvent). */
@ApiTags('Billing · Webhooks')
@Controller('webhooks/payments')
@UseGuards(JwtGuard)
export class PaymentWebhooksController {
    constructor(private readonly providers: PaymentProvidersService) { }

    @Post(':connectionId')
    @Public()
    @HttpCode(200)
    @ApiExcludeEndpoint()
    receive(@Param('connectionId', ParseUUIDPipe) connectionId: string, @Req() req: RawBodyRequest<Request>, @Headers('stripe-signature') signature?: string) {
        return this.providers.handleWebhook(connectionId, req.rawBody, signature);
    }
}
