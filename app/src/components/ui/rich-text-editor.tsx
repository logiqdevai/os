import { useEffect, useRef } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import { Markdown } from "tiptap-markdown";
import { Bold, Code, Heading2, Italic, Link2, List, ListOrdered, Quote, Strikethrough } from "lucide-react";
import { cn } from "@/lib/utils";

interface RichTextEditorProps {
    /** Markdown source (what the API stores and the `Markdown` renderer displays). */
    value: string | null | undefined;
    /** Called with the Markdown of the document on every edit. */
    onChange: (markdown: string) => void;
    placeholder?: string;
    disabled?: boolean;
    autoFocus?: boolean;
    /** Minimum height of the writing area, in rows of text (default 4). */
    rows?: number;
    id?: string;
    "aria-label"?: string;
    className?: string;
    onBlur?: () => void;
}

/**
 * WYSIWYG editor for description-style fields (headings, bold/italic, lists, quotes, code, links).
 * It reads and writes Markdown, so stored values stay plain strings and render with `<Markdown>` / `MarkdownField`.
 * Works with react-hook-form: `<RichTextEditor value={field.value} onChange={field.onChange} />`.
 */
export function RichTextEditor({ value, onChange, placeholder = "Write something…", disabled, autoFocus, rows = 4, id, "aria-label": ariaLabel, className, onBlur }: RichTextEditorProps) {
    const lastEmitted = useRef(value ?? "");
    const editor = useEditor({
        extensions: [
            StarterKit.configure({ link: { openOnClick: false, autolink: true } }),
            Placeholder.configure({ placeholder }),
            Markdown.configure({ html: false, breaks: true, linkify: true, transformPastedText: true }),
        ],
        content: value ?? "",
        editable: !disabled,
        autofocus: autoFocus ? "end" : false,
        editorProps: { attributes: { ...(id ? { id } : {}), ...(ariaLabel ? { "aria-label": ariaLabel } : {}), role: "textbox", "aria-multiline": "true" } },
        onUpdate: ({ editor: e }) => {
            const md = (e.storage as unknown as { markdown: { getMarkdown: () => string } }).markdown.getMarkdown();
            lastEmitted.current = md;
            onChange(md);
        },
        onBlur: () => onBlur?.(),
    });

    // Follow outside changes (form reset, a different record) without echoing our own edits back.
    useEffect(() => {
        if (!editor) return;
        const next = value ?? "";
        if (next !== lastEmitted.current) {
            lastEmitted.current = next;
            editor.commands.setContent(next, { emitUpdate: false });
        }
    }, [value, editor]);
    useEffect(() => { editor?.setEditable(!disabled); }, [disabled, editor]);

    if (!editor) return null;

    const setLink = () => {
        const previous = editor.getAttributes("link").href as string | undefined;
        const url = window.prompt("Link address", previous ?? "https://");
        if (url === null) return;
        if (url.trim() === "") editor.chain().focus().extendMarkRange("link").unsetLink().run();
        else editor.chain().focus().extendMarkRange("link").setLink({ href: url.trim() }).run();
    };
    const tools = [
        { label: "Bold", icon: Bold, active: editor.isActive("bold"), run: () => editor.chain().focus().toggleBold().run() },
        { label: "Italic", icon: Italic, active: editor.isActive("italic"), run: () => editor.chain().focus().toggleItalic().run() },
        { label: "Strikethrough", icon: Strikethrough, active: editor.isActive("strike"), run: () => editor.chain().focus().toggleStrike().run() },
        { label: "Heading", icon: Heading2, active: editor.isActive("heading", { level: 2 }), run: () => editor.chain().focus().toggleHeading({ level: 2 }).run() },
        { label: "Bulleted list", icon: List, active: editor.isActive("bulletList"), run: () => editor.chain().focus().toggleBulletList().run() },
        { label: "Numbered list", icon: ListOrdered, active: editor.isActive("orderedList"), run: () => editor.chain().focus().toggleOrderedList().run() },
        { label: "Quote", icon: Quote, active: editor.isActive("blockquote"), run: () => editor.chain().focus().toggleBlockquote().run() },
        { label: "Code", icon: Code, active: editor.isActive("code"), run: () => editor.chain().focus().toggleCode().run() },
        { label: "Link", icon: Link2, active: editor.isActive("link"), run: setLink },
    ];

    return (
        <div className={cn("rounded-md border border-input bg-transparent shadow-sm focus-within:ring-1 focus-within:ring-ring", disabled && "cursor-not-allowed opacity-50", className)}>
            <div className="flex flex-wrap gap-0.5 border-b border-border px-1.5 py-1" role="toolbar" aria-label="Formatting">
                {tools.map((t) => (
                    <button
                        key={t.label}
                        type="button"
                        title={t.label}
                        aria-label={t.label}
                        aria-pressed={t.active}
                        disabled={disabled}
                        // Keep the selection in the editor while a toolbar button is pressed.
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={t.run}
                        className={cn("inline-flex size-7 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground disabled:pointer-events-none", t.active && "bg-accent text-foreground")}
                    >
                        <t.icon className="size-3.5" />
                    </button>
                ))}
            </div>
            <EditorContent editor={editor} className="rich-text px-3 py-2 text-sm" style={{ ["--rt-rows" as string]: rows }} />
        </div>
    );
}
