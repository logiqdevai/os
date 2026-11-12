import { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { personName } from "@/lib/format";
import { ApprovalConditionFieldOptions, ApprovalConditionOperatorOptions } from "@/config/constants/dropdowns/proposals/proposal-content.options";
import { useCreateApprovalRule, useUpdateApprovalRule } from "@/features/proposals/hooks/use-proposals";
import type { ApprovalCondition, ApprovalRule } from "@/features/proposals/interfaces/proposals.interfaces";
import { LookupPicker } from "../../../components/lookup-picker";

interface StepDraft { step: number; name: string; approver_membership_id: string | null }
interface CondDraft { field: ApprovalCondition["field"]; operator: ApprovalCondition["operator"]; value: string }

const parseValue = (c: CondDraft): ApprovalCondition["value"] =>
    c.field === "requires_contract" ? c.value === "true" : c.field === "currency" ? c.value.toUpperCase() : Number(c.value);

/** Approval rule: when ALL conditions match a submitted version, its steps are requested in order. */
export function RuleDialog({ open, onOpenChange, rule }: { open: boolean; onOpenChange: (o: boolean) => void; rule: ApprovalRule | null }) {
    const create = useCreateApprovalRule();
    const update = useUpdateApprovalRule();
    const pending = create.isPending || update.isPending;
    const [name, setName] = useState("");
    const [priority, setPriority] = useState("100");
    const [enabled, setEnabled] = useState(true);
    const [conds, setConds] = useState<CondDraft[]>([]);
    const [steps, setSteps] = useState<StepDraft[]>([]);

    useEffect(() => {
        if (!open) return;
        setName(rule?.name ?? "");
        setPriority(String(rule?.priority ?? 100));
        setEnabled(rule?.enabled ?? true);
        setConds(rule?.conditions.map((c) => ({ ...c, value: String(c.value) })) ?? [{ field: "discount_percent", operator: ">", value: "10" }]);
        setSteps(rule?.steps.map((s) => ({ ...s })) ?? [{ step: 1, name: "Finance", approver_membership_id: null }]);
    }, [open, rule]);

    const invalid = !name.trim() || !conds.length || !steps.length || steps.some((s) => !s.approver_membership_id || !s.name.trim()) || conds.some((c) => c.value.trim() === "" || (!["currency", "requires_contract"].includes(c.field) && Number.isNaN(Number(c.value))));
    const save = () => {
        const dto = {
            name: name.trim(),
            priority: Number(priority) || 100,
            enabled,
            conditions: conds.map((c) => ({ field: c.field, operator: c.operator, value: parseValue(c) })),
            steps: steps.map((s) => ({ step: s.step, name: s.name.trim(), approver_membership_id: s.approver_membership_id as string })),
        };
        // Multi-step rule editor: stays a dialog with Save; closes on success, failures toast globally.
        const opts = { onSuccess: () => onOpenChange(false) };
        if (rule) update.mutate({ id: rule.id, ...dto }, opts);
        else create.mutate(dto, opts);
    };

    return (
        <Dialog open={open} onOpenChange={(o) => !pending && onOpenChange(o)}>
            <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
                <DialogHeader>
                    <DialogTitle>{rule ? "Edit approval rule" : "New approval rule"}</DialogTitle>
                    <DialogDescription>Checked when a proposal version is submitted for review. All conditions must match.</DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                    <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_120px]">
                        <div className="space-y-1.5"><Label htmlFor="rule-name">Name</Label><Input id="rule-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Discount over 10%" /></div>
                        <div className="space-y-1.5"><Label htmlFor="rule-priority">Priority</Label><Input id="rule-priority" inputMode="numeric" value={priority} onChange={(e) => setPriority(e.target.value)} /></div>
                    </div>
                    <div className="space-y-2">
                        <div className="flex items-center justify-between"><Label>Conditions</Label><Button size="sm" variant="ghost" onClick={() => setConds((all) => [...all, { field: "gross_total", operator: ">=", value: "50000" }])}><Plus /> Add</Button></div>
                        {conds.map((c, i) => (
                            <div key={i} className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_140px_120px_32px]">
                                <Select value={c.field} onValueChange={(f) => setConds((all) => all.map((x, j) => (j === i ? { ...x, field: f as CondDraft["field"], value: f === "requires_contract" ? "true" : f === "currency" ? "EUR" : x.value } : x)))}>
                                    <SelectTrigger className="h-8" aria-label="Field"><SelectValue /></SelectTrigger>
                                    <SelectContent>{ApprovalConditionFieldOptions.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent>
                                </Select>
                                <Select value={c.operator} onValueChange={(op) => setConds((all) => all.map((x, j) => (j === i ? { ...x, operator: op as CondDraft["operator"] } : x)))}>
                                    <SelectTrigger className="h-8" aria-label="Operator"><SelectValue /></SelectTrigger>
                                    <SelectContent>{ApprovalConditionOperatorOptions.filter((o) => !["currency", "requires_contract"].includes(c.field) || ["=", "!="].includes(o.id)).map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent>
                                </Select>
                                {c.field === "requires_contract" ? (
                                    <Select value={c.value} onValueChange={(val) => setConds((all) => all.map((x, j) => (j === i ? { ...x, value: val } : x)))}>
                                        <SelectTrigger className="h-8" aria-label="Value"><SelectValue /></SelectTrigger>
                                        <SelectContent><SelectItem value="true">Yes</SelectItem><SelectItem value="false">No</SelectItem></SelectContent>
                                    </Select>
                                ) : (
                                    <Input aria-label="Value" className="h-8" value={c.value} onChange={(e) => setConds((all) => all.map((x, j) => (j === i ? { ...x, value: e.target.value } : x)))} />
                                )}
                                <Button variant="ghost" size="icon-sm" aria-label="Remove condition" onClick={() => setConds((all) => all.filter((_, j) => j !== i))}><Trash2 /></Button>
                            </div>
                        ))}
                    </div>
                    <div className="space-y-2">
                        <div className="flex items-center justify-between"><Label>Approval steps</Label><Button size="sm" variant="ghost" onClick={() => setSteps((all) => [...all, { step: (all[all.length - 1]?.step ?? 0) + 1, name: "Executive", approver_membership_id: null }])}><Plus /> Add step</Button></div>
                        {steps.map((s, i) => (
                            <div key={i} className="grid gap-2 sm:grid-cols-[70px_minmax(0,1fr)_minmax(0,1.2fr)_32px]">
                                <Input aria-label="Step number" className="h-9" inputMode="numeric" value={String(s.step)} onChange={(e) => setSteps((all) => all.map((x, j) => (j === i ? { ...x, step: Math.max(1, Number(e.target.value) || 1) } : x)))} />
                                <Input aria-label="Step name" className="h-9" value={s.name} onChange={(e) => setSteps((all) => all.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} />
                                <LookupPicker kind="members" ariaLabel="Approver" value={s.approver_membership_id} clearable={false} valueLabel={(() => { const m = rule?.approvers.find((a) => a.id === s.approver_membership_id); return m ? personName(m.user) : undefined; })()} placeholder="Approver" onChange={(id) => setSteps((all) => all.map((x, j) => (j === i ? { ...x, approver_membership_id: id } : x)))} />
                                <Button variant="ghost" size="icon-sm" aria-label="Remove step" onClick={() => setSteps((all) => all.filter((_, j) => j !== i))}><Trash2 /></Button>
                            </div>
                        ))}
                        <p className="text-xs text-muted-foreground">Steps with the same number run in parallel; higher numbers wait for lower ones.</p>
                    </div>
                    <label className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-[13px] text-foreground">Enabled <Switch checked={enabled} onCheckedChange={setEnabled} /></label>
                </div>
                <DialogFooter>
                    <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={pending}>Cancel</Button>
                    <Button loading={pending} disabled={invalid} onClick={save}>{rule ? "Save rule" : "Create rule"}</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
