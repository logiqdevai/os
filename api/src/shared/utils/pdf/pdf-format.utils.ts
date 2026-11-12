/** Formatting for generated documents (stable output: fixed locale, UTC dates). */

export function pdfMoney(value: unknown, currency: string | null | undefined): string {
    const n = value === null || value === undefined || value === '' ? 0 : Number(value);
    try {
        return new Intl.NumberFormat('en-IE', { style: 'currency', currency: currency || 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
    } catch {
        return `${n.toFixed(2)} ${currency ?? ''}`.trim();
    }
}

export function pdfNumber(value: unknown, digits = 2): string {
    const n = value === null || value === undefined || value === '' ? 0 : Number(value);
    return new Intl.NumberFormat('en-IE', { maximumFractionDigits: digits }).format(n);
}

export function pdfDate(value: Date | string | null | undefined): string {
    if (!value) return '—';
    const d = typeof value === 'string' ? new Date(value) : value;
    if (Number.isNaN(d.getTime())) return '—';
    return new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(d);
}

export function pdfDateTime(value: Date | string | null | undefined): string {
    if (!value) return '—';
    const d = typeof value === 'string' ? new Date(value) : value;
    if (Number.isNaN(d.getTime())) return '—';
    return `${new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false, timeZone: 'UTC' }).format(d)} UTC`;
}

/** Safe file name for a generated document, e.g. "PRO-2026-0001-v2.pdf". */
export function pdfFilename(...parts: (string | number | null | undefined)[]): string {
    return `${parts.filter((p) => p !== null && p !== undefined && p !== '').join('-').replace(/[^A-Za-z0-9._-]+/g, '_').slice(0, 120)}.pdf`;
}
