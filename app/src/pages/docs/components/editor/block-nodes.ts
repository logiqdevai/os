import { mergeAttributes, Node } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";
import CodeBlock from "@tiptap/extension-code-block";
import type { MarkdownSerializerState } from "prosemirror-markdown";
import type { Node as PMNode } from "@tiptap/pm/model";
import { formatChipDate, MEDIA_KINDS } from "./block-utils";
import { CodeBlockView, DateChipView, InlineMathView, MediaView, TocView } from "./block-views";

/**
 * Notion's "Media" and "Advanced blocks" for the docs editor. Like ./nodes.ts every node declares its Markdown form, so
 * versions, search, the AI index and the MCP tools keep reading plain text:
 *
 *   Video / Audio / File / Embed / Bookmark   [name](attachment:<id> | https://… "video|audio|file|embed|bookmark")  alone in a paragraph
 *   Block equation  ```math … ```        Inline equation  $`latex`$        Mermaid  ```mermaid … ```
 *   Table of contents  [TOC]             Date  [Nov 22, 2026](date:2026-11-22)
 *   Columns  <div data-columns><div data-column> …markdown… </div> … </div>
 */

type Ser = MarkdownSerializerState;

// ---------------------------------------------------------------------------------------------------------------------
// Media blocks. `(attachment:<id>)` keeps uploads linked to the page (the API scans the Markdown for it).
// ---------------------------------------------------------------------------------------------------------------------

export const Media = Node.create({
    name: "media",
    group: "block",
    atom: true,
    selectable: true,
    draggable: true,
    addAttributes() {
        return {
            kind: { default: "file", parseHTML: (el) => el.getAttribute("data-media") ?? "file", renderHTML: (a) => ({ "data-media": a.kind }) },
            src: { default: "", parseHTML: (el) => el.getAttribute("data-src") ?? "", renderHTML: (a) => ({ "data-src": a.src }) },
            name: { default: "", parseHTML: (el) => el.getAttribute("data-name") ?? "", renderHTML: (a) => ({ "data-name": a.name }) },
        };
    },
    parseHTML() { return [{ tag: "div[data-media]" }]; },
    renderHTML({ HTMLAttributes }) { return ["div", mergeAttributes(HTMLAttributes)]; },
    addNodeView() { return ReactNodeViewRenderer(MediaView); },
    addStorage() {
        return {
            markdown: {
                serialize(state: Ser, node: PMNode) {
                    const src = String(node.attrs.src ?? "");
                    // An empty placeholder (nothing uploaded or pasted yet) is not saved.
                    if (src) {
                        const name = String(node.attrs.name || src).replace(/[[\]]/g, "");
                        state.write(`[${name}](${src.replace(/[()\s]/g, encodeURIComponent)} "${node.attrs.kind}")`);
                    }
                    state.closeBlock(node);
                },
                parse: {
                    updateDOM(element: HTMLElement) {
                        element.querySelectorAll("p").forEach((p) => {
                            const a = p.firstElementChild;
                            if (p.childNodes.length !== 1 || !a || a.tagName !== "A") return;
                            const kind = a.getAttribute("title");
                            if (!kind || !(MEDIA_KINDS as readonly string[]).includes(kind)) return;
                            const div = p.ownerDocument.createElement("div");
                            div.setAttribute("data-media", kind);
                            div.setAttribute("data-src", a.getAttribute("href") ?? "");
                            div.setAttribute("data-name", a.textContent ?? "");
                            p.replaceWith(div);
                        });
                    },
                },
            },
        };
    },
});

// ---------------------------------------------------------------------------------------------------------------------
// Table of contents: `[TOC]` on its own line; the node view lists the page's headings live.
// ---------------------------------------------------------------------------------------------------------------------

export const TableOfContents = Node.create({
    name: "toc",
    group: "block",
    atom: true,
    selectable: true,
    draggable: true,
    parseHTML() { return [{ tag: "div[data-toc]" }]; },
    renderHTML() { return ["div", { "data-toc": "" }]; },
    addNodeView() { return ReactNodeViewRenderer(TocView); },
    addStorage() {
        return {
            markdown: {
                serialize(state: Ser, node: PMNode) { state.write("[TOC]"); state.closeBlock(node); },
                parse: {
                    updateDOM(element: HTMLElement) {
                        element.querySelectorAll("p").forEach((p) => {
                            if (p.textContent?.trim() !== "[TOC]") return;
                            const div = p.ownerDocument.createElement("div");
                            div.setAttribute("data-toc", "");
                            p.replaceWith(div);
                        });
                    },
                },
            },
        };
    },
});

// ---------------------------------------------------------------------------------------------------------------------
// Date chip (inline)
// ---------------------------------------------------------------------------------------------------------------------

export const DateChip = Node.create({
    name: "dateChip",
    group: "inline",
    inline: true,
    atom: true,
    selectable: true,
    addAttributes() {
        return { date: { default: "", parseHTML: (el) => el.getAttribute("data-date") ?? "", renderHTML: (a) => ({ "data-date": a.date }) } };
    },
    parseHTML() { return [{ tag: "span[data-date-chip]" }]; },
    renderHTML({ node }) { return ["span", { "data-date-chip": "", "data-date": node.attrs.date }, node.attrs.date ? formatChipDate(node.attrs.date) : ""]; },
    renderText({ node }) { return node.attrs.date ? formatChipDate(node.attrs.date) : ""; },
    addNodeView() { return ReactNodeViewRenderer(DateChipView, { as: "span" }); },
    addStorage() {
        return {
            markdown: {
                serialize(state: Ser, node: PMNode) {
                    if (node.attrs.date) state.write(`[${formatChipDate(node.attrs.date)}](date:${node.attrs.date})`);
                },
                parse: {
                    updateDOM(element: HTMLElement) {
                        element.querySelectorAll('a[href^="date:"]').forEach((a) => {
                            const span = element.ownerDocument.createElement("span");
                            span.setAttribute("data-date-chip", "");
                            span.setAttribute("data-date", (a.getAttribute("href") ?? "").slice("date:".length));
                            a.replaceWith(span);
                        });
                    },
                },
            },
        };
    },
});

// ---------------------------------------------------------------------------------------------------------------------
// Inline equation: GitHub's `$`latex`$` syntax (markdown-it renders it as $<code>latex</code>$).
// ---------------------------------------------------------------------------------------------------------------------

export const InlineMath = Node.create({
    name: "inlineMath",
    group: "inline",
    inline: true,
    atom: true,
    selectable: true,
    addAttributes() {
        return { latex: { default: "", parseHTML: (el) => el.getAttribute("data-latex") ?? "", renderHTML: (a) => ({ "data-latex": a.latex }) } };
    },
    parseHTML() { return [{ tag: "span[data-inline-math]" }]; },
    renderHTML({ node }) { return ["span", { "data-inline-math": "", "data-latex": node.attrs.latex }, node.attrs.latex]; },
    renderText({ node }) { return node.attrs.latex; },
    addNodeView() { return ReactNodeViewRenderer(InlineMathView, { as: "span" }); },
    addStorage() {
        return {
            markdown: {
                serialize(state: Ser, node: PMNode) {
                    const latex = String(node.attrs.latex ?? "").replace(/[`\n]/g, " ").trim();
                    if (latex) state.write("$`" + latex + "`$");
                },
                parse: {
                    updateDOM(element: HTMLElement) {
                        element.querySelectorAll("code").forEach((code) => {
                            if (code.closest("pre")) return;
                            const prev = code.previousSibling;
                            const next = code.nextSibling;
                            if (prev?.nodeType !== 3 || next?.nodeType !== 3 || !prev.textContent?.endsWith("$") || !next.textContent?.startsWith("$")) return;
                            prev.textContent = prev.textContent.slice(0, -1);
                            next.textContent = next.textContent.slice(1);
                            const span = element.ownerDocument.createElement("span");
                            span.setAttribute("data-inline-math", "");
                            span.setAttribute("data-latex", code.textContent ?? "");
                            code.replaceWith(span);
                        });
                    },
                },
            },
        };
    },
});

// ---------------------------------------------------------------------------------------------------------------------
// Code block with a language picker; "mermaid" and "math" (block equation) render a live preview under the source.
// ---------------------------------------------------------------------------------------------------------------------

export const PageCodeBlock = CodeBlock.extend({
    addNodeView() { return ReactNodeViewRenderer(CodeBlockView); },
});

// ---------------------------------------------------------------------------------------------------------------------
// Columns (2–5): HTML wrappers around Markdown bodies, like the toggle (blank lines hand each body back to Markdown).
// ---------------------------------------------------------------------------------------------------------------------

export const Columns = Node.create({
    name: "columns",
    group: "block",
    content: "column{2,5}",
    defining: true,
    isolating: true,
    parseHTML() { return [{ tag: "div[data-columns]" }]; },
    renderHTML({ HTMLAttributes }) { return ["div", mergeAttributes(HTMLAttributes, { "data-columns": "", class: "notion-columns" }), 0]; },
    addStorage() {
        return {
            markdown: {
                serialize(state: Ser, node: PMNode) {
                    state.write("<div data-columns>\n");
                    node.forEach((col) => {
                        state.write("<div data-column>\n\n");
                        state.renderContent(col);
                        state.write("</div>\n");
                    });
                    state.write("</div>");
                    state.closeBlock(node);
                },
                parse: {},
            },
        };
    },
});

export const Column = Node.create({
    name: "column",
    content: "block+",
    isolating: true,
    parseHTML() { return [{ tag: "div[data-column]" }]; },
    renderHTML({ HTMLAttributes }) { return ["div", mergeAttributes(HTMLAttributes, { "data-column": "", class: "notion-column" }), 0]; },
    addStorage() { return { markdown: { serialize() { /* written by Columns */ }, parse: {} } }; },
});
