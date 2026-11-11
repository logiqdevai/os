import { useMemo, useState } from "react";
import { Check, ChevronsUpDown, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useCatalog } from "@/features/admin/permissions/hooks/use-permissions-admin";
import { ModuleKeyOptions } from "@/config/constants/dropdowns/admin/module-key.options";
import { getDropdownOptionLabel } from "@/lib/dropdown-option-label.utils";
import { cn } from "@/lib/utils";

interface PermissionPickerProps {
    value: string | undefined;
    onChange: (key: string) => void;
    /** Only offer keys the signed-in admin holds (granting). */
    onlyHeld?: boolean;
    className?: string;
}

/** Searchable permission key combobox grouped by module. */
export function PermissionPicker({ value, onChange, onlyHeld, className }: PermissionPickerProps) {
    const [open, setOpen] = useState(false);
    const catalog = useCatalog({}, open || !!value);
    const groups = useMemo(() => {
        const map = new Map<string, NonNullable<typeof catalog.data>["data"]>();
        for (const p of catalog.data?.data ?? []) {
            if (onlyHeld && !p.held) continue;
            const list = map.get(p.module) ?? [];
            list.push(p);
            map.set(p.module, list);
        }
        return [...map.entries()];
    }, [catalog.data, onlyHeld]);

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button type="button" variant="outline" role="combobox" aria-expanded={open} className={cn("w-full justify-between font-normal", className)}>
                    <span className={cn("truncate font-mono text-[12.5px]", !value && "font-sans text-muted-foreground")}>{value ?? "Pick a permission"}</span>
                    <ChevronsUpDown className="opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[var(--radix-popover-trigger-width)] min-w-72 p-0" align="start">
                <Command>
                    <CommandInput placeholder="Search keys, e.g. crm.deals…" />
                    <CommandList className="max-h-72">
                        <CommandEmpty>{catalog.isFetching ? "Loading…" : "No permission found."}</CommandEmpty>
                        {groups.map(([module, perms]) => (
                            <CommandGroup key={module} heading={getDropdownOptionLabel(ModuleKeyOptions, module)}>
                                {perms.map((p) => (
                                    <CommandItem key={p.key} value={`${p.key} ${p.description ?? ""}`} onSelect={() => { onChange(p.key); setOpen(false); }}>
                                        <Check className={cn("size-4", value === p.key ? "opacity-100" : "opacity-0")} />
                                        <span className="truncate font-mono text-[12.5px]">{p.key}</span>
                                        {p.is_sensitive && <Lock className="ml-auto size-3 text-warning" aria-label="Sensitive" />}
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
