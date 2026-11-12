import { useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Archive, FilePlus2, GitBranch, MoreHorizontal, Pencil, Plus, RefreshCw, Send, Trash2, XOctagon } from "lucide-react";
import { Page } from "@/components/ui/page";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ErrorState, PageSkeleton } from "@/components/ui/states";
import { KeyValueList } from "@/components/ui/page";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import ConfirmationDialog from "@/components/ui/confirmation-dialog";
import { usePageMetadata } from "@/hooks/use-page-metadata";
import { usePermissions } from "@/hooks/use-permission";
import { toast } from "@/hooks/use-toast";
import { getApiErrorMessage } from "@/lib/api-error";
import { formatDate, personName } from "@/lib/format";
import { getDropdownOptionLabel } from "@/lib/dropdown-option-label.utils";
import { ContractRelationKindOptions, ContractRenewalTypeFormOptions, ContractTerminationTypeOptions } from "@/config/constants/dropdowns/contracts/contract-terms.options";
import { useArchiveContract, useContract, useContractVersion, useCreateVersion, useDeleteContract, useObligations, useRestoreContract } from "@/features/contracts/hooks/use-contracts";
import { ContractStatusBadge, ContractVersionBadge, contractValue } from "../../components/contract-badges";
import { ObligationsTable } from "../../components/obligations-table";
import { ObligationDialog } from "../../components/obligation-dialog";
import { DocumentTab } from "./components/document-tab";
import { PartiesTab } from "./components/parties-tab";
import { SignaturesTab } from "./components/signatures-tab";
import { HistoryTab } from "./components/history-tab";
import { AiTab } from "./components/ai-tab";
import { AmendDialog, EditContractDialog, RenewDialog, TerminateDialog } from "./components/lifecycle-dialogs";

const TABS = ["document", "parties", "signatures", "obligations", "ai", "history"] as const;
const LIVE = ["ACTIVE", "EXPIRING", "FULLY_SIGNED"];
const TERMINAL = ["TERMINATED", "EXPIRED", "CANCELLED", "ARCHIVED", "SUPERSEDED"];

/**
 * /contracts/:id?tab=&version= — contract record with tabs Document · Parties · Signatures · Obligations · History.
 * @perm contracts.contracts.read · update · versions.create · signatures.* · obligations.manage · renew · amend · terminate · archive · delete
 * @api GET /contracts/:id · GET /contracts/:id/versions/:vid · lifecycle POSTs
 */
export default function ContractDetailPage() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [sp, setSp] = useSearchParams();
    const tab = (TABS as readonly string[]).includes(sp.get("tab") ?? "") ? (sp.get("tab") as string) : "document";
    const q = useContract(id);
    const versionId = sp.get("version") ?? q.data?.current_version_id ?? undefined;
    const version = useContractVersion(id, versionId);
    const obligations = useObligations({ contract_id: id, limit: 100 });
    const p = usePermissions();
    const createVersion = useCreateVersion();
    const archive = useArchiveContract();
    const restore = useRestoreContract();
    const remove = useDeleteContract();
    const [dialog, setDialog] = useState<"edit" | "renew" | "amend" | "terminate" | "delete" | "archive" | "obligation" | null>(null);
    usePageMetadata({ title: q.data ? `${q.data.number} · ${q.data.title}` : "Contract" });

    const setParam = (key: string, value: string | null) => setSp((prev) => { const n = new URLSearchParams(prev); if (value) n.set(key, value); else n.delete(key); return n; }, { replace: key === "tab" });

    if (q.isPending) return <PageSkeleton />;
    if (q.error || !q.data) return <Page><ErrorState error={q.error} onRetry={() => q.refetch()} /></Page>;
    const c = q.data;
    const live = LIVE.includes(c.status);
    const terminal = TERMINAL.includes(c.status);
    const currentVersion = c.versions.find((v) => v.id === c.current_version_id);
    const canNewVersion = p.can("contracts.versions.create") && !terminal && !live && !!currentVersion && ["IN_REVIEW", "APPROVED"].includes(currentVersion.status);

    const newVersion = () => createVersion.mutate({ id: c.id }, {
        onSuccess: (v) => { toast({ title: `Draft ${v.label} created` }); setParam("version", null); setParam("tab", null); },
        onError: (e) => toast({ variant: "destructive", title: "Could not create a version", description: getApiErrorMessage(e) }),
    });

    return (
        <Page>
            <div className="mb-4 space-y-2">
                <Link to="/contracts" className="text-[13px] text-muted-foreground hover:text-foreground">← Contracts</Link>
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                            <span className="font-mono text-[13px] text-muted-foreground">{c.number}</span>
                            <h1 className="min-w-0 truncate text-xl font-medium text-foreground">{c.title}</h1>
                            <ContractStatusBadge status={c.status} />
                            {c.relation_kind !== "STANDALONE" && <Badge variant="outline">{getDropdownOptionLabel(ContractRelationKindOptions, c.relation_kind)}</Badge>}
                        </div>
                        <p className="text-[13px] text-muted-foreground">
                            {[c.primary_company?.name, c.type?.name, c.owner?.user ? `owner ${personName(c.owner.user)}` : null, c.proposal ? `from proposal ${c.proposal.number}` : null].filter(Boolean).join(" · ")}
                        </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        {c.status === "READY_FOR_SIGNATURE" && p.can("contracts.signatures.send") && (
                            <Button onClick={() => setSp((prev) => { const n = new URLSearchParams(prev); n.set("tab", "signatures"); n.set("send", "1"); return n; })}><Send /> Send for signature</Button>
                        )}
                        {canNewVersion && <Button variant="outline" loading={createVersion.isPending} onClick={newVersion}><GitBranch /> New version</Button>}
                        {live && p.can("contracts.contracts.renew") && <Button variant="outline" onClick={() => setDialog("renew")}><RefreshCw /> Renew</Button>}
                        {live && p.can("contracts.contracts.amend") && <Button variant="outline" onClick={() => setDialog("amend")}><FilePlus2 /> Amend</Button>}
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild><Button variant="outline" size="icon" aria-label="More actions"><MoreHorizontal /></Button></DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                {p.can("contracts.contracts.update") && !terminal && <DropdownMenuItem onSelect={() => setDialog("edit")}><Pencil /> Edit details</DropdownMenuItem>}
                                {p.can("contracts.obligations.manage") && <DropdownMenuItem onSelect={() => setDialog("obligation")}><Plus /> Add obligation</DropdownMenuItem>}
                                {(live || c.status === "EXPIRED") && p.can("contracts.contracts.renew") && !live && <DropdownMenuItem onSelect={() => setDialog("renew")}><RefreshCw /> Renew</DropdownMenuItem>}
                                <DropdownMenuSeparator />
                                {live && p.can("contracts.contracts.terminate") && <DropdownMenuItem className="text-danger focus:text-danger" onSelect={() => setDialog("terminate")}><XOctagon /> Terminate</DropdownMenuItem>}
                                {p.can("contracts.contracts.archive") && (c.archived_at
                                    ? <DropdownMenuItem onSelect={() => restore.mutate(c.id, { onSuccess: () => toast({ title: "Contract restored" }), onError: (e) => toast({ variant: "destructive", title: "Could not restore", description: getApiErrorMessage(e) }) })}><Archive /> Restore</DropdownMenuItem>
                                    : <DropdownMenuItem onSelect={() => setDialog("archive")}><Archive /> Archive</DropdownMenuItem>)}
                                {p.can("contracts.contracts.delete") && c.status === "DRAFT" && <DropdownMenuItem className="text-danger focus:text-danger" onSelect={() => setDialog("delete")}><Trash2 /> Delete draft</DropdownMenuItem>}
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                </div>
            </div>

            <div className="mb-4 rounded-lg border border-border bg-card p-4">
                <KeyValueList
                    columns={3}
                    items={[
                        { label: "Term", value: c.start_date || c.end_date ? `${formatDate(c.start_date)} – ${c.end_date ? formatDate(c.end_date) : "open-ended"}` : null },
                        { label: "Renewal", value: `${getDropdownOptionLabel(ContractRenewalTypeFormOptions, c.renewal_type)}${c.renewal_term_months ? ` · ${c.renewal_term_months} months` : ""}` },
                        { label: "Notice deadline", value: c.notice_deadline ? formatDate(c.notice_deadline) : c.notice_days != null ? `${c.notice_days} days notice` : null },
                        { label: "Total value", value: contractValue(c.total_value, c.currency, c.confidential_hidden) },
                        { label: "Recurring", value: c.recurring_value || c.confidential_hidden ? `${contractValue(c.recurring_value, c.currency, c.confidential_hidden)}${c.billing_frequency && !c.confidential_hidden ? ` · ${c.billing_frequency}` : ""}` : null },
                        { label: "Signed", value: c.signature_date ? formatDate(c.signature_date) : null },
                    ]}
                />
                {c.termination && (
                    <p className="mt-3 rounded-md bg-danger-soft px-3 py-2 text-[13px] text-danger">
                        Terminated ({getDropdownOptionLabel(ContractTerminationTypeOptions, c.termination.type)}) effective {formatDate(c.termination.effective_date)}{c.termination.reason ? `: ${c.termination.reason}` : ""}
                    </p>
                )}
            </div>

            <Tabs value={tab} onValueChange={(t) => setParam("tab", t === "document" ? null : t)}>
                <div className="-mx-4 flex flex-wrap items-center gap-2 overflow-x-auto px-4 md:mx-0 md:px-0">
                    <TabsList className="w-max">
                        <TabsTrigger value="document">Document</TabsTrigger>
                        <TabsTrigger value="parties">Parties</TabsTrigger>
                        <TabsTrigger value="signatures">Signatures</TabsTrigger>
                        <TabsTrigger value="obligations">Obligations{obligations.data?.pagination.total ? ` (${obligations.data.pagination.total})` : ""}</TabsTrigger>
                        <TabsTrigger value="ai">AI review</TabsTrigger>
                        <TabsTrigger value="history">History</TabsTrigger>
                    </TabsList>
                    {(tab === "document" || tab === "ai") && c.versions.length > 0 && (
                        <div className="flex items-center gap-2">
                            <Select value={versionId} onValueChange={(v) => setParam("version", v === c.current_version_id ? null : v)}>
                                <SelectTrigger className="h-8 w-auto min-w-32" aria-label="Version"><SelectValue /></SelectTrigger>
                                <SelectContent>{c.versions.map((v) => <SelectItem key={v.id} value={v.id}>{v.label}{v.id === c.current_version_id ? " · current" : ""}</SelectItem>)}</SelectContent>
                            </Select>
                            {version.data && <ContractVersionBadge status={version.data.status} />}
                        </div>
                    )}
                </div>
                <TabsContent value="document" className="mt-4"><DocumentTab contract={c} version={version.data} loading={version.isPending} error={version.error} onRetry={() => version.refetch()} /></TabsContent>
                <TabsContent value="parties" className="mt-4"><PartiesTab contract={c} /></TabsContent>
                <TabsContent value="signatures" className="mt-4"><SignaturesTab contract={c} version={version.data && version.data.id === c.current_version_id ? version.data : undefined} /></TabsContent>
                <TabsContent value="obligations" className="mt-4 space-y-3">
                    {p.can("contracts.obligations.manage") && <div className="flex justify-end"><Button size="sm" onClick={() => setDialog("obligation")}><Plus /> Add obligation</Button></div>}
                    <ObligationsTable data={obligations.data?.data} loading={obligations.isFetching} error={obligations.error} onRetry={() => obligations.refetch()} empty={{ title: "No obligations", description: "Track deliverables, payments, reports and notice dates from this contract." }} />
                </TabsContent>
                <TabsContent value="ai" className="mt-4"><AiTab contract={c} version={version.data} /></TabsContent>
                <TabsContent value="history" className="mt-4"><HistoryTab contract={c} onOpenVersion={(vid) => setSp((prev) => { const n = new URLSearchParams(prev); n.delete("tab"); if (vid === c.current_version_id) n.delete("version"); else n.set("version", vid); return n; })} /></TabsContent>
            </Tabs>

            <EditContractDialog contract={c} open={dialog === "edit"} onOpenChange={(o) => setDialog(o ? "edit" : null)} />
            <RenewDialog contract={c} open={dialog === "renew"} onOpenChange={(o) => setDialog(o ? "renew" : null)} />
            <AmendDialog contract={c} open={dialog === "amend"} onOpenChange={(o) => setDialog(o ? "amend" : null)} />
            <TerminateDialog contract={c} open={dialog === "terminate"} onOpenChange={(o) => setDialog(o ? "terminate" : null)} />
            <ObligationDialog open={dialog === "obligation"} onOpenChange={(o) => setDialog(o ? "obligation" : null)} contractId={c.id} obligation={null} />
            <ConfirmationDialog
                isOpen={dialog === "delete" || dialog === "archive"}
                onClose={() => setDialog(null)}
                title={dialog === "delete" ? `Delete ${c.number}?` : `Archive ${c.number}?`}
                description={dialog === "delete" ? "This permanently deletes the draft. Contracts sent for signature cannot be deleted." : "Archived contracts are hidden from lists."}
                confirmText={dialog === "delete" ? "Delete" : "Archive"}
                variant="destructive"
                isLoading={remove.isPending || archive.isPending}
                onConfirm={() => {
                    if (dialog === "delete") remove.mutate(c.id, { onSuccess: () => { toast({ title: "Contract deleted" }); navigate("/contracts"); }, onError: (e) => toast({ variant: "destructive", title: "Could not delete", description: getApiErrorMessage(e) }) });
                    else archive.mutate(c.id, { onSuccess: () => { toast({ title: "Contract archived" }); setDialog(null); }, onError: (e) => toast({ variant: "destructive", title: "Could not archive", description: getApiErrorMessage(e) }) });
                }}
            />
        </Page>
    );
}
