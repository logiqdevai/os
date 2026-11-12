import { useState, type KeyboardEvent } from "react";
import { Plus, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface TagListInputProps {
    value: string[];
    onChange: (value: string[]) => void;
    placeholder?: string;
    /** Return an error message for an invalid entry, or null. */
    validate?: (entry: string) => string | null;
    normalize?: (entry: string) => string;
    disabled?: boolean;
    "aria-label": string;
}

/** Small "tag" editor for lists of domains, IP ranges or country codes (Enter or comma adds). */
export function TagListInput({ value, onChange, placeholder, validate, normalize = (s) => s.trim(), disabled, ...rest }: TagListInputProps) {
    const [draft, setDraft] = useState("");
    const [error, setError] = useState<string | null>(null);

    const add = () => {
        const entries = draft.split(/[,\s]+/).map(normalize).filter(Boolean);
        if (!entries.length) return;
        for (const e of entries) {
            const msg = validate?.(e) ?? null;
            if (msg) { setError(msg); return; }
        }
        onChange([...new Set([...value, ...entries])]);
        setDraft("");
        setError(null);
    };
    const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Enter" || e.key === ",") { e.preventDefault(); add(); }
    };

    return (
        <div className="space-y-2">
            {value.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                    {value.map((v) => (
                        <Badge key={v} variant="neutral" className="gap-1 pr-0.5 font-mono">
                            {v}
                            {!disabled && (
                                <button type="button" className="rounded-xs p-0.5 hover:bg-border-soft hover:text-foreground" aria-label={`Remove ${v}`} onClick={() => onChange(value.filter((x) => x !== v))}>
                                    <X className="size-3" />
                                </button>
                            )}
                        </Badge>
                    ))}
                </div>
            )}
            {!disabled && (
                <div className="flex gap-2">
                    <Input value={draft} placeholder={placeholder} aria-label={rest["aria-label"]} aria-invalid={!!error} onChange={(e) => { setDraft(e.target.value); setError(null); }} onKeyDown={onKey} onBlur={() => draft.trim() && add()} />
                    <Button type="button" variant="outline" size="icon" aria-label="Add" onClick={add}><Plus /></Button>
                </div>
            )}
            {error && <p className="text-xs text-danger">{error}</p>}
        </div>
    );
}
