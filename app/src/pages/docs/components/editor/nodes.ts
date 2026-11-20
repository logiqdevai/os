import { mergeAttributes, Node } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { Details, DetailsContent, DetailsSummary } from "@tiptap/extension-details";
import Image from "@tiptap/extension-image";
import Mention from "@tiptap/extension-mention";
import type { MarkdownSerializerState } from "prosemirror-markdown";
import type { Node as PMNode } from "@tiptap/pm/model";
import { CalloutView, ImageView, PageRefView } from "./node-views";

/**
 * Custom blocks of the Notion-style editor. Markdown stays the single source of truth (search, AI index, versions, MCP),
 * so every node declares how it is written to and read from Markdown (tiptap-markdown `storage.markdown`):
 *
 *   Callout   > [!NOTE] …              (GitHub alert syntax: NOTE, TIP, IMPORTANT, WARNING, CAUTION)
 *   Toggle    <details><summary>Title</summary> …markdown… </details>
 *   Page link [Title](/docs/pages/<id>)  — also reads the legacy [[Title]]
 *   Mention   [@Name](mention:member/<membership_id>)
 *   Image     ![alt](attachment:<document_id>)  — resolved to a signed URL when shown
 */

type Ser = MarkdownSerializerState & { inTable?: boolean };
const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";

// ---------------------------------------------------------------------------------------------------------------------
// Callout
// ---------------------------------------------------------------------------------------------------------------------

export const CALLOUT_TYPES = ["note", "tip", "important", "warning", "caution"] as const;
export type CalloutType = (typeof CALLOUT_TYPES)[number];

export const Callout = Node.create({
    name: "callout",
    group: "block",
    content: "paragraph+",
    defining: true,
    addAttributes() {
        return { type: { default: "note", parseHTML: (el) => (el.getAttribute("data-callout") ?? "note").toLowerCase(), renderHTML: (a) => ({ "data-callout": a.type }) } };
    },
    parseHTML() { return [{ tag: "div[data-callout]" }]; },
    renderHTML({ HTMLAttributes }) { return ["div", mergeAttributes(HTMLAttributes, { class: "notion-callout" }), 0]; },
    addNodeView() { return ReactNodeViewRenderer(CalloutView); },
    addStorage() {
        return {
            markdown: {
                serialize(state: Ser, node: PMNode) {
                    state.wrapBlock("> ", null, node, () => {
                        state.write(`[!${String(node.attrs.type).toUpperCase()}]`);
                        state.ensureNewLine();
                        state.renderContent(node);
                    });
                },
                parse: {
                    // markdown-it renders "> [!TIP]\n> text" as <blockquote><p>[!TIP]\ntext</p></blockquote>.
                    updateDOM(element: HTMLElement) {
                        element.querySelectorAll("blockquote").forEach((bq) => {
                            const first = bq.firstElementChild;
                            const text = first?.firstChild;
                            if (!first || first.tagName !== "P" || !text || text.nodeType !== 3) return;
                            const m = /^\[!(note|tip|important|warning|caution)\]\s*/i.exec(text.textContent ?? "");
                            if (!m) return;
                            text.textContent = (text.textContent ?? "").slice(m[0].length);
                            if (first.firstChild?.nodeName === "BR") first.firstChild.remove();
                            if (!first.textContent?.trim() && first.children.length === 0) first.remove();
                            const div = bq.ownerDocument.createElement("div");
                            div.setAttribute("data-callout", m[1].toLowerCase());
                            while (bq.firstChild) div.appendChild(bq.firstChild);
                            if (!div.firstChild) div.appendChild(bq.ownerDocument.createElement("p"));
                            bq.replaceWith(div);
                        });
                    },
                },
            },
        };
    },
});

// ---------------------------------------------------------------------------------------------------------------------
// Toggle (details / summary) — the body stays Markdown between the HTML tags.
// ---------------------------------------------------------------------------------------------------------------------

const escapeHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export const Toggle = Details.extend({
    addStorage() {
        return {
            markdown: {
                serialize(state: Ser, node: PMNode) {
                    const summary = node.firstChild;
                    const body = node.childCount > 1 ? node.child(1) : null;
                    state.write(`<details>\n<summary>${escapeHtml(summary?.textContent ?? "")}</summary>\n\n`);
                    if (body) state.renderContent(body);
                    state.ensureNewLine();
                    state.write("</details>");
                    state.closeBlock(node);
                },
                parse: {
                    // markdown-it splits the HTML around the Markdown body: put everything after <summary> into the content div.
                    updateDOM(element: HTMLElement) {
                        element.querySelectorAll("details").forEach((d) => {
                            if (d.querySelector(':scope > div[data-type="detailsContent"]')) return;
                            const content = d.ownerDocument.createElement("div");
                            content.setAttribute("data-type", "detailsContent");
                            [...d.childNodes].forEach((c) => { if (!(c instanceof HTMLElement && c.tagName === "SUMMARY")) content.appendChild(c); });
                            if (!content.textContent?.trim() && !content.querySelector("img")) content.appendChild(d.ownerDocument.createElement("p"));
                            d.appendChild(content);
                        });
                    },
                },
            },
        };
    },
}).configure({ persist: false, HTMLAttributes: { class: "notion-toggle" } });

export { DetailsContent as ToggleContent, DetailsSummary as ToggleSummary };

// ---------------------------------------------------------------------------------------------------------------------
// Page link chip
// ---------------------------------------------------------------------------------------------------------------------

export interface PageRefStorage { onOpen?: (ref: { id: string | null; title: string }) => void }

export const PageRef = Node.create({
    name: "pageRef",
    group: "inline",
    inline: true,
    atom: true,
    selectable: true,
    addAttributes() {
        return {
            id: { default: null, parseHTML: (el) => el.getAttribute("data-page-id") || null },
            title: { default: "", parseHTML: (el) => el.getAttribute("data-page-title") ?? el.textContent ?? "" },
        };
    },
    parseHTML() { return [{ tag: "span[data-page-ref]" }]; },
    renderHTML({ node }) {
        return ["span", { "data-page-ref": "", "data-page-id": node.attrs.id ?? "", "data-page-title": node.attrs.title }, node.attrs.title || "Untitled"];
    },
    renderText({ node }) { return node.attrs.title || "Untitled"; },
    addNodeView() { return ReactNodeViewRenderer(PageRefView, { as: "span" }); },
    addStorage() {
        return {
            markdown: {
                serialize(state: Ser, node: PMNode) {
                    const title = String(node.attrs.title || "Untitled").replace(/[[\]]/g, "");
                    state.write(node.attrs.id ? `[${title}](/docs/pages/${node.attrs.id})` : `[[${title}]]`);
                },
                parse: {
                    updateDOM(element: HTMLElement) {
                        const doc = element.ownerDocument;
                        element.querySelectorAll("a[href]").forEach((a) => {
                            const m = new RegExp(`^/docs/pages/(${UUID})$`, "i").exec(a.getAttribute("href") ?? "");
                            if (!m) return;
                            const span = doc.createElement("span");
                            span.setAttribute("data-page-ref", "");
                            span.setAttribute("data-page-id", m[1]);
                            span.setAttribute("data-page-title", a.textContent ?? "");
                            a.replaceWith(span);
                        });
                        // Legacy wiki links: [[Title]] in text.
                        const walker = doc.createTreeWalker(element, 4);
                        const hits: Text[] = [];
                        while (walker.nextNode()) { const t = walker.currentNode as Text; if (t.textContent?.includes("[[") && !t.parentElement?.closest("code,pre")) hits.push(t); }
                        for (const t of hits) {
                            const parts = (t.textContent ?? "").split(/(\[\[[^\]|]{1,200}\]\])/);
                            if (parts.length === 1) continue;
                            const frag = doc.createDocumentFragment();
                            for (const p of parts) {
                                const m = /^\[\[([^\]|]+)\]\]$/.exec(p);
                                if (!m) { if (p) frag.appendChild(doc.createTextNode(p)); continue; }
                                const span = doc.createElement("span");
                                span.setAttribute("data-page-ref", "");
                                span.setAttribute("data-page-title", m[1].trim());
                                frag.appendChild(span);
                            }
                            t.replaceWith(frag);
                        }
                    },
                },
            },
        };
    },
});

// ---------------------------------------------------------------------------------------------------------------------
// Mention (people)
// ---------------------------------------------------------------------------------------------------------------------

export const PersonMention = Mention.extend({
    addStorage() {
        return {
            markdown: {
                serialize(state: Ser, node: PMNode) {
                    state.write(`[@${String(node.attrs.label ?? "").replace(/[[\]]/g, "")}](mention:member/${node.attrs.id})`);
                },
                parse: {
                    updateDOM(element: HTMLElement) {
                        element.querySelectorAll('a[href^="mention:member/"]').forEach((a) => {
                            const span = element.ownerDocument.createElement("span");
                            span.setAttribute("data-type", "mention");
                            span.setAttribute("data-id", (a.getAttribute("href") ?? "").slice("mention:member/".length));
                            span.setAttribute("data-label", (a.textContent ?? "").replace(/^@/, ""));
                            a.replaceWith(span);
                        });
                    },
                },
            },
        };
    },
});

// ---------------------------------------------------------------------------------------------------------------------
// Image — attachment:<document_id> sources are resolved to short-lived signed URLs by the node view.
// ---------------------------------------------------------------------------------------------------------------------

export const PageImage = Image.extend({
    draggable: true,
    addNodeView() { return ReactNodeViewRenderer(ImageView); },
    addStorage() {
        return {
            markdown: {
                // A block of its own: close the block so the next one starts on a new paragraph.
                serialize(state: Ser, node: PMNode) {
                    const alt = String(node.attrs.alt ?? "").replace(/[[\]]/g, "");
                    state.write(`![${alt}](${String(node.attrs.src ?? "").replace(/[()\s]/g, encodeURIComponent)})`);
                    state.closeBlock(node);
                },
                parse: {},
            },
        };
    },
}).configure({ inline: false, allowBase64: false });
