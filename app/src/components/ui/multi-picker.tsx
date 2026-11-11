import { useState, type ReactNode } from "react";
import { Check, Plus, X } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export interface MultiPickerItem {
    id: string;
    label: string;
    /** Secondary line (email, location, count …). */
    hint?: ReactNode;
    /** Extra text matched by the search box. */
    keywords?: string;
    disabled?: boolean;
}

interface MultiPickerProps {
    items: MultiPickerItem[];
    value: string[];
    onChange: (ids: string[]) => void;
    /** Trigger button text. */
    placeholder?: string;
    searchPlaceholder?: string;
    emptyText?: string;
    loading?: boolean;
    disabled?: boolean;
    /** Names for selected ids that are not in `items` (edit mode). */
    known?: Record<string, string>;
    ariaLabel?: string;
}

/** Searchable multi-select (Popover + Command, shadcn combobox pattern) with removable chips. Never a plain <select>. */
export function MultiPicker({ items, value, onChange, placeholder = "Add", searchPlaceholder = "Search…", emptyText = "Nothing found", loading, disabled, known = {}, ariaLabel }: MultiPickerProps) {
    const [open, setOpen] = useState(false);
    const labelOf = (id: string) => items.find((i) => i.id === id)?.label ?? known[id] ?? "Unknown";
    const toggle = (id: string) => onChange(value.includes(id) ? value.filter((x) => x !== id) : [...value, id]);

    return (
        <div className="space-y-2">
            {value.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                    {value.map((id) => (
                        <Badge key={id} variant="secondary" className="h-6 max-w-full gap-1 pr-0.5">
                            <span className="truncate">{labelOf(id)}</span>
                            <button type="button" disabled={disabled} className="rounded-xs p-0.5 hover:bg-accent" onClick={() => toggle(id)} aria-label={`Remove ${labelOf(id)}`}>
                                <X className="size-3" />
                            </button>
                        </Badge>
                    ))}
                </div>
            )}
            <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild disabled={disabled}>
                    <Button type="button" variant="outline" size="sm" aria-label={ariaLabel ?? placeholder} disabled={disabled}><Plus /> {placeholder}</Button>
                </PopoverTrigger>
                <PopoverContent className="w-72 max-w-[calc(100vw-2rem)] p-0" align="start">
                    <Command>
                        <CommandInput placeholder={searchPlaceholder} />
                        <CommandList>
                            <CommandEmpty>{loading ? "Loading…" : emptyText}</CommandEmpty>
                            <CommandGroup>
                                {items.map((i) => (
                                    <CommandItem key={i.id} value={`${i.label} ${i.keywords ?? ""} ${i.id}`} disabled={i.disabled} onSelect={() => toggle(i.id)}>
                                        <Check className={cn("size-4 shrink-0", value.includes(i.id) ? "opacity-100" : "opacity-0")} />
                                        <div className="min-w-0">
                                            <div className="truncate text-[13px]">{i.label}</div>
                                            {i.hint && <div className="truncate text-xs text-muted-foreground">{i.hint}</div>}
                                        </div>
                                    </CommandItem>
                                ))}
                            </CommandGroup>
                        </CommandList>
                    </Command>
                </PopoverContent>
            </Popover>
        </div>
    );
}
