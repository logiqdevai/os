import { useState } from "react";
import { Check, ChevronsUpDown, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useCrmMembers } from "@/features/crm/settings/hooks/use-crm-settings";
import { useCompanyLookup } from "@/features/crm/companies/hooks/use-companies";
import { useContactLookup } from "@/features/crm/contacts/hooks/use-contacts";
import { contactName } from "@/features/crm/common/interfaces/crm-common.interfaces";
import { memberLabel } from "./crm-ui";

const NONE = "__none";

/** Owner / assignee picker (GET /crm/members). `allowNone` adds "Unassigned". */
export function MemberSelect({ value, onChange, allowNone, disabled, label = "Owner", className }: { value: string | undefined | null; onChange: (v: string | undefined) => void; allowNone?: boolean; disabled?: boolean; label?: string; className?: string }) {
    const members = useCrmMembers();
    return (
        // No value on create = the API makes the caller the owner, so say so instead of showing an empty field.
        <Select value={value ?? (allowNone ? NONE : "")} onValueChange={(v) => onChange(v === NONE ? undefined : v)} disabled={disabled}>
            <SelectTrigger aria-label={label} className={className}>
                <SelectValue placeholder={members.isPending ? "Loading members…" : "You (default)"} />
            </SelectTrigger>
            <SelectContent>
                {allowNone && <SelectItem value={NONE}>Unassigned</SelectItem>}
                {members.data?.map((m) => (
                    <SelectItem key={m.id} value={m.id}>{memberLabel(m)}</SelectItem>
                ))}
            </SelectContent>
        </Select>
    );
}

interface ComboProps {
    value: string | undefined | null;
    /** Label shown for the current value when it is not in the loaded results. */
    valueLabel?: string | null;
    onChange: (id: string | undefined, label?: string) => void;
    placeholder?: string;
    disabled?: boolean;
    className?: string;
}

function Combo({ value, valueLabel, onChange, placeholder, disabled, className, items, loading, search, setSearch, label }: ComboProps & { items: { id: string; label: string; hint?: string | null }[]; loading: boolean; search: string; setSearch: (s: string) => void; label: string }) {
    const [open, setOpen] = useState(false);
    const current = items.find((i) => i.id === value)?.label ?? valueLabel;
    return (
        <div className={cn("flex items-center gap-1", className)}>
            <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                    <Button type="button" variant="outline" role="combobox" aria-label={label} aria-expanded={open} disabled={disabled} className="h-8 w-full min-w-0 justify-between font-normal">
                        <span className={cn("truncate", !value && "text-muted-foreground")}>{value ? current ?? "Selected" : placeholder}</span>
                        <ChevronsUpDown className="opacity-50" />
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[var(--radix-popover-trigger-width)] min-w-64 p-0" align="start">
                    <Command shouldFilter={false}>
                        <CommandInput placeholder="Search…" value={search} onValueChange={setSearch} />
                        <CommandList>
                            <CommandEmpty>{loading ? "Searching…" : "No matches"}</CommandEmpty>
                            <CommandGroup>
                                {items.map((i) => (
                                    <CommandItem key={i.id} value={i.id} onSelect={() => { onChange(i.id, i.label); setOpen(false); }}>
                                        <Check className={cn("size-4", value === i.id ? "opacity-100" : "opacity-0")} />
                                        <div className="min-w-0">
                                            <div className="truncate">{i.label}</div>
                                            {i.hint && <div className="truncate text-xs text-muted-foreground">{i.hint}</div>}
                                        </div>
                                    </CommandItem>
                                ))}
                            </CommandGroup>
                        </CommandList>
                    </Command>
                </PopoverContent>
            </Popover>
            {value && !disabled && (
                <Button type="button" variant="ghost" size="icon-sm" aria-label={`Clear ${label.toLowerCase()}`} onClick={() => onChange(undefined)}>
                    <X />
                </Button>
            )}
        </div>
    );
}

/** Searchable company picker (GET /crm/companies/lookup). */
export function CompanyPicker(props: ComboProps) {
    const [search, setSearch] = useState("");
    const q = useCompanyLookup(search);
    const items = (q.data ?? []).map((c) => ({ id: c.id, label: c.name, hint: c.website }));
    return <Combo {...props} label="Company" placeholder={props.placeholder ?? "Choose a company"} items={items} loading={q.isFetching} search={search} setSearch={setSearch} />;
}

/** Searchable contact picker (GET /crm/contacts/lookup), optionally limited to one company. */
export function ContactPicker({ companyId, ...props }: ComboProps & { companyId?: string | null }) {
    const [search, setSearch] = useState("");
    const q = useContactLookup(search, companyId ?? undefined);
    const items = (q.data ?? []).map((c) => ({ id: c.id, label: contactName(c), hint: [c.email, c.company?.name].filter(Boolean).join(" · ") }));
    return <Combo {...props} label="Contact" placeholder={props.placeholder ?? "Choose a contact"} items={items} loading={q.isFetching} search={search} setSearch={setSearch} />;
}
