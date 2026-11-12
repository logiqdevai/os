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
import { InlineText } from "@/components/ui/inline-edit";
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

/**
 * Header fields: title, customer, contact, deal, owner, contract requirement. Every field saves on change
 * (optimistic: the page header updates at once; a refusal rolls back and toasts) — no Save button.
 */
export function DetailsDialog({ proposal, open, onOpenChange }: DialogProps) {
    const update = useUpdateProposal();
    const contactName = proposal.contact ? `${proposal.contact.first_name} ${proposal.contact.last_name ?? ""}`.trim() : null;
    const patch = (body: Record<string, unknown>, optimistic?: Record<string, unknown>) => update.mutate({ id: proposal.id, ...body, optimistic });

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle>Proposal details</DialogTitle>
                    <DialogDescription>{proposal.number}. Changes apply to the record, not to sent versions.</DialogDescription>
                </DialogHeader>
                <div className="space-y-3">
                    <div className="space-y-1.5">
                        <Label htmlFor="p-title">Title</Label>
                        <div className="rounded-md border border-border px-3 py-1.5 text-[13px]"><InlineText value={proposal.title} aria-label="Title" onSave={(title) => patch({ title })} /></div>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                        <div className="space-y-1.5"><Label>Customer</Label><LookupPicker kind="companies" ariaLabel="Customer" value={proposal.company_id} valueLabel={proposal.company?.name} onChange={(id, o) => patch({ company_id: id, contact_id: null }, { company: id && o ? { id, name: o.name ?? "" } : null, contact: null })} /></div>
                        <div className="space-y-1.5"><Label>Primary contact</Label><LookupPicker kind="contacts" ariaLabel="Primary contact" value={proposal.contact_id} valueLabel={contactName} companyId={proposal.company_id} onChange={(id, o) => patch({ contact_id: id }, { contact: id && o ? { id, first_name: o.first_name ?? "", last_name: o.last_name ?? null, email: o.email ?? null } : null })} /></div>
                        <div className="space-y-1.5"><Label>Deal</Label><LookupPicker kind="deals" ariaLabel="Deal" value={proposal.deal_id} valueLabel={proposal.deal?.name} companyId={proposal.company_id} onChange={(id, o) => patch({ deal_id: id }, { deal: id && o ? { id, name: o.name ?? "" } : null })} /></div>
                        <div className="space-y-1.5"><Label>Owner</Label><LookupPicker kind="members" ariaLabel="Owner" value={proposal.owner_membership_id} clearable={false} valueLabel={proposal.owner ? personName(proposal.owner.user) : undefined} onChange={(id, o) => id && patch({ owner_membership_id: id }, o?.user ? { owner: { id, job_title: null, user: o.user } } : undefined)} /></div>
                    </div>
                    <label className="flex items-center justify-between gap-2 rounded-md border border-border px-3 py-2 text-[13px] text-foreground">
                        Acceptance leads to a contract <Switch checked={proposal.requires_contract} onCheckedChange={(requires_contract) => patch({ requires_contract })} />
                    </label>
                    <p className="text-xs text-muted-foreground">Changes save automatically.</p>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>Done</Button>
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
                    <Button variant="destructive" loading={lost.isPending} onClick={() => lost.mutate({ id: proposal.id, lost_reason: reason, note: note || undefined }, { onSuccess: () => onOpenChange(false) })}>
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
                                { onSuccess: (r) => { onOpenChange(false); navigate(`/contracts/${r.contract_id}`); } }
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
