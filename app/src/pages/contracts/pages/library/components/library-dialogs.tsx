import { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ApprovalRuleFieldOptions, ApprovalRuleOperatorOptions, ContractClauseCategoryOptions } from "@/config/constants/dropdowns/contracts/contract-library.options";
import { ContractRenewalTypeFormOptions } from "@/config/constants/dropdowns/contracts/contract-terms.options";
import {
    useAddClauseVersion, useContractTemplates, useCreateApprovalRule, useCreateContractClause, useCreateContractType, useUpdateApprovalRule, useUpdateContractClause, useUpdateContractType,
} from "@/features/contracts/hooks/use-contracts";
import type { ApprovalRule, ContractClause, ContractRenewalType, ContractType } from "@/features/contracts/interfaces/contracts.interfaces";
import { ContractLookupPicker } from "../../../components/contract-badges";

const NONE = "__none";

/** New clause, or edit metadata + add a new text version (old versions stay attached to the contracts that used them). */
export function ClauseDialog({ open, onOpenChange, clause }: { open: boolean; onOpenChange: (o: boolean) => void; clause: ContractClause | null }) {
    const create = useCreateContractClause();
    const update = useUpdateContractClause();
    const addVersion = useAddClauseVersion();
    const pending = create.isPending || update.isPending || addVersion.isPending;
    const [key, setKey] = useState("");
    const [name, setName] = useState("");
    const [category, setCategory] = useState("other");
    const [description, setDescription] = useState("");
    const [text, setText] = useState("");
    const [summary, setSummary] = useState("");
    useEffect(() => {
        if (!open) return;
        setKey(clause?.key ?? ""); setName(clause?.name ?? ""); setCategory(clause?.category ?? "other"); setDescription(clause?.description ?? ""); setText(clause?.current_version?.text ?? ""); setSummary("");
    }, [open, clause]);
    const submit = async () => {
        if (!clause) {
            create.mutate({ key: key.trim(), name: name.trim(), category, description: description || undefined, text }, { onSuccess: () => onOpenChange(false) });
            return;
        }
        try {
            if (name !== clause.name || category !== clause.category || description !== (clause.description ?? "")) await update.mutateAsync({ id: clause.id, name: name.trim(), category, description: description || undefined });
            if (text !== (clause.current_version?.text ?? "")) await addVersion.mutateAsync({ id: clause.id, text, change_summary: summary || undefined });
            onOpenChange(false);
        } catch {
            // already toasted by the global MutationCache; the dialog stays open with the edits
        }
    };
    return (
        <Dialog open={open} onOpenChange={(o) => !pending && onOpenChange(o)}>
            <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
                <DialogHeader><DialogTitle>{clause ? `Edit ${clause.name}` : "New clause"}</DialogTitle><DialogDescription>{clause ? `Version ${clause.current_version?.version_number ?? 1}. Changing the text creates a new version.` : "Approved language reused across templates and contracts."}</DialogDescription></DialogHeader>
                <div className="space-y-3">
                    <div className="grid gap-3 sm:grid-cols-3">
                        <div className="space-y-1.5"><Label htmlFor="cl-key">Key</Label><Input id="cl-key" disabled={!!clause} value={key} onChange={(e) => setKey(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_"))} placeholder="limitation_of_liability" /></div>
                        <div className="space-y-1.5"><Label htmlFor="cl-name">Name</Label><Input id="cl-name" value={name} onChange={(e) => setName(e.target.value)} /></div>
                        <div className="space-y-1.5"><Label>Category</Label><Select value={category} onValueChange={setCategory}><SelectTrigger aria-label="Category"><SelectValue /></SelectTrigger><SelectContent>{ContractClauseCategoryOptions.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent></Select></div>
                    </div>
                    <div className="space-y-1.5"><Label htmlFor="cl-desc">When to use it</Label><Input id="cl-desc" value={description} onChange={(e) => setDescription(e.target.value)} /></div>
                    <div className="space-y-1.5"><Label htmlFor="cl-text">Text</Label><Textarea id="cl-text" rows={10} className="font-mono text-[13px]" value={text} onChange={(e) => setText(e.target.value)} /></div>
                    {clause && text !== (clause.current_version?.text ?? "") && <div className="space-y-1.5"><Label htmlFor="cl-sum">What changed</Label><Input id="cl-sum" value={summary} onChange={(e) => setSummary(e.target.value)} /></div>}
                </div>
                <DialogFooter>
                    <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={pending}>Cancel</Button>
                    <Button loading={pending} disabled={!name.trim() || !text.trim() || (!clause && !key.trim())} onClick={submit}>{clause ? "Save" : "Create clause"}</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

export function TypeDialog({ open, onOpenChange, type }: { open: boolean; onOpenChange: (o: boolean) => void; type: ContractType | null }) {
    const create = useCreateContractType();
    const update = useUpdateContractType();
    const templates = useContractTemplates({ limit: 100 });
    const pending = create.isPending || update.isPending;
    const [name, setName] = useState("");
    const [description, setDescription] = useState("");
    const [renewal, setRenewal] = useState<ContractRenewalType>("NONE");
    const [notice, setNotice] = useState("");
    const [template, setTemplate] = useState(NONE);
    useEffect(() => {
        if (!open) return;
        setName(type?.name ?? ""); setDescription(type?.description ?? ""); setRenewal(type?.default_renewal_type ?? "NONE"); setNotice(type?.default_notice_days != null ? String(type.default_notice_days) : ""); setTemplate(type?.default_template_id ?? NONE);
    }, [open, type]);
    const submit = () => {
        const dto = { name: name.trim(), description: description || undefined, default_renewal_type: renewal, default_notice_days: notice ? Number(notice) : undefined, default_template_id: template !== NONE ? template : undefined };
        // Multi-field definition: stays a dialog with Save; closes on success, failures toast globally.
        const opts = { onSuccess: () => onOpenChange(false) };
        if (type) update.mutate({ id: type.id, ...dto }, opts);
        else create.mutate(dto, opts);
    };
    return (
        <Dialog open={open} onOpenChange={(o) => !pending && onOpenChange(o)}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader><DialogTitle>{type ? `Edit ${type.name}` : "New contract type"}</DialogTitle><DialogDescription>Defaults applied when a contract of this type is created.</DialogDescription></DialogHeader>
                <div className="space-y-3">
                    <div className="space-y-1.5"><Label htmlFor="ty-name">Name</Label><Input id="ty-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Retainer" /></div>
                    <div className="space-y-1.5"><Label htmlFor="ty-desc">Description</Label><Input id="ty-desc" value={description} onChange={(e) => setDescription(e.target.value)} /></div>
                    <div className="grid gap-3 sm:grid-cols-2">
                        <div className="space-y-1.5"><Label>Default renewal</Label><Select value={renewal} onValueChange={(v) => setRenewal(v as ContractRenewalType)}><SelectTrigger aria-label="Default renewal"><SelectValue /></SelectTrigger><SelectContent>{ContractRenewalTypeFormOptions.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent></Select></div>
                        <div className="space-y-1.5"><Label htmlFor="ty-notice">Notice (days)</Label><Input id="ty-notice" inputMode="numeric" value={notice} onChange={(e) => setNotice(e.target.value.replace(/\D/g, ""))} /></div>
                    </div>
                    <div className="space-y-1.5"><Label>Default template</Label><Select value={template} onValueChange={setTemplate}><SelectTrigger aria-label="Default template"><SelectValue /></SelectTrigger><SelectContent><SelectItem value={NONE}>None</SelectItem>{templates.data?.data.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent></Select></div>
                </div>
                <DialogFooter>
                    <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={pending}>Cancel</Button>
                    <Button loading={pending} disabled={!name.trim()} onClick={submit}>{type ? "Save" : "Create type"}</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

type Cond = { field: string; operator: string; value: string };
type Step = { step: number; name: string; membership_id: string | null };

export function ContractRuleDialog({ open, onOpenChange, rule }: { open: boolean; onOpenChange: (o: boolean) => void; rule: ApprovalRule | null }) {
    const create = useCreateApprovalRule();
    const update = useUpdateApprovalRule();
    const pending = create.isPending || update.isPending;
    const [name, setName] = useState("");
    const [enabled, setEnabled] = useState(true);
    const [conds, setConds] = useState<Cond[]>([]);
    const [steps, setSteps] = useState<Step[]>([]);
    useEffect(() => {
        if (!open) return;
        setName(rule?.name ?? ""); setEnabled(rule?.enabled ?? true);
        setConds(rule?.conditions.map((c) => ({ field: c.field, operator: c.operator, value: String(c.value) })) ?? [{ field: ApprovalRuleFieldOptions[0]?.id ?? "total_value", operator: ">=", value: "50000" }]);
        setSteps(rule?.steps.map((s) => ({ step: s.step, name: s.name ?? "", membership_id: s.approver.membership_id ?? null })) ?? [{ step: 1, name: "Legal", membership_id: null }]);
    }, [open, rule]);
    const invalid = !name.trim() || !conds.length || !steps.length || steps.some((s) => !s.membership_id);
    const submit = () => {
        const dto = {
            name: name.trim(), enabled, priority: rule?.priority ?? 0,
            conditions: conds.map((c) => ({ field: c.field, operator: c.operator, value: c.value !== "" && !Number.isNaN(Number(c.value)) ? Number(c.value) : c.value === "true" ? true : c.value === "false" ? false : c.value })),
            steps: steps.map((s) => ({ step: s.step, name: s.name || undefined, approver: { membership_id: s.membership_id as string } })),
        };
        // Multi-step rule editor: stays a dialog with Save; closes on success, failures toast globally.
        const opts = { onSuccess: () => onOpenChange(false) };
        if (rule) update.mutate({ id: rule.id, ...dto }, opts);
        else create.mutate(dto, opts);
    };
    return (
        <Dialog open={open} onOpenChange={(o) => !pending && onOpenChange(o)}>
            <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
                <DialogHeader><DialogTitle>{rule ? "Edit approval rule" : "New approval rule"}</DialogTitle><DialogDescription>When all conditions match a contract submitted for approval, these steps are requested in order.</DialogDescription></DialogHeader>
                <div className="space-y-4">
                    <div className="space-y-1.5"><Label htmlFor="cr-name">Name</Label><Input id="cr-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="High-value contracts need Legal" /></div>
                    <div className="space-y-2">
                        <div className="flex items-center justify-between"><Label>Conditions</Label><Button size="sm" variant="ghost" onClick={() => setConds((all) => [...all, { field: ApprovalRuleFieldOptions[0]?.id ?? "total_value", operator: ">=", value: "" }])}><Plus /> Add</Button></div>
                        {conds.map((c, i) => (
                            <div key={i} className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_140px_120px_32px]">
                                <Select value={c.field} onValueChange={(v) => setConds((all) => all.map((x, j) => (j === i ? { ...x, field: v } : x)))}><SelectTrigger className="h-8" aria-label="Field"><SelectValue /></SelectTrigger><SelectContent>{ApprovalRuleFieldOptions.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent></Select>
                                <Select value={c.operator} onValueChange={(v) => setConds((all) => all.map((x, j) => (j === i ? { ...x, operator: v } : x)))}><SelectTrigger className="h-8" aria-label="Operator"><SelectValue /></SelectTrigger><SelectContent>{ApprovalRuleOperatorOptions.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent></Select>
                                <Input aria-label="Value" className="h-8" value={c.value} onChange={(e) => setConds((all) => all.map((x, j) => (j === i ? { ...x, value: e.target.value } : x)))} />
                                <Button variant="ghost" size="icon-sm" aria-label="Remove condition" onClick={() => setConds((all) => all.filter((_, j) => j !== i))}><Trash2 /></Button>
                            </div>
                        ))}
                    </div>
                    <div className="space-y-2">
                        <div className="flex items-center justify-between"><Label>Steps</Label><Button size="sm" variant="ghost" onClick={() => setSteps((all) => [...all, { step: (all[all.length - 1]?.step ?? 0) + 1, name: "", membership_id: null }])}><Plus /> Add step</Button></div>
                        {steps.map((s, i) => (
                            <div key={i} className="grid gap-2 sm:grid-cols-[70px_minmax(0,1fr)_minmax(0,1.2fr)_32px]">
                                <Input aria-label="Step" className="h-9" inputMode="numeric" value={String(s.step)} onChange={(e) => setSteps((all) => all.map((x, j) => (j === i ? { ...x, step: Math.max(1, Number(e.target.value) || 1) } : x)))} />
                                <Input aria-label="Step name" className="h-9" placeholder="Legal" value={s.name} onChange={(e) => setSteps((all) => all.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} />
                                <ContractLookupPicker kind="members" ariaLabel="Approver" value={s.membership_id} clearable={false} placeholder="Approver" onChange={(id) => setSteps((all) => all.map((x, j) => (j === i ? { ...x, membership_id: id } : x)))} />
                                <Button variant="ghost" size="icon-sm" aria-label="Remove step" onClick={() => setSteps((all) => all.filter((_, j) => j !== i))}><Trash2 /></Button>
                            </div>
                        ))}
                    </div>
                    <label className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-[13px]">Enabled <Switch checked={enabled} onCheckedChange={setEnabled} /></label>
                </div>
                <DialogFooter>
                    <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={pending}>Cancel</Button>
                    <Button loading={pending} disabled={invalid} onClick={submit}>{rule ? "Save rule" : "Create rule"}</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
