import { BadRequestException, Injectable } from '@nestjs/common';
import Stripe from 'stripe';
import { CheckoutInput, CheckoutResult, NormalizedProviderEvent, PaymentProviderAdapter, ProviderAccountInfo, ProviderCredentials } from '../payment-provider.adapter';

/**
 * Stripe adapter for 08 Billing (BYOK): a Stripe client is created per call from the organization's own secret key and
 * dropped afterwards. Never reads STRIPE_* from the environment (01 §160). The legacy env-based services in
 * `integrations/stripe` are not used by Billing.
 */
@Injectable()
export class StripePaymentAdapter implements PaymentProviderAdapter {
    private client(credentials: ProviderCredentials) {
        return new Stripe(credentials.secret_key, { maxNetworkRetries: 1, timeout: 20_000 });
    }

    async verify(credentials: ProviderCredentials): Promise<ProviderAccountInfo> {
        try {
            const account = await this.client(credentials).accounts.retrieveCurrent();
            return {
                account_id: account.id,
                account_name: account.business_profile?.name ?? account.settings?.dashboard?.display_name ?? null,
                country: account.country ?? null,
                default_currency: account.default_currency?.toUpperCase() ?? null,
                livemode: credentials.secret_key.startsWith('sk_live') || credentials.secret_key.startsWith('rk_live'),
                capabilities: { recurring: true, saved_methods: true, refunds: true, partial_refunds: true, provider_invoices: true, provider_subscriptions: true, payouts: true, checkout: true, payment_links: true },
            };
        } catch (error) {
            throw new BadRequestException({ message: `Stripe rejected the credentials: ${(error as Error).message}`, code: 'provider_verify_failed' });
        }
    }

    async createCheckout(credentials: ProviderCredentials, input: CheckoutInput): Promise<CheckoutResult> {
        const session = await this.client(credentials).checkout.sessions.create({
            mode: 'payment',
            customer_email: input.customer_email ?? undefined,
            line_items: [{ quantity: 1, price_data: { currency: input.currency.toLowerCase(), unit_amount: input.amount_cents, product_data: { name: input.title, ...(input.description && { description: input.description.slice(0, 500) }) } } }],
            payment_intent_data: { metadata: input.metadata, description: input.title },
            metadata: input.metadata,
            success_url: input.success_url,
            cancel_url: input.cancel_url,
        });
        return { id: session.id, url: session.url ?? '', expires_at: session.expires_at ? new Date(session.expires_at * 1000) : null };
    }

    async refund(credentials: ProviderCredentials, providerPaymentId: string, amountCents: number, reason?: string | null) {
        const refund = await this.client(credentials).refunds.create({ payment_intent: providerPaymentId, amount: amountCents, metadata: reason ? { reason: reason.slice(0, 450) } : undefined });
        const status = refund.status === 'succeeded' ? 'SUCCEEDED' : refund.status === 'failed' || refund.status === 'canceled' ? 'FAILED' : 'PENDING';
        return { id: refund.id, status: status as 'SUCCEEDED' | 'PENDING' | 'FAILED' };
    }

    async paymentFee(credentials: ProviderCredentials, providerPaymentId: string): Promise<number | null> {
        try {
            const pi = await this.client(credentials).paymentIntents.retrieve(providerPaymentId, { expand: ['latest_charge.balance_transaction'] });
            const charge = pi.latest_charge as Stripe.Charge | null;
            const bt = charge?.balance_transaction as Stripe.BalanceTransaction | null;
            return bt?.fee ?? null;
        } catch {
            return null;
        }
    }

    async parseWebhook(credentials: ProviderCredentials, rawBody: Buffer, signature: string): Promise<NormalizedProviderEvent> {
        if (!credentials.webhook_signing_secret) throw new BadRequestException({ message: 'The connection has no webhook signing secret', code: 'webhook_secret_missing' });
        let event: Stripe.Event;
        try {
            event = this.client(credentials).webhooks.constructEvent(rawBody, signature, credentials.webhook_signing_secret);
        } catch (error) {
            throw new BadRequestException({ message: `Webhook signature verification failed: ${(error as Error).message}`, code: 'webhook_signature_invalid' });
        }
        const base = { id: event.id, type: event.type, raw: event };
        switch (event.type) {
            case 'checkout.session.completed': {
                const s = event.data.object as Stripe.Checkout.Session;
                if (s.payment_status !== 'paid') return { ...base, normalized: 'ignored', data: {} };
                return { ...base, normalized: 'payment.succeeded', data: { checkout_id: s.id, payment_id: typeof s.payment_intent === 'string' ? s.payment_intent : s.payment_intent?.id ?? null, amount_cents: s.amount_total, currency: s.currency?.toUpperCase() ?? null, metadata: (s.metadata ?? {}) as Record<string, string>, email: s.customer_details?.email ?? null, method_type: 'CARD' } };
            }
            case 'payment_intent.payment_failed': {
                const pi = event.data.object as Stripe.PaymentIntent;
                return { ...base, normalized: 'payment.failed', data: { payment_id: pi.id, amount_cents: pi.amount, currency: pi.currency.toUpperCase(), metadata: (pi.metadata ?? {}) as Record<string, string>, failure_code: pi.last_payment_error?.code ?? null, failure_message: pi.last_payment_error?.message ?? null } };
            }
            case 'charge.refunded': {
                const c = event.data.object as Stripe.Charge;
                const latest = c.refunds?.data?.[0];
                return { ...base, normalized: 'payment.refunded', data: { payment_id: typeof c.payment_intent === 'string' ? c.payment_intent : c.payment_intent?.id ?? null, refund_id: latest?.id ?? null, refund_amount_cents: latest?.amount ?? c.amount_refunded, currency: c.currency.toUpperCase(), metadata: (c.metadata ?? {}) as Record<string, string> } };
            }
            case 'charge.dispute.created':
            case 'charge.dispute.closed': {
                const d = event.data.object as Stripe.Dispute;
                return { ...base, normalized: event.type === 'charge.dispute.created' ? 'dispute.opened' : 'dispute.closed', data: { dispute_id: d.id, payment_id: typeof d.payment_intent === 'string' ? d.payment_intent : d.payment_intent?.id ?? null, amount_cents: d.amount, currency: d.currency.toUpperCase(), dispute_status: d.status, reason: d.reason, evidence_due_at: d.evidence_details?.due_by ? new Date(d.evidence_details.due_by * 1000) : null } };
            }
            case 'payout.paid': {
                const p = event.data.object as Stripe.Payout;
                return { ...base, normalized: 'payout.paid', data: { payout_id: p.id, amount_cents: p.amount, currency: p.currency.toUpperCase(), arrival_date: p.arrival_date ? new Date(p.arrival_date * 1000) : null } };
            }
            default:
                return { ...base, normalized: 'ignored', data: {} };
        }
    }
}
