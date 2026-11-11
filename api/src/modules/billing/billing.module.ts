import { Module } from '@nestjs/common';
import { FinanceSharedModule } from '@/modules/finance-shared/finance-shared.module';
import { LedgerModule } from '@/modules/ledger/ledger.module';
import { PaymentsIntegrationModule } from '@/integrations/payments/payments-integration.module';
import { BillingSetupController, CatalogController, InvoicesController, PaymentsController, PaymentWebhooksController } from './billing.controller';
import { CatalogService } from './services/catalog.service';
import { BillingProfilesService } from './services/billing-profiles.service';
import { InvoicesService } from './services/invoices.service';
import { PaymentsService } from './services/payments.service';
import { SubscriptionsService } from './services/subscriptions.service';
import { ProviderGatewayService } from './services/provider-gateway.service';
import { PaymentProvidersService } from './services/payment-providers.service';
import { BillingSetupService } from './services/billing-setup.service';
import { FinanceReportsService } from './services/finance-reports.service';
import { BillingMcp } from './billing.mcp';

/**
 * 08 Financial Management & Payment Providers (docs/features/08-financial-management-stripe-integration.md).
 * Bills and collects; every invoice / payment change re-derives its 09 income record (LedgerModule).
 */
@Module({
    imports: [FinanceSharedModule, LedgerModule, PaymentsIntegrationModule],
    controllers: [CatalogController, InvoicesController, PaymentsController, BillingSetupController, PaymentWebhooksController],
    providers: [CatalogService, BillingProfilesService, InvoicesService, PaymentsService, SubscriptionsService, ProviderGatewayService, PaymentProvidersService, BillingSetupService, FinanceReportsService, BillingMcp],
    exports: [CatalogService, InvoicesService, PaymentsService, SubscriptionsService],
})
export class BillingModule { }
