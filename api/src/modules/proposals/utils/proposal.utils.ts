import { createHash, randomBytes } from 'crypto';
import { Prisma, ProposalAccessTokenSource } from 'generated/prisma';

export const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
export const num = (v: unknown): number => (v === null || v === undefined || v === '' ? 0 : Number(v));

export interface LineInput {
    quantity: number;
    unit_price: number;
    discount_percent?: number | null;
    discount_amount?: number | null;
    tax_percent?: number | null;
    is_recurring?: boolean;
    billing_frequency?: string | null;
    is_optional?: boolean;
    selected_by_customer?: boolean | null;
}

export interface LineAmounts {
    discount_amount: number;
    net_amount: number;
    tax_amount: number;
    gross_amount: number;
}

/** One line: qty × price − discount (% wins over amount) → net; net × tax% → tax; net + tax → gross. */
export function computeLine(l: LineInput): LineAmounts {
    const base = round2(num(l.quantity) * num(l.unit_price));
    const discount = l.discount_percent ? round2((base * num(l.discount_percent)) / 100) : Math.min(base, round2(num(l.discount_amount)));
    const net = round2(base - discount);
    const tax = round2((net * num(l.tax_percent)) / 100);
    return { discount_amount: discount, net_amount: net, tax_amount: tax, gross_amount: round2(net + tax) };
}

const MONTHS: Record<string, number> = { monthly: 1, quarterly: 3, annual: 12 };

export interface Totals {
    net_total: number;
    discount_total: number;
    tax_total: number;
    gross_total: number;
    recurring_monthly: number;
    recurring_annual: number;
    optional_total: number;
}

/**
 * Version totals. Optional items count only when the customer selected them (`selected_by_customer`).
 * Recurring lines: the per-period amount is net / quantity, normalised to a month by billing_frequency.
 */
export function computeTotals(lines: LineInput[]): Totals {
    const t: Totals = { net_total: 0, discount_total: 0, tax_total: 0, gross_total: 0, recurring_monthly: 0, recurring_annual: 0, optional_total: 0 };
    for (const l of lines) {
        const a = computeLine(l);
        if (l.is_optional && !l.selected_by_customer) {
            t.optional_total += a.gross_amount;
            continue;
        }
        t.net_total += a.net_amount;
        t.discount_total += a.discount_amount;
        t.tax_total += a.tax_amount;
        t.gross_total += a.gross_amount;
        if (l.is_recurring) {
            const perPeriod = num(l.quantity) > 0 ? a.net_amount / num(l.quantity) : 0;
            t.recurring_monthly += perPeriod / (MONTHS[l.billing_frequency ?? 'monthly'] ?? 1);
        }
    }
    for (const k of Object.keys(t) as (keyof Totals)[]) t[k] = round2(t[k]);
    t.recurring_annual = round2(t.recurring_monthly * 12);
    return t;
}

/** Public link token: the raw value goes in the URL only; the database stores the sha256. */
export function newToken() {
    const token = randomBytes(32).toString('base64url');
    return { token, hash: hashToken(token) };
}
export const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');

type TokenDb = { proposalAccessToken: Prisma.TransactionClient['proposalAccessToken'] };

/**
 * 03/07 — issue one more public link for a proposal (send, reminder, portal, rotation). Earlier links keep working until
 * they are revoked (rotation, cancel, marked lost) or the proposal stops being valid. Returns the raw token once.
 */
export async function issueAccessToken(db: TokenDb, data: { organization_id: string; proposal_id: string; source: ProposalAccessTokenSource; recipient_email?: string | null; portal_membership_id?: string | null }) {
    const t = newToken();
    await db.proposalAccessToken.create({ data: { ...data, recipient_email: data.recipient_email?.toLowerCase() ?? null, token_hash: t.hash } });
    return t;
}

/** Revoke every live public link of a proposal. */
export const revokeAccessTokens = (db: TokenDb, proposalId: string) =>
    db.proposalAccessToken.updateMany({ where: { proposal_id: proposalId, revoked_at: null }, data: { revoked_at: new Date() } });
export const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');

/** 6-digit one-time code. */
export const newCode = () => String(Math.floor(100000 + Math.random() * 900000));

/** Replace {{path.to.value}} with values from a flat map; unknown variables stay visible so reviewers notice them. */
export function renderVariables(text: string | null | undefined, vars: Record<string, string | null | undefined>) {
    if (!text) return text ?? null;
    return text.replace(/\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g, (m, key: string) => {
        const v = vars[key];
        return v === undefined || v === null || v === '' ? m : v;
    });
}

export const maskEmail = (email: string) => {
    const [user, domain] = email.split('@');
    if (!domain) return email;
    return `${user.slice(0, 1)}${'•'.repeat(Math.max(1, Math.min(6, user.length - 1)))}@${domain}`;
};

export const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string);

export const addDays = (d: Date, days: number) => new Date(d.getTime() + days * 86_400_000);
export const dateOnly = (d: Date) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
