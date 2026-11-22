import { useEffect, useMemo, useRef, useState } from "react";
import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Highlight from "@tiptap/extension-highlight";
import { TaskItem, TaskList } from "@tiptap/extension-list";
import { Table, TableCell, TableHeader, TableRow } from "@tiptap/extension-table";
import { Extension } from "@tiptap/core";
import Suggestion from "@tiptap/suggestion";
import { Markdown } from "tiptap-markdown";
import { Bold, Check, Code, FileText, Highlighter, Italic, Link2, Strikethrough, Underline, X } from "lucide-react";
import { EmojiPicker } from "@/components/ui/emoji-picker";
import { cn } from "@/lib/utils";
import { DocIcon } from "../doc-icons";
import { EditorEnvContext, type EditorEnv, type MentionCandidate } from "./editor-env";
import { Column, Columns, DateChip, InlineMath, Media, PageCodeBlock, TableOfContents } from "./block-nodes";
import { Callout, PageImage, PageRef, PersonMention, Toggle, ToggleContent, ToggleSummary } from "./nodes";
import { filterSlashItems, type SlashItem } from "./slash-items";
import { createMenuStore, SuggestionPopup } from "./suggestion-menu";
import { BlockHandle } from "./block-handle";

interface BlockEditorProps {
    value: string;
    onChange: (markdown: string) => void;
    env: EditorEnv;
    onSave?: () => void;
    /** Arrow-up / Backspace at the very start of the document (the page moves focus back to the title). */
    onExitTop?: () => void;
    placeholder?: string;
    autoFocus?: boolean;
    className?: string;
    /** Receives the editor once it exists (the page uses it to focus the body from the title). */
    onReady?: (editor: Editor) => void;
}

const markdownOf = (e: Editor) => (e.storage as unknown as { markdown: { getMarkdown: () => string } }).markdown.getMarkdown();

/**
 * Notion-style block editor (15 §2). Every line is a block: "/" opens the block menu, "@" mentions people and links pages,
 * the ⋮⋮ handle drags / duplicates / turns blocks into others, Markdown shortcuts work as you type, selecting text shows
 * the formatting bubble, images can be pasted or dropped. Reads and writes Markdown (see ./nodes.ts for the dialect),
 * so versions, search, the AI index and the MCP tools keep working on plain text. Read-only when `env.editable` is false.
 */
export function BlockEditor({ value, onChange, env, onSave, onExitTop, placeholder = "Write, press '/' for commands, '@' to mention…", autoFocus, className, onReady }: BlockEditorProps) {
    const last = useRef(value);
    const editorRef = useRef<Editor | null>(null);
    // The page's env plus what only the editor can offer (the emoji picker anchored at the caret).
    const [emojiPick, setEmojiPick] = useState<{ x: number; y: number; onPick: (emoji: string) => void } | null>(null);
    const fullEnv = useMemo<EditorEnv>(() => ({
        ...env,
        pickEmoji: (onPick) => {
            const ed = editorRef.current;
            const at = ed ? ed.view.coordsAtPos(ed.state.selection.from) : { left: 200, bottom: 200 };
            setEmojiPick({ x: at.left, y: at.bottom, onPick });
        },
    }), [env]);
    const envRef = useRef(fullEnv);
    envRef.current = fullEnv;
    const saveRef = useRef(onSave);
    saveRef.current = onSave;
    const exitTopRef = useRef(onExitTop);
    exitTopRef.current = onExitTop;
    const container = useRef<HTMLDivElement>(null);
    const slash = useMemo(() => createMenuStore<SlashItem>(), []);
    const mention = useMemo(() => createMenuStore<MentionCandidate>(), []);

    const extensions = useMemo(() => [
        StarterKit.configure({ codeBlock: false, link: { openOnClick: false, autolink: true }, dropcursor: { color: "var(--info)", width: 3 } }),
        TaskList,
        TaskItem.configure({ nested: true }),
        Highlight,
        Table.configure({ resizable: false, HTMLAttributes: { class: "notion-table" } }),
        TableRow, TableHeader, TableCell,
        Callout,
        PageCodeBlock,
        Media, TableOfContents, DateChip, InlineMath, Columns, Column,
        Toggle, ToggleSummary, ToggleContent,
        PageRef,
        PageImage,
        PersonMention.configure({
            HTMLAttributes: { class: "notion-mention" },
            renderText: ({ node }) => `@${node.attrs.label ?? ""}`,
            suggestion: {
                char: "@",
                allowSpaces: false,
                items: async ({ query }) => envRef.current.searchMentions(query).catch(() => []),
                command: ({ editor, range, props }) => {
                    const item = props as unknown as MentionCandidate;
                    const node = item.kind === "page"
                        ? { type: "pageRef", attrs: { id: item.id, title: item.label } }
                        : { type: "mention", attrs: { id: item.id, label: item.label } };
                    editor.chain().focus().deleteRange(range).insertContent([node, { type: "text", text: " " }]).run();
                },
                render: mention.render as never,
            },
        }),
        Placeholder.configure({
            includeChildren: true,
            placeholder: ({ node }) => (node.type.name === "heading" ? `Heading ${node.attrs.level}` : node.type.name === "detailsSummary" ? "Toggle" : placeholder),
        }),
        Markdown.configure({ html: true, breaks: false, linkify: true, transformPastedText: true, tightLists: true }),
        Extension.create({
            name: "notionKeys",
            priority: 1000,
            addKeyboardShortcuts() {
                const ed = () => this.editor;
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
                const atDocStart = () => { const { selection } = ed().state; return selection.empty && selection.from <= 1; };
                return {
                    // Notion: ⌘S save · ⌘⌥1/2/3 headings · ⌘⌥0 text · ⌘⇧4 to-do · ⌘⇧5 bulleted · ⌘⇧6 numbered · ⌘⇧7 toggle ·
                    // ⌘⇧8 code block · ⌘⇧↑/↓ move block · ⌘D duplicate block · ⌘⇧H highlight
                    "Mod-s": () => { saveRef.current?.(); return true; },
                    "Mod-Alt-0": () => ed().chain().focus().setParagraph().run(),
                    "Mod-Alt-1": () => ed().chain().focus().toggleHeading({ level: 1 }).run(),
                    "Mod-Alt-2": () => ed().chain().focus().toggleHeading({ level: 2 }).run(),
                    "Mod-Alt-3": () => ed().chain().focus().toggleHeading({ level: 3 }).run(),
                    "Mod-Shift-4": () => ed().chain().focus().toggleTaskList().run(),
                    "Mod-Shift-5": () => ed().chain().focus().toggleBulletList().run(),
                    "Mod-Shift-6": () => ed().chain().focus().toggleOrderedList().run(),
                    "Mod-Shift-7": () => ed().chain().focus().setDetails().run(),
                    "Mod-Shift-8": () => ed().chain().focus().toggleCodeBlock().run(),
                    "Mod-Shift-h": () => ed().chain().focus().toggleHighlight().run(),
                    "Mod-Shift-ArrowUp": move(-1),
                    "Mod-Shift-ArrowDown": move(1),
                    "Mod-d": () => {
                        const { pos, node } = topBlock();
                        ed().view.dispatch(ed().state.tr.insert(pos + node.nodeSize, node).scrollIntoView());
                        return true;
                    },
                    ArrowUp: () => { if (atDocStart() && exitTopRef.current) { exitTopRef.current(); return true; } return false; },
                    Backspace: () => { if (atDocStart() && ed().state.doc.firstChild?.content.size === 0 && ed().state.doc.childCount === 1 && exitTopRef.current) { exitTopRef.current(); return true; } return false; },
                };
            },
            addProseMirrorPlugins() {
                return [Suggestion<SlashItem>({
                    editor: this.editor,
                    char: "/",
                    startOfLine: false,
                    allowedPrefixes: [" "],
                    items: ({ query }) => filterSlashItems(query, envRef.current),
                    command: ({ editor, range, props }) => props.run(editor, range, envRef.current),
                    render: slash.render,
                })];
            },
        }),
        // eslint-disable-next-line react-hooks/exhaustive-deps
    ], []);

    const editor = useEditor({
        extensions,
        content: value,
        editable: env.editable,
        autofocus: autoFocus ? "end" : false,
        editorProps: {
            attributes: { role: "textbox", "aria-multiline": "true", "aria-label": "Page content" },
            // Paste or drop image files: upload into the page and insert them where they land.
            handlePaste: (_view, event) => {
                const files = [...(event.clipboardData?.files ?? [])].filter((f) => f.type.startsWith("image/"));
                if (!files.length || !envRef.current.uploadFile) return false;
                for (const f of files) void envRef.current.uploadFile(f).then((src) => editorRef.current?.chain().focus().setImage({ src, alt: f.name }).run()).catch(() => undefined);
                return true;
            },
            handleDrop: (view, event, _slice, moved) => {
                if (moved) return false;
                const files = [...(event.dataTransfer?.files ?? [])].filter((f) => f.type.startsWith("image/"));
                if (!files.length || !envRef.current.uploadFile) return false;
                const at = view.posAtCoords({ left: event.clientX, top: event.clientY })?.pos;
                for (const f of files) void envRef.current.uploadFile(f).then((src) => editorRef.current?.chain().focus().insertContentAt(at ?? view.state.doc.content.size, { type: "image", attrs: { src, alt: f.name } }).run()).catch(() => undefined);
                return true;
            },
        },
        onUpdate: ({ editor: e }) => {
            const md = markdownOf(e);
            last.current = md;
            onChange(md);
        },
    });
    editorRef.current = editor;

    useEffect(() => { if (editor) onReady?.(editor); /* once per editor */ }, [editor]); // eslint-disable-line react-hooks/exhaustive-deps
    useEffect(() => { if (editor && editor.isEditable !== env.editable) editor.setEditable(env.editable); }, [editor, env.editable]);
    useEffect(() => {
        if (editor && value !== last.current) {
            last.current = value;
            editor.commands.setContent(value, { emitUpdate: false });
        }
    }, [value, editor]);

    if (!editor) return null;
    return (
        <EditorEnvContext.Provider value={fullEnv}>
            <div ref={container} className={cn("relative", className)}>
                {env.editable && <FormatBubble editor={editor} />}
                {env.editable && <BlockHandle editor={editor} container={container} />}
                <EditorContent editor={editor} className={cn("rich-text notion-blocks text-[16px] leading-[1.6]", !env.editable && "is-readonly")} />
                <SuggestionPopup
                    store={slash}
                    label="Insert block"
                    empty="No results"
                    group={(it) => it.group}
                    keyOf={(it) => it.title}
                    footer={<><span>Close menu</span><kbd className="rounded border border-border px-1 text-[10.5px]">esc</kbd></>}
                    render={(it) => (
                        <>
                            <it.icon className="size-[18px] flex-none text-muted-foreground" aria-hidden />
                            <span className="min-w-0 flex-1 truncate text-[13.5px] text-foreground" title={it.hint}>{it.title}</span>
                        </>
                    )}
                />
                {emojiPick && (
                    <>
                        <div className="fixed inset-0 z-40" onMouseDown={() => setEmojiPick(null)} aria-hidden />
                        <div className="fixed z-50 overflow-hidden rounded-lg border border-border shadow-lg" style={{ left: Math.max(8, Math.min(emojiPick.x, window.innerWidth - 336)), top: Math.min(emojiPick.y + 6, window.innerHeight - 396) }}
                            onKeyDown={(e) => e.key === "Escape" && setEmojiPick(null)}>
                            <EmojiPicker onSelect={(emoji) => { emojiPick.onPick(emoji); setEmojiPick(null); }} />
                        </div>
                    </>
                )}
                <SuggestionPopup
                    store={mention}
                    label="Mention a person or page"
                    empty="No people or pages found"
                    group={(it) => (it.kind === "member" ? "People" : "Link to page")}
                    keyOf={(it) => `${it.kind}:${it.id}`}
                    render={(it) => (
                        <>
                            <span className="flex size-6 flex-none items-center justify-center rounded-full bg-secondary text-[11px] font-medium text-muted-foreground">
                                {it.kind === "page" ? (it.icon ? <DocIcon icon={it.icon} /> : <FileText className="size-3.5" />) : it.label.slice(0, 1).toUpperCase()}
                            </span>
                            <span className="min-w-0"><span className="block truncate text-[13px] text-foreground">{it.label}</span>{it.hint && <span className="block truncate text-[11.5px] text-muted-foreground">{it.hint}</span>}</span>
                        </>
                    )}
                />
            </div>
        </EditorEnvContext.Provider>
    );
}

/** Selection bubble: bold, italic, underline, strike, code, highlight and an inline link field (no browser prompt). */
function FormatBubble({ editor }: { editor: Editor }) {
    const [linking, setLinking] = useState(false);
    const [href, setHref] = useState("");
    const startLink = () => { setHref((editor.getAttributes("link").href as string | undefined) ?? ""); setLinking(true); };
    const applyLink = () => {
        const url = href.trim();
        const chain = editor.chain().focus().extendMarkRange("link");
        (url ? chain.setLink({ href: /^(https?:|mailto:|\/)/.test(url) ? url : `https://${url}` }) : chain.unsetLink()).run();
        setLinking(false);
    };
    const marks = [
        { label: "Bold (⌘B)", icon: Bold, on: editor.isActive("bold"), run: () => editor.chain().focus().toggleBold().run() },
        { label: "Italic (⌘I)", icon: Italic, on: editor.isActive("italic"), run: () => editor.chain().focus().toggleItalic().run() },
        { label: "Underline (⌘U)", icon: Underline, on: editor.isActive("underline"), run: () => editor.chain().focus().toggleUnderline().run() },
        { label: "Strikethrough (⌘⇧S)", icon: Strikethrough, on: editor.isActive("strike"), run: () => editor.chain().focus().toggleStrike().run() },
        { label: "Code (⌘E)", icon: Code, on: editor.isActive("code"), run: () => editor.chain().focus().toggleCode().run() },
        { label: "Highlight (⌘⇧H)", icon: Highlighter, on: editor.isActive("highlight"), run: () => editor.chain().focus().toggleHighlight().run() },
        { label: "Link (⌘K)", icon: Link2, on: editor.isActive("link"), run: startLink },
    ];
    return (
        <BubbleMenu editor={editor} shouldShow={({ editor: e, state }) => !state.selection.empty && !e.isActive("image") && !e.isActive("pageRef") && !e.isActive("codeBlock")}
            className="flex items-center gap-0.5 rounded-lg border border-border bg-popover p-1 shadow-md">
            {linking ? (
                <form className="flex items-center gap-1" onSubmit={(e) => { e.preventDefault(); applyLink(); }}>
                    <input autoFocus value={href} onChange={(e) => setHref(e.target.value)} onKeyDown={(e) => e.key === "Escape" && setLinking(false)} placeholder="Paste a link…" aria-label="Link address"
                        className="h-7 w-56 rounded-md border border-border bg-background px-2 text-[13px] text-foreground outline-none focus:ring-1 focus:ring-ring" />
                    <button type="submit" aria-label="Apply link" className="inline-flex size-7 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground"><Check className="size-3.5" /></button>
                    <button type="button" aria-label="Cancel" onClick={() => setLinking(false)} className="inline-flex size-7 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground"><X className="size-3.5" /></button>
                </form>
            ) : marks.map((m) => (
                <button key={m.label} type="button" title={m.label} aria-label={m.label} aria-pressed={m.on} onMouseDown={(e) => e.preventDefault()} onClick={m.run}
                    className={cn("inline-flex size-7 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground", m.on && "bg-accent text-foreground")}>
                    <m.icon className="size-3.5" />
                </button>
            ))}
        </BubbleMenu>
    );
}
