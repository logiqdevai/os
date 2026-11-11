/**
 * 08 "Payment Providers" — the provider-agnostic adapter contract. 08 services only call this interface, never a provider
 * SDK. Each call receives the organization's own decrypted credentials (BYOK, IntegrationConnection) for the duration of
 * the call only; adapters never read process.env and never log secrets.
 */
export interface ProviderCredentials {
    secret_key: string;
    webhook_signing_secret?: string;
    publishable_key?: string;
}

export interface ProviderAccountInfo {
    account_id: string;
    account_name: string | null;
    country: string | null;
    default_currency: string | null;
    livemode: boolean | null;
    capabilities: Record<string, boolean>;
}

export interface CheckoutInput {
    amount_cents: number;
    currency: string;
    title: string;
    description?: string | null;
    customer_email?: string | null;
    success_url: string;
    cancel_url: string;
    metadata: Record<string, string>;
    method_types?: string[];
}

export interface CheckoutResult {
    id: string;
    url: string;
    expires_at: Date | null;
}

/** Normalized webhook events (08 spec): payment.succeeded, payment.failed, payment.refunded, dispute.opened, dispute.closed, subscription.updated, payout.paid. */
export interface NormalizedProviderEvent {
    id: string;
    type: string;
    normalized:
    | 'payment.succeeded'
    | 'payment.failed'
    | 'payment.refunded'
    | 'dispute.opened'
    | 'dispute.closed'
    | 'payout.paid'
    | 'subscription.updated'
    | 'ignored';
    data: {
        checkout_id?: string | null;
        payment_id?: string | null;
        amount_cents?: number | null;
        fee_cents?: number | null;
        currency?: string | null;
        metadata?: Record<string, string>;
        failure_code?: string | null;
        failure_message?: string | null;
        refund_id?: string | null;
        refund_amount_cents?: number | null;
        dispute_id?: string | null;
        dispute_status?: string | null;
        reason?: string | null;
        evidence_due_at?: Date | null;
        payout_id?: string | null;
        arrival_date?: Date | null;
        method_type?: string | null;
        email?: string | null;
    };
    raw: unknown;
}

export interface PaymentProviderAdapter {
    verify(credentials: ProviderCredentials): Promise<ProviderAccountInfo>;
    createCheckout(credentials: ProviderCredentials, input: CheckoutInput): Promise<CheckoutResult>;
    refund(credentials: ProviderCredentials, providerPaymentId: string, amountCents: number, reason?: string | null): Promise<{ id: string; status: 'SUCCEEDED' | 'PENDING' | 'FAILED' }>;
    parseWebhook(credentials: ProviderCredentials, rawBody: Buffer, signature: string): Promise<NormalizedProviderEvent>;
    /** Fee of a payment (balance transaction), when the provider reports it. */
    paymentFee?(credentials: ProviderCredentials, providerPaymentId: string): Promise<number | null>;
}

/** Zero-decimal currencies per Stripe (amounts are not in cents). */
export const ZERO_DECIMAL = new Set(['BIF', 'CLP', 'DJF', 'GNF', 'JPY', 'KMF', 'KRW', 'MGA', 'PYG', 'RWF', 'UGX', 'VND', 'VUV', 'XAF', 'XOF', 'XPF']);
export const toMinor = (amount: string | number, currency: string) => (ZERO_DECIMAL.has(currency.toUpperCase()) ? Math.round(Number(amount)) : Math.round(Number(amount) * 100));
export const fromMinor = (minor: number, currency: string) => (ZERO_DECIMAL.has(currency.toUpperCase()) ? minor : minor / 100);
