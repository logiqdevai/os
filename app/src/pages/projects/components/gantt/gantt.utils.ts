/** Date math for the Gantt in whole UTC days (API dates are `@db.Date`, serialized as midnight UTC). */

export const DAY_MS = 86_400_000;

/** `2026-11-12` or ISO string → day number (days since epoch, UTC). */
export const toDay = (value: string | null | undefined): number | null => {
    if (!value) return null;
    const t = Date.parse(value.length === 10 ? `${value}T00:00:00Z` : value);
    return Number.isNaN(t) ? null : Math.floor(t / DAY_MS);
};

/** Day number → `YYYY-MM-DD`. */
export const dayToIso = (day: number) => new Date(day * DAY_MS).toISOString().slice(0, 10);

export const todayDay = () => {
    const now = new Date();
    return Math.floor(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) / DAY_MS);
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export const formatDay = (day: number, withYear = false) => {
    const d = new Date(day * DAY_MS);
    return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}${withYear ? ` ${d.getUTCFullYear()}` : ""}`;
};

export const monthLabel = (day: number) => {
    const d = new Date(day * DAY_MS);
    return `${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
};

/** First day of every month between two day numbers (inclusive). */
export const monthStarts = (from: number, to: number) => {
    const out: number[] = [];
    const d = new Date(from * DAY_MS);
    let cursor = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1);
    while (cursor / DAY_MS <= to) {
        out.push(Math.floor(cursor / DAY_MS));
        const c = new Date(cursor);
        cursor = Date.UTC(c.getUTCFullYear(), c.getUTCMonth() + 1, 1);
    }
    return out;
};

/** Mondays between two day numbers (day 0 = Thursday 1 Jan 1970, so Monday ≡ 4 mod 7). */
export const mondays = (from: number, to: number) => {
    const out: number[] = [];
    let first = from + ((4 - (from % 7) + 7) % 7);
    for (; first <= to; first += 7) out.push(first);
    return out;
};

export type GanttZoom = "week" | "month" | "quarter";
export const PX_PER_DAY: Record<GanttZoom, number> = { week: 30, month: 10, quarter: 4 };
