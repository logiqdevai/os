import { format, formatDistanceToNowStrict, isValid, parseISO } from "date-fns";

const toDate = (value: string | Date | null | undefined): Date | null => {
    if (!value) return null;
    const d = typeof value === "string" ? parseISO(value) : value;
    return isValid(d) ? d : null;
};

export const formatDate = (value: string | Date | null | undefined, pattern = "d MMM yyyy") => {
    const d = toDate(value);
    return d ? format(d, pattern) : "—";
};

export const formatDateTime = (value: string | Date | null | undefined) => formatDate(value, "d MMM yyyy, HH:mm");

export const formatRelative = (value: string | Date | null | undefined) => {
    const d = toDate(value);
    return d ? `${formatDistanceToNowStrict(d)} ago` : "—";
};

/** Money from a decimal string/number or integer cents (`cents: true`). */
export const formatMoney = (amount: number | string | null | undefined, currency = "EUR", opts: { cents?: boolean; compact?: boolean } = {}) => {
    if (amount === null || amount === undefined || amount === "") return "—";
    let n = typeof amount === "string" ? Number(amount) : amount;
    if (Number.isNaN(n)) return "—";
    if (opts.cents) n = n / 100;
    try {
        return new Intl.NumberFormat(undefined, { style: "currency", currency, notation: opts.compact ? "compact" : "standard", maximumFractionDigits: opts.compact ? 1 : 2 }).format(n);
    } catch {
        return `${n.toFixed(2)} ${currency}`;
    }
};

export const formatNumber = (n: number | string | null | undefined, digits = 0) => {
    if (n === null || n === undefined || n === "") return "—";
    const v = typeof n === "string" ? Number(n) : n;
    return Number.isNaN(v) ? "—" : new Intl.NumberFormat(undefined, { maximumFractionDigits: digits }).format(v);
};

export const formatPercent = (n: number | null | undefined, digits = 0) => (n === null || n === undefined ? "—" : `${n.toFixed(digits)}%`);

/** Minutes → "3h 20m". */
export const formatMinutes = (minutes: number | null | undefined) => {
    if (!minutes) return "0h";
    const h = Math.floor(minutes / 60);
    const m = Math.round(minutes % 60);
    return h ? (m ? `${h}h ${m}m` : `${h}h`) : `${m}m`;
};

export const initials = (name: string | null | undefined) =>
    (name ?? "?")
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((p) => p[0]?.toUpperCase())
        .join("") || "?";

export const personName = (p: { display_name?: string | null; first_name?: string | null; last_name?: string | null; email?: string | null } | null | undefined) =>
    p ? p.display_name || [p.first_name, p.last_name].filter(Boolean).join(" ") || p.email || "Unknown" : "Unknown";
