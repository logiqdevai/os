import { IntegrationProvider } from 'generated/prisma';

export interface VerifyResult {
    ok: boolean;
    /** `null` = this provider cannot be verified automatically; the connection stays PENDING. */
    verified: boolean | null;
    error?: string;
    capabilities?: Record<string, unknown>;
}

const TIMEOUT_MS = 8000;

async function call(url: string, init: RequestInit): Promise<{ status: number; body: any }> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
        const res = await fetch(url, { ...init, signal: controller.signal });
        let body: any = null;
        try {
            body = await res.json();
        } catch {
            body = null;
        }
        return { status: res.status, body };
    } finally {
        clearTimeout(timer);
    }
}

const failed = (status: number, body: any): VerifyResult => ({
    ok: false,
    verified: false,
    error: (body?.error?.message ?? body?.message ?? body?.error ?? `Provider answered ${status}`).toString().slice(0, 300),
});

/**
 * "Test connection" (integration-providers.ts `verify`): one cheap, read-only request per provider that proves
 * the credentials work. Secrets live only in memory for the duration of the call and are never logged.
 */
export async function verifyIntegration(provider: IntegrationProvider, secrets: Record<string, string>, config: Record<string, unknown>): Promise<VerifyResult> {
    try {
        switch (provider) {
            case 'OPENAI': {
                const base = String(config.base_url || 'https://api.openai.com/v1').replace(/\/$/, '');
                const headers: Record<string, string> = { Authorization: `Bearer ${secrets.api_key}` };
                if (config.organization_id) headers['OpenAI-Organization'] = String(config.organization_id);
                if (config.project_id) headers['OpenAI-Project'] = String(config.project_id);
                const { status, body } = await call(`${base}/models`, { headers });
                if (status !== 200) return failed(status, body);
                return { ok: true, verified: true, capabilities: { models: (body?.data ?? []).slice(0, 50).map((m: { id: string }) => m.id) } };
            }
            case 'RESEND': {
                const { status, body } = await call('https://api.resend.com/domains', { headers: { Authorization: `Bearer ${secrets.api_key}` } });
                if (status !== 200) return failed(status, body);
                return { ok: true, verified: true, capabilities: { domains: (body?.data ?? []).map((d: { name: string; status: string }) => ({ name: d.name, status: d.status })) } };
            }
            case 'STRIPE': {
                const { status, body } = await call('https://api.stripe.com/v1/account', { headers: { Authorization: `Bearer ${secrets.secret_key}` } });
                if (status !== 200) return failed(status, body);
                return { ok: true, verified: true, capabilities: { account_id: body?.id, account_name: body?.settings?.dashboard?.display_name ?? body?.business_profile?.name ?? null, country: body?.country, livemode: !String(secrets.secret_key).startsWith('sk_test_') } };
            }
            case 'TWILIO': {
                const auth = Buffer.from(`${secrets.account_sid}:${secrets.auth_token}`).toString('base64');
                const { status, body } = await call(`https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(secrets.account_sid)}.json`, { headers: { Authorization: `Basic ${auth}` } });
                if (status !== 200) return failed(status, body);
                return { ok: true, verified: true, capabilities: { account_name: body?.friendly_name, status: body?.status } };
            }
            default:
                return { ok: true, verified: null };
        }
    } catch (error) {
        const aborted = (error as Error).name === 'AbortError';
        return { ok: false, verified: false, error: aborted ? 'The provider did not answer in time' : `Could not reach the provider: ${(error as Error).message}`.slice(0, 300) };
    }
}
