import { useEffect, useRef, useState } from "react";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import { Markdown } from "@/components/ui/markdown";
import { SaveStatus } from "@/components/ui/save-status";
import { useAutosave } from "@/hooks/use-autosave";
import { cn } from "@/lib/utils";

/**
 * Linear-style Markdown field (descriptions, notes): rendered Markdown; click to edit; every change autosaves after a
 * short pause; blur or Esc closes the editor (after saving). No Save / Cancel buttons and no success toast.
 * `onSave` must return a promise (e.g. `mutateAsync`) so a refused save shows "Couldn't save · Retry".
 */
export function MarkdownField({
    value, onSave, canEdit = true, placeholder = "Add a description…", rows = 8, className, "aria-label": ariaLabel = "Description", rich,
}: {
    value: string | null | undefined; onSave: (next: string) => Promise<unknown>; canEdit?: boolean; placeholder?: string; rows?: number;
    className?: string; "aria-label"?: string;
    /** Edit with the WYSIWYG editor (floating formatting toolbar on selection) instead of a Markdown textarea. */
    rich?: boolean;
}) {
    const [editing, setEditing] = useState(false);
    const [draft, setDraft] = useState(value ?? "");
    const ref = useRef<HTMLTextAreaElement>(null);
    useEffect(() => { if (!editing) setDraft(value ?? ""); }, [value, editing]);
    const autosave = useAutosave({ value: draft, save: onSave, enabled: editing, delay: 900 });

    const close = () => { autosave.flush(); setEditing(false); };

    if (editing && rich) {
        return (
            <div className={cn("space-y-1", className)} onKeyDown={(e) => { if (e.key === "Escape") { e.preventDefault(); close(); } }}>
                <div className="-mx-2 px-2 py-1" onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) close(); }}>
                    <RichTextEditor bare autoFocus value={draft} onChange={setDraft} rows={rows} placeholder={placeholder} aria-label={ariaLabel} />
                </div>
                <div className="flex min-h-4 items-center justify-between text-xs text-muted-foreground">
                    <span>Select text to format · saves automatically · Esc to close</span>
                    <SaveStatus state={autosave} />
                </div>
            </div>
        );
    }
    if (editing) {
        return (
            <div className={cn("space-y-1", className)}>
                <textarea
                    ref={ref}
                    autoFocus
                    rows={rows}
                    value={draft}
                    aria-label={ariaLabel}
                    placeholder={placeholder}
                    onChange={(e) => setDraft(e.target.value)}
                    onBlur={close}
                    onKeyDown={(e) => { if (e.key === "Escape") { e.preventDefault(); ref.current?.blur(); } }}
                    className="w-full resize-y rounded-md border border-border-strong bg-background px-3 py-2 text-[13px] leading-relaxed text-foreground outline-none placeholder:text-muted-foreground"
                />
                <div className="flex min-h-4 items-center justify-between text-xs text-muted-foreground">
                    <span>Markdown · saves automatically · Esc to close</span>
                    <SaveStatus state={autosave} />
                </div>
            </div>
        );
    }
    return (
        <div className={className}>
            {value ? (
                <div
                    className={cn("rounded-md text-[13px] leading-relaxed text-body", canEdit && "-mx-2 cursor-text px-2 py-1 hover:bg-accent/40")}
                    onClick={(e) => canEdit && !(e.target as HTMLElement).closest("a") && setEditing(true)}
                >
                    <Markdown source={value} />
                </div>
            ) : canEdit ? (
                <button type="button" className="text-[13px] text-muted-foreground hover:text-foreground" onClick={() => setEditing(true)}>{placeholder}</button>
            ) : null}
            {autosave.status === "error" && <SaveStatus state={autosave} />}
        </div>
    );
}
