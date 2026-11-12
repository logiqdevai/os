import { useEffect } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SaveStatus } from "@/components/ui/save-status";
import { formatDate, formatMoney } from "@/lib/format";
import { getDropdownOptionLabel } from "@/lib/dropdown-option-label.utils";
import { ProposalPaymentTriggerFormOptions } from "@/config/constants/dropdowns/proposals/proposal-content.options";
import { useVersionAutosave } from "@/features/proposals/hooks/use-version-autosave";
import type { PaymentInput, ProposalDetail, ProposalPaymentTrigger } from "@/features/proposals/interfaces/proposals.interfaces";

interface Row {
    key: string;
    name: string;
    trigger: ProposalPaymentTrigger;
    mode: "percent" | "amount";
    value: string;
    due_date: string;
    milestone_name: string;
    frequency: string;
}

const toRows = (p: ProposalDetail): Row[] =>
    (p.version?.payment_schedule ?? []).map((s, i) => ({
        key: s.id ?? `r${i}`,
        name: s.name,
        trigger: s.trigger,
        mode: s.amount !== null && s.percentage === null ? "amount" : "percent",
        value: s.percentage !== null ? String(Number(s.percentage)) : s.amount !== null ? String(Number(s.amount)) : "",
        due_date: s.due_date ? s.due_date.slice(0, 10) : "",
        milestone_name: s.milestone_name ?? "",
        frequency: s.frequency ?? "",
    }));
const toInput = (r: Row): PaymentInput => {
    const n = r.value.trim() === "" ? null : Number(r.value);
    return {
        name: r.name.trim(),
        trigger: r.trigger,
        percentage: r.mode === "percent" ? n : null,
        amount: r.mode === "amount" ? n : null,
        due_date: r.trigger === "ON_DATE" && r.due_date ? r.due_date : null,
        milestone_name: r.trigger === "ON_MILESTONE" ? r.milestone_name || null : null,
        frequency: r.trigger === "RECURRING" ? r.frequency || "monthly" : null,
    };
};

type ScheduleDraft = { rows: Row[]; terms: string; validity: string };
const toDraft = (p: ProposalDetail): ScheduleDraft => ({ rows: toRows(p), terms: p.version?.payment_terms ?? "", validity: String(p.version?.validity_days ?? 30) });
const isInvalid = (d: ScheduleDraft) => d.rows.some((r) => !r.name.trim()) || Number.isNaN(Number(d.validity)) || Number(d.validity) < 1;

/**
 * Payment schedule (must add up to 100% of the base total before sending), payment terms and validity.
 * Autosaves (no Save / Discard); incomplete rows are not sent until they are valid.
 */
export function ScheduleEditor({ proposal, editable, onDirtyChange }: { proposal: ProposalDetail; editable: boolean; onDirtyChange: (d: boolean) => void }) {
    const v = proposal.version!;
    const { draft, setDraft, autosave, dirty } = useVersionAutosave({
        proposal, editable, toDraft,
        toPayload: (d: ScheduleDraft) => ({ payment_schedule: d.rows.map(toInput), payment_terms: d.terms || null, validity_days: Number(d.validity) }),
        valid: (d) => !isInvalid(d),
    });
    const { rows, terms, validity } = draft;
    const setRows = (fn: (all: Row[]) => Row[]) => setDraft((d) => ({ ...d, rows: fn(d.rows) }));
    const setTerms = (t: string) => setDraft((d) => ({ ...d, terms: t }));
    const setValidity = (x: string) => setDraft((d) => ({ ...d, validity: x }));
    useEffect(() => onDirtyChange(dirty), [dirty, onDirtyChange]);

    const gross = Number(v.gross_total);
    const allocated = rows.filter((r) => r.trigger !== "RECURRING").reduce((a, r) => a + (r.mode === "percent" ? Number(r.value || 0) : gross > 0 ? (Number(r.value || 0) / gross) * 100 : 0), 0);
    const fixedCount = rows.filter((r) => r.trigger !== "RECURRING").length;
    const balanced = fixedCount === 0 || Math.abs(allocated - 100) < 0.5;
    const invalid = isInvalid(draft);
    const set = (key: string, patch: Partial<Row>) => setRows((all) => all.map((r) => (r.key === key ? { ...r, ...patch } : r)));


    return (
        <div className="space-y-4">
            <div className="rounded-lg border border-border bg-card">
                <div className="flex flex-wrap items-center gap-2 border-b border-border px-3 py-2">
                    <span className="text-[13px] font-medium text-foreground">Payment schedule</span>
                    {fixedCount > 0 && <Badge variant={balanced ? "success" : "warning"}>{Math.round(allocated * 100) / 100}% allocated</Badge>}
                    {editable && (
                        <Button size="sm" variant="ghost" className="ml-auto" onClick={() => setRows((all) => [...all, { key: `new-${Date.now()}`, name: all.length ? "Milestone payment" : "Deposit", trigger: all.length ? "ON_MILESTONE" : "ON_ACCEPTANCE", mode: "percent", value: String(Math.max(0, Math.round(100 - allocated))), due_date: "", milestone_name: "", frequency: "" }])}>
                            <Plus /> Add payment
                        </Button>
                    )}
                </div>
                {rows.length === 0 ? (
                    <p className="px-3 py-6 text-center text-[13px] text-muted-foreground">No schedule. The customer pays according to the payment terms.</p>
                ) : (
                    <ul className="divide-y divide-border">
                        {rows.map((r) =>
                            editable ? (
                                <li key={r.key} className="grid gap-2 p-3 sm:grid-cols-[minmax(0,1fr)_170px_150px_minmax(0,1fr)_32px] sm:items-center">
                                    <Input aria-label="Payment name" value={r.name} onChange={(e) => set(r.key, { name: e.target.value })} className="h-8" />
                                    <Select value={r.trigger} onValueChange={(t) => set(r.key, { trigger: t as ProposalPaymentTrigger })}>
                                        <SelectTrigger className="h-8" aria-label="When"><SelectValue /></SelectTrigger>
                                        <SelectContent>{ProposalPaymentTriggerFormOptions.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent>
                                    </Select>
                                    <div className="flex gap-1">
                                        <Input aria-label="Share" inputMode="decimal" value={r.value} onChange={(e) => set(r.key, { value: e.target.value })} className="h-8 text-right" />
                                        <Select value={r.mode} onValueChange={(m) => set(r.key, { mode: m as Row["mode"] })}>
                                            <SelectTrigger className="h-8 w-16" aria-label="Share type"><SelectValue /></SelectTrigger>
                                            <SelectContent><SelectItem value="percent">%</SelectItem><SelectItem value="amount">{proposal.currency}</SelectItem></SelectContent>
                                        </Select>
                                    </div>
                                    {r.trigger === "ON_DATE" ? (
                                        <Input aria-label="Due date" type="date" value={r.due_date} onChange={(e) => set(r.key, { due_date: e.target.value })} className="h-8" />
                                    ) : r.trigger === "ON_MILESTONE" ? (
                                        <Input aria-label="Milestone" placeholder="Milestone, e.g. Design approved" value={r.milestone_name} onChange={(e) => set(r.key, { milestone_name: e.target.value })} className="h-8" />
                                    ) : r.trigger === "RECURRING" ? (
                                        <Input aria-label="Frequency" placeholder="monthly" value={r.frequency} onChange={(e) => set(r.key, { frequency: e.target.value })} className="h-8" />
                                    ) : (
                                        <span className="text-xs text-muted-foreground">{r.mode === "percent" && gross ? formatMoney((gross * Number(r.value || 0)) / 100, proposal.currency) : ""}</span>
                                    )}
                                    <Button variant="ghost" size="icon-sm" aria-label="Remove payment" onClick={() => setRows((all) => all.filter((x) => x.key !== r.key))}><Trash2 /></Button>
                                </li>
                            ) : (
                                <li key={r.key} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5 text-[13px]">
                                    <div>
                                        <div className="font-medium text-foreground">{r.name}</div>
                                        <div className="text-xs text-muted-foreground">
                                            {getDropdownOptionLabel(ProposalPaymentTriggerFormOptions, r.trigger)}
                                            {r.milestone_name ? ` · ${r.milestone_name}` : ""}
                                            {r.due_date ? ` · ${formatDate(r.due_date)}` : ""}
                                        </div>
                                    </div>
                                    <span className="tabular text-foreground">{r.mode === "percent" ? `${r.value}% · ${formatMoney((gross * Number(r.value || 0)) / 100, proposal.currency)}` : formatMoney(r.value, proposal.currency)}</span>
                                </li>
                            )
                        )}
                    </ul>
                )}
            </div>
            <div className="grid gap-4 rounded-lg border border-border bg-card p-4 sm:grid-cols-[minmax(0,1fr)_160px]">
                <div className="space-y-1.5">
                    <Label htmlFor="payment-terms">Payment terms</Label>
                    <Textarea id="payment-terms" rows={3} disabled={!editable} value={terms} onChange={(e) => setTerms(e.target.value)} placeholder="Invoices are due within 14 days." />
                </div>
                <div className="space-y-1.5">
                    <Label htmlFor="validity">Valid for (days)</Label>
                    <Input id="validity" inputMode="numeric" disabled={!editable} value={validity} onChange={(e) => setValidity(e.target.value)} />
                    <p className="text-xs text-muted-foreground">The valid-until date is set when you send.</p>
                </div>
            </div>
            {editable && (
                <div className="flex min-h-6 items-center justify-end gap-2">
                    {(invalid || !balanced) && <span className="mr-auto text-xs text-warning">{invalid ? "Every payment needs a name, and validity at least 1 day, to be saved" : "The schedule must add up to 100% before sending"}</span>}
                    <SaveStatus state={autosave} />
                </div>
            )}
        </div>
    );
}
