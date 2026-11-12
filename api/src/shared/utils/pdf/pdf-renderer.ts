import { PDFDocument, PDFFont, PDFImage, PDFPage, RGB, StandardFonts, rgb } from 'pdf-lib';
import { PdfBlock, PdfDocumentModel, PdfTableColumn } from './pdf-document.interfaces';

/*
 * Small, dependency-light PDF layout engine on top of pdf-lib: A4 pages, wrapped text, headings, markdown,
 * key/value lists, tables with repeated headers, images, branded header and page footers ("Page x of y").
 * Standard PDF fonts only (WinAnsi): text is transliterated / sanitized so any input renders.
 */

const PAGE: [number, number] = [595.28, 841.89];
const MARGIN_X = 50;
const MARGIN_TOP = 56;
const MARGIN_BOTTOM = 60;
const CONTENT_W = PAGE[0] - MARGIN_X * 2;

const INK = rgb(0.067, 0.094, 0.153);
const MUTED = rgb(0.42, 0.45, 0.5);
const RULE = rgb(0.86, 0.87, 0.89);
const ZEBRA = rgb(0.965, 0.969, 0.976);

const GREEK: Record<string, string> = {
    α: 'a', β: 'v', γ: 'g', δ: 'd', ε: 'e', ζ: 'z', η: 'i', θ: 'th', ι: 'i', κ: 'k', λ: 'l', μ: 'm', ν: 'n', ξ: 'x', ο: 'o', π: 'p', ρ: 'r', σ: 's', ς: 's', τ: 't', υ: 'y', φ: 'f', χ: 'ch', ψ: 'ps', ω: 'o',
    ά: 'a', έ: 'e', ή: 'i', ί: 'i', ό: 'o', ύ: 'y', ώ: 'o', ϊ: 'i', ϋ: 'y', ΐ: 'i', ΰ: 'y',
};
/** Characters outside Latin-1 that WinAnsi (standard fonts) can still encode. */
const WIN_ANSI_EXTRA = new Set('€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ');

/** Make text encodable by the standard PDF fonts (WinAnsi). */
export function pdfSafe(input: string | null | undefined): string {
    if (!input) return '';
    let out = '';
    for (const ch of input.normalize('NFC')) {
        const code = ch.codePointAt(0)!;
        if (ch === '\t') out += '    ';
        else if (ch === '\r') continue;
        else if (ch === '\n' || (code >= 32 && code <= 126) || (code >= 160 && code <= 255) || WIN_ANSI_EXTRA.has(ch)) out += ch;
        else if (ch === '−' || ch === '‐' || ch === '‑') out += '-';
        else if (ch === '→') out += '->';
        else if (ch === '✓' || ch === '✔') out += 'v';
        else if (ch === ' ' || ch === ' ' || ch === ' ') out += ' ';
        else {
            const lower = ch.toLowerCase();
            const t = GREEK[lower];
            if (t) out += ch === lower ? t : t.charAt(0).toUpperCase() + t.slice(1);
            else {
                const base = ch.normalize('NFD').replace(/[̀-ͯ]/g, '');
                const bc = base.codePointAt(0) ?? 0;
                out += base && bc >= 32 && bc <= 255 ? base : '?';
            }
        }
    }
    return out;
}

function hexToRgb(hex: string | null | undefined): RGB {
    const m = /^#?([0-9a-f]{6})$/i.exec(hex ?? '');
    if (!m) return INK;
    const n = parseInt(m[1], 16);
    return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
}

/** Strip inline markdown marks: **bold**, _em_, `code`, [label](url) → label (url). */
export function stripInlineMarkdown(text: string): string {
    return text
        .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
        .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1 ($2)')
        .replace(/(\*\*|__)(.+?)\1/g, '$2')
        .replace(/(^|[\s(])[*_]([^*_\n]+)[*_](?=[\s).,;:!?]|$)/g, '$1$2')
        .replace(/`([^`]+)`/g, '$1')
        .replace(/~~(.+?)~~/g, '$1');
}

class Layout {
    page!: PDFPage;
    y = 0;
    readonly pages: PDFPage[] = [];

    constructor(
        readonly doc: PDFDocument,
        readonly regular: PDFFont,
        readonly bold: PDFFont,
        readonly accent: RGB,
    ) { }

    newPage() {
        this.page = this.doc.addPage(PAGE);
        this.pages.push(this.page);
        this.page.drawRectangle({ x: 0, y: PAGE[1] - 5, width: PAGE[0], height: 5, color: this.accent });
        this.y = PAGE[1] - MARGIN_TOP;
    }

    ensure(height: number) {
        if (this.y - height < MARGIN_BOTTOM) this.newPage();
    }

    wrap(text: string, font: PDFFont, size: number, width: number): string[] {
        const lines: string[] = [];
        for (const para of pdfSafe(text).split('\n')) {
            const words = para.split(/ +/);
            let line = '';
            for (const word of words) {
                const candidate = line ? `${line} ${word}` : word;
                if (font.widthOfTextAtSize(candidate, size) <= width) {
                    line = candidate;
                    continue;
                }
                if (line) lines.push(line);
                // A single word longer than the line: hard-break it.
                let rest = word;
                while (font.widthOfTextAtSize(rest, size) > width && rest.length > 1) {
                    let cut = rest.length - 1;
                    while (cut > 1 && font.widthOfTextAtSize(rest.slice(0, cut), size) > width) cut--;
                    lines.push(rest.slice(0, cut));
                    rest = rest.slice(cut);
                }
                line = rest;
            }
            lines.push(line);
        }
        return lines;
    }

    text(text: string, opts: { size?: number; font?: PDFFont; color?: RGB; indent?: number; gapAfter?: number; lineGap?: number; width?: number } = {}) {
        const size = opts.size ?? 10.5;
        const font = opts.font ?? this.regular;
        const indent = opts.indent ?? 0;
        const lh = size * (opts.lineGap ?? 1.42);
        for (const line of this.wrap(text, font, size, (opts.width ?? CONTENT_W) - indent)) {
            this.ensure(lh);
            this.page.drawText(line, { x: MARGIN_X + indent, y: this.y - size, size, font, color: opts.color ?? INK });
            this.y -= lh;
        }
        this.y -= opts.gapAfter ?? 0;
    }

    divider(gap = 10) {
        this.ensure(gap * 2);
        this.y -= gap;
        this.page.drawLine({ start: { x: MARGIN_X, y: this.y }, end: { x: PAGE[0] - MARGIN_X, y: this.y }, thickness: 0.6, color: RULE });
        this.y -= gap;
    }
}

function renderMarkdown(l: Layout, markdown: string) {
    const lines = markdown.replace(/\r/g, '').split('\n');
    let para: string[] = [];
    const flush = () => {
        if (para.length) l.text(stripInlineMarkdown(para.join(' ')), { gapAfter: 6 });
        para = [];
    };
    for (const raw of lines) {
        const line = raw.trimEnd();
        const heading = /^(#{1,6})\s+(.*)$/.exec(line);
        const bullet = /^(\s*)[-*+]\s+(.*)$/.exec(line);
        const numbered = /^(\s*)(\d+)[.)]\s+(.*)$/.exec(line);
        if (!line.trim()) { flush(); continue; }
        if (/^\s*\|?\s*:?-{3,}/.test(line) && line.includes('-') && /^[\s|:-]+$/.test(line)) continue; // table separator
        if (/^(-{3,}|\*{3,}|_{3,})$/.test(line.trim())) { flush(); l.divider(6); continue; }
        if (heading) {
            flush();
            const level = heading[1].length;
            l.ensure(28);
            l.y -= 4;
            l.text(stripInlineMarkdown(heading[2]), { size: level <= 1 ? 14 : level === 2 ? 12.5 : 11, font: l.bold, gapAfter: 3 });
            continue;
        }
        if (bullet || numbered) {
            flush();
            const depth = Math.min(3, Math.floor(((bullet?.[1] ?? numbered?.[1]) ?? '').length / 2));
            const indent = 12 + depth * 14;
            const marker = bullet ? '•' : `${numbered![2]}.`;
            const body = stripInlineMarkdown(bullet ? bullet[2] : numbered![3]);
            l.ensure(15);
            l.page.drawText(pdfSafe(marker), { x: MARGIN_X + indent - 11, y: l.y - 10.5, size: 10.5, font: l.regular, color: MUTED });
            l.text(body.replace(/^\[( |x)\]\s*/i, (m) => (/x/i.test(m) ? '[x] ' : '[ ] ')), { indent, gapAfter: 2 });
            continue;
        }
        if (line.trim().startsWith('|')) {
            flush();
            l.text(stripInlineMarkdown(line.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim()).join('   |   ')), { size: 9.5, gapAfter: 1 });
            continue;
        }
        if (/^>\s?/.test(line)) {
            flush();
            l.text(stripInlineMarkdown(line.replace(/^>\s?/, '')), { indent: 12, color: MUTED, gapAfter: 2 });
            continue;
        }
        para.push(line.trim());
    }
    flush();
}

function columnWidths(columns: PdfTableColumn[]) {
    const total = columns.reduce((s, c) => s + c.width, 0) || 1;
    return columns.map((c) => (c.width / total) * CONTENT_W);
}

function renderTable(l: Layout, block: Extract<PdfBlock, { kind: 'table' }>) {
    const widths = columnWidths(block.columns);
    const size = 9.5;
    const pad = 5;
    const lh = size * 1.35;
    const drawRow = (cells: string[], opts: { header?: boolean; zebra?: boolean }) => {
        const font = opts.header ? l.bold : l.regular;
        const wrapped = cells.map((c, i) => l.wrap(c ?? '', font, size, widths[i] - pad * 2));
        const height = Math.max(...wrapped.map((w) => w.length)) * lh + pad * 2;
        return { wrapped, height, font, draw: () => {
            if (opts.header || opts.zebra) l.page.drawRectangle({ x: MARGIN_X, y: l.y - height, width: CONTENT_W, height, color: opts.header ? ZEBRA : rgb(0.985, 0.986, 0.99) });
            let x = MARGIN_X;
            wrapped.forEach((lines, i) => {
                const col = block.columns[i];
                lines.forEach((line, li) => {
                    const w = font.widthOfTextAtSize(line, size);
                    const tx = col?.align === 'right' ? x + widths[i] - pad - w : x + pad;
                    l.page.drawText(line, { x: tx, y: l.y - pad - size - li * lh + 1.5, size, font, color: opts.header ? MUTED : INK });
                });
                x += widths[i];
            });
            l.page.drawLine({ start: { x: MARGIN_X, y: l.y - height }, end: { x: PAGE[0] - MARGIN_X, y: l.y - height }, thickness: 0.5, color: RULE });
            l.y -= height;
        } };
    };
    const header = () => {
        const h = drawRow(block.columns.map((c) => c.label.toUpperCase()), { header: true });
        l.ensure(h.height + 20);
        h.draw();
    };
    header();
    block.rows.forEach((cells, idx) => {
        const row = drawRow(cells, { zebra: idx % 2 === 1 });
        if (l.y - row.height < MARGIN_BOTTOM) {
            l.newPage();
            header();
        }
        row.draw();
    });
    if (block.totals?.length) {
        l.y -= 6;
        const labelW = CONTENT_W * 0.7;
        for (const [label, value] of block.totals) {
            const isGrand = label === block.totals[block.totals.length - 1][0];
            const font = isGrand ? l.bold : l.regular;
            const s = isGrand ? 11 : 10;
            l.ensure(s * 1.6);
            const lw = font.widthOfTextAtSize(pdfSafe(label), s);
            const vw = font.widthOfTextAtSize(pdfSafe(value), s);
            l.page.drawText(pdfSafe(label), { x: MARGIN_X + labelW - lw, y: l.y - s, size: s, font, color: isGrand ? INK : MUTED });
            l.page.drawText(pdfSafe(value), { x: PAGE[0] - MARGIN_X - pad - vw, y: l.y - s, size: s, font, color: INK });
            l.y -= s * 1.6;
        }
    }
    l.y -= 10;
}

function renderKeyValues(l: Layout, rows: [string, string][], size = 9.5) {
    const labelW = 140;
    for (const [k, v] of rows) {
        const lines = l.wrap(v || '—', l.regular, size, CONTENT_W - labelW);
        const lh = size * 1.45;
        l.ensure(lines.length * lh);
        l.page.drawText(pdfSafe(k), { x: MARGIN_X, y: l.y - size, size, font: l.bold, color: MUTED });
        lines.forEach((line, i) => l.page.drawText(line, { x: MARGIN_X + labelW, y: l.y - size - i * lh, size, font: l.regular, color: INK }));
        l.y -= lines.length * lh;
    }
    l.y -= 8;
}

async function embedImage(doc: PDFDocument, bytes: Uint8Array, type: 'png' | 'jpg'): Promise<PDFImage | null> {
    try {
        return type === 'png' ? await doc.embedPng(bytes) : await doc.embedJpg(bytes);
    } catch {
        return null;
    }
}

/** Render the model to PDF bytes. */
export async function renderPdf(model: PdfDocumentModel): Promise<Buffer> {
    const doc = await PDFDocument.create();
    const created = model.created_at ?? new Date();
    doc.setTitle(pdfSafe(model.title));
    doc.setAuthor(pdfSafe(model.author ?? model.branding.organization_name));
    if (model.subject) doc.setSubject(pdfSafe(model.subject));
    if (model.keywords?.length) doc.setKeywords(model.keywords.map(pdfSafe));
    doc.setCreator('Logiqdev OS');
    doc.setProducer('Logiqdev OS');
    doc.setCreationDate(created);
    doc.setModificationDate(created);

    const regular = await doc.embedFont(StandardFonts.Helvetica);
    const bold = await doc.embedFont(StandardFonts.HelveticaBold);
    const accent = hexToRgb(model.branding.primary_color);
    const l = new Layout(doc, regular, bold, accent);
    l.newPage();

    // Branded header: logo (or organization name) left, organization name right.
    const logo = model.branding.logo ? await embedImage(doc, model.branding.logo.bytes, model.branding.logo.type) : null;
    const top = l.y;
    if (logo) {
        const scale = Math.min(140 / logo.width, 36 / logo.height, 1);
        l.page.drawImage(logo, { x: MARGIN_X, y: top - logo.height * scale, width: logo.width * scale, height: logo.height * scale });
    } else {
        l.page.drawText(pdfSafe(model.branding.organization_name), { x: MARGIN_X, y: top - 14, size: 14, font: bold, color: accent });
    }
    const orgName = pdfSafe(model.branding.organization_name);
    const ow = regular.widthOfTextAtSize(orgName, 9);
    if (logo) l.page.drawText(orgName, { x: PAGE[0] - MARGIN_X - ow, y: top - 10, size: 9, font: regular, color: MUTED });
    l.y = top - 56;

    if (model.eyebrow) l.text(model.eyebrow.toUpperCase(), { size: 8.5, font: bold, color: accent, gapAfter: 2 });
    l.text(model.title, { size: 20, font: bold, lineGap: 1.25, gapAfter: 2 });
    if (model.subtitle) l.text(model.subtitle, { size: 11, color: MUTED, gapAfter: 4 });
    l.y -= 6;
    if (model.meta?.length) renderKeyValues(l, model.meta);
    l.divider(6);

    for (const block of model.blocks) {
        switch (block.kind) {
            case 'heading': {
                const size = block.level === 3 ? 11 : block.level === 2 ? 12.5 : 14.5;
                l.ensure(size * 3.5);
                l.y -= block.level === 3 ? 4 : 10;
                l.text(block.text, { size, font: l.bold, gapAfter: 4, color: block.level === 1 || !block.level ? accent : INK });
                break;
            }
            case 'paragraph':
                l.text(block.text, { size: block.size ?? 10.5, color: block.muted ? MUTED : INK, font: block.bold ? l.bold : l.regular, gapAfter: 6 });
                break;
            case 'markdown':
                renderMarkdown(l, block.text);
                break;
            case 'key_values':
                renderKeyValues(l, block.rows);
                break;
            case 'table':
                renderTable(l, block);
                break;
            case 'image': {
                const img = await embedImage(doc, block.bytes, block.type);
                if (!img) break;
                const scale = Math.min((block.max_width ?? 180) / img.width, (block.max_height ?? 60) / img.height, 1);
                const h = img.height * scale;
                l.ensure(h + 18);
                l.page.drawImage(img, { x: MARGIN_X, y: l.y - h, width: img.width * scale, height: h });
                l.y -= h + 2;
                if (block.caption) l.text(block.caption, { size: 8.5, color: MUTED });
                l.y -= 6;
                break;
            }
            case 'spacer':
                l.y -= block.height ?? 10;
                break;
            case 'divider':
                l.divider();
                break;
            case 'page_break':
                l.newPage();
                break;
        }
    }

    // Footers once the page count is known.
    const footer = pdfSafe(model.branding.footer ?? model.branding.organization_name);
    l.pages.forEach((page, i) => {
        page.drawLine({ start: { x: MARGIN_X, y: 40 }, end: { x: PAGE[0] - MARGIN_X, y: 40 }, thickness: 0.5, color: RULE });
        let f = footer;
        while (f.length > 4 && regular.widthOfTextAtSize(f, 8) > CONTENT_W - 90) f = `${f.slice(0, -4)}...`;
        page.drawText(f, { x: MARGIN_X, y: 28, size: 8, font: regular, color: MUTED });
        const label = `Page ${i + 1} of ${l.pages.length}`;
        page.drawText(label, { x: PAGE[0] - MARGIN_X - regular.widthOfTextAtSize(label, 8), y: 28, size: 8, font: regular, color: MUTED });
    });

    return Buffer.from(await doc.save({ useObjectStreams: true }));
}
