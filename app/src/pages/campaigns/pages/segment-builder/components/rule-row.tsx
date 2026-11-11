import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getDropdownOptionLabel } from "@/lib/dropdown-option-label.utils";
import { SegmentOperatorOptions } from "@/config/constants/dropdowns/communications/comm-compliance.options";
import type { SegmentField, SegmentRule } from "@/features/communications/interfaces/communications.interfaces";

const NO_VALUE = ["is_set", "is_not_set"];

/** One `{ field, op, value }` condition of the segment builder. */
export function RuleRow({ rule, fields, onChange, onRemove, disabled }: { rule: SegmentRule; fields: SegmentField[]; onChange: (r: SegmentRule) => void; onRemove: () => void; disabled?: boolean }) {
    const field = fields.find((f) => f.key === rule.field) ?? fields[0];
    const groups = [...new Set(fields.map((f) => f.group))];
    const value = Array.isArray(rule.value) ? rule.value.join(", ") : rule.value === undefined || rule.value === null ? "" : String(rule.value);
    const multi = ["in", "not_in", "has", "not_has"].includes(rule.op);

    const setValue = (v: string) => onChange({ ...rule, value: multi ? v.split(",").map((x) => x.trim()).filter(Boolean) : v });

    return (
        <div className="flex flex-col gap-2 rounded-lg border border-border bg-card p-2 sm:flex-row sm:items-center">
            <Select value={field?.key} disabled={disabled} onValueChange={(key) => { const f = fields.find((x) => x.key === key)!; onChange({ field: key, op: f.ops[0], value: f.options?.[0] ?? "" }); }}>
                <SelectTrigger className="h-8 sm:w-48" aria-label="Field"><SelectValue /></SelectTrigger>
                <SelectContent>
                    {groups.map((g) => (
                        <SelectGroup key={g}>
                            <SelectLabel>{g}</SelectLabel>
                            {fields.filter((f) => f.group === g).map((f) => <SelectItem key={f.key} value={f.key}>{f.label}</SelectItem>)}
                        </SelectGroup>
                    ))}
                </SelectContent>
            </Select>
            <Select value={rule.op} disabled={disabled} onValueChange={(op) => onChange({ ...rule, op, value: NO_VALUE.includes(op) ? undefined : rule.value })}>
                <SelectTrigger className="h-8 sm:w-44" aria-label="Operator"><SelectValue /></SelectTrigger>
                <SelectContent>{field?.ops.map((op) => <SelectItem key={op} value={op}>{getDropdownOptionLabel(SegmentOperatorOptions, op)}</SelectItem>)}</SelectContent>
            </Select>
            {!NO_VALUE.includes(rule.op) && (
                field?.options?.length && !multi ? (
                    <Select value={value || field.options[0]} disabled={disabled} onValueChange={setValue}>
                        <SelectTrigger className="h-8 flex-1" aria-label="Value"><SelectValue /></SelectTrigger>
                        <SelectContent>{field.options.map((o) => <SelectItem key={o} value={o}>{o.charAt(0) + o.slice(1).toLowerCase().replace(/_/g, " ")}</SelectItem>)}</SelectContent>
                    </Select>
                ) : (
                    <Input
                        className="h-8 flex-1"
                        disabled={disabled}
                        type={field?.type === "date" && ["before", "after"].includes(rule.op) ? "date" : ["within_days", "older_than_days"].includes(rule.op) ? "number" : "text"}
                        value={value}
                        onChange={(e) => setValue(e.target.value)}
                        placeholder={multi ? (field?.options?.join(", ") ?? "value, value") : field?.type === "id" ? "Record id" : "Value"}
                        aria-label="Value"
                    />
                )
            )}
            {!disabled && <Button type="button" variant="ghost" size="icon-sm" onClick={onRemove} aria-label="Remove condition" className="self-end sm:self-auto"><X /></Button>}
        </div>
    );
}
