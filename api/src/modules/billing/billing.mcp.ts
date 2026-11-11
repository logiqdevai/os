import { Injectable, OnModuleInit } from '@nestjs/common';
import { ModuleKey } from 'generated/prisma';
import { z } from 'zod';
import { McpRegistry } from '@/core/mcp/mcp.registry';
import { CatalogService } from './services/catalog.service';
import { BillingProfilesService } from './services/billing-profiles.service';
import { InvoicesService } from './services/invoices.service';
import { PaymentsService } from './services/payments.service';
import { SubscriptionsService } from './services/subscriptions.service';
import { PaymentProvidersService } from './services/payment-providers.service';
import { FinanceReportsService } from './services/finance-reports.service';
import { BillingSetupService } from './services/billing-setup.service';
import * as S from './dto/billing.schemas';

const M = ModuleKey.FINANCE;
const id = z.object({ id: z.string().uuid() });

/**
 * 08 MCP tools over the same services and schemas as REST. Send / void / approve / refund / payments are sensitive
 * (human confirmation for AI agents). Connecting or disconnecting providers is not exposed to agents.
 */
@Injectable()
export class BillingMcp implements OnModuleInit {
    constructor(
        private readonly registry: McpRegistry,
        private readonly catalog: CatalogService,
        private readonly profiles: BillingProfilesService,
        private readonly invoices: InvoicesService,
        private readonly payments: PaymentsService,
        private readonly subscriptions: SubscriptionsService,
        private readonly providers: PaymentProvidersService,
        private readonly reports: FinanceReportsService,
        private readonly setup: BillingSetupService,
    ) { }

    onModuleInit() {
        this.registry.registerMany([
            { name: 'finance_dashboard_read', description: 'Billing KPIs: outstanding, overdue, MRR/ARR, collected this month, monthly invoiced vs collected, aging, top customers.', permission: 'finance.dashboard.read', module: M, resource_type: 'invoice', input: S.FinanceRangeSchema, handler: (ctx, a) => this.reports.dashboard(ctx, a) },
            { name: 'finance_reports_read', description: 'Billing report rows: revenue, invoices, outstanding, tax, customers, payments or subscriptions for a date range.', permission: 'finance.reports.read', module: M, resource_type: 'invoice', input: S.FinanceRangeSchema.extend({ report: z.enum(['revenue', 'invoices', 'outstanding', 'tax', 'customers', 'payments', 'subscriptions']) }), handler: (ctx, { report, ...q }) => this.reports.report(ctx, report, q) },
            { name: 'finance_catalog_read', description: 'List products and services with their prices.', permission: 'finance.catalog.read', module: M, resource_type: 'product', input: S.ProductQuerySchema, handler: (ctx, a) => this.catalog.listProducts(ctx, a) },
            { name: 'finance_catalog_manage', description: 'Create a product or service with prices.', permission: 'finance.catalog.manage', module: M, resource_type: 'product', input: S.CreateProductSchema, handler: (ctx, a) => this.catalog.createProduct(ctx, a) },
            { name: 'finance_tax_rates_read', description: 'List active tax rates.', permission: 'finance.catalog.read', module: M, resource_type: 'tax_rate', input: z.object({}), handler: (ctx) => this.catalog.listTaxRates(ctx) },
            { name: 'finance_billing_profiles_read', description: 'List customer billing profiles with outstanding balance.', permission: 'finance.invoices.read', module: M, resource_type: 'billing_profile', input: S.BillingProfileQuerySchema, handler: (ctx, a) => this.profiles.findAll(ctx, a) },
            { name: 'finance_billing_profiles_manage', description: 'Create a billing profile for a CRM company.', permission: 'finance.billing_profiles.manage', module: M, resource_type: 'billing_profile', sensitive: true, input: S.CreateBillingProfileSchema, handler: (ctx, a) => this.profiles.create(ctx, a) },
            { name: 'finance_invoices_read', description: 'List invoices (filter by status, customer, project, dates, overdue).', permission: 'finance.invoices.read', module: M, resource_type: 'invoice', input: S.InvoiceQuerySchema, handler: (ctx, a) => this.invoices.findAll(ctx, a) },
            { name: 'finance_invoices_get', description: 'Get one invoice by id or number with lines, payments and timeline.', permission: 'finance.invoices.read', module: M, resource_type: 'invoice', input: z.object({ id: z.string() }), handler: (ctx, a) => this.invoices.findOne(ctx, a.id) },
            { name: 'finance_invoices_create', description: 'Create a DRAFT invoice with line items (never approved or sent automatically).', permission: 'finance.invoices.create', module: M, resource_type: 'invoice', input: S.CreateInvoiceSchema, handler: (ctx, a) => this.invoices.create(ctx, a) },
            { name: 'finance_invoices_approve', description: 'Approve and finalize a draft invoice.', permission: 'finance.invoices.approve', module: M, resource_type: 'invoice', sensitive: true, input: id.extend({ comment: z.string().max(1000).optional() }), handler: (ctx, a) => this.invoices.approve(ctx, a.id, a.comment) },
            { name: 'finance_invoices_send', description: 'Send an invoice to the customer (finalizes a draft that needs no approval).', permission: 'finance.invoices.send', module: M, resource_type: 'invoice', sensitive: true, input: S.SendInvoiceSchema.extend({ id: z.string().uuid() }), handler: (ctx, { id: iid, ...dto }) => this.invoices.send(ctx, iid, dto) },
            { name: 'finance_invoices_void', description: 'Void an unpaid invoice with a reason.', permission: 'finance.invoices.void', module: M, resource_type: 'invoice', sensitive: true, input: id.extend(S.ReasonSchema.shape), handler: (ctx, a) => this.invoices.void(ctx, a.id, a.reason) },
            { name: 'finance_invoices_remind', description: 'Log a payment reminder for an unpaid invoice (delivery via Communications).', permission: 'finance.invoices.send', module: M, resource_type: 'invoice', sensitive: true, input: id.extend({ message: z.string().max(5000).optional() }), handler: (ctx, a) => this.invoices.remind(ctx, a.id, a.message) },
            { name: 'finance_payments_read', description: 'List payments (filter by status, provider, customer, dates).', permission: 'finance.payments.read', module: M, resource_type: 'payment', input: S.PaymentQuerySchema, handler: (ctx, a) => this.payments.findAll(ctx, a) },
            { name: 'finance_payments_record', description: 'Record a manual / bank payment and allocate it to invoices.', permission: 'finance.payments.record', module: M, resource_type: 'payment', sensitive: true, input: S.RecordPaymentSchema, handler: (ctx, a) => this.payments.record(ctx, a) },
            { name: 'finance_payments_refund', description: 'Refund (part of) a payment; goes through approval when a rule applies.', permission: 'finance.payments.refund', module: M, resource_type: 'payment', sensitive: true, input: S.RefundSchema.extend({ id: z.string().uuid() }), handler: (ctx, { id: pid, ...dto }) => this.payments.refund(ctx, pid, dto) },
            { name: 'finance_credit_notes_manage', description: 'Create (and optionally issue) a credit note against an invoice.', permission: 'finance.credit_notes.manage', module: M, resource_type: 'credit_note', sensitive: true, input: S.CreateCreditNoteSchema, handler: (ctx, a) => this.payments.createCreditNote(ctx, a) },
            { name: 'finance_subscriptions_read', description: 'List subscriptions with MRR/ARR.', permission: 'finance.subscriptions.read', module: M, resource_type: 'subscription', input: S.SubscriptionQuerySchema, handler: (ctx, a) => this.subscriptions.findAll(ctx, a) },
            { name: 'finance_subscriptions_manage', description: 'Create a subscription for a billing profile.', permission: 'finance.subscriptions.manage', module: M, resource_type: 'subscription', sensitive: true, input: S.CreateSubscriptionSchema, handler: (ctx, a) => this.subscriptions.create(ctx, a) },
            { name: 'finance_subscriptions_cancel', description: 'Cancel a subscription now, at period end or on a date.', permission: 'finance.subscriptions.manage', module: M, resource_type: 'subscription', sensitive: true, input: S.CancelSubscriptionSchema.extend({ id: z.string().uuid() }), handler: (ctx, { id: sid, ...dto }) => this.subscriptions.cancel(ctx, sid, dto) },
            { name: 'finance_payment_links_create', description: 'Create a payment link (hosted checkout) for an invoice or an amount.', permission: 'finance.payment_links.manage', module: M, resource_type: 'payment_link', sensitive: true, input: S.CreatePaymentLinkSchema, handler: (ctx, a) => this.providers.createLink(ctx, a) },
            { name: 'finance_payment_providers_read', description: 'List payment provider connections (no secrets).', permission: 'finance.payment_providers.manage', module: M, resource_type: 'payment_provider_connection', input: z.object({}), handler: (ctx) => this.providers.list(ctx) },
            { name: 'finance_approvals_read', description: 'Billing items waiting for approval.', permission: 'finance.invoices.approve', module: M, resource_type: 'finance_approval', input: z.object({}), handler: (ctx) => this.setup.inbox(ctx) },
        ]);
    }
}
