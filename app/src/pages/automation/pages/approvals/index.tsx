import { useState } from "react";
import { Link } from "react-router-dom";
import { CheckCheck } from "lucide-react";
import { Page, PageHeader } from "@/components/ui/page";
import { DataTable, TableToolbar, type DataTableColumn } from "@/components/ui/data-table";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useListParams } from "@/hooks/use-list-params";
import { usePermission } from "@/hooks/use-permission";
import { toast } from "@/hooks/use-toast";
import { getApiErrorMessage } from "@/lib/api-error";
import { formatDateTime, formatRelative, personName } from "@/lib/format";
import { ApprovalDecisionFilterOptions } from "@/config/constants/dropdowns/automation/automation.options";
import { useApprovals, useDecideApproval } from "@/features/automation/hooks/use-automation";
import type { ApprovalRow } from "@/features/automation/interfaces/automation.interfaces";
import { JsonBlock, StatusBadge } from "../../components/automation-ui";

/**
 * /automation/approvals — human gates of workflow runs (20 §4, §6)
 * @perm own requests: any member · all approvals: automation.runs.read · decide: only the requested approver (server-checked)
 * @api GET /automation/approvals?decision=&mine= · POST /automation/approvals/:id/decide
 */
export default function ApprovalsPage() {
    const canSeeAll = usePermission("automation.runs.read");
    const { params, setPage, filters, setFilter } = useListParams({ filters: { decision: "PENDING" } });
    const mine = !canSeeAll || filters.mine !== "false";
    const decision = filters.decision === "ANY" ? undefined : filters.decision;
    const approvals = useApprovals({ ...params, decision, mine: mine ? "true" : "false" });
    const decide = useDecideApproval();
    const [deciding, setDeciding] = useState<{ row: ApprovalRow; decision: "APPROVED" | "REJECTED" } | null>(null);
    const [comment, setComment] = useState("");

    const columns: DataTableColumn<ApprovalRow>[] = [
        {
            key: "what",
            header: "Request",
            cell: (a) => (
                <div className="min-w-0">
                    <Link to={`/automation/runs/${a.run.id}`} className="truncate font-medium text-foreground hover:underline">{a.run.rule.name}</Link>
                    <div className="line-clamp-2 text-xs text-muted-foreground">{a.context?.message ?? a.step.action_key}</div>
                </div>
            ),
        },
        { key: "from", header: "Approver", cell: (a) => (a.requested_from_member ? personName(a.requested_from_member.user) : "—"), hideBelow: "md" },
        { key: "requested", header: "Requested", cell: (a) => <span title={formatDateTime(a.requested_at)}>{formatRelative(a.requested_at)}</span>, hideBelow: "sm" },
        { key: "expires", header: "Expires", cell: (a) => (a.expires_at ? formatDateTime(a.expires_at) : "—"), hideBelow: "lg" },
        { key: "decision", header: "Decision", cell: (a) => <StatusBadge status={a.decision} /> },
        {
            key: "actions",
            header: <span className="sr-only">Decide</span>,
            cell: (a) =>
                a.can_decide && (
                    <div className="flex justify-end gap-1.5">
                        <Button size="sm" variant="outline" onClick={() => { setComment(""); setDeciding({ row: a, decision: "REJECTED" }); }}>Reject</Button>
                        <Button size="sm" onClick={() => { setComment(""); setDeciding({ row: a, decision: "APPROVED" }); }}>Approve</Button>
                    </div>
                ),
        },
    ];

    return (
        <Page>
            <PageHeader title="Approvals" description="Workflow runs paused until a person approves the next step. Agents can never decide." />
            <TableToolbar>
                <Select value={decision ?? "all"} onValueChange={(v) => setFilter("decision", v === "all" ? "ANY" : v)}>
                    <SelectTrigger className="h-8 w-full sm:w-40" aria-label="Filter by decision"><SelectValue /></SelectTrigger>
                    <SelectContent>{ApprovalDecisionFilterOptions.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent>
                </Select>
                {canSeeAll && (
                    <label className="flex items-center gap-2 text-[13px] text-muted-foreground">
                        <Switch checked={mine} onCheckedChange={(v) => setFilter("mine", v ? null : "false")} aria-label="Only requested from me" />
                        Only mine
                    </label>
                )}
            </TableToolbar>
            <DataTable
                columns={columns}
                data={approvals.data?.data}
                rowKey={(a) => a.id}
                loading={approvals.isFetching}
                error={approvals.error}
                onRetry={() => approvals.refetch()}
                pagination={approvals.data?.pagination}
                onPageChange={setPage}
                empty={{ icon: CheckCheck, title: "Nothing waiting for you", description: "Approval requests from workflows show up here." }}
            />
            <Dialog open={!!deciding} onOpenChange={(o) => !decide.isPending && !o && setDeciding(null)}>
                <DialogContent className="sm:max-w-lg">
                    <DialogHeader>
                        <DialogTitle>{deciding?.decision === "APPROVED" ? "Approve" : "Reject"} — {deciding?.row.run.rule.name}</DialogTitle>
                        <DialogDescription>{deciding?.decision === "APPROVED" ? "The run continues with this step." : "The run stops here."}</DialogDescription>
                    </DialogHeader>
                    {deciding && <JsonBlock value={deciding.row.step.input} maxHeight="max-h-48" />}
                    <div className="space-y-1.5">
                        <Label htmlFor="approval-comment">Comment</Label>
                        <Textarea id="approval-comment" rows={3} value={comment} onChange={(e) => setComment(e.target.value)} />
                    </div>
                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setDeciding(null)} disabled={decide.isPending}>Cancel</Button>
                        <Button
                            variant={deciding?.decision === "REJECTED" ? "destructive" : "default"}
                            loading={decide.isPending}
                            onClick={() => deciding && decide.mutate({ id: deciding.row.id, decision: deciding.decision, comment: comment || undefined }, {
                                onSuccess: () => { toast({ title: deciding.decision === "APPROVED" ? "Approved" : "Rejected" }); setDeciding(null); },
                                onError: (e) => toast({ variant: "destructive", title: "Could not decide", description: getApiErrorMessage(e) }),
                            })}
                        >
                            {deciding?.decision === "APPROVED" ? "Approve" : "Reject"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </Page>
    );
}
