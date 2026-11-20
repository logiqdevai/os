import { useEffect, useRef, useState } from "react";
import type { Editor } from "@tiptap/react";
import { NodeSelection, TextSelection } from "@tiptap/pm/state";
import { ArrowDown, ArrowUp, Copy, GripVertical, Plus, Repeat2, Trash2 } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { TURN_INTO } from "./slash-items";

interface Hover { pos: number; top: number }

/** Top-level block under a vertical coordinate (Notion shows the handle for the block the pointer is level with). */
function blockAt(editor: Editor, clientY: number): { pos: number; dom: HTMLElement } | null {
    const view = editor.view;
    const rect = view.dom.getBoundingClientRect();
    const hit = view.posAtCoords({ left: rect.left + Math.min(40, rect.width / 2), top: clientY });
    if (!hit) return null;
    const $pos = view.state.doc.resolve(hit.pos);
    const pos = $pos.depth > 0 ? $pos.before(1) : hit.inside >= 0 ? hit.inside : null;
    if (pos === null) return null;
    const dom = view.nodeDOM(pos);
    return dom instanceof HTMLElement ? { pos, dom } : null;
}

/**
 * Notion's left-gutter controls for the hovered block: "+" adds a block below (and opens the "/" menu), "⋮⋮" drags the
 * block (ProseMirror's own node drag, so the drop cursor and undo work) and, when clicked, opens the block menu:
 * Delete · Duplicate · Turn into · Move up / down.
 */
export function BlockHandle({ editor, container }: { editor: Editor; container: React.RefObject<HTMLDivElement | null> }) {
    const [hover, setHover] = useState<Hover | null>(null);
    const [menuOpen, setMenuOpen] = useState(false);
    const frozen = useRef(false);
    frozen.current = menuOpen;

    useEffect(() => {
        const el = container.current;
        if (!el) return;
        const onMove = (e: MouseEvent) => {
            if (frozen.current || !editor.isEditable) return;
            const b = blockAt(editor, e.clientY);
            if (!b) return;
            const top = b.dom.getBoundingClientRect().top - el.getBoundingClientRect().top;
            setHover((h) => (h?.pos === b.pos && h.top === top ? h : { pos: b.pos, top }));
        };
        const onLeave = () => { if (!frozen.current) setHover(null); };
        el.addEventListener("mousemove", onMove);
        el.addEventListener("mouseleave", onLeave);
        // Content changes move blocks: re-anchor on the next pointer move.
        const onUpdate = () => { if (!frozen.current) setHover(null); };
        editor.on("update", onUpdate);
        return () => { el.removeEventListener("mousemove", onMove); el.removeEventListener("mouseleave", onLeave); editor.off("update", onUpdate); };
    }, [editor, container]);

    if (!hover || !editor.isEditable) return null;
    const node = editor.state.doc.nodeAt(hover.pos);
    if (!node) return null;
    const end = hover.pos + node.nodeSize;

    const focusInside = () => {
        const { state, view } = editor;
        view.dispatch(state.tr.setSelection(TextSelection.near(state.doc.resolve(Math.min(hover.pos + 1, state.doc.content.size)))));
        view.focus();
    };
    const addBelow = () => {
        if (node.type.name === "paragraph" && node.content.size === 0) {
            editor.chain().focus().setTextSelection(hover.pos + 1).insertContent("/").run();
        } else {
            editor.chain().focus().insertContentAt(end, { type: "paragraph" }).setTextSelection(end + 1).insertContent("/").run();
        }
    };
    const onDragStart = (e: React.DragEvent) => {
        const { view } = editor;
        const sel = NodeSelection.create(view.state.doc, hover.pos);
        view.dispatch(view.state.tr.setSelection(sel));
        const dom = view.nodeDOM(hover.pos);
        e.dataTransfer.effectAllowed = "copyMove";
        e.dataTransfer.setData("text/plain", node.textContent);
        if (dom instanceof HTMLElement) e.dataTransfer.setDragImage(dom, 0, 0);
        (view as unknown as { dragging: { slice: unknown; move: boolean } | null }).dragging = { slice: sel.content(), move: true };
    };
    const remove = () => editor.chain().focus().deleteRange({ from: hover.pos, to: end }).run();
    const duplicate = () => editor.view.dispatch(editor.state.tr.insert(end, node).scrollIntoView());
    const move = (dir: -1 | 1) => {
        const { state, view } = editor;
        const $p = state.doc.resolve(hover.pos);
        const idx = $p.index(0);
        const sib = state.doc.maybeChild(idx + dir);
        if (!sib) return;
        const tr = state.tr.delete(hover.pos, end);
        tr.insert(dir === -1 ? hover.pos - sib.nodeSize : hover.pos + sib.nodeSize, node);
        view.dispatch(tr.scrollIntoView());
    };

    return (
        <div contentEditable={false} className="absolute -left-14 z-10 flex h-7 items-center gap-0.5 transition-opacity" style={{ top: hover.top }}>
            <button type="button" aria-label="Add a block below" title="Click to add a block below" onMouseDown={(e) => e.preventDefault()} onClick={addBelow}
                className="flex size-6 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground">
                <Plus className="size-4" />
            </button>
            <DropdownMenu open={menuOpen} onOpenChange={(o) => { setMenuOpen(o); if (!o) setHover(null); }}>
                <DropdownMenuTrigger asChild>
                    <button type="button" draggable onDragStart={onDragStart} aria-label="Drag to move · click for block options" title="Drag to move · Click to open menu"
                        className="flex h-6 w-5 cursor-grab items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground active:cursor-grabbing">
                        <GripVertical className="size-4" />
                    </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" side="left" className="w-52">
                    <DropdownMenuItem onSelect={remove}><Trash2 /> Delete</DropdownMenuItem>
                    <DropdownMenuItem onSelect={duplicate}><Copy /> Duplicate <span className="ml-auto text-xs text-muted-foreground">⌘D</span></DropdownMenuItem>
                    <DropdownMenuSub>
                        <DropdownMenuSubTrigger><Repeat2 /> Turn into</DropdownMenuSubTrigger>
                        <DropdownMenuSubContent className="w-48">
                            {TURN_INTO.map((t) => <DropdownMenuItem key={t.title} onSelect={() => { focusInside(); t.run(editor); }}><t.icon /> {t.title}</DropdownMenuItem>)}
                        </DropdownMenuSubContent>
                    </DropdownMenuSub>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onSelect={() => move(-1)}><ArrowUp /> Move up <span className="ml-auto text-xs text-muted-foreground">⌘⇧↑</span></DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => move(1)}><ArrowDown /> Move down <span className="ml-auto text-xs text-muted-foreground">⌘⇧↓</span></DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
        </div>
    );
}
