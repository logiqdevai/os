import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Download, FileSignature, FileText, PenLine, Receipt, Upload } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Pagination } from "@/components/ui/pagination";
import { StatCard } from "@/components/ui/stat-card";
import { EmptyState, ErrorState, ListSkeleton } from "@/components/ui/states";
import { formatDate, formatMoney } from "@/lib/format";
import { environments } from "@/config/environments";
import { toast } from "@/hooks/use-toast";
import { getApiErrorMessage } from "@/lib/api-error";
import { getPortalDocumentDownload } from "@/features/portal/services/portal.services";
import { getDropdownOptionLabel } from "@/lib/dropdown-option-label.utils";
import { PortalAgreementStatusOptions, PortalInvoiceFilterOptions, PortalInvoiceStatusOptions, PortalInvoiceStatusTone } from "@/config/constants/dropdowns/portal/portal.options";
import { useOpenPortalProposal, usePortalContracts, usePortalDocuments, usePortalInvoices, usePortalProposals, useSignPortalContract } from "@/features/portal/hooks/use-portal";
import { usePortal } from "../components/portal-context";
import { PortalCard, PortalHeader } from "../components/portal-ui";
import { PortalUploadDialog } from "../components/upload-dialog";

/** Same key the public proposal page reads for EMAIL_VERIFIED links (pages/proposals/public). */
const PROPOSAL_ACCESS_KEY = (tokenPrefix: string) => `lq-proposal-access:${tokenPrefix}`;

/** Download through a fresh signed URL (the API checks the document is shared with your company). */
async function downloadDocument(id: string) {
    try {
        const { path } = await getPortalDocumentDownload(id);
        // Attachment disposition: the browser downloads the file and stays on this page.
        window.location.assign(`${environments.API_URL.replace(/\/+$/, "")}${path}`);
    } catch (e) {
        toast({ variant: "destructive", title: "Could not download", description: getApiErrorMessage(e) });
    }
}

const fileSize = (n: number | null) => (n === null ? "" : n < 1024 ? `${n} B` : n < 1048576 ? `${Math.round(n / 1024)} KB` : `${(n / 1048576).toFixed(1)} MB`);

/** Customer documents — /portal/documents (mockup 07-portal `cp-documents`). @perm portal.documents.read · upload portal.documents.upload */
export function PortalDocumentsPage() {
    const { can } = usePortal();
    const canUpload = can("portal.documents.upload");
    const [uploadOpen, setUploadOpen] = useState(false);
    const [search, setSearch] = useState("");
    const [page, setPage] = useState(1);
    const docs = usePortalDocuments({ search: search || undefined, page, limit: 25 });
    return (
        <>
            <PortalHeader title="Documents" description="Files the team shared with you, and files you shared with the team." actions={canUpload ? <Button onClick={() => setUploadOpen(true)}><Upload /> Upload</Button> : undefined} />
            <Input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Search documents…" className="mb-4 h-9 sm:max-w-xs" aria-label="Search documents" />
            {docs.isLoading ? <ListSkeleton /> : docs.error ? <ErrorState error={docs.error} onRetry={() => docs.refetch()} /> : !docs.data?.data.length ? (
                <EmptyState icon={FileText} title={search ? "No documents match" : "No documents yet"} description="Specifications, reports and deliverables appear here when shared with you." action={canUpload && !search ? <Button size="sm" variant="outline" onClick={() => setUploadOpen(true)}><Upload /> Share a file</Button> : undefined} />
            ) : (
                <PortalCard>
                    <ul className="divide-y divide-border-soft">
                        {docs.data.data.map((d) => (
                            <li key={d.id} className="flex items-center gap-3 py-2.5">
                                <FileText className="size-4 shrink-0 text-muted-foreground" />
                                <div className="min-w-0 flex-1"><div className="truncate text-[13px] font-medium">{d.title || d.filename}</div><div className="truncate text-xs text-muted-foreground">{[d.uploaded_via_portal ? "Shared by you" : null, d.project?.name, fileSize(d.size), formatDate(d.created_at)].filter(Boolean).join(" · ")}</div></div>
                                <Button variant="ghost" size="icon-sm" aria-label={`Download ${d.title || d.filename}`} onClick={() => downloadDocument(d.id)}><Download /></Button>
                            </li>
                        ))}
                    </ul>
                    {docs.data.pagination.total_pages > 1 && <div className="mt-3"><Pagination currentPage={page} totalPages={docs.data.pagination.total_pages} onPageChange={setPage} /></div>}
                </PortalCard>
            )}
            {canUpload && <PortalUploadDialog open={uploadOpen} onOpenChange={setUploadOpen} />}
        </>
    );
}

/**
 * Customer proposals and contracts — /portal/agreements (mockup 07-portal `cp-agreements`).
 * "Review & accept" / "Sign" ask the API for a fresh link and open the same public pages as the emailed links (/p/:token, /sign/:token).
 * @perm portal.proposals.read / portal.contracts.read · accept portal.proposals.accept · sign portal.contracts.sign
 */
export function PortalAgreementsPage() {
    const { can, feature } = usePortal();
    const navigate = useNavigate();
    const openProposal = useOpenPortalProposal();
    const signContract = useSignPortalContract();
    const [busyId, setBusyId] = useState<string | null>(null);
    const onOpenProposal = (id: string) => {
        setBusyId(id);
        openProposal.mutate(id, {
            onSuccess: (r) => {
                if (r.access) { try { sessionStorage.setItem(PROPOSAL_ACCESS_KEY(r.token_prefix), r.access); } catch { /* private mode: the page asks for a code */ } }
                navigate(r.path);
            },
            onError: (e) => { setBusyId(null); toast({ variant: "destructive", title: "Could not open the proposal", description: getApiErrorMessage(e) }); },
        });
    };
    const onSign = (id: string) => {
        setBusyId(id);
        signContract.mutate(id, {
            onSuccess: (r) => navigate(r.path),
            onError: (e) => { setBusyId(null); toast({ variant: "destructive", title: "Could not open signing", description: getApiErrorMessage(e) }); },
        });
    };
    const showProposals = can("portal.proposals.read") && feature("proposals");
    const showContracts = can("portal.contracts.read") && feature("contracts");
    const proposals = usePortalProposals({ limit: 50 }, showProposals);
    const contracts = usePortalContracts({ limit: 50 }, showContracts);
    return (
        <>
            <PortalHeader title="Agreements" description="Proposals and contracts with the team. Review, accept and sign them here." />
            <Tabs defaultValue={showProposals ? "proposals" : "contracts"}>
                <TabsList>
                    {showProposals && <TabsTrigger value="proposals">Proposals</TabsTrigger>}
                    {showContracts && <TabsTrigger value="contracts">Contracts</TabsTrigger>}
                </TabsList>
                {showProposals && (
                    <TabsContent value="proposals" className="mt-4">
                        {proposals.isLoading ? <ListSkeleton /> : proposals.error ? <ErrorState error={proposals.error} onRetry={() => proposals.refetch()} /> : !proposals.data?.data.length ? <EmptyState icon={FileSignature} title="No proposals" /> : (
                            <PortalCard>
                                <ul className="divide-y divide-border-soft">
                                    {proposals.data.data.map((p) => (
                                        <li key={p.id} className="flex flex-wrap items-center gap-2 py-3">
                                            <div className="min-w-0 flex-1"><div className="truncate text-[13px] font-medium">{p.title}</div><div className="text-xs text-muted-foreground">{p.number} · sent {formatDate(p.sent_at)}{p.valid_until ? ` · valid until ${formatDate(p.valid_until)}` : ""}</div></div>
                                            <span className="tabular text-[13px]">{formatMoney(p.gross_total, p.currency)}</span>
                                            <Badge variant={p.status === "ACCEPTED" ? "success" : p.can_accept ? "warning" : "neutral"}>{getDropdownOptionLabel(PortalAgreementStatusOptions, p.status)}</Badge>
                                            {p.can_accept && <Button size="sm" loading={busyId === p.id} disabled={!!busyId} onClick={() => onOpenProposal(p.id)}>Review & accept</Button>}
                                        </li>
                                    ))}
                                </ul>
                            </PortalCard>
                        )}
                    </TabsContent>
                )}
                {showContracts && (
                    <TabsContent value="contracts" className="mt-4">
                        {contracts.isLoading ? <ListSkeleton /> : contracts.error ? <ErrorState error={contracts.error} onRetry={() => contracts.refetch()} /> : !contracts.data?.data.length ? <EmptyState icon={FileSignature} title="No contracts" /> : (
                            <PortalCard>
                                <ul className="divide-y divide-border-soft">
                                    {contracts.data.data.map((c) => (
                                        <li key={c.id} className="flex flex-wrap items-center gap-2 py-3">
                                            <div className="min-w-0 flex-1"><div className="truncate text-[13px] font-medium">{c.title}</div><div className="text-xs text-muted-foreground">{c.number}{c.start_date ? ` · ${formatDate(c.start_date)} – ${formatDate(c.end_date)}` : ""}</div></div>
                                            {c.total_value && <span className="tabular text-[13px]">{formatMoney(c.total_value, c.currency ?? "EUR")}</span>}
                                            <Badge variant={c.awaiting_signature ? "warning" : c.status === "ACTIVE" ? "success" : "neutral"}>{getDropdownOptionLabel(PortalAgreementStatusOptions, c.status)}</Badge>
                                            {c.awaiting_signature && can("portal.contracts.sign") && <Button size="sm" loading={busyId === c.id} disabled={!!busyId} onClick={() => onSign(c.id)}><PenLine /> Sign</Button>}
                                        </li>
                                    ))}
                                </ul>
                            </PortalCard>
                        )}
                    </TabsContent>
                )}
            </Tabs>
        </>
    );
}

/** Customer billing — /portal/billing (mockup 07-portal `cp-billing`). @perm portal.invoices.read · pay portal.invoices.pay */
export function PortalBillingPage() {
    const [filter, setFilter] = useState("all");
    const [page, setPage] = useState(1);
    const invoices = usePortalInvoices({ status: filter === "all" ? undefined : filter, page, limit: 25 });
    return (
        <>
            <PortalHeader title="Billing" description="Your invoices and what is left to pay." />
            {invoices.data?.outstanding.length ? (
                <div className="mb-4 grid gap-3 sm:grid-cols-3">
                    {invoices.data.outstanding.map((o) => <StatCard key={o.currency} label={`To pay (${o.currency})`} value={formatMoney(o.amount_due, o.currency)} hint={`${o.count} invoice${o.count === 1 ? "" : "s"}`} tone="warning" icon={Receipt} />)}
                </div>
            ) : null}
            <Select value={filter} onValueChange={(v) => { setFilter(v); setPage(1); }}>
                <SelectTrigger className="mb-4 h-9 sm:w-40" aria-label="Filter invoices"><SelectValue /></SelectTrigger>
                <SelectContent>{PortalInvoiceFilterOptions.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent>
            </Select>
            {invoices.isLoading ? <ListSkeleton /> : invoices.error ? <ErrorState error={invoices.error} onRetry={() => invoices.refetch()} /> : !invoices.data?.data.length ? (
                <EmptyState icon={Receipt} title="No invoices" description="Invoices from the team appear here." />
            ) : (
                <PortalCard>
                    <ul className="divide-y divide-border-soft">
                        {invoices.data.data.map((i) => (
                            <li key={i.id} className="flex flex-wrap items-center gap-2 py-3">
                                <div className="min-w-0 flex-1"><div className="text-[13px] font-medium tabular">{i.number}</div><div className="text-xs text-muted-foreground">{i.project?.name ? `${i.project.name} · ` : ""}issued {formatDate(i.issue_date)}{i.due_date ? ` · due ${formatDate(i.due_date)}` : ""}</div></div>
                                <div className="text-right"><div className="tabular text-[13px]">{formatMoney(i.total, i.currency)}</div>{Number(i.amount_due) > 0 && i.status !== "PAID" && <div className="text-xs text-muted-foreground tabular">{formatMoney(i.amount_due, i.currency)} due</div>}</div>
                                <Badge variant={PortalInvoiceStatusTone[i.status] ?? "neutral"}>{getDropdownOptionLabel(PortalInvoiceStatusOptions, i.status)}</Badge>
                                {i.pay_url && <Button size="sm" asChild><a href={i.pay_url} target="_blank" rel="noreferrer">Pay</a></Button>}
                            </li>
                        ))}
                    </ul>
                    {invoices.data.pagination.total_pages > 1 && <div className="mt-3"><Pagination currentPage={page} totalPages={invoices.data.pagination.total_pages} onPageChange={setPage} /></div>}
                </PortalCard>
            )}
        </>
    );
}
