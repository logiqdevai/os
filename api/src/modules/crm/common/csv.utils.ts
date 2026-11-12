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

/**
 * RFC 4180 CSV reader (imports, 02 §22): quoted fields, escaped quotes, CRLF/LF, a UTF-8 BOM, and `;` or tab
 * delimiters (detected from the header line). Returns rows of trimmed cells; blank lines are dropped.
 */
export function parseCsv(text: string): string[][] {
    const src = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
    const firstLine = src.slice(0, src.search(/\r?\n/) === -1 ? src.length : src.search(/\r?\n/));
    const counts = { ',': (firstLine.match(/,/g) ?? []).length, ';': (firstLine.match(/;/g) ?? []).length, '\t': (firstLine.match(/\t/g) ?? []).length };
    const delim = (Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[1] ? Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0] : ',') as string;
    const rows: string[][] = [];
    let row: string[] = [];
    let cell = '';
    let quoted = false;
    for (let i = 0; i < src.length; i++) {
        const ch = src[i];
        if (quoted) {
            if (ch === '"') {
                if (src[i + 1] === '"') { cell += '"'; i++; } else quoted = false;
            } else cell += ch;
            continue;
        }
        if (ch === '"' && cell === '') quoted = true;
        else if (ch === delim) { row.push(cell); cell = ''; }
        else if (ch === '\n' || ch === '\r') {
            if (ch === '\r' && src[i + 1] === '\n') i++;
            row.push(cell); cell = '';
            if (row.some((c) => c.trim() !== '')) rows.push(row.map((c) => c.trim()));
            row = [];
        } else cell += ch;
    }
    row.push(cell);
    if (row.some((c) => c.trim() !== '')) rows.push(row.map((c) => c.trim()));
    return rows;
}
