import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { getApiErrorMessage } from "@/lib/api-error";
import { formatDate, formatMoney } from "@/lib/format";
import { getDropdownOptionLabel } from "@/lib/dropdown-option-label.utils";
import { ProposalPaymentTriggerFormOptions } from "@/config/constants/dropdowns/proposals/proposal-content.options";
import { useSaveProposalContent } from "@/features/proposals/hooks/use-proposals";
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

/** Payment schedule (must add up to 100% of the base total before sending), payment terms and validity. */
export function ScheduleEditor({ proposal, editable, onDirtyChange }: { proposal: ProposalDetail; editable: boolean; onDirtyChange: (d: boolean) => void }) {
    const save = useSaveProposalContent();
    const v = proposal.version!;
    const [rows, setRows] = useState<Row[]>(() => toRows(proposal));
    const [terms, setTerms] = useState(v.payment_terms ?? "");
    const [validity, setValidity] = useState(String(v.validity_days ?? 30));
    const original = useMemo(() => JSON.stringify({ r: toRows(proposal).map(toInput), t: proposal.version?.payment_terms ?? "", d: String(proposal.version?.validity_days ?? 30) }), [proposal]);
    const dirty = JSON.stringify({ r: rows.map(toInput), t: terms, d: validity }) !== original;
    useEffect(() => {
        setRows(toRows(proposal));
        setTerms(proposal.version?.payment_terms ?? "");
        setValidity(String(proposal.version?.validity_days ?? 30));
    }, [proposal]);
    useEffect(() => onDirtyChange(dirty), [dirty, onDirtyChange]);

    const gross = Number(v.gross_total);
    const allocated = rows.filter((r) => r.trigger !== "RECURRING").reduce((a, r) => a + (r.mode === "percent" ? Number(r.value || 0) : gross > 0 ? (Number(r.value || 0) / gross) * 100 : 0), 0);
    const fixedCount = rows.filter((r) => r.trigger !== "RECURRING").length;
    const balanced = fixedCount === 0 || Math.abs(allocated - 100) < 0.5;
    const invalid = rows.some((r) => !r.name.trim()) || Number.isNaN(Number(validity)) || Number(validity) < 1;
    const set = (key: string, patch: Partial<Row>) => setRows((all) => all.map((r) => (r.key === key ? { ...r, ...patch } : r)));

    const submit = () =>
        save.mutate(
            { id: proposal.id, versionId: v.id, payment_schedule: rows.map(toInput), payment_terms: terms || null, validity_days: Number(validity) },
            { onSuccess: () => toast({ title: "Payment schedule saved" }), onError: (e) => toast({ variant: "destructive", title: "Could not save", description: getApiErrorMessage(e) }) }
        );

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
                <div className="flex items-center justify-end gap-2">
                    <span className="mr-auto text-xs text-muted-foreground">{!balanced ? "The schedule must add up to 100% before sending" : dirty ? "Unsaved changes" : "All changes saved"}</span>
                    <Button size="sm" variant="ghost" disabled={!dirty || save.isPending} onClick={() => { setRows(toRows(proposal)); setTerms(v.payment_terms ?? ""); setValidity(String(v.validity_days ?? 30)); }}>Discard</Button>
                    <Button size="sm" disabled={!dirty || invalid} loading={save.isPending} onClick={submit}>Save schedule</Button>
                </div>
            )}
        </div>
    );
}
