import { AsyncLocalStorage } from 'async_hooks';
import { createHmac, randomBytes, timingSafeEqual } from 'crypto';
import { isIP } from 'net';
import { ConditionGroup, ConditionNode, ConditionPredicate } from './rule-definition.types';

// -------------------------------------------------------------------------------------------------
// Loop protection: actions run inside this async context, so events they publish (EventsService emits the
// bus event in the same async chain) can be linked back to the run that caused them (20 §6).
// -------------------------------------------------------------------------------------------------
export interface AutomationRunContext {
    run_id: string;
    rule_id: string;
    trigger_depth: number;
}
export const automationRunStorage = new AsyncLocalStorage<AutomationRunContext>();

// -------------------------------------------------------------------------------------------------
// Paths and templates
// -------------------------------------------------------------------------------------------------
export function getPath(source: unknown, path: string): unknown {
    if (!path) return undefined;
    let cur: unknown = source;
    for (const part of path.split('.')) {
        if (cur === null || cur === undefined) return undefined;
        if (Array.isArray(cur) && /^\d+$/.test(part)) cur = cur[Number(part)];
        else if (typeof cur === 'object') cur = (cur as Record<string, unknown>)[part];
        else return undefined;
    }
    return cur;
}

const WHOLE = /^\{\{\s*([\w.]+)\s*\}\}$/;
const ANY = /\{\{\s*([\w.]+)\s*\}\}/g;

/**
 * Resolve `{{event.payload.name}}` style templates in strings, arrays and objects. A string that is exactly one
 * placeholder keeps the value's type (number, object, array); embedded placeholders are stringified.
 */
export function resolveTemplates<T>(value: T, scope: unknown): T {
    if (typeof value === 'string') {
        const whole = value.match(WHOLE);
        if (whole) return getPath(scope, whole[1]) as T;
        return value.replace(ANY, (_, p: string) => {
            const v = getPath(scope, p);
            if (v === undefined || v === null) return '';
            return typeof v === 'object' ? JSON.stringify(v) : String(v);
        }) as T;
    }
    if (Array.isArray(value)) return value.map((v) => resolveTemplates(v, scope)) as T;
    if (value && typeof value === 'object') {
        const out: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(value as Record<string, unknown>)) out[k] = resolveTemplates(v, scope);
        return out as T;
    }
    return value;
}

// -------------------------------------------------------------------------------------------------
// Conditions (20 §2)
// -------------------------------------------------------------------------------------------------
export interface ConditionResult {
    path: string;
    operator: string;
    expected: unknown;
    actual: unknown;
    passed: boolean;
}

const isGroup = (n: ConditionNode): n is ConditionGroup => !!n && typeof n === 'object' && ('all' in n || 'any' in n || 'not' in n) && !('operator' in n);

const num = (v: unknown) => (typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' && !Number.isNaN(Number(v)) ? Number(v) : NaN);
const cmp = (a: unknown, b: unknown) => {
    const na = num(a);
    const nb = num(b);
    if (!Number.isNaN(na) && !Number.isNaN(nb)) return na - nb;
    const da = Date.parse(String(a));
    const db = Date.parse(String(b));
    if (!Number.isNaN(da) && !Number.isNaN(db)) return da - db;
    return String(a ?? '').localeCompare(String(b ?? ''));
};
const looseEq = (a: unknown, b: unknown) => {
    if (a === b) return true;
    if (a === null || a === undefined || b === null || b === undefined) return false;
    if (typeof a === 'object' || typeof b === 'object') return JSON.stringify(a) === JSON.stringify(b);
    return String(a).toLowerCase() === String(b).toLowerCase();
};
const asList = (v: unknown): unknown[] => (Array.isArray(v) ? v : typeof v === 'string' ? v.split(',').map((s) => s.trim()).filter(Boolean) : v === undefined || v === null ? [] : [v]);

function evalPredicate(p: ConditionPredicate, scope: Record<string, unknown>): ConditionResult {
    const actual = getPath(scope, p.path);
    const expected = p.value;
    let passed = false;
    switch (p.operator) {
        case 'eq': passed = looseEq(actual, expected); break;
        case 'neq': passed = !looseEq(actual, expected); break;
        case 'gt': passed = actual !== undefined && actual !== null && cmp(actual, expected) > 0; break;
        case 'gte': passed = actual !== undefined && actual !== null && cmp(actual, expected) >= 0; break;
        case 'lt': passed = actual !== undefined && actual !== null && cmp(actual, expected) < 0; break;
        case 'lte': passed = actual !== undefined && actual !== null && cmp(actual, expected) <= 0; break;
        case 'contains':
            passed = Array.isArray(actual) ? actual.some((a) => looseEq(a, expected)) : String(actual ?? '').toLowerCase().includes(String(expected ?? '').toLowerCase());
            break;
        case 'not_contains':
            passed = Array.isArray(actual) ? !actual.some((a) => looseEq(a, expected)) : !String(actual ?? '').toLowerCase().includes(String(expected ?? '').toLowerCase());
            break;
        case 'starts_with': passed = String(actual ?? '').toLowerCase().startsWith(String(expected ?? '').toLowerCase()); break;
        case 'ends_with': passed = String(actual ?? '').toLowerCase().endsWith(String(expected ?? '').toLowerCase()); break;
        case 'in': passed = asList(expected).some((e) => looseEq(actual, e)); break;
        case 'not_in': passed = !asList(expected).some((e) => looseEq(actual, e)); break;
        case 'exists': passed = actual !== undefined && actual !== null && actual !== ''; break;
        case 'not_exists': passed = actual === undefined || actual === null || actual === ''; break;
        case 'changed': {
            // `path` names a field; true when the event's changes include it.
            const field = p.path.split('.').pop() as string;
            const changes = getPath(scope, 'event.changes') as Record<string, unknown> | null;
            passed = !!changes && Object.prototype.hasOwnProperty.call(changes, field);
            break;
        }
        default: passed = false;
    }
    return { path: p.path, operator: p.operator, expected, actual: truncate(actual), passed };
}

function truncate(v: unknown) {
    if (typeof v === 'string' && v.length > 300) return `${v.slice(0, 300)}…`;
    return v;
}

/** Evaluate a condition tree; an empty or missing tree passes. Returns the flat list of predicate results. */
export function evaluateConditions(group: ConditionGroup | null | undefined, scope: Record<string, unknown>): { passed: boolean; results: ConditionResult[] } {
    const results: ConditionResult[] = [];
    const walk = (node: ConditionNode): boolean => {
        if (isGroup(node)) {
            const all = node.all ?? [];
            const any = node.any ?? [];
            const not = node.not ?? [];
            const allOk = all.map(walk).every(Boolean);
            const anyOk = any.length ? any.map(walk).some(Boolean) : true;
            const notOk = not.map(walk).every((r) => !r);
            return allOk && anyOk && notOk;
        }
        const r = evalPredicate(node as ConditionPredicate, scope);
        results.push(r);
        return r.passed;
    };
    if (!group) return { passed: true, results };
    return { passed: walk(group), results };
}

// -------------------------------------------------------------------------------------------------
// Webhook helpers
// -------------------------------------------------------------------------------------------------
export const newSecret = (prefix: string) => `${prefix}_${randomBytes(24).toString('base64url')}`;

/** `t=<unix>,v1=<hex hmac-sha256 of "<t>.<body>">` (Stripe-style, replay-resistant). */
export function signPayload(secret: string, body: string, timestamp = Math.floor(Date.now() / 1000)) {
    const sig = createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex');
    return `t=${timestamp},v1=${sig}`;
}

export function safeEqual(a: string, b: string) {
    const ba = Buffer.from(a);
    const bb = Buffer.from(b);
    return ba.length === bb.length && timingSafeEqual(ba, bb);
}

/** Verify an inbound HMAC: accepts a bare hex digest, `sha256=<hex>` or `t=…,v1=…`. */
export function verifyHmac(secret: string, rawBody: string, header: string | undefined, toleranceSeconds = 600): boolean {
    if (!header) return false;
    const value = header.trim();
    if (value.includes('v1=')) {
        const parts = Object.fromEntries(value.split(',').map((p) => p.split('=') as [string, string]));
        const t = Number(parts.t);
        if (!t || Math.abs(Date.now() / 1000 - t) > toleranceSeconds) return false;
        const expected = createHmac('sha256', secret).update(`${t}.${rawBody}`).digest('hex');
        return safeEqual(expected, parts.v1 ?? '');
    }
    const digest = value.startsWith('sha256=') ? value.slice(7) : value;
    const expected = createHmac('sha256', secret).update(rawBody).digest('hex');
    return safeEqual(expected, digest);
}

const PRIVATE_V4 = [/^10\./, /^127\./, /^169\.254\./, /^192\.168\./, /^172\.(1[6-9]|2\d|3[01])\./, /^0\./];

/**
 * SSRF guard for outbound URLs: https only, no IP literals in private ranges, no localhost — except outside
 * production where http and localhost are allowed so endpoints can be tested locally.
 */
export function assertSafeUrl(raw: string): string | null {
    let url: URL;
    try {
        url = new URL(raw);
    } catch {
        return 'The URL is not valid';
    }
    const prod = process.env.NODE_ENV === 'production';
    if (url.protocol !== 'https:' && !(url.protocol === 'http:' && !prod)) return 'The URL must use https';
    const host = url.hostname.toLowerCase();
    if (prod) {
        if (host === 'localhost' || host.endsWith('.local') || host.endsWith('.internal')) return 'Private network URLs are not allowed';
        if (isIP(host) === 4 && PRIVATE_V4.some((r) => r.test(host))) return 'Private network URLs are not allowed';
        if (isIP(host) === 6 && (host === '::1' || host.startsWith('fc') || host.startsWith('fd') || host.startsWith('fe80'))) return 'Private network URLs are not allowed';
    }
    return null;
}

/** Exponential backoff with a cap (seconds). */
export const backoffSeconds = (base: number, attempt: number) => Math.min(base * 2 ** Math.max(0, attempt - 1), 6 * 3600);

/** Event key subscription match: exact, `*`, or prefix wildcard `crm.*`. */
export function matchesEventKey(patterns: string[], key: string) {
    return patterns.some((p) => p === '*' || p === key || (p.endsWith('.*') && key.startsWith(p.slice(0, -1))));
}
