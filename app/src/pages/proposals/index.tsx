import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Archive, ClipboardCheck, Copy, FileText, MoreHorizontal, Plus, Trash2, XCircle } from "lucide-react";
import { Page, PageHeader } from "@/components/ui/page";
import { DataTable, TableToolbar, type DataTableColumn } from "@/components/ui/data-table";
import { Button } from "@/components/ui/button";
import { StatCard, StatGrid } from "@/components/ui/stat-card";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import ConfirmationDialog from "@/components/ui/confirmation-dialog";
import { Can } from "@/components/access/can";
import { useListParams } from "@/hooks/use-list-params";
import { usePermissions } from "@/hooks/use-permission";
import { toast } from "@/hooks/use-toast";
import { getApiErrorMessage } from "@/lib/api-error";
import { formatDate, formatMoney, formatRelative } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
    useArchiveProposal, useCancelProposal, useDeleteProposal, useDuplicateProposal, useMyApprovals, useProposalSummary, useProposals,
} from "@/features/proposals/hooks/use-proposals";
import type { ProposalListItem } from "@/features/proposals/interfaces/proposals.interfaces";
import { ProposalViewFilterOptions } from "@/config/constants/dropdowns/proposals/proposal-status.options";
import { MemberChip, ProposalStatusBadge } from "./components/proposal-badges";

type PendingAction = { kind: "cancel" | "archive" | "delete"; proposal: ProposalListItem } | null;

/**
 * /proposals — all proposals with view tabs, search, KPIs and row actions.
 * @perm VIEW proposals.proposals.read · create · archive · cancel · delete
 * @api GET /proposals · GET /proposals/summary · GET /proposals/approvals/mine
 */
export default function ProposalsListPage() {
    const navigate = useNavigate();
    const p = usePermissions();
    const { params, setPage, search, setSearch, filters, setFilter } = useListParams();
    const view = ProposalViewFilterOptions.find((v) => v.id === (filters.view ?? "all")) ?? ProposalViewFilterOptions[0];
    const { view: _view, ...rest } = params as Record<string, string | number>;
    void _view;
    const query = { ...rest, ...(view.status && { status: view.status }), ...(view.owner && { owner: view.owner }), ...(view.expiring_within_days && { expiring_within_days: view.expiring_within_days }) };
    const list = useProposals(query);
    const summary = useProposalSummary();
    const approvals = useMyApprovals(p.can("proposals.proposals.approve"));
    const duplicate = useDuplicateProposal();
    const archive = useArchiveProposal();
    const cancel = useCancelProposal();
    const remove = useDeleteProposal();
    const [pending, setPending] = useState<PendingAction>(null);

    const columns: DataTableColumn<ProposalListItem>[] = [
        {
            key: "proposal",
            header: "Proposal",
            cell: (r) => (
                <div className="min-w-0 max-w-[260px]">
                    <div className="font-mono text-xs text-muted-foreground">{r.number}</div>
                    <div className="truncate font-medium text-foreground">{r.title}</div>
                    <div className="truncate text-xs text-muted-foreground sm:hidden">{r.company?.name ?? "No customer"}</div>
                </div>
            ),
        },
        { key: "customer", header: "Customer", hideBelow: "sm", cell: (r) => <span className="truncate">{r.company?.name ?? <span className="text-muted-foreground">—</span>}</span> },
        { key: "status", header: "Status", cell: (r) => <ProposalStatusBadge status={r.status} /> },
        {
            key: "version",
            header: "Version",
            hideBelow: "lg",
            cell: (r) => (
                <span className="text-xs text-muted-foreground">
                    {r.sent_version ? `v${r.sent_version.version_number} sent` : ""}
                    {r.current_version && r.current_version.id !== r.sent_version?.id ? `${r.sent_version ? " · " : ""}v${r.current_version.version_number} ${r.current_version.status.toLowerCase().replace("_", " ")}` : ""}
                </span>
            ),
        },
        { key: "total", header: "Total", className: "text-right tabular", headerClassName: "text-right", cell: (r) => formatMoney(r.gross_total, r.currency) },
        { key: "valid", header: "Valid until", hideBelow: "md", cell: (r) => <span className="text-muted-foreground">{r.valid_until ? formatDate(r.valid_until) : "—"}</span> },
        {
            key: "tracking",
            header: "Tracking",
            hideBelow: "xl",
            cell: (r) => (
                <span className="text-xs text-muted-foreground">
                    {r.status === "ACCEPTED" ? `accepted ${formatRelative(r.accepted_at)}` : r.view_count ? `${r.view_count} views · ${formatRelative(r.last_viewed_at)}` : r.sent_at ? "not viewed yet" : "—"}
                </span>
            ),
        },
        { key: "owner", header: "Owner", hideBelow: "lg", cell: (r) => <MemberChip member={r.owner} /> },
        {
            key: "actions",
            header: <span className="sr-only">Actions</span>,
            className: "w-10",
            cell: (r) => (
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${r.number}`}>
                            <MoreHorizontal />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        <DropdownMenuItem onSelect={() => navigate(`/proposals/${r.id}`)}><FileText /> Open</DropdownMenuItem>
                        {p.can("proposals.proposals.create") && (
                            <DropdownMenuItem
                                onSelect={() =>
                                    duplicate.mutate(r.id, {
                                        onSuccess: (n) => { toast({ title: `Duplicated as ${n.number}` }); navigate(`/proposals/${n.id}`); },
                                        onError: (e) => toast({ variant: "destructive", title: "Could not duplicate", description: getApiErrorMessage(e) }),
                                    })
                                }
                            >
                                <Copy /> Duplicate
                            </DropdownMenuItem>
                        )}
                        {(p.can("proposals.proposals.cancel") || p.can("proposals.proposals.archive") || p.can("proposals.proposals.delete")) && <DropdownMenuSeparator />}
                        {p.can("proposals.proposals.cancel") && !["ACCEPTED", "REJECTED", "EXPIRED", "CANCELLED"].includes(r.status) && (
                            <DropdownMenuItem onSelect={() => setPending({ kind: "cancel", proposal: r })}><XCircle /> Cancel proposal</DropdownMenuItem>
                        )}
                        {p.can("proposals.proposals.archive") && !r.archived_at && <DropdownMenuItem onSelect={() => setPending({ kind: "archive", proposal: r })}><Archive /> Archive</DropdownMenuItem>}
                        {p.can("proposals.proposals.archive") && r.archived_at && (
                            <DropdownMenuItem onSelect={() => archive.mutate({ id: r.id, restore: true }, { onSuccess: () => toast({ title: "Proposal restored" }), onError: (e) => toast({ variant: "destructive", title: "Could not restore", description: getApiErrorMessage(e) }) })}>
                                <Archive /> Restore
                            </DropdownMenuItem>
                        )}
                        {p.can("proposals.proposals.delete") && !r.sent_version_id && (
                            <DropdownMenuItem className="text-danger focus:text-danger" onSelect={() => setPending({ kind: "delete", proposal: r })}><Trash2 /> Delete</DropdownMenuItem>
                        )}
                    </DropdownMenuContent>
                </DropdownMenu>
            ),
        },
    ];

    const s = summary.data;
    const confirm = () => {
        if (!pending) return;
        const { kind, proposal } = pending;
        const done = (title: string) => ({
            onSuccess: () => { toast({ title }); setPending(null); },
            onError: (e: unknown) => toast({ variant: "destructive" as const, title: "Action failed", description: getApiErrorMessage(e) }),
        });
        if (kind === "cancel") cancel.mutate(proposal.id, done(`${proposal.number} cancelled`));
        if (kind === "archive") archive.mutate({ id: proposal.id }, done(`${proposal.number} archived`));
        if (kind === "delete") remove.mutate(proposal.id, done(`${proposal.number} deleted`));
    };

    return (
        <Page>
            <PageHeader
                title="Proposals"
                description="Quotes and proposals from first draft to accepted work. Every sent proposal stays bound to the exact version that was sent."
                actions={
                    <Can permission="proposals.proposals.create">
                        <Button onClick={() => navigate("/proposals/new")}>
                            <Plus /> New proposal
                        </Button>
                    </Can>
                }
            />

            {summary.isPending ? (
                <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-[86px]" />)}</div>
            ) : s ? (
                <StatGrid className="mb-4">
                    <StatCard label="Open value" value={formatMoney(s.open_value, "EUR", { compact: true })} hint={`${s.open_count} with customers`} />
                    <StatCard label="Accepted (90 days)" value={formatMoney(s.accepted_90d_value, "EUR", { compact: true })} hint={`${s.accepted_90d_count} proposals`} tone="success" />
                    <StatCard label="Win rate" value={s.win_rate === null ? "—" : `${s.win_rate}%`} hint="accepted / decided" />
                    <StatCard label="Expiring in 7 days" value={s.expiring_7d} hint={`${s.awaiting_approval} awaiting approval`} tone={s.expiring_7d ? "warning" : "default"} />
                </StatGrid>
            ) : null}

            {!!approvals.data?.length && (
                <div className="mb-4 rounded-lg border border-border bg-card p-3">
                    <div className="mb-2 flex items-center gap-2 text-[13px] font-medium text-foreground">
                        <ClipboardCheck className="size-4 text-warning" /> Waiting for your approval ({approvals.data.length})
                    </div>
                    <div className="space-y-1">
                        {approvals.data.map((a) => (
                            <Link key={a.id} to={`/proposals/${a.version.proposal.id}?tab=review`} className="flex flex-wrap items-center gap-x-3 gap-y-0.5 rounded-md px-2 py-1.5 text-[13px] hover:bg-accent">
                                <span className="font-mono text-xs text-muted-foreground">{a.version.proposal.number}</span>
                                <span className="min-w-0 flex-1 truncate text-foreground">{a.version.proposal.title}</span>
                                <span className="text-xs text-muted-foreground">v{a.version.version_number} · step {a.step}</span>
                                <span className="tabular text-foreground">{formatMoney(a.version.gross_total, a.version.proposal.currency)}</span>
                            </Link>
                        ))}
                    </div>
                </div>
            )}

            <div className="-mx-4 mb-3 overflow-x-auto px-4 md:mx-0 md:px-0">
                <div className="flex w-max gap-1" role="tablist" aria-label="Views">
                    {ProposalViewFilterOptions.map((v) => (
                        <button
                            key={v.id}
                            type="button"
                            role="tab"
                            aria-selected={view.id === v.id}
                            onClick={() => setFilter("view", v.id)}
                            className={cn(
                                "h-7 whitespace-nowrap rounded-md px-2.5 text-[12.5px] transition-colors",
                                view.id === v.id ? "bg-secondary font-medium text-foreground ring-1 ring-border" : "text-muted-foreground hover:bg-accent hover:text-foreground"
                            )}
                        >
                            {v.label}
                        </button>
                    ))}
                </div>
            </div>

            <TableToolbar search={search} onSearch={setSearch} placeholder="Search number, title, customer…">
                <Select value={filters.archived === "true" ? "archived" : "active"} onValueChange={(v) => setFilter("archived", v === "archived" ? "true" : null)}>
                    <SelectTrigger className="h-8 w-36" aria-label="Archived">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="archived">Archived</SelectItem>
                    </SelectContent>
                </Select>
            </TableToolbar>

            <DataTable
                columns={columns}
                data={list.data?.data}
                rowKey={(r) => r.id}
                loading={list.isFetching}
                error={list.error}
                onRetry={() => list.refetch()}
                pagination={list.data?.pagination}
                onPageChange={setPage}
                rowHref={(r) => `/proposals/${r.id}`}
                empty={{
                    icon: FileText,
                    title: search || view.id !== "all" ? "No proposals match these filters" : "No proposals yet",
                    description: search || view.id !== "all" ? "Try another view or search." : "Create your first proposal for a customer or a deal.",
                    action:
                        p.can("proposals.proposals.create") && !search && view.id === "all" ? (
                            <Button size="sm" onClick={() => navigate("/proposals/new")}><Plus /> New proposal</Button>
                        ) : undefined,
                }}
            />

            <ConfirmationDialog
                isOpen={!!pending}
                onClose={() => setPending(null)}
                title={pending ? `${pending.kind === "cancel" ? "Cancel" : pending.kind === "archive" ? "Archive" : "Delete"} ${pending.proposal.number}?` : ""}
                description={
                    pending?.kind === "cancel"
                        ? "The customer link stops working and the proposal can no longer be accepted."
                        : pending?.kind === "archive"
                          ? "Archived proposals are hidden from the list. You can restore them later."
                          : "This permanently deletes the draft and its versions."
                }
                confirmText={pending?.kind === "cancel" ? "Cancel proposal" : pending?.kind === "archive" ? "Archive" : "Delete"}
                variant="destructive"
                isLoading={cancel.isPending || archive.isPending || remove.isPending}
                onConfirm={confirm}
            />
        </Page>
    );
}
