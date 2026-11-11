import { ListTree, Plus, X } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ConditionOperatorOptions } from "@/config/constants/dropdowns/automation/automation.options";
import type { CatalogField, ConditionGroup, ConditionOperator, ConditionPredicate } from "@/features/automation/interfaces/automation.interfaces";

const NO_VALUE: ConditionOperator[] = ["exists", "not_exists", "changed"];

interface Props {
    value: ConditionGroup | null | undefined;
    onChange: (next: ConditionGroup) => void;
    fields?: CatalogField[];
    disabled?: boolean;
}

/** Flat condition list (all / any). Nested groups from imports are kept untouched. */
export function ConditionsEditor({ value, onChange, fields = [], disabled }: Props) {
    const mode: "all" | "any" = value?.any?.length && !value?.all?.length ? "any" : "all";
    const list = ((mode === "any" ? value?.any : value?.all) ?? []).filter((n): n is ConditionPredicate => "operator" in n);
    const nested = ((mode === "any" ? value?.any : value?.all) ?? []).filter((n) => !("operator" in n));
    const suggestions = ["event.entity_id", "event.actor_membership_id", ...fields.map((f) => `event.payload.${f.path}`)];

    const emit = (items: ConditionPredicate[], m = mode) => onChange({ ...(value?.not ? { not: value.not } : {}), [m]: [...items, ...nested] });
    const update = (i: number, patch: Partial<ConditionPredicate>) => emit(list.map((c, idx) => (idx === i ? { ...c, ...patch } : c)));

    return (
        <div className="space-y-3">
            {list.length > 1 && (
                <div className="flex flex-wrap items-center gap-2 text-[13px] text-muted-foreground">
                    Match
                    <Select value={mode} onValueChange={(m) => emit(list, m as "all" | "any")} disabled={disabled}>
                        <SelectTrigger className="h-8 w-28" aria-label="Match mode"><SelectValue /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">all</SelectItem>
                            <SelectItem value="any">any</SelectItem>
                        </SelectContent>
                    </Select>
                    of these conditions
                </div>
            )}
            {list.map((c, i) => (
                <div key={i} className="grid gap-2 rounded-md border border-border bg-secondary/40 p-2 sm:grid-cols-[1fr_180px_1fr_auto]">
                    <div className="flex gap-1">
                        <Input value={c.path} onChange={(e) => update(i, { path: e.target.value })} placeholder="event.payload.amount" aria-label="Field" disabled={disabled} className="font-mono text-xs" />
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button type="button" variant="outline" size="icon" aria-label="Pick a field" disabled={disabled}><ListTree /></Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="max-h-72 overflow-y-auto">
                                {suggestions.map((sug) => <DropdownMenuItem key={sug} onSelect={() => update(i, { path: sug })} className="font-mono text-xs">{sug}</DropdownMenuItem>)}
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                    <Select value={c.operator} onValueChange={(v) => update(i, { operator: v as ConditionOperator })} disabled={disabled}>
                        <SelectTrigger aria-label="Operator"><SelectValue /></SelectTrigger>
                        <SelectContent>{ConditionOperatorOptions.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent>
                    </Select>
                    {NO_VALUE.includes(c.operator) ? (
                        <div className="hidden sm:block" />
                    ) : (
                        <Input
                            value={Array.isArray(c.value) ? c.value.join(", ") : c.value === undefined || c.value === null ? "" : String(c.value)}
                            onChange={(e) => update(i, { value: c.operator === "in" || c.operator === "not_in" ? e.target.value.split(",").map((s) => s.trim()).filter(Boolean) : e.target.value })}
                            placeholder="Value"
                            aria-label="Value"
                            disabled={disabled}
                        />
                    )}
                    <Button type="button" variant="ghost" size="icon" aria-label="Remove condition" onClick={() => emit(list.filter((_, idx) => idx !== i))} disabled={disabled}>
                        <X />
                    </Button>
                </div>
            ))}
            {nested.length > 0 && <p className="text-xs text-muted-foreground">{nested.length} nested condition group(s) from an import are kept as they are.</p>}
            <Button type="button" variant="outline" size="sm" onClick={() => emit([...list, { path: suggestions[2] ?? "event.payload.", operator: "eq", value: "" }])} disabled={disabled}>
                <Plus /> Add condition
            </Button>
        </div>
    );
}
