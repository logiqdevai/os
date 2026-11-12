import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { FolderKanban, Pencil, Plus, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { usePermission } from "@/hooks/use-permission";
import { getDropdownOptionLabel } from "@/lib/dropdown-option-label.utils";
import { ContractPartyTypeFormOptions } from "@/config/constants/dropdowns/contracts/contract-terms.options";
import { useLinkProject, useSetParties, useUnlinkProject } from "@/features/contracts/hooks/use-contracts";
import type { ContractDetail, ContractPartyType, PartyInput } from "@/features/contracts/interfaces/contracts.interfaces";
import { ContractLookupPicker } from "../../../components/contract-badges";

const LOCKED = ["PARTIALLY_SIGNED", "FULLY_SIGNED", "ACTIVE", "EXPIRING", "RENEWED", "SUPERSEDED", "TERMINATED", "EXPIRED", "CANCELLED", "ARCHIVED"];

/** Parties and signatories (editable until signing starts) + linked projects. */
export function PartiesTab({ contract }: { contract: ContractDetail }) {
    const canUpdate = usePermission("contracts.contracts.update");
    const editable = canUpdate && !LOCKED.includes(contract.status);
    const [editing, setEditing] = useState(false);
    const link = useLinkProject();
    const unlink = useUnlinkProject();
    const [project, setProject] = useState<string | null>(null);

    return (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
            <div className="space-y-3">
                <div className="flex items-center justify-between">
                    <h2 className="text-[15px] font-medium text-foreground">Parties</h2>
                    {editable && <Button size="sm" variant="outline" onClick={() => setEditing(true)}><Pencil /> Edit parties</Button>}
                </div>
                {contract.parties.map((p) => (
                    <div key={p.id} className="rounded-lg border border-border bg-card p-3">
                        <div className="flex flex-wrap items-center gap-2">
                            <Badge variant={p.party_type === "AGENCY" ? "violet" : "info"}>{getDropdownOptionLabel(ContractPartyTypeFormOptions, p.party_type)}</Badge>
                            <span className="text-[13.5px] font-medium text-foreground">{p.legal_name}</span>
                            {p.company && p.company.name !== p.legal_name && <span className="text-xs text-muted-foreground">({p.company.name})</span>}
                        </div>
                        {(p.registration_number || p.vat_number) && <p className="mt-1 text-xs text-muted-foreground">{[p.registration_number && `Reg. ${p.registration_number}`, p.vat_number && `VAT ${p.vat_number}`].filter(Boolean).join(" · ")}</p>}
                        <ul className="mt-2 space-y-1">
                            {p.signatories.length === 0 && <li className="text-xs text-muted-foreground">No signatory yet.</li>}
                            {p.signatories.map((s) => (
                                <li key={s.id} className="flex flex-wrap items-center gap-x-2 text-[13px]">
                                    <span className="text-foreground">{s.name}</span>
                                    {s.title && <span className="text-xs text-muted-foreground">{s.title}</span>}
                                    <span className="text-xs text-muted-foreground">{s.email}</span>
                                    {!s.is_required && <Badge variant="neutral">optional</Badge>}
                                </li>
                            ))}
                        </ul>
                    </div>
                ))}
            </div>
            <div className="h-fit rounded-lg border border-border bg-card">
                <div className="border-b border-border px-3 py-2 text-[13px] font-medium text-foreground">Linked projects</div>
                <ul className="divide-y divide-border">
                    {contract.projects.length === 0 && <li className="px-3 py-3 text-[13px] text-muted-foreground">No projects linked.</li>}
                    {contract.projects.map((p) => (
                        <li key={p.project_id} className="flex items-center gap-2 px-3 py-2 text-[13px]">
                            <FolderKanban className="size-4 text-muted-foreground" />
                            <Link to={`/projects/${p.project.id}`} className="min-w-0 flex-1 truncate text-foreground hover:underline">{p.project.code ? `${p.project.code} · ` : ""}{p.project.name}</Link>
                            {canUpdate && <Button variant="ghost" size="icon-sm" aria-label="Unlink project" onClick={() => unlink.mutate({ id: contract.id, project_id: p.project_id })}><X /></Button>}
                        </li>
                    ))}
                </ul>
                {canUpdate && (
                    <div className="flex gap-2 border-t border-border p-3">
                        {/* Picking a project links it right away; it then appears in the list above. */}
                        <div className="min-w-0 flex-1"><ContractLookupPicker kind="projects" ariaLabel="Link a project" value={project} companyId={contract.primary_company_id} placeholder={link.isPending ? "Linking…" : "Link a project"} disabled={link.isPending} onChange={(id) => { if (!id) return; setProject(id); link.mutate({ id: contract.id, project_id: id }, { onSettled: () => setProject(null) }); }} /></div>
                    </div>
                )}
            </div>
            <PartiesDialog contract={contract} open={editing} onOpenChange={setEditing} />
        </div>
    );
}

type SignatoryDraft = { name: string; title: string; email: string; contact_id?: string; membership_id?: string; is_required: boolean };
type PartyDraft = { party_type: ContractPartyType; company_id?: string; legal_name: string; registration_number: string; vat_number: string; signatories: SignatoryDraft[] };

function PartiesDialog({ contract, open, onOpenChange }: { contract: ContractDetail; open: boolean; onOpenChange: (o: boolean) => void }) {
    const save = useSetParties();
    const [parties, setParties] = useState<PartyDraft[]>([]);
    useEffect(() => {
        if (!open) return;
        setParties(contract.parties.map((p) => ({
            party_type: p.party_type, company_id: p.company_id ?? undefined, legal_name: p.legal_name, registration_number: p.registration_number ?? "", vat_number: p.vat_number ?? "",
            signatories: p.signatories.map((s) => ({ name: s.name, title: s.title ?? "", email: s.email, contact_id: s.contact_id ?? undefined, membership_id: s.membership_id ?? undefined, is_required: s.is_required })),
        })));
    }, [open, contract.parties]);
    const setParty = (i: number, patch: Partial<PartyDraft>) => setParties((all) => all.map((p, j) => (j === i ? { ...p, ...patch } : p)));
    const setSig = (i: number, k: number, patch: Partial<SignatoryDraft>) => setParty(i, { signatories: parties[i].signatories.map((s, j) => (j === k ? { ...s, ...patch } : s)) });
    const invalid = !parties.length || parties.some((p) => !p.legal_name.trim() || p.signatories.some((s) => !s.name.trim() || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(s.email)));

    const submit = () => {
        const dto: PartyInput[] = parties.map((p) => ({
            party_type: p.party_type, company_id: p.company_id, legal_name: p.legal_name.trim(), registration_number: p.registration_number || undefined, vat_number: p.vat_number || undefined,
            signatories: p.signatories.map((s) => ({ name: s.name.trim(), title: s.title || undefined, email: s.email.trim(), contact_id: s.contact_id, membership_id: s.membership_id, is_required: s.is_required })),
        }));
        // Nested multi-party edit stays a dialog with Save; it closes on success, failures toast globally.
        save.mutate({ id: contract.id, parties: dto }, { onSuccess: () => onOpenChange(false) });
    };

    return (
        <Dialog open={open} onOpenChange={(o) => !save.isPending && onOpenChange(o)}>
            <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
                <DialogHeader><DialogTitle>Parties and signatories</DialogTitle><DialogDescription>Signatories receive the signing links. Changes are not possible once signing has started.</DialogDescription></DialogHeader>
                <div className="space-y-4">
                    {parties.map((p, i) => (
                        <div key={i} className="space-y-2 rounded-md border border-border p-3">
                            <div className="grid gap-2 sm:grid-cols-[160px_minmax(0,1fr)_32px]">
                                <Select value={p.party_type} onValueChange={(v) => setParty(i, { party_type: v as ContractPartyType })}>
                                    <SelectTrigger className="h-9" aria-label="Party type"><SelectValue /></SelectTrigger>
                                    <SelectContent>{ContractPartyTypeFormOptions.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent>
                                </Select>
                                <Input aria-label="Legal name" placeholder="Legal name" value={p.legal_name} onChange={(e) => setParty(i, { legal_name: e.target.value })} />
                                <Button variant="ghost" size="icon-sm" aria-label="Remove party" onClick={() => setParties((all) => all.filter((_, j) => j !== i))}><Trash2 /></Button>
                            </div>
                            <div className="grid gap-2 sm:grid-cols-2">
                                <Input aria-label="Registration number" placeholder="Registration number" value={p.registration_number} onChange={(e) => setParty(i, { registration_number: e.target.value })} />
                                <Input aria-label="VAT number" placeholder="VAT number" value={p.vat_number} onChange={(e) => setParty(i, { vat_number: e.target.value })} />
                            </div>
                            <div className="space-y-2 pl-0 sm:pl-3">
                                {p.signatories.map((s, k) => (
                                    <div key={k} className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,0.8fr)_minmax(0,1.2fr)_32px]">
                                        <Input aria-label="Signatory name" placeholder="Name" value={s.name} onChange={(e) => setSig(i, k, { name: e.target.value })} />
                                        <Input aria-label="Signatory title" placeholder="Title" value={s.title} onChange={(e) => setSig(i, k, { title: e.target.value })} />
                                        <Input aria-label="Signatory email" type="email" placeholder="Email" value={s.email} onChange={(e) => setSig(i, k, { email: e.target.value })} />
                                        <Button variant="ghost" size="icon-sm" aria-label="Remove signatory" onClick={() => setParty(i, { signatories: p.signatories.filter((_, j) => j !== k) })}><X /></Button>
                                    </div>
                                ))}
                                <div className="flex flex-wrap items-center gap-2">
                                    {p.party_type === "AGENCY" ? (
                                        <div className="w-full sm:w-64"><ContractLookupPicker kind="members" ariaLabel="Add internal signatory" value={null} placeholder="Add a team member" onChange={(id, item) => id && item && setParty(i, { signatories: [...p.signatories, { name: item.label, title: item.sub ?? "", email: item.email ?? "", membership_id: id, is_required: true }] })} /></div>
                                    ) : (
                                        <div className="w-full sm:w-64"><ContractLookupPicker kind="contacts" ariaLabel="Add contact signatory" value={null} companyId={p.company_id} placeholder="Add a contact" onChange={(id, item) => id && item && setParty(i, { signatories: [...p.signatories, { name: item.label, title: "", email: item.email ?? "", contact_id: id, is_required: true }] })} /></div>
                                    )}
                                    <Button size="sm" variant="ghost" onClick={() => setParty(i, { signatories: [...p.signatories, { name: "", title: "", email: "", is_required: true }] })}><Plus /> Other person</Button>
                                </div>
                            </div>
                        </div>
                    ))}
                    <Button size="sm" variant="outline" onClick={() => setParties((all) => [...all, { party_type: "CUSTOMER", legal_name: "", registration_number: "", vat_number: "", signatories: [] }])}><Plus /> Add party</Button>
                </div>
                <DialogFooter>
                    <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={save.isPending}>Cancel</Button>
                    <Button loading={save.isPending} disabled={invalid} onClick={submit}>Save parties</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
