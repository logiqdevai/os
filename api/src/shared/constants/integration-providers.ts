/**
 * Registry of the third-party services an organization connects with its OWN credentials
 * (docs/features/01-users-organizations-permissions.md §156-§161, model IntegrationConnection).
 *
 * LAUNCH SET (5): OpenAI (AI), Resend (email), Twilio (SMS), Stripe and Viva Wallet (payments).
 * To support another provider: add a value to the `IntegrationProvider` enum (and a category if needed) in prisma/schema.prisma,
 * add its entry here, and add the adapter in the module that consumes it. Nothing else changes: the Admin -> Integrations form
 * and the API validation are generated from this file.
 *
 * This file is the single source of truth for:
 *   - which secret fields a provider needs (stored encrypted, write-only, never returned by any API),
 *   - which non-secret config fields it has (stored in IntegrationConnection.config, safe to return),
 *   - how a connection is verified,
 *   - which category it belongs to (modules resolve connections by category).
 *
 * Rules for adapters (owned by the modules that consume the provider):
 *   1. Never read a provider key from process.env for an organization feature. Resolve an IntegrationConnection through the
 *      integration layer (`resolveConnection(organizationId, category, { provider?, branchId?, mode? })`), which decrypts the
 *      secret in memory for the duration of the call only.
 *   2. Never log, serialize, cache in plain text or return a secret. Redact `secret_ciphertext` and decrypted values everywhere.
 *   3. Report usage and failures back through the integration layer (IntegrationUsageDaily, last_error, status ERROR).
 *   4. Platform-level secrets (database, Redis, JWT, queue dashboard, platform storage, platform system email, platform maps) stay in the environment.
 */
import { IntegrationCategory, IntegrationProvider } from '../../generated/prisma';

export interface IntegrationFieldSpec {
    /** Key inside the secret JSON (secret fields) or inside IntegrationConnection.config (config fields). */
    key: string;
    label: string;
    /** UI input type. Secret fields are always rendered as write-only password inputs with the stored hint next to them. */
    input: 'text' | 'password' | 'url' | 'select' | 'number' | 'textarea';
    required: boolean;
    placeholder?: string;
    help?: string;
    /** For input = 'select'. */
    options?: string[];
}

export interface IntegrationProviderSpec {
    provider: IntegrationProvider;
    category: IntegrationCategory;
    label: string;
    description: string;
    /** Fields stored encrypted in secret_ciphertext. */
    secrets: IntegrationFieldSpec[];
    /** Fields stored in the clear in config. */
    config: IntegrationFieldSpec[];
    /** Provider has separate test and live credentials (IntegrationMode). */
    hasTestMode: boolean;
    /** Provider calls back (webhook): the connection gets a webhook_token and the URL /webhooks/integrations/:token. */
    webhook: boolean;
    /** What "Test connection" calls; must be a cheap, read-only request that proves the credentials work. */
    verify: string;
    /** Organization may set spend/rate guardrails (IntegrationConnection.usage_limits). */
    supportsUsageLimits: boolean;
    docsUrl?: string;
}

const secret = (key: string, label: string, placeholder?: string, help?: string): IntegrationFieldSpec => ({ key, label, input: 'password', required: true, placeholder, help });
const optSecret = (key: string, label: string, placeholder?: string, help?: string): IntegrationFieldSpec => ({ ...secret(key, label, placeholder, help), required: false });
const text = (key: string, label: string, required = false, placeholder?: string, help?: string): IntegrationFieldSpec => ({ key, label, input: 'text', required, placeholder, help });

export const INTEGRATION_PROVIDERS: Record<IntegrationProvider, IntegrationProviderSpec> = {
    // --- AI: one shared AI integration layer used by every module (Product Specification §6) ---
    OPENAI: {
        provider: 'OPENAI',
        category: 'AI',
        label: 'OpenAI',
        description: 'Drafting, classification, extraction, retrieval and automation AI steps.',
        secrets: [secret('api_key', 'API key', 'sk-…')],
        config: [
            text('organization_id', 'Organization ID', false, 'org-…'),
            text('project_id', 'Project ID', false, 'proj_…'),
            text('base_url', 'Base URL (proxy / Azure)', false, 'https://api.openai.com/v1'),
            text('default_model', 'Default model', true),
            text('embedding_model', 'Embedding model'),
        ],
        hasTestMode: false,
        webhook: false,
        verify: 'GET /v1/models',
        supportsUsageLimits: true,
        docsUrl: 'https://platform.openai.com/api-keys',
    },

    // --- Email (module 11) ---
    RESEND: {
        provider: 'RESEND',
        category: 'EMAIL',
        label: 'Resend',
        description: 'Transactional and campaign email.',
        secrets: [secret('api_key', 'API key', 're_…'), optSecret('webhook_secret', 'Webhook signing secret', 'whsec_…')],
        config: [text('default_from', 'Default from address', false, 'Agency <hello@agency.com>')],
        hasTestMode: false,
        webhook: true,
        verify: 'GET /domains',
        supportsUsageLimits: false,
        docsUrl: 'https://resend.com/api-keys',
    },

    // --- SMS (module 11) ---
    TWILIO: {
        provider: 'TWILIO',
        category: 'SMS',
        label: 'Twilio',
        description: 'SMS delivery.',
        secrets: [secret('account_sid', 'Account SID', 'AC…'), secret('auth_token', 'Auth token')],
        config: [text('messaging_service_sid', 'Messaging service SID'), text('from_number', 'From number', false, '+30…')],
        hasTestMode: false,
        webhook: true,
        verify: 'GET /Accounts/{sid}.json',
        supportsUsageLimits: false,
        docsUrl: 'https://console.twilio.com',
    },

    // --- Payments (module 08). Several accounts per provider are allowed (test/live, per branch, per country). ---
    STRIPE: {
        provider: 'STRIPE',
        category: 'PAYMENTS',
        label: 'Stripe',
        description: 'Cards, wallets, invoices and subscriptions.',
        secrets: [secret('secret_key', 'Secret key', 'sk_live_… / sk_test_…'), secret('webhook_signing_secret', 'Webhook signing secret', 'whsec_…')],
        config: [
            text('publishable_key', 'Publishable key', true, 'pk_live_… / pk_test_…', 'Not a secret: shown in the checkout.'),
            text('statement_descriptor', 'Statement descriptor'),
            text('account_id', 'Account ID (filled after verification)'),
        ],
        hasTestMode: true,
        webhook: true,
        verify: 'GET /v1/account',
        supportsUsageLimits: false,
        docsUrl: 'https://dashboard.stripe.com/apikeys',
    },
    VIVA_WALLET: {
        provider: 'VIVA_WALLET',
        category: 'PAYMENTS',
        label: 'Viva Wallet',
        description: 'Card payments in Europe.',
        secrets: [secret('client_id', 'Client ID'), secret('client_secret', 'Client secret'), secret('api_key', 'API key')],
        config: [text('merchant_id', 'Merchant ID', true), text('source_code', 'Source code', true)],
        hasTestMode: true,
        webhook: true,
        verify: 'OAuth token request',
        supportsUsageLimits: false,
    },
};

/**
 * Environment variables that REMAIN platform-level (not per organization). Everything an organization consumes from a third party
 * comes from IntegrationConnection instead.
 */
export const PLATFORM_ENV_KEYS = [
    'DATABASE_URL', 'REDIS_URL', 'JWT_SECRET', 'JWT_EXPIRATION_TIME', 'BULL_BOARD_USER', 'BULL_BOARD_PASSWORD',
    'API_URL', 'APP_URL', 'LANDING_URL', 'CORS_URLS', 'PORT', 'NODE_ENV', 'CACHE_TTL_SECONDS',
    // platform storage bucket (DocumentStorageProvider PLATFORM) and platform system email (sign-up verification, password reset)
    'GCS_BUCKET_NAME', 'GCS_PROJECT_ID', 'GCS_CREDENTIALS_JSON_BASE64', 'SMTP_HOST', 'SMTP_PORT', 'SMTP_SECURE', 'SMTP_USER', 'SMTP_PASSWORD', 'SMTP_FROM', 'SMTP_FROM_NAME',
    // platform-level maps key (address autocomplete of the platform itself); not a tenant integration
    'GOOGLE_MAPS_API_KEY',
    // master key / KMS reference used to wrap each organization's vault key
    'VAULT_MASTER_KEY_REF',
] as const;

/**
 * Env keys that MOVE to per-organization IntegrationConnection (remove from .env once the adapters read connections).
 * In local development a seed creates PLATFORM-source connections that read these from .env.staging (01 §160).
 */
export const MIGRATED_ENV_KEYS: Record<string, IntegrationProvider> = {
    OPENAI_API_KEY: 'OPENAI',
    RESEND_API_KEY: 'RESEND',
    STRIPE_SECRET_KEY: 'STRIPE',
    STRIPE_PUBLISHABLE_KEY: 'STRIPE',
    STRIPE_WEBHOOK_SECRET: 'STRIPE',
    TWILIO_ACCOUNT_SID: 'TWILIO',
    TWILIO_AUTH_TOKEN: 'TWILIO',
};
