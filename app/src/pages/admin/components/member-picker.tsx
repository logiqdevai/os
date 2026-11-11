import { useEffect, useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useMembers } from "@/features/admin/members/hooks/use-members";
import type { MemberListItem } from "@/features/admin/members/interfaces/members.interfaces";
import { personName } from "@/lib/format";
import { cn } from "@/lib/utils";

interface MemberPickerProps {
    value: string | undefined;
    onChange: (membershipId: string, label: string, member: MemberListItem) => void;
    /** Label to show for a preselected value (e.g. restored from the URL). */
    valueLabel?: string;
    /** Membership ids to hide (already added). */
    exclude?: string[];
    placeholder?: string;
    className?: string;
}

/** Searchable member combobox (Popover + Command), active members only. */
export function MemberPicker({ value, onChange, exclude = [], placeholder = "Pick a member", className, valueLabel }: MemberPickerProps) {
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState("");
    const [debounced, setDebounced] = useState("");
    const [selectedLabel, setSelectedLabel] = useState<string | null>(null);
    useEffect(() => {
        const t = setTimeout(() => setDebounced(search), 250);
        return () => clearTimeout(t);
    }, [search]);
    const members = useMembers({ status: "ACTIVE", limit: 20, ...(debounced && { search: debounced }) }, { enabled: open });
    const rows = (members.data?.data ?? []).filter((m) => !exclude.includes(m.id));

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button type="button" variant="outline" role="combobox" aria-expanded={open} className={cn("w-full justify-between font-normal", className)}>
                    <span className={cn("truncate", !value && "text-muted-foreground")}>{value ? selectedLabel ?? valueLabel ?? "Selected member" : placeholder}</span>
                    <ChevronsUpDown className="opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[--radix-popover-trigger-width] min-w-64 p-0" align="start">
                <Command shouldFilter={false}>
                    <CommandInput placeholder="Search by name or email…" value={search} onValueChange={setSearch} />
                    <CommandList>
                        <CommandEmpty>{members.isFetching ? "Searching…" : "No members found."}</CommandEmpty>
                        <CommandGroup>
                            {rows.map((m) => {
                                const label = personName(m.user);
                                return (
                                    <CommandItem
                                        key={m.id}
                                        value={m.id}
                                        onSelect={() => {
                                            setSelectedLabel(label);
                                            onChange(m.id, label, m);
                                            setOpen(false);
                                        }}
                                    >
                                        <Check className={cn("size-4", value === m.id ? "opacity-100" : "opacity-0")} />
                                        <div className="min-w-0">
                                            <div className="truncate text-[13px]">{label}</div>
                                            <div className="truncate text-xs text-muted-foreground">{m.user.email}</div>
                                        </div>
                                    </CommandItem>
                                );
                            })}
                        </CommandGroup>
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    );
}
