import { useState, type ReactNode } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface PickerItem {
    id: string;
    label: string;
    /** Extra text matched by the search box. */
    keywords?: string;
    icon?: ReactNode;
    hint?: ReactNode;
}

interface EntityPickerProps {
    items: PickerItem[];
    value: string | null | undefined;
    onChange: (id: string | null) => void;
    placeholder?: string;
    searchPlaceholder?: string;
    emptyText?: string;
    /** Label of the "none" entry; omit to hide it. */
    noneLabel?: string;
    /** Server-side search (called on every keystroke); local filtering is used otherwise. */
    onSearch?: (value: string) => void;
    loading?: boolean;
    disabled?: boolean;
    /** Custom trigger (default: an outline button showing the selection). */
    trigger?: ReactNode;
    className?: string;
    ariaLabel?: string;
    align?: "start" | "end" | "center";
}

/** Searchable single picker (Popover + Command, shadcn combobox pattern). Never a plain <select>. */
export function EntityPicker({ items, value, onChange, placeholder = "Select…", searchPlaceholder = "Search…", emptyText = "Nothing found", noneLabel, onSearch, loading, disabled, trigger, className, ariaLabel, align = "start" }: EntityPickerProps) {
    const [open, setOpen] = useState(false);
    const selected = items.find((i) => i.id === value);
    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild disabled={disabled}>
                {trigger ?? (
                    <Button type="button" variant="outline" role="combobox" aria-expanded={open} aria-label={ariaLabel ?? placeholder} className={cn("h-8 w-full justify-between font-normal", className)} disabled={disabled}>
                        <span className={cn("flex min-w-0 items-center gap-2 truncate", !selected && "text-muted-foreground")}>
                            {selected?.icon}
                            <span className="truncate">{selected?.label ?? placeholder}</span>
                        </span>
                        <ChevronsUpDown className="opacity-50" />
                    </Button>
                )}
            </PopoverTrigger>
            <PopoverContent className="w-[var(--radix-popover-trigger-width)] min-w-56 p-0" align={align}>
                <Command shouldFilter={!onSearch}>
                    <CommandInput placeholder={searchPlaceholder} onValueChange={onSearch} />
                    <CommandList>
                        <CommandEmpty>{loading ? "Searching…" : emptyText}</CommandEmpty>
                        <CommandGroup>
                            {noneLabel && (
                                <CommandItem value={`__none ${noneLabel}`} onSelect={() => { onChange(null); setOpen(false); }}>
                                    <Check className={cn("size-4", value ? "opacity-0" : "opacity-100")} />
                                    <span className="text-muted-foreground">{noneLabel}</span>
                                </CommandItem>
                            )}
                            {items.map((item) => (
                                <CommandItem key={item.id} value={`${item.label} ${item.keywords ?? ""} ${item.id}`} onSelect={() => { onChange(item.id); setOpen(false); }}>
                                    <Check className={cn("size-4", value === item.id ? "opacity-100" : "opacity-0")} />
                                    {item.icon}
                                    <span className="truncate">{item.label}</span>
                                    {item.hint && <span className="ml-auto truncate text-xs text-muted-foreground">{item.hint}</span>}
                                </CommandItem>
                            ))}
                        </CommandGroup>
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    );
}
