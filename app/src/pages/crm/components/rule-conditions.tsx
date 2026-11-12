import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { usePermission } from "@/hooks/use-permission";
import { getDropdownOptionLabel } from "@/lib/dropdown-option-label.utils";
import { RuleOperatorOptions } from "@/config/constants/dropdowns/crm/crm-rules.options";
import { useBranchOptions, useRuleFields } from "@/features/crm/rules/hooks/use-rules";
import { useCrmSettings } from "@/features/crm/settings/hooks/use-crm-settings";
import type { RuleCondition, RuleField } from "@/features/crm/rules/interfaces/rules.interfaces";

const VALUELESS = new Set(["is_empty", "is_not_empty"]);

/** Options for id fields (source, status, branch) so conditions never need raw ids. */
function useIdOptions() {
    const settings = useCrmSettings();
    const canBranches = usePermission("organizations.branches.read");
    const branches = useBranchOptions(canBranches);
    return {
        lead_source_id: settings.data?.lead_sources.map((s) => ({ value: s.id, label: s.name })) ?? [],
        status_id: settings.data?.lead_statuses.map((s) => ({ value: s.id, label: s.name })) ?? [],
        branch_id: branches.data?.map((b) => ({ value: b.id, label: b.name })) ?? [],
    } as Record<string, { value: string; label: string }[]>;
}

/** Human-readable summary of conditions ("Source is Website and Estimated value at least 5000"). */
export function useConditionSummary() {
    const fields = useRuleFields();
    const ids = useIdOptions();
    return (conditions: RuleCondition[]) => {
        if (!conditions.length) return "Every lead";
        return conditions.map((c) => {
            const f = fields.data?.fields.find((x) => x.key === c.field);
            const opts = ids[c.field] ?? f?.options ?? [];
            const v = VALUELESS.has(c.operator) ? "" : ` ${opts.find((o) => o.value === c.value)?.label ?? String(c.value ?? "")}`;
            return `${f?.label ?? c.field} ${getDropdownOptionLabel(RuleOperatorOptions, c.operator)}${v}`;
        }).join(" and ");
    };
}

/**
 * Editor for rule conditions (all must match). Fields from GET /crm/rules/fields (lead columns + lead custom fields).
 */
export function RuleConditionsEditor({ value, onChange, allowEmpty }: { value: RuleCondition[]; onChange: (v: RuleCondition[]) => void; allowEmpty?: boolean }) {
    const fields = useRuleFields();
    const ids = useIdOptions();
    const list = fields.data?.fields ?? [];
    const set = (i: number, patch: Partial<RuleCondition>) => onChange(value.map((c, j) => (j === i ? { ...c, ...patch } : c)));
    const optionsOf = (f: RuleField | undefined) => (f ? ids[f.key] ?? f.options ?? null : null);

    return (
        <div className="space-y-2">
            {!value.length && <p className="text-[13px] text-muted-foreground">{allowEmpty ? "No conditions: the rule applies to every lead." : "Add at least one condition."}</p>}
            {value.map((c, i) => {
                const f = list.find((x) => x.key === c.field);
                const opts = optionsOf(f);
                return (
                    <div key={i} className="grid gap-2 rounded-md border border-border p-2 sm:grid-cols-[1fr_1fr_1fr_auto] sm:border-0 sm:p-0">
                        <Select value={c.field} onValueChange={(v) => set(i, { field: v, value: null })}>
                            <SelectTrigger className="h-8" aria-label="Field"><SelectValue placeholder="Field" /></SelectTrigger>
                            <SelectContent>{list.map((x) => <SelectItem key={x.key} value={x.key}>{x.label}</SelectItem>)}</SelectContent>
                        </Select>
                        <Select value={c.operator} onValueChange={(v) => set(i, { operator: v as RuleCondition["operator"] })}>
                            <SelectTrigger className="h-8" aria-label="Operator"><SelectValue /></SelectTrigger>
                            <SelectContent>
                                {RuleOperatorOptions.filter((o) => f?.type === "number" || !["gt", "gte", "lt", "lte"].includes(o.id)).map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}
                            </SelectContent>
                        </Select>
                        {VALUELESS.has(c.operator) ? <span className="hidden sm:block" /> : opts?.length && (c.operator === "equals" || c.operator === "not_equals") ? (
                            <Select value={(c.value as string) ?? ""} onValueChange={(v) => set(i, { value: v })}>
                                <SelectTrigger className="h-8" aria-label="Value"><SelectValue placeholder="Choose…" /></SelectTrigger>
                                <SelectContent>{opts.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                            </Select>
                        ) : (
                            <Input className="h-8" aria-label="Value" inputMode={f?.type === "number" ? "decimal" : undefined} value={c.value === null || c.value === undefined ? "" : String(c.value)}
                                onChange={(e) => set(i, { value: f?.type === "number" && e.target.value !== "" && Number.isFinite(Number(e.target.value)) ? Number(e.target.value) : e.target.value })} />
                        )}
                        <Button type="button" variant="ghost" size="icon-sm" aria-label="Remove condition" onClick={() => onChange(value.filter((_, j) => j !== i))}><X /></Button>
                    </div>
                );
            })}
            <Button type="button" variant="outline" size="sm" disabled={!list.length} onClick={() => onChange([...value, { field: list[0]?.key ?? "lead_source_id", operator: "equals", value: null }])}>
                <Plus /> Add condition
            </Button>
        </div>
    );
}
