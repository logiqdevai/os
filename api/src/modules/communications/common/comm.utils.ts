import { NotFoundException } from '@nestjs/common';
import { CommChannel, Prisma } from 'generated/prisma';
import { randomBytes } from 'crypto';
import { OrgContext } from '@/shared/authorization/interfaces/org-context.interface';

/** `{{ first_name }}` / `{{contact.first_name}}` / `{{first_name | there}}` (fallback after the pipe). */
const VARIABLE_RE = /\{\{\s*([a-zA-Z0-9_.]+)\s*(?:\|\s*([^}]*?)\s*)?\}\}/g;

/** Variables used in a template body / subject, in order of first use. */
export function extractVariables(...sources: (string | null | undefined)[]): string[] {
    const keys = new Set<string>();
    for (const src of sources) {
        if (!src) continue;
        for (const m of src.matchAll(VARIABLE_RE)) keys.add(m[1]);
    }
    return [...keys];
}

const escapeHtml = (v: string) => v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Resolve a dotted path (`contact.first_name`) or a flat key (`first_name`) against the render context. */
function lookup(context: Record<string, unknown>, key: string): unknown {
    if (key in context) return context[key];
    return key.split('.').reduce<unknown>((acc, part) => (acc && typeof acc === 'object' ? (acc as Record<string, unknown>)[part] : undefined), context);
}

/**
 * Render `{{variables}}`. Missing values use the inline fallback (`{{first_name | there}}`) or an empty string.
 * HTML mode escapes values so personalization can never inject markup.
 */
export function renderTemplate(source: string | null | undefined, context: Record<string, unknown>, mode: 'html' | 'text' = 'text'): string {
    if (!source) return '';
    return source.replace(VARIABLE_RE, (_, key: string, fallback?: string) => {
        const value = lookup(context, key);
        const str = value === null || value === undefined || value === '' ? (fallback ?? '') : String(value);
        return mode === 'html' ? escapeHtml(str) : str;
    });
}

/** Missing required variables for a context (used by preflight and preview). */
export function missingVariables(keys: string[], context: Record<string, unknown>) {
    return keys.filter((k) => {
        const v = lookup(context, k);
        return v === null || v === undefined || v === '';
    });
}

/** Plain-text fallback for an HTML body. */
export function htmlToText(html: string | null | undefined): string {
    if (!html) return '';
    return html
        .replace(/<style[\s\S]*?<\/style>/gi, '')
        .replace(/<script[\s\S]*?<\/script>/gi, '')
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/(p|div|h[1-6]|li|tr)>/gi, '\n')
        .replace(/<li[^>]*>/gi, '• ')
        .replace(/<a [^>]*href="([^"]+)"[^>]*>(.*?)<\/a>/gi, '$2 ($1)')
        .replace(/<[^>]+>/g, '')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
}

const EMAIL_RE = /^[^\s@<>()]+@[^\s@<>()]+\.[^\s@<>()]{2,}$/;
const E164_RE = /^\+[1-9]\d{6,14}$/;

/** Normalized address for suppression / dedupe: lower-case email, E.164 phone (spaces and dashes stripped). */
export function normalizeAddress(channel: CommChannel, address: string | null | undefined): string | null {
    if (!address) return null;
    const raw = address.trim();
    if (channel === CommChannel.EMAIL) {
        const v = raw.toLowerCase();
        return EMAIL_RE.test(v) ? v : null;
    }
    const v = raw.replace(/[\s\-().]/g, '');
    const withPlus = v.startsWith('00') ? `+${v.slice(2)}` : v;
    return E164_RE.test(withPlus) ? withPlus : null;
}

/** SMS segment count (GSM-7: 160/153, UCS-2: 70/67). */
export function smsSegments(text: string): number {
    if (!text) return 0;
    // eslint-disable-next-line no-control-regex
    const gsm = /^[\x0A\x0D\x20-\x7E£¥èéùìòÇØøÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ¡ÄÖÑÜ§¿äöñüà€]*$/.test(text);
    const single = gsm ? 160 : 70;
    const multi = gsm ? 153 : 67;
    return text.length <= single ? 1 : Math.ceil(text.length / multi);
}

export const randomToken = (bytes = 18) => randomBytes(bytes).toString('base64url');

export function slugify(value: string) {
    return value
        .toLowerCase()
        .normalize('NFKD')
        .replace(/[̀-ͯ]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 60) || 'item';
}

/**
 * Branch scope for records that carry `branch_id` (campaigns, messages, templates): organization-wide sees all;
 * otherwise the record is in one of the caller's branches, has no branch, or was created / owned by the caller.
 */
export function branchScopeWhere(ctx: OrgContext, key: string, ownerFields: string[] = []): Record<string, unknown> {
    const scope = ctx.scopeOf(key);
    if (!scope || scope.organization) return {};
    const or: Record<string, unknown>[] = [{ branch_id: null }, { branch_id: { in: scope.branch_ids } }];
    if (ctx.membership_id) for (const f of ownerFields) or.push({ [f]: ctx.membership_id });
    return { OR: or };
}

export const notFound = (what: string, code: string) => new NotFoundException({ message: `${what} not found`, code });

export function isUniqueError(error: unknown): boolean {
    return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}

/** Start of a UTC day. */
export const utcDay = (d: Date) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));

/** Sample values used in template previews when no recipient is chosen. */
export const SAMPLE_CONTEXT: Record<string, unknown> = {
    first_name: 'Maria',
    last_name: 'Papadopoulou',
    full_name: 'Maria Papadopoulou',
    email: 'maria@example.com',
    phone: '+306900000000',
    job_title: 'Head of Marketing',
    company_name: 'Acme Corp',
    organization_name: 'Your agency',
    unsubscribe_url: '#unsubscribe',
    preferences_url: '#preferences',
};
