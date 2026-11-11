import { Fragment, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";

/**
 * Small, safe Markdown renderer (no HTML injection: everything becomes React elements).
 * Supports headings, paragraphs, bold/italic/strike, inline code, fenced code, links, [[wiki links]],
 * ordered/unordered/task lists, blockquotes, horizontal rules and simple pipe tables.
 */
export function Markdown({ source, className, resolveWikiLink }: { source: string | null | undefined; className?: string; resolveWikiLink?: (title: string) => string | null }) {
    const blocks = parseBlocks(source ?? "");
    return <div className={cn("space-y-3 text-[14px] leading-relaxed text-foreground", className)}>{blocks.map((b, i) => renderBlock(b, i, resolveWikiLink))}</div>;
}

type Block =
    | { type: "heading"; level: number; text: string }
    | { type: "paragraph"; text: string }
    | { type: "code"; lang: string; text: string }
    | { type: "list"; ordered: boolean; items: { text: string; checked: boolean | null }[] }
    | { type: "quote"; text: string }
    | { type: "table"; header: string[]; rows: string[][] }
    | { type: "hr" };

function parseBlocks(src: string): Block[] {
    const lines = src.replace(/\r\n?/g, "\n").split("\n");
    const out: Block[] = [];
    let i = 0;
    while (i < lines.length) {
        const line = lines[i];
        if (!line.trim()) { i++; continue; }
        const fence = line.match(/^```(\w*)/);
        if (fence) {
            const body: string[] = [];
            i++;
            while (i < lines.length && !lines[i].startsWith("```")) body.push(lines[i++]);
            i++;
            out.push({ type: "code", lang: fence[1], text: body.join("\n") });
            continue;
        }
        const h = line.match(/^(#{1,6})\s+(.*)$/);
        if (h) { out.push({ type: "heading", level: h[1].length, text: h[2] }); i++; continue; }
        if (/^(-{3,}|\*{3,}|_{3,})\s*$/.test(line)) { out.push({ type: "hr" }); i++; continue; }
        if (line.startsWith(">")) {
            const body: string[] = [];
            while (i < lines.length && lines[i].startsWith(">")) body.push(lines[i++].replace(/^>\s?/, ""));
            out.push({ type: "quote", text: body.join("\n") });
            continue;
        }
        if (/^\s*\|.*\|\s*$/.test(line) && i + 1 < lines.length && /^\s*\|?\s*:?-{2,}/.test(lines[i + 1])) {
            const cells = (l: string) => l.trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim());
            const header = cells(line);
            i += 2;
            const rows: string[][] = [];
            while (i < lines.length && /^\s*\|.*\|\s*$/.test(lines[i])) rows.push(cells(lines[i++]));
            out.push({ type: "table", header, rows });
            continue;
        }
        const li = line.match(/^\s*([-*+]|\d+[.)])\s+(.*)$/);
        if (li) {
            const ordered = /\d/.test(li[1]);
            const items: { text: string; checked: boolean | null }[] = [];
            while (i < lines.length) {
                const m = lines[i].match(/^\s*([-*+]|\d+[.)])\s+(.*)$/);
                if (!m) break;
                const task = m[2].match(/^\[( |x|X)\]\s+(.*)$/);
                items.push(task ? { text: task[2], checked: task[1].toLowerCase() === "x" } : { text: m[2], checked: null });
                i++;
            }
            out.push({ type: "list", ordered, items });
            continue;
        }
        const body: string[] = [];
        while (i < lines.length && lines[i].trim() && !/^(#{1,6}\s|```|>|\s*([-*+]|\d+[.)])\s)/.test(lines[i])) body.push(lines[i++]);
        // Always consume at least one line so an unexpected line shape can never stall the parser.
        if (!body.length) body.push(lines[i++]);
        out.push({ type: "paragraph", text: body.join("\n") });
    }
    return out;
}

const HEADING = ["text-2xl font-semibold", "text-xl font-semibold", "text-lg font-medium", "text-base font-medium", "text-sm font-medium", "text-sm font-medium text-muted-foreground"];

function renderBlock(b: Block, key: number, wiki?: (t: string) => string | null): ReactNode {
    switch (b.type) {
        case "heading": {
            const Tag = `h${b.level}` as "h1";
            return <Tag key={key} className={cn("pt-2 text-foreground", HEADING[b.level - 1])}>{inline(b.text, wiki)}</Tag>;
        }
        case "paragraph":
            return <p key={key}>{b.text.split("\n").map((l, j) => <Fragment key={j}>{j > 0 && <br />}{inline(l, wiki)}</Fragment>)}</p>;
        case "code":
            return <pre key={key} className="overflow-x-auto rounded-md border border-border bg-secondary p-3 font-mono text-xs leading-relaxed"><code>{b.text}</code></pre>;
        case "quote":
            return <blockquote key={key} className="border-l-2 border-border pl-3 text-muted-foreground">{inline(b.text, wiki)}</blockquote>;
        case "hr":
            return <hr key={key} className="border-border" />;
        case "table":
            return (
                <div key={key} className="overflow-x-auto rounded-md border border-border">
                    <table className="w-full text-[13px]">
                        <thead className="bg-secondary"><tr>{b.header.map((h, j) => <th key={j} className="px-3 py-1.5 text-left font-medium">{inline(h, wiki)}</th>)}</tr></thead>
                        <tbody>{b.rows.map((r, j) => <tr key={j} className="border-t border-border">{r.map((c, k) => <td key={k} className="px-3 py-1.5">{inline(c, wiki)}</td>)}</tr>)}</tbody>
                    </table>
                </div>
            );
        case "list": {
            const Tag = b.ordered ? "ol" : "ul";
            return (
                <Tag key={key} className={cn("space-y-1 pl-5", b.ordered ? "list-decimal" : b.items.some((x) => x.checked !== null) ? "list-none pl-1" : "list-disc")}>
                    {b.items.map((it, j) => (
                        <li key={j} className={cn(it.checked !== null && "flex items-start gap-2")}>
                            {it.checked !== null && <input type="checkbox" checked={it.checked} readOnly disabled className="mt-1 accent-[var(--info)]" aria-label={it.checked ? "Done" : "Open"} />}
                            <span className={cn(it.checked && "text-muted-foreground line-through")}>{inline(it.text, wiki)}</span>
                        </li>
                    ))}
                </Tag>
            );
        }
    }
}

const TOKEN = /(`[^`]+`)|(\*\*[^*]+\*\*)|(~~[^~]+~~)|(\*[^*\s][^*]*\*|_[^_\s][^_]*_)|(\[\[[^\]]+\]\])|(\[[^\]]+\]\([^)\s]+\))|(https?:\/\/[^\s)]+)/g;

function safeHref(href: string) {
    return /^(https?:|mailto:|\/|#)/i.test(href) ? href : null;
}

function inline(text: string, wiki?: (t: string) => string | null): ReactNode[] {
    const nodes: ReactNode[] = [];
    let last = 0;
    let m: RegExpExecArray | null;
    // A fresh regex per call: inline() recurses for **bold** / *italic*, and a shared /g regex would have its
    // lastIndex reset by the inner call, making the outer loop match the same token forever (frozen tab).
    const token = new RegExp(TOKEN.source, "g");
    let k = 0;
    while ((m = token.exec(text))) {
        if (m.index > last) nodes.push(text.slice(last, m.index));
        const t = m[0];
        if (m[1]) nodes.push(<code key={k++} className="rounded bg-secondary px-1 py-0.5 font-mono text-[0.85em]">{t.slice(1, -1)}</code>);
        else if (m[2]) nodes.push(<strong key={k++} className="font-semibold">{inline(t.slice(2, -2), wiki)}</strong>);
        else if (m[3]) nodes.push(<del key={k++}>{t.slice(2, -2)}</del>);
        else if (m[4]) nodes.push(<em key={k++}>{inline(t.slice(1, -1), wiki)}</em>);
        else if (m[5]) {
            const title = t.slice(2, -2);
            const href = wiki?.(title);
            nodes.push(href ? <Link key={k++} to={href} className="text-info underline-offset-2 hover:underline">{title}</Link> : <span key={k++} className="rounded bg-info-soft px-1 text-info">{title}</span>);
        } else if (m[6]) {
            const parts = t.match(/^\[([^\]]+)\]\(([^)\s]+)\)$/);
            const href = parts ? safeHref(parts[2]) : null;
            if (parts && href) nodes.push(href.startsWith("/") ? <Link key={k++} to={href} className="text-info underline-offset-2 hover:underline">{parts[1]}</Link> : <a key={k++} href={href} target="_blank" rel="noopener noreferrer" className="text-info underline-offset-2 hover:underline">{parts[1]}</a>);
            else nodes.push(t);
        } else if (m[7]) nodes.push(<a key={k++} href={t} target="_blank" rel="noopener noreferrer" className="break-all text-info underline-offset-2 hover:underline">{t}</a>);
        last = m.index + t.length;
    }
    if (last < text.length) nodes.push(text.slice(last));
    return nodes;
}
