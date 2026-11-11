import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { usePermission } from "@/hooks/use-permission";
import { toast } from "@/hooks/use-toast";
import { getApiErrorMessage } from "@/lib/api-error";
import { formatMoney, personName } from "@/lib/format";
import { ProposalLostReasonFormOptions } from "@/config/constants/dropdowns/proposals/proposal-content.options";
import { useConvertProposal, useMarkProposalLost, useUpdateProposal } from "@/features/proposals/hooks/use-proposals";
import type { ProposalDetail, ProposalLostReason } from "@/features/proposals/interfaces/proposals.interfaces";
import { LookupPicker } from "../../../components/lookup-picker";

interface DialogProps {
    proposal: ProposalDetail;
    open: boolean;
    onOpenChange: (o: boolean) => void;
}

/** Edit header fields: title, customer, contact, deal, owner, contract requirement. */
export function DetailsDialog({ proposal, open, onOpenChange }: DialogProps) {
    const update = useUpdateProposal();
    const [title, setTitle] = useState(proposal.title);
    const [company, setCompany] = useState<string | null>(proposal.company_id);
    const [contact, setContact] = useState<string | null>(proposal.contact_id);
    const [deal, setDeal] = useState<string | null>(proposal.deal_id);
    const [owner, setOwner] = useState<string | null>(proposal.owner_membership_id);
    const [requiresContract, setRequiresContract] = useState(proposal.requires_contract);
    useEffect(() => {
        if (!open) return;
        setTitle(proposal.title); setCompany(proposal.company_id); setContact(proposal.contact_id); setDeal(proposal.deal_id); setOwner(proposal.owner_membership_id); setRequiresContract(proposal.requires_contract);
    }, [open, proposal]);
    const contactName = proposal.contact ? `${proposal.contact.first_name} ${proposal.contact.last_name ?? ""}`.trim() : null;

    const save = () =>
        update.mutate(
            { id: proposal.id, title: title.trim(), company_id: company, contact_id: contact, deal_id: deal, owner_membership_id: owner, requires_contract: requiresContract },
            { onSuccess: () => { toast({ title: "Details saved" }); onOpenChange(false); }, onError: (e) => toast({ variant: "destructive", title: "Could not save", description: getApiErrorMessage(e) }) }
        );

    return (
        <Dialog open={open} onOpenChange={(o) => !update.isPending && onOpenChange(o)}>
            <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle>Proposal details</DialogTitle>
                    <DialogDescription>{proposal.number}. Changes apply to the record, not to sent versions.</DialogDescription>
                </DialogHeader>
                <div className="space-y-3">
                    <div className="space-y-1.5"><Label htmlFor="p-title">Title</Label><Input id="p-title" value={title} onChange={(e) => setTitle(e.target.value)} /></div>
                    <div className="grid gap-3 sm:grid-cols-2">
                        <div className="space-y-1.5"><Label>Customer</Label><LookupPicker kind="companies" ariaLabel="Customer" value={company} valueLabel={proposal.company?.name} onChange={(id) => { setCompany(id); setContact(null); }} /></div>
                        <div className="space-y-1.5"><Label>Primary contact</Label><LookupPicker kind="contacts" ariaLabel="Primary contact" value={contact} valueLabel={contact === proposal.contact_id ? contactName : undefined} companyId={company} onChange={setContact} /></div>
                        <div className="space-y-1.5"><Label>Deal</Label><LookupPicker kind="deals" ariaLabel="Deal" value={deal} valueLabel={proposal.deal?.name} companyId={company} onChange={setDeal} /></div>
                        <div className="space-y-1.5"><Label>Owner</Label><LookupPicker kind="members" ariaLabel="Owner" value={owner} clearable={false} valueLabel={proposal.owner ? personName(proposal.owner.user) : undefined} onChange={setOwner} /></div>
                    </div>
                    <label className="flex items-center justify-between gap-2 rounded-md border border-border px-3 py-2 text-[13px] text-foreground">
                        Acceptance leads to a contract <Switch checked={requiresContract} onCheckedChange={setRequiresContract} />
                    </label>
                </div>
                <DialogFooter>
                    <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={update.isPending}>Cancel</Button>
                    <Button loading={update.isPending} disabled={!title.trim()} onClick={save}>Save</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

export function MarkLostDialog({ proposal, open, onOpenChange }: DialogProps) {
    const lost = useMarkProposalLost();
    const [reason, setReason] = useState<ProposalLostReason>("PRICE");
    const [note, setNote] = useState("");
    return (
        <Dialog open={open} onOpenChange={(o) => !lost.isPending && onOpenChange(o)}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Mark {proposal.number} as lost</DialogTitle>
                    <DialogDescription>The customer link stops working. The reason feeds proposal analytics.</DialogDescription>
                </DialogHeader>
                <div className="space-y-3">
                    <div className="space-y-1.5">
                        <Label>Reason</Label>
                        <Select value={reason} onValueChange={(v) => setReason(v as ProposalLostReason)}>
                            <SelectTrigger aria-label="Lost reason"><SelectValue /></SelectTrigger>
                            <SelectContent>{ProposalLostReasonFormOptions.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-1.5"><Label htmlFor="lost-note">Note</Label><Textarea id="lost-note" rows={3} value={note} onChange={(e) => setNote(e.target.value)} /></div>
                </div>
                <DialogFooter>
                    <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={lost.isPending}>Cancel</Button>
                    <Button variant="destructive" loading={lost.isPending} onClick={() => lost.mutate({ id: proposal.id, lost_reason: reason, note: note || undefined }, { onSuccess: () => { toast({ title: "Marked as lost" }); onOpenChange(false); }, onError: (e) => toast({ variant: "destructive", title: "Could not update", description: getApiErrorMessage(e) }) })}>
                        Mark lost
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

/** Accepted proposal → draft contract bound to the accepted version. Needs contracts.contracts.create as well. */
export function ConvertDialog({ proposal, open, onOpenChange }: DialogProps) {
    const navigate = useNavigate();
    const canCreateContract = usePermission("contracts.contracts.create");
    const convert = useConvertProposal();
    const [title, setTitle] = useState(proposal.title);
    useEffect(() => { if (open) setTitle(proposal.title); }, [open, proposal.title]);
    return (
        <Dialog open={open} onOpenChange={(o) => !convert.isPending && onOpenChange(o)}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Create contract from {proposal.number}</DialogTitle>
                    <DialogDescription>
                        A draft contract is created from the accepted version: parties, the customer contact as signatory, value {formatMoney(proposal.gross_total, proposal.currency)} and the proposal sections as its first version.
                    </DialogDescription>
                </DialogHeader>
                {canCreateContract ? (
                    <div className="space-y-1.5"><Label htmlFor="contract-title">Contract title</Label><Input id="contract-title" value={title} onChange={(e) => setTitle(e.target.value)} /></div>
                ) : (
                    <p className="rounded-md bg-warning-soft px-3 py-2 text-[13px] text-warning">Creating contracts needs the contracts.contracts.create permission.</p>
                )}
                <DialogFooter>
                    <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={convert.isPending}>Cancel</Button>
                    <Button
                        loading={convert.isPending}
                        disabled={!canCreateContract || !title.trim()}
                        onClick={() =>
                            convert.mutate(
                                { id: proposal.id, contract_title: title.trim() },
                                {
                                    onSuccess: (r) => { toast({ title: `Contract ${r.contract_number} drafted` }); onOpenChange(false); navigate(`/contracts/${r.contract_id}`); },
                                    onError: (e) => toast({ variant: "destructive", title: "Could not convert", description: getApiErrorMessage(e) }),
                                }
                            )
                        }
                    >
                        Create contract
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
