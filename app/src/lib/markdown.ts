/**
 * Minimal, safe markdown → HTML for document bodies (proposal sections, contract clauses).
 * Everything is HTML-escaped first, so user text can never inject markup. Supports headings (#..###), **bold**, *italic*,
 * `code`, [links](https://…), bullet and numbered lists, blockquotes and paragraphs. Unresolved {{variables}} are highlighted.
 */
const escape = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string);

function inline(text: string) {
    return escape(text)
        .replace(/`([^`]+)`/g, '<code class="rounded bg-secondary px-1 text-[0.92em]">$1</code>')
        .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
        .replace(/(^|[^*])\*([^*]+)\*/g, "$1<em>$2</em>")
        .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-info underline">$1</a>')
        .replace(/\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g, '<span class="rounded bg-warning-soft px-1 font-mono text-[0.85em] text-warning">{{$1}}</span>');
}

export function renderMarkdown(source: string | null | undefined): string {
    if (!source) return "";
    const lines = source.replace(/\r\n/g, "\n").split("\n");
    const out: string[] = [];
    let list: "ul" | "ol" | null = null;
    let para: string[] = [];
    const flushPara = () => {
        if (para.length) out.push(`<p>${para.map(inline).join("<br/>")}</p>`);
        para = [];
    };
    const closeList = () => {
        if (list) out.push(`</${list}>`);
        list = null;
    };
    for (const raw of lines) {
        const line = raw.trimEnd();
        const heading = /^(#{1,3})\s+(.*)$/.exec(line);
        const bullet = /^\s*[-*]\s+(.*)$/.exec(line);
        const numbered = /^\s*\d+[.)]\s+(.*)$/.exec(line);
        const quote = /^>\s?(.*)$/.exec(line);
        if (!line.trim()) {
            flushPara();
            closeList();
        } else if (heading) {
            flushPara();
            closeList();
            const level = heading[1].length + 1;
            out.push(`<h${level}>${inline(heading[2])}</h${level}>`);
        } else if (bullet || numbered) {
            flushPara();
            const kind = bullet ? "ul" : "ol";
            if (list !== kind) {
                closeList();
                out.push(`<${kind}>`);
                list = kind;
            }
            out.push(`<li>${inline((bullet ?? numbered)![1])}</li>`);
        } else if (quote) {
            flushPara();
            closeList();
            out.push(`<blockquote>${inline(quote[1])}</blockquote>`);
        } else {
            closeList();
            para.push(line);
        }
    }
    flushPara();
    closeList();
    return out.join("");
}

/** Tailwind classes for rendered markdown (semantic tokens only, works in light and dark). */
export const markdownClass =
    "text-[14px] leading-relaxed text-foreground [&_h2]:mt-4 [&_h2]:mb-2 [&_h2]:text-lg [&_h2]:font-medium [&_h3]:mt-3 [&_h3]:mb-1.5 [&_h3]:font-medium [&_h4]:mt-3 [&_h4]:font-medium [&_p]:my-2 [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:my-0.5 [&_blockquote]:my-2 [&_blockquote]:border-l-2 [&_blockquote]:border-border [&_blockquote]:pl-3 [&_blockquote]:text-muted-foreground";
