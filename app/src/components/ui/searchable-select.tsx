import { useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export type SearchableOption = { value: string; label: string; /** Extra text matched by the search box. */ keywords?: string };
export type SearchableGroup = { heading: string; options: SearchableOption[] };

/** Select with a search box and grouped options. Base for the timezone and currency selectors. */
export function SearchableSelect({
    value, onChange, groups, placeholder = "Select", searchPlaceholder = "Search...", emptyText = "No results", disabled, className, "aria-label": ariaLabel, id, renderValue,
}: {
    value: string; onChange: (value: string) => void; groups: SearchableGroup[]; placeholder?: string; searchPlaceholder?: string; emptyText?: string;
    disabled?: boolean; className?: string; "aria-label"?: string; id?: string; renderValue?: (value: string) => string | undefined;
}) {
    const [open, setOpen] = useState(false);
    const selected = groups.flatMap((g) => g.options).find((o) => o.value === value);
    const text = selected?.label ?? renderValue?.(value) ?? (value || undefined);
    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button id={id} type="button" variant="outline" role="combobox" aria-expanded={open} aria-label={ariaLabel} disabled={disabled} className={cn("h-9 w-full justify-between px-3 font-normal", !text && "text-muted-foreground", className)}>
                    <span className="truncate">{text ?? placeholder}</span>
                    <ChevronsUpDown className="size-4 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-[var(--radix-popover-trigger-width)] min-w-64 p-0">
                <Command>
                    <CommandInput placeholder={searchPlaceholder} />
                    <CommandList>
                        <CommandEmpty>{emptyText}</CommandEmpty>
                        {groups.map((g) => (
                            <CommandGroup key={g.heading || "_"} heading={g.heading || undefined}>
                                {g.options.map((o) => (
                                    <CommandItem key={`${g.heading}:${o.value}`} value={`${o.label} ${o.value} ${o.keywords ?? ""}`} onSelect={() => { onChange(o.value); setOpen(false); }}>
                                        <Check className={cn("size-4", o.value === value ? "opacity-100" : "opacity-0")} />
                                        <span className="truncate">{o.label}</span>
                                    </CommandItem>
                                ))}
                            </CommandGroup>
                        ))}
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    );
}
