import { OrgContext } from '@/shared/authorization/interfaces/org-context.interface';

/**
 * Context for actions taken by an external party through a token link (customer, signer). There is no member identity:
 * audit rows get actor_type SYSTEM with the customer details in metadata, and the event bus still fans out (owner notifications).
 * It holds no permissions, so it can never be passed to a permission-checked service method by mistake.
 */
export function externalContext(organizationId: string, meta: { ip?: string | null; user_agent?: string | null } = {}): OrgContext {
    return {
        organization_id: organizationId,
        user_id: null,
        membership_id: null,
        service_account_id: null,
        api_key_id: null,
        actor_type: 'SYSTEM',
        channel: 'api',
        ip_address: meta.ip ?? null,
        user_agent: meta.user_agent ?? null,
        effective: { permissions: {}, modules: [] },
        can: () => false,
        scopeOf: () => null,
    };
}

/** Tiny fixed-window rate limiter for public token endpoints (per process). */
export class RateLimiter {
    private readonly hits = new Map<string, { count: number; reset: number }>();

    constructor(private readonly limit: number, private readonly windowMs: number) { }

    allow(key: string) {
        const now = Date.now();
        const entry = this.hits.get(key);
        if (!entry || entry.reset < now) {
            this.hits.set(key, { count: 1, reset: now + this.windowMs });
            if (this.hits.size > 10_000) for (const [k, v] of this.hits) if (v.reset < now) this.hits.delete(k);
            return true;
        }
        entry.count += 1;
        return entry.count <= this.limit;
    }
}
