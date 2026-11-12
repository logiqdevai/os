/**
 * Document model rendered to PDF by `renderPdf()` (shared by 03 Proposals, 04 Contracts, 08 Billing).
 * Modules build this model from their own records; the renderer owns layout, pagination, branding and fonts.
 */
export interface PdfBranding {
    organization_name: string;
    /** Hex color like #2563eb (Organization.branding.primary_color); defaults to a neutral ink. */
    primary_color?: string | null;
    /** PNG or JPEG bytes of the organization logo (fetched once by the caller; optional). */
    logo?: { bytes: Uint8Array; type: 'png' | 'jpg' } | null;
    /** Footer line on every page (Organization.branding.email_footer or address). */
    footer?: string | null;
}

export interface PdfTableColumn {
    label: string;
    /** Relative width weight. */
    width: number;
    align?: 'left' | 'right';
}

export type PdfBlock =
    | { kind: 'heading'; text: string; level?: 1 | 2 | 3 }
    | { kind: 'paragraph'; text: string; muted?: boolean; size?: number; bold?: boolean }
    /** Markdown body (headings, bullets, numbered lists, paragraphs; inline marks are stripped). */
    | { kind: 'markdown'; text: string }
    | { kind: 'key_values'; rows: [string, string][] }
    | { kind: 'table'; columns: PdfTableColumn[]; rows: string[][]; totals?: [string, string][] }
    | { kind: 'image'; bytes: Uint8Array; type: 'png' | 'jpg'; max_width?: number; max_height?: number; caption?: string }
    | { kind: 'spacer'; height?: number }
    | { kind: 'divider' }
    | { kind: 'page_break' };

export interface PdfDocumentModel {
    title: string;
    subtitle?: string | null;
    /** Small label above the title, e.g. "PROPOSAL" or "INVOICE". */
    eyebrow?: string | null;
    branding: PdfBranding;
    /** Key facts shown under the title (number, dates, customer …). */
    meta?: [string, string][];
    blocks: PdfBlock[];
    /** Document metadata (PDF info dictionary). */
    author?: string | null;
    subject?: string | null;
    keywords?: string[];
    /** Fixed creation date keeps the bytes stable for the same content. */
    created_at?: Date;
}
