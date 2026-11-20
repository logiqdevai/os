import type { Editor, Range } from "@tiptap/core";
import {
    ChevronRight, CodeSquare, FileText, Heading1, Heading2, Heading3, ImageIcon, Info, Link2, List, ListChecks, ListOrdered, Minus, Pilcrow, Quote, Table, type LucideIcon,
} from "lucide-react";
import type { EditorEnv } from "./editor-env";

export interface SlashItem {
    title: string;
    hint: string;
    group: "Basic blocks" | "Media" | "Advanced";
    keywords: string;
    icon: LucideIcon;
    run: (editor: Editor, range: Range, env: EditorEnv) => void;
}

/** Ask for an image file, upload it into the page and insert it (Notion: /image). */
export function pickAndInsertImage(editor: Editor, env: EditorEnv, at?: number) {
    if (!env.uploadImage) return;
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = async () => {
        const file = input.files?.[0];
        if (!file) return;
        const src = await env.uploadImage?.(file).catch(() => null);
        if (!src) return;
        const chain = editor.chain().focus();
        (at !== undefined ? chain.insertContentAt(at, { type: "image", attrs: { src, alt: file.name } }) : chain.setImage({ src, alt: file.name })).run();
    };
    input.click();
}

/** Block types offered by "/" and by "Turn into" in the block menu. */
export const SLASH_ITEMS: SlashItem[] = [
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
    { group: "Media", title: "Image", hint: "Upload an image", keywords: "image picture photo upload media", icon: ImageIcon, run: (e, r, env) => { e.chain().focus().deleteRange(r).run(); pickAndInsertImage(e, env); } },
    { group: "Media", title: "Code", hint: "Capture a code snippet", keywords: "code snippet pre", icon: CodeSquare, run: (e, r) => e.chain().focus().deleteRange(r).toggleCodeBlock().run() },
    { group: "Advanced", title: "Table", hint: "Add a simple table", keywords: "table grid rows columns", icon: Table, run: (e, r) => e.chain().focus().deleteRange(r).insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run() },
];

export function filterSlashItems(query: string, env: EditorEnv) {
    const q = query.toLowerCase().trim();
    return SLASH_ITEMS.filter((i) => (i.title !== "Image" || !!env.uploadImage) && (i.title !== "Page" || !!env.createSubpage))
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
