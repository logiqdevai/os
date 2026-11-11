/** Minimal RFC 4180 CSV writer (exports, 02 §22). Neutralises spreadsheet formula injection. */
export function toCsv(headers: string[], rows: (string | number | boolean | null | undefined | Date)[][]): string {
    const cell = (v: unknown) => {
        if (v === null || v === undefined) return '';
        let s = v instanceof Date ? v.toISOString() : String(v);
        if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
        return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    return [headers.map(cell).join(','), ...rows.map((r) => r.map(cell).join(','))].join('\r\n');
}

export interface CsvExport {
    filename: string;
    content: string;
    count: number;
}

export const memberLabel = (m: { user?: { display_name?: string | null; first_name?: string | null; last_name?: string | null; email?: string | null } | null } | null | undefined) =>
    m?.user ? m.user.display_name || [m.user.first_name, m.user.last_name].filter(Boolean).join(' ') || m.user.email || '' : '';
