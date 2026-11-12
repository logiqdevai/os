import { useEffect, useState } from "react";
import { SaveStatus } from "@/components/ui/save-status";
import { useAutosave } from "@/hooks/use-autosave";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { usePermission } from "@/hooks/use-permission";
import {
    BillingFrequencyOptions, ContractAmendmentKindOptions, ContractRenewalTypeFormOptions, ContractTerminationTypeOptions, RenewalDecisionOptions, RenewalValueChangeOptions, TerminationObligationHandlingOptions,
} from "@/config/constants/dropdowns/contracts/contract-terms.options";
import { useAmendContract, useRenewContract, useRenewalDecision, useTerminateContract, useUpdateContract } from "@/features/contracts/hooks/use-contracts";
import type { ContractDetail, ContractRenewalType } from "@/features/contracts/interfaces/contracts.interfaces";
import { ContractLookupPicker } from "../../../components/contract-badges";

interface P { contract: ContractDetail; open: boolean; onOpenChange: (o: boolean) => void }
const NONE = "__none";
const d = (v: string | null | undefined) => (v ? v.slice(0, 10) : "");
/** Edit record metadata: dates, renewal, value (confidential), owner. Autosaves — no Save button. */
export function EditContractDialog({ contract, open, onOpenChange }: P) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-lg">
                {/* Mounted per opening, so the form starts from the current record and nothing is re-saved on open. */}
                {open && <EditContractForm contract={contract} onDone={() => onOpenChange(false)} />}
            </DialogContent>
        </Dialog>
    );
}

function EditContractForm({ contract, onDone }: { contract: ContractDetail; onDone: () => void }) {
    // The dialog shows failures in <SaveStatus /> with Retry, so no toast.
    const update = useUpdateContract({ errorToast: false });
    const canValue = usePermission("contracts.confidential_terms.read");
    const [f, setF] = useState(() => ({
        title: contract.title, owner: contract.owner_membership_id, start: d(contract.start_date), end: d(contract.end_date), notice: contract.notice_days != null ? String(contract.notice_days) : "",
        renewal: contract.renewal_type as ContractRenewalType, term: contract.renewal_term_months != null ? String(contract.renewal_term_months) : "", total: contract.total_value ?? "", recurring: contract.recurring_value ?? "",
        freq: contract.billing_frequency ?? NONE, terms: contract.payment_terms ?? "",
    }));
    const n = (v: string) => (v.trim() === "" ? undefined : Number(v));
    const invalid = !f.title.trim() || (!!f.start && !!f.end && f.end < f.start);
    // Every valid change is saved after a short pause (optimistic: the page behind updates at once).
    const autosave = useAutosave({
        value: f,
        enabled: !invalid,
        save: (x) => update.mutateAsync({
            id: contract.id, title: x.title.trim(), owner_membership_id: x.owner ?? undefined, start_date: x.start || undefined, end_date: x.end || undefined, notice_days: n(x.notice), renewal_type: x.renewal,
            renewal_term_months: x.renewal === "NONE" ? undefined : n(x.term),
            ...(canValue && !contract.confidential_hidden && { total_value: n(x.total), recurring_value: n(x.recurring), billing_frequency: x.freq !== NONE ? x.freq : undefined, payment_terms: x.terms || undefined }),
        }),
    });
    return (
        <>
                <DialogHeader><DialogTitle>Edit {contract.number}</DialogTitle><DialogDescription>Record details save automatically. The document text is edited on the Document tab.</DialogDescription></DialogHeader>
                <div className="space-y-3">
                    <div className="space-y-1.5"><Label htmlFor="c-title">Title</Label><Input id="c-title" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></div>
                    <div className="space-y-1.5"><Label>Owner</Label><ContractLookupPicker kind="members" ariaLabel="Owner" value={f.owner} clearable={false} valueLabel={contract.owner?.user ? (contract.owner.user.display_name ?? contract.owner.user.email) : undefined} onChange={(id) => setF({ ...f, owner: id })} /></div>
                    <div className="grid gap-3 sm:grid-cols-2">
                        <div className="space-y-1.5"><Label htmlFor="c-start">Start</Label><Input id="c-start" type="date" value={f.start} onChange={(e) => setF({ ...f, start: e.target.value })} /></div>
                        <div className="space-y-1.5"><Label htmlFor="c-end">End</Label><Input id="c-end" type="date" value={f.end} onChange={(e) => setF({ ...f, end: e.target.value })} /></div>
                        <div className="space-y-1.5"><Label>Renewal</Label><Select value={f.renewal} onValueChange={(v) => setF({ ...f, renewal: v as ContractRenewalType })}><SelectTrigger aria-label="Renewal"><SelectValue /></SelectTrigger><SelectContent>{ContractRenewalTypeFormOptions.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent></Select></div>
                        <div className="space-y-1.5"><Label htmlFor="c-term">Renewal term (months)</Label><Input id="c-term" inputMode="numeric" disabled={f.renewal === "NONE"} value={f.term} onChange={(e) => setF({ ...f, term: e.target.value.replace(/\D/g, "") })} /></div>
                        <div className="space-y-1.5"><Label htmlFor="c-notice">Notice (days)</Label><Input id="c-notice" inputMode="numeric" value={f.notice} onChange={(e) => setF({ ...f, notice: e.target.value.replace(/\D/g, "") })} /></div>
                    </div>
                    {canValue && !contract.confidential_hidden && (
                        <div className="grid gap-3 border-t border-border pt-3 sm:grid-cols-2">
                            <div className="space-y-1.5"><Label htmlFor="c-total">Total value</Label><Input id="c-total" inputMode="decimal" value={f.total} onChange={(e) => setF({ ...f, total: e.target.value })} /></div>
                            <div className="space-y-1.5"><Label htmlFor="c-rec">Recurring value</Label><Input id="c-rec" inputMode="decimal" value={f.recurring} onChange={(e) => setF({ ...f, recurring: e.target.value })} /></div>
                            <div className="space-y-1.5"><Label>Billing</Label><Select value={f.freq} onValueChange={(v) => setF({ ...f, freq: v })}><SelectTrigger aria-label="Billing frequency"><SelectValue /></SelectTrigger><SelectContent><SelectItem value={NONE}>Not set</SelectItem>{BillingFrequencyOptions.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent></Select></div>
                            <div className="space-y-1.5"><Label htmlFor="c-terms">Payment terms</Label><Input id="c-terms" value={f.terms} onChange={(e) => setF({ ...f, terms: e.target.value })} /></div>
                        </div>
                    )}
                </div>
                <DialogFooter className="items-center gap-3">
                    {invalid ? <span className="mr-auto text-xs text-warning">{!f.title.trim() ? "A title is required" : "The end date is before the start"} — not saved yet</span> : <SaveStatus state={autosave} className="mr-auto" />}
                    <Button variant="outline" onClick={() => { autosave.flush(); onDone(); }}>Done</Button>
                </DialogFooter>
        </>
    );
}

/** Record the renewal decision; when renewing, create the renewal contract. @perm contracts.contracts.renew */
export function RenewDialog({ contract, open, onOpenChange }: P) {
    const navigate = useNavigate();
    const decide = useRenewalDecision();
    const renew = useRenewContract();
    const [decision, setDecision] = useState<"RENEW" | "DO_NOT_RENEW">("RENEW");
    const [reason, setReason] = useState("");
    const [term, setTerm] = useState(String(contract.renewal_term_months ?? 12));
    const [effective, setEffective] = useState("");
    const [change, setChange] = useState<"none" | "percent" | "amount">("none");
    const [value, setValue] = useState("");
    useEffect(() => {
        if (!open) return;
        const next = contract.end_date ? new Date(new Date(contract.end_date).getTime() + 86_400_000).toISOString().slice(0, 10) : "";
        setEffective(next); setTerm(String(contract.renewal_term_months ?? 12)); setDecision("RENEW"); setReason(""); setChange("none"); setValue("");
    }, [open, contract]);
    const pending = decide.isPending || renew.isPending;
    const submit = () => {
        if (decision === "DO_NOT_RENEW") {
            decide.mutate({ id: contract.id, decision, reason: reason || undefined }, { onSuccess: () => onOpenChange(false) });
            return;
        }
        decide.mutate({ id: contract.id, decision, reason: reason || undefined }, {
            onSuccess: () => renew.mutate(
                { id: contract.id, term_months: Number(term) || undefined, effective_date: effective || undefined, value_change_type: change, value_change: change === "none" ? undefined : Number(value) || 0 },
                { onSuccess: (c) => { onOpenChange(false); navigate(`/contracts/${c.id}`); } } // opens the drafted renewal
            ),
        });
    };
    return (
        <Dialog open={open} onOpenChange={(o) => !pending && onOpenChange(o)}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader><DialogTitle>Renewal of {contract.number}</DialogTitle><DialogDescription>Renewing drafts a new contract linked to this one; it goes through review and signature again.</DialogDescription></DialogHeader>
                <div className="space-y-3">
                    <Select value={decision} onValueChange={(v) => setDecision(v as typeof decision)}><SelectTrigger aria-label="Decision"><SelectValue /></SelectTrigger><SelectContent>{RenewalDecisionOptions.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent></Select>
                    {decision === "RENEW" && (
                        <div className="grid gap-3 sm:grid-cols-2">
                            <div className="space-y-1.5"><Label htmlFor="r-eff">Starts</Label><Input id="r-eff" type="date" value={effective} onChange={(e) => setEffective(e.target.value)} /></div>
                            <div className="space-y-1.5"><Label htmlFor="r-term">Term (months)</Label><Input id="r-term" inputMode="numeric" value={term} onChange={(e) => setTerm(e.target.value.replace(/\D/g, ""))} /></div>
                            <div className="space-y-1.5"><Label>Price change</Label><Select value={change} onValueChange={(v) => setChange(v as typeof change)}><SelectTrigger aria-label="Price change"><SelectValue /></SelectTrigger><SelectContent>{RenewalValueChangeOptions.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent></Select></div>
                            {change !== "none" && <div className="space-y-1.5"><Label htmlFor="r-val">{change === "percent" ? "Percent" : "Amount"}</Label><Input id="r-val" inputMode="decimal" value={value} onChange={(e) => setValue(e.target.value)} /></div>}
                        </div>
                    )}
                    <div className="space-y-1.5"><Label htmlFor="r-reason">Reason</Label><Textarea id="r-reason" rows={2} value={reason} onChange={(e) => setReason(e.target.value)} /></div>
                </div>
                <DialogFooter>
                    <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={pending}>Cancel</Button>
                    <Button loading={pending} onClick={submit}>{decision === "RENEW" ? "Create renewal" : "Record decision"}</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

/** Amendment / change order / SOW: a child contract that starts from this contract's signed text. @perm contracts.contracts.amend */
export function AmendDialog({ contract, open, onOpenChange }: P) {
    const navigate = useNavigate();
    const amend = useAmendContract();
    const [kind, setKind] = useState<"AMENDMENT" | "CHANGE_ORDER" | "SOW">("AMENDMENT");
    const [title, setTitle] = useState("");
    const [reason, setReason] = useState("");
    const [effective, setEffective] = useState("");
    const [delta, setDelta] = useState("");
    useEffect(() => { if (open) { setKind("AMENDMENT"); setTitle(""); setReason(""); setEffective(""); setDelta(""); } }, [open]);
    return (
        <Dialog open={open} onOpenChange={(o) => !amend.isPending && onOpenChange(o)}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader><DialogTitle>Change {contract.number}</DialogTitle><DialogDescription>The signed contract never changes. This drafts a linked document that you edit and sign separately.</DialogDescription></DialogHeader>
                <div className="space-y-3">
                    <Select value={kind} onValueChange={(v) => setKind(v as typeof kind)}><SelectTrigger aria-label="Kind"><SelectValue /></SelectTrigger><SelectContent>{ContractAmendmentKindOptions.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent></Select>
                    <div className="space-y-1.5"><Label htmlFor="a-title">Title</Label><Input id="a-title" value={title} placeholder={`${contract.title} — amendment`} onChange={(e) => setTitle(e.target.value)} /></div>
                    <div className="grid gap-3 sm:grid-cols-2">
                        <div className="space-y-1.5"><Label htmlFor="a-eff">Effective</Label><Input id="a-eff" type="date" value={effective} onChange={(e) => setEffective(e.target.value)} /></div>
                        <div className="space-y-1.5"><Label htmlFor="a-delta">Value change</Label><Input id="a-delta" inputMode="decimal" placeholder="0" value={delta} onChange={(e) => setDelta(e.target.value)} /></div>
                    </div>
                    <div className="space-y-1.5"><Label htmlFor="a-reason">Reason</Label><Textarea id="a-reason" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} /></div>
                </div>
                <DialogFooter>
                    <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={amend.isPending}>Cancel</Button>
                    <Button loading={amend.isPending} onClick={() => amend.mutate({ id: contract.id, kind, title: title || undefined, reason: reason || undefined, effective_date: effective || undefined, value_delta: delta ? Number(delta) : undefined }, { onSuccess: (c) => { onOpenChange(false); navigate(`/contracts/${c.id}`); } })}>Create draft</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

/** Terminate: records ContractTermination; the signed document is never altered. @perm contracts.contracts.terminate */
export function TerminateDialog({ contract, open, onOpenChange }: P) {
    const terminate = useTerminateContract();
    const [type, setType] = useState("FOR_CONVENIENCE");
    const [effective, setEffective] = useState(new Date().toISOString().slice(0, 10));
    const [notice, setNotice] = useState("");
    const [reason, setReason] = useState("");
    const [obligations, setObligations] = useState<"keep" | "waive" | "cancel">("cancel");
    return (
        <Dialog open={open} onOpenChange={(o) => !terminate.isPending && onOpenChange(o)}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader><DialogTitle>Terminate {contract.number}</DialogTitle><DialogDescription>When the effective date is today or earlier, the contract becomes Terminated right away.</DialogDescription></DialogHeader>
                <div className="space-y-3">
                    <div className="space-y-1.5"><Label>Type</Label><Select value={type} onValueChange={setType}><SelectTrigger aria-label="Termination type"><SelectValue /></SelectTrigger><SelectContent>{ContractTerminationTypeOptions.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent></Select></div>
                    <div className="grid gap-3 sm:grid-cols-2">
                        <div className="space-y-1.5"><Label htmlFor="t-notice">Notice given</Label><Input id="t-notice" type="date" value={notice} onChange={(e) => setNotice(e.target.value)} /></div>
                        <div className="space-y-1.5"><Label htmlFor="t-eff">Effective</Label><Input id="t-eff" type="date" value={effective} onChange={(e) => setEffective(e.target.value)} /></div>
                    </div>
                    <div className="space-y-1.5"><Label>Open obligations</Label><Select value={obligations} onValueChange={(v) => setObligations(v as typeof obligations)}><SelectTrigger aria-label="Open obligations"><SelectValue /></SelectTrigger><SelectContent>{TerminationObligationHandlingOptions.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent></Select></div>
                    <div className="space-y-1.5"><Label htmlFor="t-reason">Reason</Label><Textarea id="t-reason" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} /></div>
                </div>
                <DialogFooter>
                    <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={terminate.isPending}>Cancel</Button>
                    <Button variant="destructive" loading={terminate.isPending} disabled={!effective || !reason.trim()} onClick={() => terminate.mutate({ id: contract.id, type, effective_date: effective, notice_date: notice || undefined, reason, close_obligations: obligations }, { onSuccess: () => onOpenChange(false) })}>Terminate</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
