import type { Editor, Range } from "@tiptap/core";
import {
    AtSign, CalendarDays, ChevronRight, CodeSquare, Columns2, Columns3, Columns4, FileText, Globe, GalleryHorizontal, Heading1, Heading2, Heading3, ImageIcon, Info, Link2, List, ListChecks,
    ListOrdered, ListTree, Minus, Music, Paperclip, Pilcrow, Quote, Radical, Sigma, Smile, Table, Video, Workflow, type LucideIcon,
} from "lucide-react";
import type { EditorEnv } from "./editor-env";
import type { MediaKind } from "./block-utils";

export interface SlashItem {
    title: string;
    hint: string;
    group: "Basic blocks" | "Media" | "Advanced blocks" | "Inline";
    keywords: string;
    icon: LucideIcon;
    run: (editor: Editor, range: Range, env: EditorEnv) => void;
}

/** Ask for an image file, upload it into the page and insert it (Notion: /image). */
export function pickAndInsertImage(editor: Editor, env: EditorEnv, at?: number) {
    if (!env.uploadFile) return;
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = async () => {
        const file = input.files?.[0];
        if (!file) return;
        const src = await env.uploadFile?.(file).catch(() => null);
        if (!src) return;
        const chain = editor.chain().focus();
        (at !== undefined ? chain.insertContentAt(at, { type: "image", attrs: { src, alt: file.name } }) : chain.setImage({ src, alt: file.name })).run();
    };
    input.click();
}

const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
const columns = (n: number) => ({ type: "columns", content: Array.from({ length: n }, () => ({ type: "column", content: [{ type: "paragraph" }] })) });
const media = (kind: MediaKind) => (e: Editor, r: Range) => { e.chain().focus().deleteRange(r).insertContent({ type: "media", attrs: { kind } }).run(); };
const toggleHeading = (level: 1 | 2 | 3) => (e: Editor, r: Range) => { e.chain().focus().deleteRange(r).setDetails().updateAttributes("details", { level }).run(); };
const codeIn = (language: string) => (e: Editor, r: Range) => { e.chain().focus().deleteRange(r).setCodeBlock({ language }).run(); };

/** Block types offered by "/" (Notion's menu: basic blocks, media, advanced blocks, inline). The array order is the menu order. */
export const SLASH_ITEMS: SlashItem[] = [
    // ---- Basic blocks ---------------------------------------------------------------------------------------------------
    { group: "Basic blocks", title: "Text", hint: "Just start writing with plain text", keywords: "paragraph text plain", icon: Pilcrow, run: (e, r) => e.chain().focus().deleteRange(r).setParagraph().run() },
    { group: "Basic blocks", title: "Page", hint: "Embed a sub-page inside this page", keywords: "page subpage sub-page child new", icon: FileText,
        run: (e, r, env) => {
            e.chain().focus().deleteRange(r).run();
            void env.createSubpage?.().then((pg) => {
                e.chain().focus().insertContent([{ type: "pageRef", attrs: { id: pg.id, title: pg.title || "Untitled" } }, { type: "text", text: " " }]).run();
                env.openPage({ id: pg.id, title: pg.title });
            });
        } },
    { group: "Basic blocks", title: "Heading 1", hint: "Big section heading", keywords: "h1 title heading", icon: Heading1, run: (e, r) => e.chain().focus().deleteRange(r).setHeading({ level: 1 }).run() },
    { group: "Basic blocks", title: "Heading 2", hint: "Medium section heading", keywords: "h2 heading", icon: Heading2, run: (e, r) => e.chain().focus().deleteRange(r).setHeading({ level: 2 }).run() },
    { group: "Basic blocks", title: "Heading 3", hint: "Small section heading", keywords: "h3 heading", icon: Heading3, run: (e, r) => e.chain().focus().deleteRange(r).setHeading({ level: 3 }).run() },
    { group: "Basic blocks", title: "To-do list", hint: "Track tasks with a to-do list", keywords: "todo task checkbox checklist", icon: ListChecks, run: (e, r) => e.chain().focus().deleteRange(r).toggleTaskList().run() },
    { group: "Basic blocks", title: "Bulleted list", hint: "Create a simple bulleted list", keywords: "bullet ul unordered list", icon: List, run: (e, r) => e.chain().focus().deleteRange(r).toggleBulletList().run() },
    { group: "Basic blocks", title: "Numbered list", hint: "Create a list with numbering", keywords: "number ol ordered list", icon: ListOrdered, run: (e, r) => e.chain().focus().deleteRange(r).toggleOrderedList().run() },
    { group: "Basic blocks", title: "Toggle list", hint: "Toggles can hide and show content inside", keywords: "toggle details collapse accordion faq", icon: ChevronRight, run: (e, r) => e.chain().focus().deleteRange(r).setDetails().run() },
    { group: "Basic blocks", title: "Quote", hint: "Capture a quote", keywords: "blockquote quote", icon: Quote, run: (e, r) => e.chain().focus().deleteRange(r).toggleBlockquote().run() },
    { group: "Basic blocks", title: "Callout", hint: "Make writing stand out", keywords: "callout note tip warning info alert", icon: Info, run: (e, r) => e.chain().focus().deleteRange(r).wrapIn("callout").run() },
    { group: "Basic blocks", title: "Divider", hint: "Visually divide blocks", keywords: "divider hr line separator", icon: Minus, run: (e, r) => e.chain().focus().deleteRange(r).setHorizontalRule().run() },
    { group: "Basic blocks", title: "Link to page", hint: "Link to an existing page", keywords: "link page mention wiki", icon: Link2, run: (e, r) => e.chain().focus().deleteRange(r).insertContent("@").run() },
    // ---- Media ----------------------------------------------------------------------------------------------------------
    { group: "Media", title: "Image", hint: "Upload an image", keywords: "image picture photo upload media", icon: ImageIcon, run: (e, r, env) => { e.chain().focus().deleteRange(r).run(); pickAndInsertImage(e, env); } },
    { group: "Media", title: "Video", hint: "Upload or embed a video", keywords: "video movie mp4 youtube vimeo loom media", icon: Video, run: media("video") },
    { group: "Media", title: "Audio", hint: "Upload or embed audio", keywords: "audio sound music mp3 podcast media", icon: Music, run: media("audio") },
    { group: "Media", title: "Code", hint: "Capture a code snippet", keywords: "code snippet pre", icon: CodeSquare, run: (e, r) => e.chain().focus().deleteRange(r).toggleCodeBlock().run() },
    { group: "Media", title: "File", hint: "Upload or link a file", keywords: "file attachment upload pdf document download", icon: Paperclip, run: media("file") },
    { group: "Media", title: "Embed", hint: "Embed Figma, Maps, any web page", keywords: "embed iframe figma maps website web", icon: Globe, run: media("embed") },
    { group: "Media", title: "Bookmark", hint: "Save a link as a visual bookmark", keywords: "bookmark link url web card", icon: Link2, run: media("bookmark") },
    // ---- Advanced blocks ------------------------------------------------------------------------------------------------
    { group: "Advanced blocks", title: "Table of contents", hint: "Show an outline of this page", keywords: "table of contents toc outline headings", icon: ListTree, run: (e, r) => e.chain().focus().deleteRange(r).insertContent({ type: "toc" }).run() },
    { group: "Advanced blocks", title: "Block equation", hint: "Display a LaTeX equation", keywords: "equation math latex formula katex", icon: Sigma, run: codeIn("math") },
    { group: "Advanced blocks", title: "Table", hint: "Add a simple table", keywords: "table grid rows columns", icon: Table, run: (e, r) => e.chain().focus().deleteRange(r).insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run() },
    { group: "Advanced blocks", title: "Toggle heading 1", hint: "Hide and show a section under a big heading", keywords: "toggle heading h1 collapse", icon: Heading1, run: toggleHeading(1) },
    { group: "Advanced blocks", title: "Toggle heading 2", hint: "Hide and show a section under a medium heading", keywords: "toggle heading h2 collapse", icon: Heading2, run: toggleHeading(2) },
    { group: "Advanced blocks", title: "Toggle heading 3", hint: "Hide and show a section under a small heading", keywords: "toggle heading h3 collapse", icon: Heading3, run: toggleHeading(3) },
    { group: "Advanced blocks", title: "2 columns", hint: "Create two columns of blocks", keywords: "columns two 2 layout side by side", icon: Columns2, run: (e, r) => e.chain().focus().deleteRange(r).insertContent(columns(2)).run() },
    { group: "Advanced blocks", title: "3 columns", hint: "Create three columns of blocks", keywords: "columns three 3 layout", icon: Columns3, run: (e, r) => e.chain().focus().deleteRange(r).insertContent(columns(3)).run() },
    { group: "Advanced blocks", title: "4 columns", hint: "Create four columns of blocks", keywords: "columns four 4 layout", icon: Columns4, run: (e, r) => e.chain().focus().deleteRange(r).insertContent(columns(4)).run() },
    { group: "Advanced blocks", title: "5 columns", hint: "Create five columns of blocks", keywords: "columns five 5 layout", icon: GalleryHorizontal, run: (e, r) => e.chain().focus().deleteRange(r).insertContent(columns(5)).run() },
    { group: "Advanced blocks", title: "Code - Mermaid", hint: "Draw a flowchart, sequence or Gantt diagram", keywords: "mermaid diagram flowchart sequence gantt chart code", icon: Workflow, run: codeIn("mermaid") },
    // ---- Inline ---------------------------------------------------------------------------------------------------------
    { group: "Inline", title: "Mention a person", hint: "Notify someone in your organization", keywords: "mention person people user member at", icon: AtSign, run: (e, r) => e.chain().focus().deleteRange(r).insertContent("@").run() },
    { group: "Inline", title: "Mention a page", hint: "Link to another page", keywords: "mention page link wiki doc", icon: FileText, run: (e, r) => e.chain().focus().deleteRange(r).insertContent("@").run() },
    { group: "Inline", title: "Date or reminder", hint: "Insert a date", keywords: "date reminder calendar day today", icon: CalendarDays, run: (e, r) => e.chain().focus().deleteRange(r).insertContent([{ type: "dateChip", attrs: { date: today() } }, { type: "text", text: " " }]).run() },
    { group: "Inline", title: "Emoji", hint: "Add an emoji to your text", keywords: "emoji smile reaction face icon", icon: Smile,
        run: (e, r, env) => {
            e.chain().focus().deleteRange(r).run();
            env.pickEmoji?.((emoji) => e.chain().focus().insertContent(emoji).run());
        } },
    { group: "Inline", title: "Inline equation", hint: "Write math inside a sentence", keywords: "inline equation math latex formula", icon: Radical, run: (e, r) => e.chain().focus().deleteRange(r).insertContent([{ type: "inlineMath", attrs: { latex: "" } }, { type: "text", text: " " }]).run() },
];

export function filterSlashItems(query: string, env: EditorEnv) {
    const q = query.toLowerCase().trim();
    return SLASH_ITEMS.filter((i) => (i.title !== "Image" || !!env.uploadFile) && (i.title !== "Page" || !!env.createSubpage) && (i.title !== "Emoji" || !!env.pickEmoji))
        .filter((i) => !q || i.title.toLowerCase().includes(q) || i.keywords.includes(q));
}

/** "Turn into" targets of the block menu (Notion's ⋮⋮ → Turn into). */
export const TURN_INTO: { title: string; icon: LucideIcon; run: (e: Editor) => void }[] = [
    { title: "Text", icon: Pilcrow, run: (e) => e.chain().focus().clearNodes().run() },
    { title: "Heading 1", icon: Heading1, run: (e) => e.chain().focus().clearNodes().setHeading({ level: 1 }).run() },
    { title: "Heading 2", icon: Heading2, run: (e) => e.chain().focus().clearNodes().setHeading({ level: 2 }).run() },
    { title: "Heading 3", icon: Heading3, run: (e) => e.chain().focus().clearNodes().setHeading({ level: 3 }).run() },
    { title: "To-do list", icon: ListChecks, run: (e) => e.chain().focus().clearNodes().toggleTaskList().run() },
    { title: "Bulleted list", icon: List, run: (e) => e.chain().focus().clearNodes().toggleBulletList().run() },
    { title: "Numbered list", icon: ListOrdered, run: (e) => e.chain().focus().clearNodes().toggleOrderedList().run() },
    { title: "Quote", icon: Quote, run: (e) => e.chain().focus().clearNodes().toggleBlockquote().run() },
    { title: "Callout", icon: Info, run: (e) => e.chain().focus().clearNodes().wrapIn("callout").run() },
    { title: "Code", icon: CodeSquare, run: (e) => e.chain().focus().clearNodes().toggleCodeBlock().run() },
];
