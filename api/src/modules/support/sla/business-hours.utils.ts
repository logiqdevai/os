/**
 * Business-hours arithmetic for SLA targets (13 §2, §7). Organization.business_hours (01 §14) may be either
 * `{ start: "09:00", end: "17:00" }` (with Organization.working_days = ISO weekdays [1..7]) or per weekday
 * `{ mon: { start, end } | null, tue: … }`. Anything unparseable falls back to Mon–Fri 09:00–17:00.
 */
export interface BusinessHours {
    timezone: string;
    /** ISO weekday (1 = Monday … 7 = Sunday) → [startMinute, endMinute) local time. */
    days: Map<number, [number, number]>;
}

const DAY_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

const toMinutes = (v: unknown): number | null => {
    if (typeof v !== 'string') return null;
    const m = /^(\d{1,2}):(\d{2})$/.exec(v.trim());
    if (!m) return null;
    const n = Number(m[1]) * 60 + Number(m[2]);
    return n >= 0 && n <= 24 * 60 ? n : null;
};

export function parseBusinessHours(raw: unknown, workingDays: unknown, timezone: string): BusinessHours {
    const days = new Map<number, [number, number]>();
    const obj = raw && typeof raw === 'object' ? (raw as Record<string, any>) : null;
    if (obj && DAY_KEYS.some((k) => k in obj)) {
        DAY_KEYS.forEach((k, i) => {
            const d = obj[k];
            const s = toMinutes(d?.start);
            const e = toMinutes(d?.end);
            if (s !== null && e !== null && e > s) days.set(i + 1, [s, e]);
        });
    } else {
        const s = toMinutes(obj?.start) ?? 9 * 60;
        const e = toMinutes(obj?.end) ?? 17 * 60;
        const list = Array.isArray(workingDays) && workingDays.every((d) => Number.isInteger(d) && d >= 1 && d <= 7) ? (workingDays as number[]) : [1, 2, 3, 4, 5];
        if (e > s) list.forEach((d) => days.set(d, [s, e]));
    }
    if (!days.size) [1, 2, 3, 4, 5].forEach((d) => days.set(d, [9 * 60, 17 * 60]));
    return { timezone: safeZone(timezone), days };
}

function safeZone(tz: string) {
    try {
        new Intl.DateTimeFormat('en-US', { timeZone: tz });
        return tz;
    } catch {
        return 'UTC';
    }
}

const WEEKDAY: Record<string, number> = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };

function localParts(date: Date, tz: string) {
    const parts = new Intl.DateTimeFormat('en-US', { timeZone: tz, weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(date);
    const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '0';
    return { weekday: WEEKDAY[get('weekday')] ?? 1, minute: Number(get('hour')) * 60 + Number(get('minute')) };
}

/** Add `minutes` of working time to `start`. */
export function addBusinessMinutes(start: Date, minutes: number, bh: BusinessHours): Date {
    let cursor = new Date(start.getTime());
    let remaining = minutes;
    for (let guard = 0; guard < 400 && remaining > 0; guard++) {
        const { weekday, minute } = localParts(cursor, bh.timezone);
        const window = bh.days.get(weekday);
        if (!window || minute >= window[1]) {
            // Jump to the next local midnight.
            cursor = new Date(cursor.getTime() + (24 * 60 - minute) * 60_000);
            cursor.setUTCSeconds(0, 0);
            continue;
        }
        if (minute < window[0]) {
            cursor = new Date(cursor.getTime() + (window[0] - minute) * 60_000);
            continue;
        }
        const available = window[1] - minute;
        const used = Math.min(available, remaining);
        cursor = new Date(cursor.getTime() + used * 60_000);
        remaining -= used;
    }
    return cursor;
}

/** Working minutes between two instants (approximate to the minute). */
export function businessMinutesBetween(from: Date, to: Date, bh: BusinessHours): number {
    if (to <= from) return 0;
    let cursor = new Date(from.getTime());
    let total = 0;
    for (let guard = 0; guard < 400 && cursor < to; guard++) {
        const { weekday, minute } = localParts(cursor, bh.timezone);
        const window = bh.days.get(weekday);
        if (!window || minute >= window[1]) {
            cursor = new Date(cursor.getTime() + (24 * 60 - minute) * 60_000);
            continue;
        }
        if (minute < window[0]) {
            cursor = new Date(cursor.getTime() + (window[0] - minute) * 60_000);
            continue;
        }
        const end = new Date(cursor.getTime() + (window[1] - minute) * 60_000);
        const stop = end < to ? end : to;
        total += (stop.getTime() - cursor.getTime()) / 60_000;
        cursor = stop;
    }
    return Math.round(total);
}
