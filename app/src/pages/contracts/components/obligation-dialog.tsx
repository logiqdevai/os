import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { getApiErrorMessage } from "@/lib/api-error";
import { personName } from "@/lib/format";
import { ObligationFrequencyOptions, ObligationStatusFormOptions, ObligationTypeFormOptions } from "@/config/constants/dropdowns/contracts/contract-obligation.options";
import { useCreateObligation, useUpdateObligation } from "@/features/contracts/hooks/use-contracts";
import type { ContractObligationStatus, ContractObligationType, Obligation } from "@/features/contracts/interfaces/contracts.interfaces";
import { ContractLookupPicker } from "./contract-badges";

const NONE = "__none";

/** Create / edit a contract obligation. @perm contracts.obligations.manage · @api POST/PATCH /contract-obligations */
export function ObligationDialog({ open, onOpenChange, contractId, obligation }: { open: boolean; onOpenChange: (o: boolean) => void; contractId: string; obligation: Obligation | null }) {
    const create = useCreateObligation();
    const update = useUpdateObligation();
    const pending = create.isPending || update.isPending;
    const [title, setTitle] = useState("");
    const [type, setType] = useState<ContractObligationType>("DELIVERABLE");
    const [status, setStatus] = useState<ContractObligationStatus>("OPEN");
    const [description, setDescription] = useState("");
    const [due, setDue] = useState("");
    const [frequency, setFrequency] = useState(NONE);
    const [reminder, setReminder] = useState("");
    const [owner, setOwner] = useState<string | null>(null);

    useEffect(() => {
        if (!open) return;
        setTitle(obligation?.title ?? "");
        setType(obligation?.type ?? "DELIVERABLE");
        setStatus(obligation?.status ?? "OPEN");
        setDescription(obligation?.description ?? "");
        setDue(obligation?.due_date?.slice(0, 10) ?? "");
        setFrequency(obligation?.frequency ?? NONE);
        setReminder(obligation?.reminder_days_before != null ? String(obligation.reminder_days_before) : "");
        setOwner(obligation?.responsible_membership_id ?? null);
    }, [open, obligation]);

    const submit = () => {
        const dto = {
            title: title.trim(),
            type,
            description: description || undefined,
            due_date: due || undefined,
            frequency: frequency !== NONE ? frequency : undefined,
            reminder_days_before: reminder ? Number(reminder) : undefined,
            responsible_membership_id: owner ?? undefined,
        };
        const opts = { onSuccess: () => { toast({ title: obligation ? "Obligation saved" : "Obligation added" }); onOpenChange(false); }, onError: (e: unknown) => toast({ variant: "destructive" as const, title: "Could not save", description: getApiErrorMessage(e) }) };
        if (obligation) update.mutate({ id: obligation.id, ...dto, status }, opts);
        else create.mutate({ contract_id: contractId, ...dto }, opts);
    };

    return (
        <Dialog open={open} onOpenChange={(o) => !pending && onOpenChange(o)}>
            <DialogContent className="sm:max-w-lg">
                <DialogHeader><DialogTitle>{obligation ? "Edit obligation" : "New obligation"}</DialogTitle><DialogDescription>Something a party must do under this contract: a deliverable, payment, report, SLA or notice.</DialogDescription></DialogHeader>
                <div className="space-y-3">
                    <div className="space-y-1.5"><Label htmlFor="ob-title">Title</Label><Input id="ob-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Monthly SLA report" /></div>
                    <div className="grid gap-3 sm:grid-cols-2">
                        <div className="space-y-1.5"><Label>Type</Label><Select value={type} onValueChange={(v) => setType(v as ContractObligationType)}><SelectTrigger aria-label="Type"><SelectValue /></SelectTrigger><SelectContent>{ObligationTypeFormOptions.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent></Select></div>
                        {obligation ? (
                            <div className="space-y-1.5"><Label>Status</Label><Select value={status} onValueChange={(v) => setStatus(v as ContractObligationStatus)}><SelectTrigger aria-label="Status"><SelectValue /></SelectTrigger><SelectContent>{ObligationStatusFormOptions.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent></Select></div>
                        ) : <div className="hidden sm:block" />}
                        <div className="space-y-1.5"><Label htmlFor="ob-due">Due date</Label><Input id="ob-due" type="date" value={due} onChange={(e) => setDue(e.target.value)} /></div>
                        <div className="space-y-1.5"><Label>Repeats</Label><Select value={frequency} onValueChange={setFrequency}><SelectTrigger aria-label="Repeats"><SelectValue /></SelectTrigger><SelectContent><SelectItem value={NONE}>Does not repeat</SelectItem>{ObligationFrequencyOptions.filter((o) => o.id !== "none").map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent></Select></div>
                        <div className="space-y-1.5"><Label>Responsible</Label><ContractLookupPicker kind="members" ariaLabel="Responsible" value={owner} valueLabel={obligation?.responsible?.user ? personName(obligation.responsible.user) : undefined} onChange={setOwner} placeholder="Team member" /></div>
                        <div className="space-y-1.5"><Label htmlFor="ob-rem">Remind days before</Label><Input id="ob-rem" inputMode="numeric" value={reminder} onChange={(e) => setReminder(e.target.value.replace(/\D/g, ""))} placeholder="7" /></div>
                    </div>
                    <div className="space-y-1.5"><Label htmlFor="ob-desc">Details</Label><Textarea id="ob-desc" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} /></div>
                </div>
                <DialogFooter>
                    <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={pending}>Cancel</Button>
                    <Button loading={pending} disabled={!title.trim()} onClick={submit}>{obligation ? "Save" : "Add obligation"}</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
