import { useState } from "react";
import { Link } from "react-router-dom";
import { CheckCheck } from "lucide-react";
import { Page, PageHeader } from "@/components/ui/page";
import { DataTable, TableToolbar, type DataTableColumn } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useListParams } from "@/hooks/use-list-params";
import { formatDate, formatRelative, personName } from "@/lib/format";
import { FileApprovalDecisionOptions } from "@/config/constants/dropdowns/files/files.options";
import { useDecideFileApproval, useFileApprovals } from "@/features/files/hooks/use-files";
import type { ApprovalDecision, DocumentApprovalRow } from "@/features/files/interfaces/files.interfaces";
import { FileIcon, FilesStatusBadge, openDocument } from "../../components/files-ui";

/**
 * /files/approvals?tab=mine|requested|all — document approvals bound to one version (17 §10)
 * @perm VIEW documents.documents.read · decide: a listed approver with documents.documents.approve
 * @api GET /files/approvals?mine=|requested= · POST /files/approvals/:id/decision
 */
export default function FileApprovalsPage() {
    const { params, setPage, filters, setFilter } = useListParams();
    const tab = filters.tab ?? "mine";
    const query: Record<string, unknown> = { ...params, ...(tab === "mine" ? { mine: "true" } : tab === "requested" ? { requested: "true" } : {}) };
    delete query.tab;
    const approvals = useFileApprovals(query);
    const decide = useDecideFileApproval();
    const [deciding, setDeciding] = useState<{ row: DocumentApprovalRow; decision: ApprovalDecision } | null>(null);
    const [comment, setComment] = useState("");

    const columns: DataTableColumn<DocumentApprovalRow>[] = [
        {
            key: "doc",
            header: "Document",
            cell: (a) => (
                <div className="flex min-w-0 items-center gap-2">
                    <FileIcon type={a.document.mimetype?.includes("pdf") ? "pdf" : "other"} />
                    <div className="min-w-0">
                        <Link to={`/files/documents/${a.document.id}`} className="truncate font-medium text-foreground hover:underline">{a.document.title}</Link>
                        <div className="truncate text-xs text-muted-foreground">v{a.version?.version_number} · {a.requested_by ? personName(a.requested_by.user) : "—"} · {formatRelative(a.created_at)}</div>
                    </div>
                </div>
            ),
        },
        { key: "approvers", header: "Approvers", cell: (a) => <span className="line-clamp-1 text-xs">{a.approvers.map((x) => (x.membership ? personName(x.membership.user) : "—")).join(", ")}</span>, hideBelow: "md" },
        { key: "due", header: "Due", cell: (a) => (a.due_at ? formatDate(a.due_at) : "—"), hideBelow: "lg" },
        { key: "status", header: "Status", cell: (a) => <div className="flex flex-wrap gap-1"><FilesStatusBadge status={a.status} />{a.version_superseded && <Badge variant="neutral">newer version</Badge>}</div> },
        {
            key: "actions",
            header: <span className="sr-only">Decide</span>,
            cell: (a) => a.can_decide && (
                <div className="flex justify-end gap-1.5">
                    <Button size="sm" variant="ghost" onClick={() => openDocument(a.document.id, "inline", a.version?.id)}>Open</Button>
                    {FileApprovalDecisionOptions.map((o) => <Button key={o.id} size="sm" variant={o.id === "APPROVED" ? "default" : "outline"} onClick={() => { setComment(""); setDeciding({ row: a, decision: o.id }); }}>{o.label}</Button>)}
                </div>
            ),
        },
    ];

    return (
        <Page>
            <PageHeader title="Approvals" description="Approve the exact version of a file. A new upload supersedes pending requests." />
            <Tabs value={tab} onValueChange={(v) => setFilter("tab", v === "mine" ? null : v)}>
                <TabsList className="mb-3"><TabsTrigger value="mine">Waiting for me</TabsTrigger><TabsTrigger value="requested">Requested by me</TabsTrigger><TabsTrigger value="all">All</TabsTrigger></TabsList>
            </Tabs>
            <TableToolbar />
            <DataTable columns={columns} data={approvals.data?.data} rowKey={(a) => a.id} loading={approvals.isFetching} error={approvals.error} onRetry={() => approvals.refetch()} pagination={approvals.data?.pagination} onPageChange={setPage} empty={{ icon: CheckCheck, title: tab === "mine" ? "Nothing to approve" : "No approvals", description: "Request an approval from a file's detail page." }} />
            <Dialog open={!!deciding} onOpenChange={(o) => !o && setDeciding(null)}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader><DialogTitle>{FileApprovalDecisionOptions.find((o) => o.id === deciding?.decision)?.label} — {deciding?.row.document.title}</DialogTitle><DialogDescription>Your decision is recorded for version v{deciding?.row.version?.version_number}.</DialogDescription></DialogHeader>
                    <div className="space-y-1.5"><Label htmlFor="decision-comment">Comment{deciding?.decision !== "APPROVED" && " (recommended)"}</Label><Textarea id="decision-comment" rows={3} value={comment} onChange={(e) => setComment(e.target.value)} /></div>
                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setDeciding(null)}>Cancel</Button>
                        <Button variant={deciding?.decision === "REJECTED" ? "destructive" : "default"} onClick={() => { if (deciding) decide.mutate({ id: deciding.row.id, decision: deciding.decision, comment: comment || undefined }); setDeciding(null); }}>Confirm</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </Page>
    );
}
