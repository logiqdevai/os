import { Module } from '@nestjs/common';
import { StripePaymentAdapter } from './stripe/stripe-payment.adapter';

/** Payment provider adapters (08 "Payment Providers"). Add one adapter per PaymentProvider value. */
@Module({
    providers: [StripePaymentAdapter],
    exports: [StripePaymentAdapter],
})
export class PaymentsIntegrationModule { }
