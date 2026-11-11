import { useState } from "react";
import { Check, ChevronsUpDown, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { useProposalLookups } from "@/features/proposals/hooks/use-proposals";
import type { LookupOption } from "@/features/proposals/interfaces/proposals.interfaces";
import { personName } from "@/lib/format";
import { cn } from "@/lib/utils";

export type LookupKind = "companies" | "contacts" | "deals" | "projects" | "members";

export const lookupLabel = (kind: LookupKind, o: LookupOption) => {
    if (kind === "contacts") return [o.first_name, o.last_name].filter(Boolean).join(" ") || o.email || "Contact";
    if (kind === "members") return personName(o.user);
    if (kind === "projects") return o.code ? `${o.code} · ${o.name}` : (o.name ?? "Project");
    return o.name ?? "—";
};

interface LookupPickerProps {
    kind: LookupKind;
    value: string | null | undefined;
    /** Label to show for the current value before the options load. */
    valueLabel?: string | null;
    onChange: (id: string | null, option?: LookupOption) => void;
    placeholder?: string;
    companyId?: string | null;
    disabled?: boolean;
    clearable?: boolean;
    ariaLabel: string;
}

/** Searchable picker (Popover + Command) over the proposals lookup endpoint (ids + labels only). */
export function LookupPicker({ kind, value, valueLabel, onChange, placeholder = "Select…", companyId, disabled, clearable = true, ariaLabel }: LookupPickerProps) {
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState("");
    const q = useProposalLookups(kind, search, { company_id: companyId ?? undefined, enabled: open || (!!value && !valueLabel) });
    const selected = q.data?.find((o) => o.id === value);
    const label = selected ? lookupLabel(kind, selected) : valueLabel;

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <div className="flex w-full items-center gap-1">
                <PopoverTrigger asChild>
                    <Button type="button" variant="outline" role="combobox" aria-expanded={open} aria-label={ariaLabel} disabled={disabled} className="h-9 w-full min-w-0 justify-between font-normal">
                        <span className={cn("truncate", !value && "text-muted-foreground")}>{value ? (label ?? "Selected") : placeholder}</span>
                        <ChevronsUpDown className="size-3.5 opacity-50" />
                    </Button>
                </PopoverTrigger>
                {clearable && value && !disabled && (
                    <Button type="button" variant="ghost" size="icon-sm" aria-label={`Clear ${ariaLabel}`} onClick={() => onChange(null)}>
                        <X />
                    </Button>
                )}
            </div>
            <PopoverContent className="w-[--radix-popover-trigger-width] min-w-64 p-0" align="start">
                <Command shouldFilter={false}>
                    <CommandInput placeholder="Search…" value={search} onValueChange={setSearch} />
                    <CommandList>
                        <CommandEmpty>{q.isFetching ? "Searching…" : "Nothing found"}</CommandEmpty>
                        <CommandGroup>
                            {q.data?.map((o) => (
                                <CommandItem
                                    key={o.id}
                                    value={o.id}
                                    onSelect={() => {
                                        onChange(o.id, o);
                                        setOpen(false);
                                    }}
                                >
                                    <Check className={cn("size-4", o.id === value ? "opacity-100" : "opacity-0")} />
                                    <span className="truncate">{lookupLabel(kind, o)}</span>
                                    {kind === "contacts" && o.email && <span className="ml-auto truncate text-xs text-muted-foreground">{o.email}</span>}
                                </CommandItem>
                            ))}
                        </CommandGroup>
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    );
}
