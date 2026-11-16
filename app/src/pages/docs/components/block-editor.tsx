import { useEffect, useMemo, useRef, useState } from "react";
import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import { TaskItem, TaskList } from "@tiptap/extension-list";
import { Extension, type Range } from "@tiptap/core";
import Suggestion, { type SuggestionProps } from "@tiptap/suggestion";
import { Markdown } from "tiptap-markdown";
import { Bold, Code, CodeSquare, Heading1, Heading2, Heading3, Italic, Link2, List, ListChecks, ListOrdered, Minus, Pilcrow, Quote, Strikethrough, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface SlashItem { title: string; hint: string; keywords: string; icon: LucideIcon; run: (editor: Editor, range: Range) => void }

/** Notion's "/" block menu: type "/" on an empty line (or after a space), filter, Enter to insert. */
const SLASH_ITEMS: SlashItem[] = [
    { title: "Text", hint: "Just start writing with plain text", keywords: "paragraph text plain", icon: Pilcrow, run: (e, r) => e.chain().focus().deleteRange(r).setParagraph().run() },
    { title: "Heading 1", hint: "Big section heading", keywords: "h1 title heading", icon: Heading1, run: (e, r) => e.chain().focus().deleteRange(r).setHeading({ level: 1 }).run() },
    { title: "Heading 2", hint: "Medium section heading", keywords: "h2 heading", icon: Heading2, run: (e, r) => e.chain().focus().deleteRange(r).setHeading({ level: 2 }).run() },
    { title: "Heading 3", hint: "Small section heading", keywords: "h3 heading", icon: Heading3, run: (e, r) => e.chain().focus().deleteRange(r).setHeading({ level: 3 }).run() },
    { title: "To-do list", hint: "Track tasks with a to-do list", keywords: "todo task checkbox checklist", icon: ListChecks, run: (e, r) => e.chain().focus().deleteRange(r).toggleTaskList().run() },
    { title: "Bulleted list", hint: "Create a simple bulleted list", keywords: "bullet ul unordered list", icon: List, run: (e, r) => e.chain().focus().deleteRange(r).toggleBulletList().run() },
    { title: "Numbered list", hint: "Create a list with numbering", keywords: "number ol ordered list", icon: ListOrdered, run: (e, r) => e.chain().focus().deleteRange(r).toggleOrderedList().run() },
    { title: "Quote", hint: "Capture a quote", keywords: "blockquote quote callout", icon: Quote, run: (e, r) => e.chain().focus().deleteRange(r).toggleBlockquote().run() },
    { title: "Code", hint: "Capture a code snippet", keywords: "code snippet pre", icon: CodeSquare, run: (e, r) => e.chain().focus().deleteRange(r).toggleCodeBlock().run() },
    { title: "Divider", hint: "Visually divide blocks", keywords: "divider hr line separator", icon: Minus, run: (e, r) => e.chain().focus().deleteRange(r).setHorizontalRule().run() },
    { title: "Link to page", hint: "Link another page with [[Title]]", keywords: "link page mention wiki", icon: Link2, run: (e, r) => e.chain().focus().deleteRange(r).insertContent("[[]]").run() },
];

interface SlashState { props: SuggestionProps<SlashItem>; index: number }

interface BlockEditorProps {
    value: string;
    onChange: (markdown: string) => void;
    onSave?: () => void;
    placeholder?: string;
    autoFocus?: boolean;
    className?: string;
}

/**
 * Notion-style block editor: every line is a block, "/" opens the block menu, Markdown shortcuts work as you type
 * (`# `, `- `, `1. `, `[] `, `> `, ```` ``` ````), selecting text shows the formatting bubble. Reads and writes Markdown,
 * so versions, search, AI index and the MCP tools keep working on plain text.
 */
export function BlockEditor({ value, onChange, onSave, placeholder = "Type '/' for commands…", autoFocus, className }: BlockEditorProps) {
    const last = useRef(value);
    const [slash, setSlash] = useState<SlashState | null>(null);
    const slashRef = useRef<SlashState | null>(null);
    slashRef.current = slash;
    const saveRef = useRef(onSave);
    saveRef.current = onSave;

    const extensions = useMemo(() => [
        StarterKit.configure({ link: { openOnClick: false, autolink: true } }),
        TaskList,
        TaskItem.configure({ nested: true }),
        Placeholder.configure({ placeholder: ({ node }) => (node.type.name === "heading" ? "Heading" : placeholder) }),
        Markdown.configure({ html: false, breaks: false, linkify: true, transformPastedText: true }),
        Extension.create({
            name: "slashMenu",
            priority: 1000,
            addKeyboardShortcuts() {
                const ed = () => this.editor;
                /** Index range of the top-level block holding the selection. */
                const topBlock = () => {
                    const { doc, selection } = ed().state;
                    const idx = selection.$from.index(0);
                    let pos = 0;
                    for (let i = 0; i < idx; i++) pos += doc.child(i).nodeSize;
                    return { doc, idx, pos, node: doc.child(idx) };
                };
                const move = (dir: -1 | 1) => () => {
                    const { doc, idx, pos, node } = topBlock();
                    const sib = doc.maybeChild(idx + dir);
                    if (!sib) return true;
                    const tr = ed().state.tr;
                    tr.delete(pos, pos + node.nodeSize).insert(dir === -1 ? pos - sib.nodeSize : pos + sib.nodeSize, node);
                    ed().view.dispatch(tr.scrollIntoView());
                    return true;
                };
                return {
                    // Notion: ⌘S save · ⌘⇧4 to-do · ⌘⇧5 bulleted · ⌘⇧6 numbered · ⌘⇧8 code block · ⌘⇧↑/↓ move block · ⌘D duplicate block · ⌘K link
                    "Mod-s": () => { saveRef.current?.(); return true; },
                    "Mod-Shift-4": () => ed().chain().focus().toggleTaskList().run(),
                    "Mod-Shift-5": () => ed().chain().focus().toggleBulletList().run(),
                    "Mod-Shift-6": () => ed().chain().focus().toggleOrderedList().run(),
                    "Mod-Shift-8": () => ed().chain().focus().toggleCodeBlock().run(),
                    "Mod-Shift-ArrowUp": move(-1),
                    "Mod-Shift-ArrowDown": move(1),
                    "Mod-d": () => {
                        const { pos, node } = topBlock();
                        ed().view.dispatch(ed().state.tr.insert(pos + node.nodeSize, node).scrollIntoView());
                        return true;
                    },
                };
            },
            addProseMirrorPlugins() {
                return [Suggestion<SlashItem>({
                    editor: this.editor,
                    char: "/",
                    startOfLine: false,
                    allowedPrefixes: [" "],
                    items: ({ query }) => {
                        const q = query.toLowerCase().trim();
                        return SLASH_ITEMS.filter((i) => !q || i.title.toLowerCase().includes(q) || i.keywords.includes(q));
                    },
                    command: ({ editor, range, props }) => props.run(editor, range),
                    render: () => ({
                        onStart: (props) => setSlash({ props, index: 0 }),
                        onUpdate: (props) => setSlash({ props, index: 0 }),
                        onExit: () => setSlash(null),
                        onKeyDown: ({ event }) => {
                            const cur = slashRef.current;
                            if (!cur || cur.props.items.length === 0) return false;
                            const n = cur.props.items.length;
                            if (event.key === "ArrowDown") { setSlash({ ...cur, index: (cur.index + 1) % n }); return true; }
                            if (event.key === "ArrowUp") { setSlash({ ...cur, index: (cur.index - 1 + n) % n }); return true; }
                            if (event.key === "Enter") { cur.props.command(cur.props.items[cur.index]); return true; }
                            return false;
                        },
                    }),
                })];
            },
        }),
        // eslint-disable-next-line react-hooks/exhaustive-deps
    ], []);

    const editor = useEditor({
        extensions,
        content: value,
        autofocus: autoFocus ? "end" : false,
        editorProps: { attributes: { role: "textbox", "aria-multiline": "true", "aria-label": "Page content" } },
        onUpdate: ({ editor: e }) => {
            const md = (e.storage as unknown as { markdown: { getMarkdown: () => string } }).markdown.getMarkdown();
            last.current = md;
            onChange(md);
        },
    });

    useEffect(() => {
        if (editor && value !== last.current) {
            last.current = value;
            editor.commands.setContent(value, { emitUpdate: false });
        }
    }, [value, editor]);

    if (!editor) return null;
    const rect = slash?.props.clientRect?.();
    const setLink = () => {
        const prev = editor.getAttributes("link").href as string | undefined;
        const url = window.prompt("Link address", prev ?? "https://");
        if (url === null) return;
        if (!url.trim()) editor.chain().focus().extendMarkRange("link").unsetLink().run();
        else editor.chain().focus().extendMarkRange("link").setLink({ href: url.trim() }).run();
    };
    const marks = [
        { label: "Bold", icon: Bold, on: editor.isActive("bold"), run: () => editor.chain().focus().toggleBold().run() },
        { label: "Italic", icon: Italic, on: editor.isActive("italic"), run: () => editor.chain().focus().toggleItalic().run() },
        { label: "Strikethrough", icon: Strikethrough, on: editor.isActive("strike"), run: () => editor.chain().focus().toggleStrike().run() },
        { label: "Code", icon: Code, on: editor.isActive("code"), run: () => editor.chain().focus().toggleCode().run() },
        { label: "Link", icon: Link2, on: editor.isActive("link"), run: setLink },
    ];

    return (
        <div className={cn("relative", className)}>
            <BubbleMenu editor={editor} className="flex items-center gap-0.5 rounded-lg border border-border bg-popover p-1 shadow-md">
                {marks.map((m) => (
                    <button key={m.label} type="button" title={m.label} aria-label={m.label} aria-pressed={m.on} onMouseDown={(e) => e.preventDefault()} onClick={m.run}
                        className={cn("inline-flex size-7 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground", m.on && "bg-accent text-foreground")}>
                        <m.icon className="size-3.5" />
                    </button>
                ))}
            </BubbleMenu>
            <EditorContent editor={editor} className="rich-text notion-blocks min-h-[50vh] text-[15px] leading-relaxed" />
            {slash && rect && (
                <div role="listbox" aria-label="Insert block" style={{ position: "fixed", left: rect.left, top: rect.bottom + 6 }}
                    className="z-50 max-h-72 w-72 overflow-y-auto rounded-lg border border-border bg-popover p-1 shadow-lg">
                    <div className="px-2 py-1 text-[11px] font-medium text-muted-foreground">Basic blocks</div>
                    {slash.props.items.length === 0 && <p className="px-2 py-2 text-[13px] text-muted-foreground">No results</p>}
                    {slash.props.items.map((it, i) => (
                        <button key={it.title} type="button" role="option" aria-selected={i === slash.index} onMouseDown={(e) => e.preventDefault()} onClick={() => slash.props.command(it)}
                            onMouseEnter={() => setSlash({ ...slash, index: i })}
                            className={cn("flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left", i === slash.index && "bg-accent")}>
                            <span className="flex size-9 flex-none items-center justify-center rounded-md border border-border bg-card text-muted-foreground"><it.icon className="size-4" /></span>
                            <span className="min-w-0"><span className="block text-[13px] font-medium text-foreground">{it.title}</span><span className="block truncate text-[11.5px] text-muted-foreground">{it.hint}</span></span>
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
