import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { useAutosave } from "@/hooks/use-autosave";
import { SaveStatus } from "@/components/ui/save-status";
import { cn } from "@/lib/utils";

/**
 * Click-to-edit single-line text (titles, names). Looks like text; saves on blur or Enter, Esc reverts. Empty values
 * are refused when `required`. The save is optimistic in the caller's mutation — no button, no toast.
 */
export function InlineText({
    value, onSave, placeholder = "Untitled", required = true, maxLength = 200, disabled, className, inputClassName, "aria-label": ariaLabel,
}: {
    value: string; onSave: (next: string) => void; placeholder?: string; required?: boolean; maxLength?: number; disabled?: boolean;
    className?: string; inputClassName?: string; "aria-label"?: string;
}) {
    const [draft, setDraft] = useState(value);
    const editing = useRef(false);
    useEffect(() => { if (!editing.current) setDraft(value); }, [value]);
    const commit = () => {
        editing.current = false;
        const next = draft.trim();
        if ((required && !next) || next === value) { setDraft(value); return; }
        onSave(next);
    };
    const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Enter") { e.preventDefault(); (e.target as HTMLInputElement).blur(); }
        if (e.key === "Escape") { editing.current = false; setDraft(value); (e.target as HTMLInputElement).blur(); }
    };
    return (
        <input
            aria-label={ariaLabel ?? placeholder}
            value={draft}
            disabled={disabled}
            maxLength={maxLength}
            placeholder={placeholder}
            onFocus={() => { editing.current = true; }}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={onKey}
            className={cn(
                "w-full min-w-0 rounded-md border border-transparent bg-transparent px-1 -mx-1 outline-none transition-colors placeholder:text-muted-foreground",
                !disabled && "hover:border-border focus:border-border-strong focus:bg-background",
                className, inputClassName,
            )}
        />
    );
}

/**
 * Multi-line text that autosaves while typing (descriptions, notes). Shows a quiet saving indicator under the field.
 * `onSave` must return a promise (mutateAsync) so failures can be shown with a Retry.
 */
export function InlineTextarea({
    value, onSave, placeholder = "Add a description…", disabled, rows = 4, className, "aria-label": ariaLabel,
}: {
    value: string; onSave: (next: string) => Promise<unknown>; placeholder?: string; disabled?: boolean; rows?: number; className?: string; "aria-label"?: string;
}) {
    const [draft, setDraft] = useState(value);
    const [focused, setFocused] = useState(false);
    useEffect(() => { if (!focused) setDraft(value); }, [value, focused]);
    const autosave = useAutosave({ value: draft, save: onSave, enabled: !disabled && focused, delay: 900 });
    return (
        <div className="space-y-1">
            <textarea
                aria-label={ariaLabel ?? placeholder}
                value={draft}
                rows={rows}
                disabled={disabled}
                placeholder={placeholder}
                onFocus={() => setFocused(true)}
                onBlur={() => { autosave.flush(); setFocused(false); }}
                onChange={(e) => setDraft(e.target.value)}
                className={cn(
                    "w-full resize-y rounded-md border border-transparent bg-transparent px-2 py-1.5 -mx-2 text-[14px] leading-relaxed outline-none transition-colors placeholder:text-muted-foreground",
                    !disabled && "hover:border-border focus:border-border-strong focus:bg-background",
                    className,
                )}
            />
            <SaveStatus state={autosave} />
        </div>
    );
}
