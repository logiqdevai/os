import { useCallback, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Archive, Copy, Eye, FileSignature, GitBranch, Link2, Lock, MoreHorizontal, Pencil, Send, ThumbsDown, Users, XCircle } from "lucide-react";
import { Page } from "@/components/ui/page";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ErrorState, PageSkeleton } from "@/components/ui/states";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import ConfirmationDialog from "@/components/ui/confirmation-dialog";
import { usePageMetadata } from "@/hooks/use-page-metadata";
import { usePermissions } from "@/hooks/use-permission";
import { toast } from "@/hooks/use-toast";
import { getApiErrorMessage } from "@/lib/api-error";
import { formatDate, formatMoney, personName } from "@/lib/format";
import { renderMarkdown, markdownClass } from "@/lib/markdown";
import {
    useArchiveProposal, useCancelProposal, useCreateProposalVersion, useDuplicateProposal, useProposal, useRotateShareLink,
} from "@/features/proposals/hooks/use-proposals";
import type { ProposalDetail } from "@/features/proposals/interfaces/proposals.interfaces";
import { ProposalStatusBadge, VersionStatusBadge } from "../../components/proposal-badges";
import { ContentEditor } from "./components/content-editor";
import { PricingEditor } from "./components/pricing-editor";
import { ScheduleEditor } from "./components/schedule-editor";
import { ReviewTab } from "./components/review-tab";
import { VersionsTab } from "./components/versions-tab";
import { ActivityTab } from "./components/activity-tab";
import { RequestReviewDialog } from "./components/request-review-dialog";
import { SendDialog } from "./components/send-dialog";
import { ConvertDialog, DetailsDialog, MarkLostDialog } from "./components/record-dialogs";
import { TotalsCard } from "./components/totals-card";

const TABS = ["content", "pricing", "payments", "review", "versions", "activity"] as const;
const LIVE = ["SENT", "VIEWED", "CHANGES_REQUESTED"];
const CLOSED = ["ACCEPTED", "REJECTED", "EXPIRED", "CANCELLED"];

/**
 * /proposals/:id?tab=&version= — proposal editor.
 * @perm VIEW proposals.proposals.read · edit DRAFT versions proposals.proposals.update · approve · send · convert · cancel · archive
 * @api GET /proposals/:id · PUT /proposals/:id/versions/:vid/content · POST …/versions · …/submit-for-review · …/send · …/convert
 * @states loading · error/403/404 · locked version (read only, "Create revision") · unsaved changes per tab
 */
export default function ProposalDetailPage() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [sp, setSp] = useSearchParams();
    const tab = (TABS as readonly string[]).includes(sp.get("tab") ?? "") ? (sp.get("tab") as string) : "content";
    const versionId = sp.get("version") ?? undefined;
    const q = useProposal(id, versionId);
    const p = usePermissions();
    const [dirty, setDirty] = useState<Record<string, boolean>>({});
    const [dialog, setDialog] = useState<"review" | "send" | "details" | "lost" | "convert" | "cancel" | "archive" | "preview" | null>(null);
    const createVersion = useCreateProposalVersion();
    const duplicate = useDuplicateProposal();
    const cancel = useCancelProposal();
    const archive = useArchiveProposal();
    const rotate = useRotateShareLink();
    const markDirty = useCallback((key: string) => (d: boolean) => setDirty((all) => (all[key] === d ? all : { ...all, [key]: d })), []);
    const onContentDirty = useCallback((d: boolean) => markDirty("content")(d), [markDirty]);
    const onPricingDirty = useCallback((d: boolean) => markDirty("pricing")(d), [markDirty]);
    const onScheduleDirty = useCallback((d: boolean) => markDirty("payments")(d), [markDirty]);
    usePageMetadata({ title: q.data ? `${q.data.number} · ${q.data.title}` : "Proposal" });

    const setParam = (key: string, value: string | null) =>
        setSp((prev) => {
            const next = new URLSearchParams(prev);
            if (value) next.set(key, value);
            else next.delete(key);
            return next;
        }, { replace: key === "tab" });

    if (q.isPending) return <PageSkeleton />;
    if (q.error || !q.data) return <Page><ErrorState error={q.error} onRetry={() => q.refetch()} /></Page>;
    const proposal = q.data;
    const v = proposal.version;
    const isCurrent = !!v && v.id === proposal.current_version_id;
    const closed = CLOSED.includes(proposal.status);
    const live = LIVE.includes(proposal.status);
    const editable = !!v && v.editable && isCurrent && !closed && p.can("proposals.proposals.update");
    const anyDirty = Object.values(dirty).some(Boolean);
    const currentStatus = proposal.versions.find((x) => x.id === proposal.current_version_id)?.status;

    const newRevision = () =>
        createVersion.mutate(
            { id: proposal.id },
            {
                onSuccess: (nv: { id: string; version_number: number }) => { toast({ title: `Draft v${nv.version_number} created` }); setParam("version", null); },
                onError: (e) => toast({ variant: "destructive", title: "Could not create a revision", description: getApiErrorMessage(e) }),
            }
        );
    const newLink = () =>
        rotate.mutate(proposal.id, {
            onSuccess: async (r) => {
                try { await navigator.clipboard.writeText(r.public_url); toast({ title: "New customer link copied", description: "The previous link no longer works." }); }
                catch { toast({ title: "New customer link", description: r.public_url }); }
            },
            onError: (e) => toast({ variant: "destructive", title: "Could not create a link", description: getApiErrorMessage(e) }),
        });

    const primary = (() => {
        if (!isCurrent || closed) {
            if (proposal.status === "ACCEPTED" && p.can("proposals.proposals.convert")) {
                return proposal.contract_id
                    ? <Button variant="outline" onClick={() => navigate(`/contracts/${proposal.contract_id}`)}><FileSignature /> Open contract</Button>
                    : <Button onClick={() => setDialog("convert")}><FileSignature /> Create contract</Button>;
            }
            return null;
        }
        const out = [];
        if (currentStatus === "DRAFT" && p.can("proposals.proposals.update")) out.push(<Button key="review" variant="outline" disabled={anyDirty} onClick={() => setDialog("review")}><Users /> Request approval</Button>);
        if ((currentStatus === "DRAFT" || currentStatus === "APPROVED") && p.can("proposals.proposals.send")) out.push(<Button key="send" disabled={anyDirty} onClick={() => setDialog("send")}><Send /> Send</Button>);
        if (currentStatus === "SENT" && live) {
            if (p.can("proposals.proposals.send")) out.push(<Button key="link" variant="outline" loading={rotate.isPending} onClick={newLink}><Link2 /> New customer link</Button>);
            if (p.can("proposals.proposals.update")) out.push(<Button key="rev" loading={createVersion.isPending} onClick={newRevision}><GitBranch /> Create revision</Button>);
        }
        return out;
    })();

    return (
        <Page>
            <div className="mb-4 space-y-2">
                <Link to="/proposals" className="text-[13px] text-muted-foreground hover:text-foreground">← Proposals</Link>
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                            <span className="font-mono text-[13px] text-muted-foreground">{proposal.number}</span>
                            <h1 className="min-w-0 truncate text-xl font-medium text-foreground">{proposal.title}</h1>
                            <ProposalStatusBadge status={proposal.status} />
                        </div>
                        <p className="text-[13px] text-muted-foreground">
                            {[proposal.company?.name ?? "No customer", proposal.contact ? `${proposal.contact.first_name} ${proposal.contact.last_name ?? ""}`.trim() : null, proposal.deal ? `deal “${proposal.deal.name}”` : null, proposal.owner ? `owner ${personName(proposal.owner.user)}` : null, proposal.valid_until ? `valid until ${formatDate(proposal.valid_until)}` : null]
                                .filter(Boolean)
                                .join(" · ")}
                        </p>
                        <div className="flex flex-wrap items-center gap-2 pt-1">
                            <Select value={v?.id} onValueChange={(vid) => setParam("version", vid === proposal.current_version_id ? null : vid)}>
                                <SelectTrigger className="h-7 w-auto min-w-36 text-[12.5px]" aria-label="Version"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    {proposal.versions.map((x) => (
                                        <SelectItem key={x.id} value={x.id}>v{x.version_number} · {x.status.toLowerCase().replace("_", " ")}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            {v && <VersionStatusBadge status={v.status} />}
                            <span className="text-[13px] tabular text-foreground">{formatMoney(v?.gross_total ?? proposal.gross_total, proposal.currency)}</span>
                        </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        <Button variant="ghost" onClick={() => setDialog("preview")}><Eye /> Preview</Button>
                        {primary}
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild><Button variant="outline" size="icon" aria-label="More actions"><MoreHorizontal /></Button></DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                {p.can("proposals.proposals.update") && !closed && <DropdownMenuItem onSelect={() => setDialog("details")}><Pencil /> Edit details</DropdownMenuItem>}
                                {p.can("proposals.proposals.create") && (
                                    <DropdownMenuItem onSelect={() => duplicate.mutate(proposal.id, { onSuccess: (n) => { toast({ title: `Duplicated as ${n.number}` }); navigate(`/proposals/${n.id}`); }, onError: (e) => toast({ variant: "destructive", title: "Could not duplicate", description: getApiErrorMessage(e) }) })}>
                                        <Copy /> Duplicate
                                    </DropdownMenuItem>
                                )}
                                {p.can("proposals.proposals.update") && !["ACCEPTED", "CANCELLED", "REJECTED"].includes(proposal.status) && <DropdownMenuItem onSelect={() => setDialog("lost")}><ThumbsDown /> Mark lost</DropdownMenuItem>}
                                <DropdownMenuSeparator />
                                {p.can("proposals.proposals.cancel") && !closed && <DropdownMenuItem onSelect={() => setDialog("cancel")}><XCircle /> Cancel proposal</DropdownMenuItem>}
                                {p.can("proposals.proposals.archive") && !proposal.archived_at && <DropdownMenuItem onSelect={() => setDialog("archive")}><Archive /> Archive</DropdownMenuItem>}
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                </div>
            </div>

            {!isCurrent && v && (
                <Banner tone="info">
                    You are looking at v{v.version_number} ({v.status.toLowerCase()}), not the working version.{" "}
                    <button type="button" className="underline" onClick={() => setParam("version", null)}>Open the working version</button>
                </Banner>
            )}
            {isCurrent && v?.status === "SENT" && live && <Banner tone="warning"><Lock className="mr-1 inline size-3.5" /> v{v.version_number} was sent and is locked. Create a revision to change it; sending the revision replaces it for the customer.</Banner>}
            {isCurrent && v?.status === "IN_REVIEW" && <Banner tone="warning">v{v.version_number} is waiting for approval and cannot be edited.</Banner>}
            {isCurrent && v?.status === "APPROVED" && !closed && <Banner tone="success">v{v.version_number} is approved and ready to send.</Banner>}
            {live && proposal.sent_version_id && proposal.current_version_id !== proposal.sent_version_id && isCurrent && (
                <Banner tone="info">The customer still sees v{proposal.sent_version?.version_number}. Send this version to replace it.</Banner>
            )}
            {proposal.status === "ACCEPTED" && <Banner tone="success">Accepted {formatDate(proposal.accepted_at)}{proposal.contract_id ? " · contract drafted" : proposal.requires_contract ? " · needs a contract" : ""}.</Banner>}
            {proposal.status === "CHANGES_REQUESTED" && <Banner tone="warning">The customer asked for changes. See the comments on the Review tab, then create a revision.</Banner>}

            {!v ? (
                <ErrorState error={null} />
            ) : (
                <Tabs value={tab} onValueChange={(t) => setParam("tab", t === "content" ? null : t)}>
                    <div className="-mx-4 overflow-x-auto px-4 md:mx-0 md:px-0">
                        <TabsList className="w-max">
                            <TabsTrigger value="content">Content{dirty.content ? " •" : ""}</TabsTrigger>
                            <TabsTrigger value="pricing">Pricing{dirty.pricing ? " •" : ""}</TabsTrigger>
                            <TabsTrigger value="payments">Payments{dirty.payments ? " •" : ""}</TabsTrigger>
                            <TabsTrigger value="review">Review{v.approvals.some((a) => a.decision === "PENDING") ? <Badge variant="info" className="ml-1.5">{v.approvals.filter((a) => a.decision === "PENDING").length}</Badge> : null}</TabsTrigger>
                            <TabsTrigger value="versions">Versions</TabsTrigger>
                            <TabsTrigger value="activity">Activity</TabsTrigger>
                        </TabsList>
                    </div>
                    <TabsContent value="content" forceMount className="mt-4 data-[state=inactive]:hidden"><ContentEditor proposal={proposal} editable={editable} onDirtyChange={onContentDirty} /></TabsContent>
                    <TabsContent value="pricing" forceMount className="mt-4 data-[state=inactive]:hidden"><PricingEditor proposal={proposal} editable={editable} onDirtyChange={onPricingDirty} /></TabsContent>
                    <TabsContent value="payments" forceMount className="mt-4 data-[state=inactive]:hidden"><ScheduleEditor proposal={proposal} editable={editable} onDirtyChange={onScheduleDirty} /></TabsContent>
                    <TabsContent value="review" className="mt-4"><ReviewTab proposal={proposal} onRequestReview={() => setDialog("review")} /></TabsContent>
                    <TabsContent value="versions" className="mt-4"><VersionsTab proposal={proposal} onOpenVersion={(vid) => setSp((prev) => { const n = new URLSearchParams(prev); if (vid === proposal.current_version_id) n.delete("version"); else n.set("version", vid); n.delete("tab"); return n; })} /></TabsContent>
                    <TabsContent value="activity" className="mt-4"><ActivityTab proposalId={proposal.id} /></TabsContent>
                </Tabs>
            )}

            {v && <RequestReviewDialog proposal={proposal} open={dialog === "review"} onOpenChange={(o) => setDialog(o ? "review" : null)} />}
            <SendDialog proposal={proposal} open={dialog === "send"} onOpenChange={(o) => setDialog(o ? "send" : null)} />
            <DetailsDialog proposal={proposal} open={dialog === "details"} onOpenChange={(o) => setDialog(o ? "details" : null)} />
            <MarkLostDialog proposal={proposal} open={dialog === "lost"} onOpenChange={(o) => setDialog(o ? "lost" : null)} />
            <ConvertDialog proposal={proposal} open={dialog === "convert"} onOpenChange={(o) => setDialog(o ? "convert" : null)} />
            <PreviewSheet proposal={proposal} open={dialog === "preview"} onOpenChange={(o) => setDialog(o ? "preview" : null)} />
            <ConfirmationDialog
                isOpen={dialog === "cancel" || dialog === "archive"}
                onClose={() => setDialog(null)}
                title={dialog === "cancel" ? `Cancel ${proposal.number}?` : `Archive ${proposal.number}?`}
                description={dialog === "cancel" ? "The customer link stops working and the proposal can no longer be accepted." : "Archived proposals are hidden from the list."}
                confirmText={dialog === "cancel" ? "Cancel proposal" : "Archive"}
                variant="destructive"
                isLoading={cancel.isPending || archive.isPending}
                onConfirm={() => {
                    const opts = { onSuccess: () => { toast({ title: dialog === "cancel" ? "Proposal cancelled" : "Proposal archived" }); setDialog(null); }, onError: (e: unknown) => toast({ variant: "destructive" as const, title: "Action failed", description: getApiErrorMessage(e) }) };
                    if (dialog === "cancel") cancel.mutate(proposal.id, opts);
                    else archive.mutate({ id: proposal.id }, opts);
                }}
            />
        </Page>
    );
}

function Banner({ tone, children }: { tone: "info" | "warning" | "success"; children: React.ReactNode }) {
    const cls = { info: "bg-info-soft text-info", warning: "bg-warning-soft text-warning", success: "bg-success-soft text-success" }[tone];
    return <div className={`mb-3 rounded-md px-3 py-2 text-[13px] ${cls}`}>{children}</div>;
}

/** What the customer sees for this version (internal sections excluded; variables resolve when sent). */
function PreviewSheet({ proposal, open, onOpenChange }: { proposal: ProposalDetail; open: boolean; onOpenChange: (o: boolean) => void }) {
    const v = proposal.version;
    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent className="w-full overflow-y-auto sm:max-w-3xl">
                <SheetHeader>
                    <SheetTitle>{proposal.title}</SheetTitle>
                    <SheetDescription>Customer preview of v{v?.version_number}. Internal sections are hidden; {"{{variables}}"} are filled in when you send.</SheetDescription>
                </SheetHeader>
                {v && (
                    <div className="mt-4 space-y-6">
                        {v.sections.filter((s) => !s.is_internal).map((s) => (
                            <section key={s.id} className="space-y-2">
                                <h2 className="text-base font-medium text-foreground">{s.title}</h2>
                                {s.body?.trim() ? <div className={markdownClass} dangerouslySetInnerHTML={{ __html: renderMarkdown(s.body) }} /> : <p className="text-[13px] text-muted-foreground">Empty section.</p>}
                            </section>
                        ))}
                        {v.line_items.length > 0 && (
                            <section className="space-y-2">
                                <h2 className="text-base font-medium text-foreground">Investment</h2>
                                <ul className="divide-y divide-border rounded-md border border-border">
                                    {v.line_items.map((l) => (
                                        <li key={l.id} className="flex items-center justify-between gap-3 px-3 py-2 text-[13px]">
                                            <span className="min-w-0 text-foreground">{l.is_optional && <Badge variant="outline" className="mr-1.5">Optional</Badge>}{l.name}</span>
                                            <span className="tabular text-foreground">{formatMoney(l.net_amount, proposal.currency)}</span>
                                        </li>
                                    ))}
                                </ul>
                                <TotalsCard proposal={proposal} />
                            </section>
                        )}
                    </div>
                )}
            </SheetContent>
        </Sheet>
    );
}
