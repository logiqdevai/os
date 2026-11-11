import { useState } from "react";
import { Check, Plus, X } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useCalendarPeople } from "@/features/calendar/hooks/use-calendar";
import type { Person } from "@/features/calendar/interfaces/calendar.interfaces";

interface PeoplePickerProps {
    value: string[];
    onChange: (ids: string[]) => void;
    /** Names for ids already selected (edit mode) when they are not in the current search page. */
    known?: Record<string, string>;
    placeholder?: string;
    excludeMe?: boolean;
    label?: string;
}

/** Multi-select of active members (Popover + Command combobox, server search). */
export function PeoplePicker({ value, onChange, known = {}, placeholder = "Add people", excludeMe, label = "Add people" }: PeoplePickerProps) {
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState("");
    const people = useCalendarPeople(search, open);
    const [names, setNames] = useState<Record<string, string>>({});
    const nameOf = (id: string) => names[id] ?? known[id] ?? people.data?.find((p) => p.id === id)?.name ?? "Member";

    const toggle = (p: Person) => {
        setNames((n) => ({ ...n, [p.id]: p.name }));
        onChange(value.includes(p.id) ? value.filter((x) => x !== p.id) : [...value, p.id]);
    };

    return (
        <div className="space-y-2">
            {value.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                    {value.map((id) => (
                        <Badge key={id} variant="secondary" className="h-6 gap-1 pr-0.5">
                            {nameOf(id)}
                            <button type="button" className="rounded-xs p-0.5 hover:bg-accent" onClick={() => onChange(value.filter((x) => x !== id))} aria-label={`Remove ${nameOf(id)}`}>
                                <X className="size-3" />
                            </button>
                        </Badge>
                    ))}
                </div>
            )}
            <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                    <Button type="button" variant="outline" size="sm" aria-label={label}><Plus /> {placeholder}</Button>
                </PopoverTrigger>
                <PopoverContent className="w-72 p-0" align="start">
                    <Command shouldFilter={false}>
                        <CommandInput placeholder="Search members…" value={search} onValueChange={setSearch} />
                        <CommandList>
                            <CommandEmpty>{people.isLoading ? "Searching…" : "No members found"}</CommandEmpty>
                            <CommandGroup>
                                {(people.data ?? []).filter((p) => !(excludeMe && p.is_me)).map((p) => (
                                    <CommandItem key={p.id} value={p.id} onSelect={() => toggle(p)}>
                                        <Check className={cn("size-4", value.includes(p.id) ? "opacity-100" : "opacity-0")} />
                                        <div className="min-w-0">
                                            <div className="truncate text-[13px]">{p.name}{p.is_me ? " (you)" : ""}</div>
                                            <div className="truncate text-xs text-muted-foreground">{p.email}</div>
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
