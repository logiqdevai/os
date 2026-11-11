import { DateTime } from 'luxon';

/**
 * Small RFC 5545 RRULE subset (19 §3): FREQ=DAILY|WEEKLY|MONTHLY, INTERVAL, COUNT, UNTIL, BYDAY (weekly).
 * Expansion runs in the event's IANA zone so wall-clock times survive DST changes.
 */
export type RecurrenceFreq = 'DAILY' | 'WEEKLY' | 'MONTHLY';

export interface RecurrenceInput {
    freq: RecurrenceFreq;
    interval?: number;
    count?: number | null;
    until?: string | Date | null;
    /** 0 = Sunday … 6 = Saturday (weekly only). */
    byday?: number[] | null;
}

export interface ParsedRule {
    freq: RecurrenceFreq;
    interval: number;
    count: number | null;
    until: Date | null;
    byday: number[];
}

export interface Occurrence {
    start: Date;
    end: Date;
}

const DAY_CODES = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
const MAX_ITERATIONS = 5000;

export function buildRRule(input: RecurrenceInput): string {
    const parts = [`FREQ=${input.freq}`];
    if (input.interval && input.interval > 1) parts.push(`INTERVAL=${input.interval}`);
    if (input.freq === 'WEEKLY' && input.byday?.length) parts.push(`BYDAY=${[...new Set(input.byday)].sort().map((d) => DAY_CODES[d]).join(',')}`);
    if (input.count) parts.push(`COUNT=${input.count}`);
    else if (input.until) parts.push(`UNTIL=${DateTime.fromJSDate(new Date(input.until)).toUTC().toFormat("yyyyMMdd'T'HHmmss'Z'")}`);
    return parts.join(';');
}

export function parseRRule(rule: string | null | undefined): ParsedRule | null {
    if (!rule) return null;
    const map = new Map(rule.replace(/^RRULE:/i, '').split(';').map((p) => p.split('=') as [string, string]).map(([k, v]) => [k?.toUpperCase(), v]));
    const freq = map.get('FREQ') as RecurrenceFreq;
    if (!['DAILY', 'WEEKLY', 'MONTHLY'].includes(freq)) return null;
    const untilRaw = map.get('UNTIL');
    const until = untilRaw ? DateTime.fromISO(untilRaw.replace(/^(\d{4})(\d{2})(\d{2})(T(\d{2})(\d{2})(\d{2}))?Z?$/, (_, y, m, d, __, h = '23', mi = '59', s = '59') => `${y}-${m}-${d}T${h}:${mi}:${s}Z`)) : null;
    return {
        freq,
        interval: Math.max(1, Number(map.get('INTERVAL') ?? 1) || 1),
        count: map.get('COUNT') ? Math.max(1, Number(map.get('COUNT'))) : null,
        until: until?.isValid ? until.toJSDate() : null,
        byday: (map.get('BYDAY') ?? '').split(',').map((c) => DAY_CODES.indexOf(c.trim().slice(-2).toUpperCase())).filter((d) => d >= 0),
    };
}

/** Structured form of a stored rule, for edit forms. */
export function describeRule(rule: string | null | undefined): RecurrenceInput | null {
    const p = parseRRule(rule);
    return p ? { freq: p.freq, interval: p.interval, count: p.count, until: p.until, byday: p.byday } : null;
}

/** Candidate series starts in order (unbounded generator; callers stop on COUNT / UNTIL / range). */
function* candidates(start: Date, tz: string, rule: ParsedRule): Generator<DateTime> {
    const base = DateTime.fromJSDate(start, { zone: tz });
    if (rule.freq === 'DAILY') {
        for (let k = 0; ; k++) yield base.plus({ days: k * rule.interval });
    }
    if (rule.freq === 'MONTHLY') {
        for (let k = 0; ; k++) {
            const c = base.plus({ months: k * rule.interval });
            if (c.day === base.day) yield c; // months without that day are skipped (RFC 5545)
        }
    }
    // WEEKLY
    const days = rule.byday.length ? [...rule.byday].sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7)) : [base.weekday % 7];
    const weekStart = base.startOf('week'); // Monday
    for (let w = 0; ; w++) {
        const week = weekStart.plus({ weeks: w * rule.interval });
        for (const d of days) {
            const c = week.plus({ days: (d + 6) % 7 }).set({ hour: base.hour, minute: base.minute, second: base.second, millisecond: base.millisecond });
            if (c < base) continue;
            yield c;
        }
    }
}

/** Occurrences of a series that overlap [from, to). Non-recurring events return themselves when they overlap. */
export function expandOccurrences(start: Date, end: Date, rule: string | null | undefined, tz: string, from: Date, to: Date, exdates: Date[] = [], limit = 1000): Occurrence[] {
    const duration = end.getTime() - start.getTime();
    const parsed = parseRRule(rule);
    if (!parsed) return start < to && end > from ? [{ start, end }] : [];
    const excluded = new Set(exdates.map((d) => d.getTime()));
    const out: Occurrence[] = [];
    let n = 0;
    let i = 0;
    for (const c of candidates(start, tz || 'UTC', parsed)) {
        if (++i > MAX_ITERATIONS) break;
        const s = c.toJSDate();
        if (parsed.until && s > parsed.until) break;
        n++;
        if (parsed.count && n > parsed.count) break;
        if (s >= to) break;
        const e = new Date(s.getTime() + duration);
        if (e > from && !excluded.has(s.getTime())) out.push({ start: s, end: e });
        if (out.length >= limit) break;
    }
    return out;
}

/** End of the last occurrence (null = endless series); stored in CalendarEvent.recurrence_ends_at for range queries. */
export function seriesEndsAt(start: Date, end: Date, rule: string | null | undefined, tz: string): Date | null {
    const parsed = parseRRule(rule);
    if (!parsed) return end;
    if (!parsed.count && !parsed.until) return null;
    const far = new Date(start.getTime() + 1000 * 60 * 60 * 24 * 366 * 20);
    const all = expandOccurrences(start, end, rule, tz, start, far, [], MAX_ITERATIONS);
    return all.length ? all[all.length - 1].end : end;
}

/** First occurrence starting at or after `after`. */
export function nextOccurrence(start: Date, end: Date, rule: string | null | undefined, tz: string, after: Date, exdates: Date[] = []): Occurrence | null {
    if (!parseRRule(rule)) return start >= after ? { start, end } : null;
    const horizon = new Date(after.getTime() + 1000 * 60 * 60 * 24 * 400);
    const list = expandOccurrences(start, end, rule, tz, after, horizon, exdates, 50);
    return list.find((o) => o.start >= after) ?? null;
}
