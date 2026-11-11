/** Date helpers for @db.Date columns (stored as UTC midnight). All dates travel as `YYYY-MM-DD`. */

export const DAY_MS = 86_400_000;

export function toDateOnly(value: string | Date): Date {
    if (value instanceof Date) return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
    return new Date(`${value.slice(0, 10)}T00:00:00.000Z`);
}

export const isoDate = (d: Date) => d.toISOString().slice(0, 10);

export const addDays = (d: Date, days: number) => new Date(d.getTime() + days * DAY_MS);

export const todayUtc = () => toDateOnly(new Date());

/**
 * Start of the period containing `date`. `weekStart` follows JS getUTCDay (0 = Sunday, 1 = Monday …);
 * TimeTrackingSettings.week_start null means Monday.
 */
export function weekStartOf(date: Date, weekStart: number | null | undefined): Date {
    const ws = weekStart ?? 1;
    const d = toDateOnly(date);
    const diff = (d.getUTCDay() - ws + 7) % 7;
    return addDays(d, -diff);
}

export function weekPeriod(date: Date, weekStart: number | null | undefined) {
    const start = weekStartOf(date, weekStart);
    return { period_start: start, period_end: addDays(start, 6) };
}

/** Working days (Mon–Fri) between two dates inclusive. */
export function workingDays(from: Date, to: Date): number {
    let n = 0;
    for (let d = toDateOnly(from); d <= to; d = addDays(d, 1)) {
        const wd = d.getUTCDay();
        if (wd !== 0 && wd !== 6) n++;
    }
    return n;
}

export const round2 = (n: number) => Math.round(n * 100) / 100;
