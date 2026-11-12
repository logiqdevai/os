import { BadRequestException } from '@nestjs/common';
import { createHash, randomBytes, randomInt } from 'crypto';
import { OrgContext } from '@/shared/authorization/interfaces/org-context.interface';

export const CONTRACT_READ = 'contracts.contracts.read';
export const CONFIDENTIAL_READ = 'contracts.confidential_terms.read';
export const INTERNAL_COMMENTS_READ = 'contracts.comments.internal.read';

export const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');
export const newToken = () => randomBytes(32).toString('base64url');
export const newCode = () => String(randomInt(0, 1_000_000)).padStart(6, '0');

/** Minimal member display (never expose more than name/email/photo through contract payloads). */
export const MEMBER_SELECT = {
    id: true,
    job_title: true,
    user: { select: { id: true, email: true, display_name: true, first_name: true, last_name: true, profile_photo_url: true } },
} as const;

export const memberName = (m: { user?: { display_name?: string | null; first_name?: string | null; last_name?: string | null; email?: string | null } | null } | null | undefined) =>
    m?.user ? m.user.display_name || [m.user.first_name, m.user.last_name].filter(Boolean).join(' ') || m.user.email || 'Member' : null;

/** Fields hidden without `contracts.confidential_terms.read` (01 §60 field-level permissions). */
const CONFIDENTIAL_FIELDS = ['total_value', 'one_time_value', 'recurring_value', 'payment_terms', 'billing_frequency', 'billing_model', 'risk_score', 'risk_level', 'risk_factors'] as const;

export function stripConfidential<T extends Record<string, any>>(ctx: OrgContext, contract: T): T & { confidential_hidden?: boolean } {
    if (!contract || ctx.can(CONFIDENTIAL_READ)) return contract;
    const copy: Record<string, any> = { ...contract };
    for (const f of CONFIDENTIAL_FIELDS) if (f in copy) copy[f] = null;
    copy.confidential_hidden = true;
    return copy as T & { confidential_hidden: boolean };
}

/** Deterministic content hash of a version's sections (04 §17, §40). */
export function sectionsHash(sections: { key: string; title: string; body: string | null; sort_order: number }[]) {
    const canonical = [...sections].sort((a, b) => a.sort_order - b.sort_order).map((s) => ({ key: s.key, title: s.title, body: s.body ?? '' }));
    return sha256(JSON.stringify(canonical));
}

/** Replace {{path.to.value}} tokens with resolved variables; unknown tokens stay visible so authors notice them. */
export function resolveVariables(text: string | null | undefined, vars: Record<string, string | null | undefined>) {
    if (!text) return text ?? null;
    return text.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (m, key: string) => (vars[key] !== undefined && vars[key] !== null && vars[key] !== '' ? String(vars[key]) : m));
}

/** Template placeholders still present in the document (e.g. `contract.start_date`), deduplicated. */
export function unresolvedVariables(sections: { body: string | null }[]): string[] {
    const found = new Set<string>();
    for (const s of sections) for (const m of (s.body ?? '').matchAll(/\{\{\s*([\w.]+)\s*\}\}/g)) found.add(m[1]);
    return [...found];
}

/** A document must never reach approvers or signers with unfilled `{{…}}` placeholders. */
export function assertNoUnresolvedVariables(sections: { body: string | null }[]) {
    const missing = unresolvedVariables(sections);
    if (missing.length) {
        throw new BadRequestException({
            message: `Fill in these values in the document first: ${missing.join(', ')}. Set the contract details (dates, payment terms) or edit the text, then submit again.`,
            code: 'unresolved_variables',
            missing,
        });
    }
}

export interface RuleCondition {
    field: string;
    operator: '>' | '>=' | '<' | '<=' | '=' | '!=' | 'in' | 'not_in';
    value: unknown;
}

/** Evaluate an approval-rule predicate (all conditions must match) against flat contract facts. */
export function matchesConditions(conditions: unknown, facts: Record<string, unknown>): boolean {
    const list = Array.isArray(conditions) ? (conditions as RuleCondition[]) : [];
    return list.every((c) => {
        const actual = facts[c.field];
        const num = (v: unknown) => (v === null || v === undefined || v === '' ? NaN : Number(v));
        switch (c.operator) {
            case '>': return num(actual) > num(c.value);
            case '>=': return num(actual) >= num(c.value);
            case '<': return num(actual) < num(c.value);
            case '<=': return num(actual) <= num(c.value);
            case '=': return String(actual) === String(c.value);
            case '!=': return String(actual) !== String(c.value);
            case 'in': return Array.isArray(c.value) && c.value.map(String).includes(String(actual));
            case 'not_in': return Array.isArray(c.value) && !c.value.map(String).includes(String(actual));
            default: return false;
        }
    });
}

export const maskEmail = (email: string) => {
    const [user, domain] = email.split('@');
    if (!domain) return email;
    return `${user.slice(0, 1)}${'•'.repeat(Math.max(1, Math.min(user.length - 1, 6)))}@${domain}`;
};

export const today = () => {
    const d = new Date();
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
};

export const addDays = (date: Date, days: number) => new Date(date.getTime() + days * 86_400_000);
export const addMonths = (date: Date, months: number) => {
    const d = new Date(date);
    d.setUTCMonth(d.getUTCMonth() + months);
    return d;
};

/** Context for writes made by a public (token) caller: no member, SYSTEM actor, organization from the record. */
export function publicContext(organizationId: string, meta: { ip?: string | null; user_agent?: string | null }): OrgContext {
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

/** +30 69•••••678 style mask for SMS recipients. */
export const maskPhone = (phone: string) => {
    const p = phone.replace(/[\s-]/g, '');
    return p.length <= 6 ? '•••' : `${p.slice(0, 5)}${'•'.repeat(Math.max(3, p.length - 8))}${p.slice(-3)}`;
};
