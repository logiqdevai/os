import { useState } from "react";
import { Link } from "react-router-dom";
import { CheckCheck, Check, X } from "lucide-react";
import { Page, PageHeader } from "@/components/ui/page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { EmptyState, ErrorState, ListSkeleton } from "@/components/ui/states";
import { Pagination } from "@/components/ui/pagination";
import { useListParams } from "@/hooks/use-list-params";
import { useApprovals, useApproveTimesheet, useBulkDecideTimesheets, useRejectTimesheet } from "@/features/time/timesheets/hooks/use-timesheets";
import type { ApprovalRow } from "@/features/time/timesheets/interfaces/timesheets.interfaces";
import { formatDate, formatMinutes, personName } from "@/lib/format";
import { toast } from "@/hooks/use-toast";
import { TimePaths } from "../../paths";
import { DecideDialog } from "../../components/decide-dialog";

/**
 * /time/approvals — submitted timesheets waiting for me. Self-approval is blocked by the API unless allowed.
 * @perm time.timesheets.approve · @api GET /time/approvals · POST /time/timesheets/:id/approve|reject · POST /time/timesheets/bulk
 */
export default function ApprovalsPage() {
    const { params, setPage } = useListParams();
    const q = useApprovals({ ...params, status: "SUBMITTED" });
    const approve = useApproveTimesheet();
    const reject = useRejectTimesheet();
    const bulk = useBulkDecideTimesheets();
    const [selected, setSelected] = useState<string[]>([]);
    const [deciding, setDeciding] = useState<{ row: ApprovalRow; mode: "approve" | "reject" } | null>(null);
    const rows = q.data?.data ?? [];

    return (
        <Page>
            <PageHeader
                title="Approvals"
                description="Timesheets submitted for your approval."
                actions={selected.length > 0 && (
                    <Button onClick={() => {
                        // Optimistic: the rows leave the queue at once. Only partial failures toast (they come back on refresh).
                        bulk.mutateAsync({ ids: selected, action: "approve" }).then((r) => {
                            if (r.failed) toast({ variant: "destructive", title: `${r.failed} of ${r.failed + r.succeeded} could not be approved`, description: r.results.filter((x) => !x.ok).map((x) => x.message).join(" · ") || undefined });
                        }, () => undefined);
                        setSelected([]);
                    }}><CheckCheck /> Approve {selected.length}</Button>
                )}
            />
            {q.isLoading ? <ListSkeleton /> : q.error ? <ErrorState error={q.error} onRetry={() => q.refetch()} /> : !rows.length ? (
                <EmptyState icon={CheckCheck} title="Nothing waiting for you" description="Submitted timesheets you approve will appear here." />
            ) : (
                <div className="space-y-3">
                    <label className="flex items-center gap-2 px-1 text-xs text-muted-foreground">
                        <Checkbox checked={selected.length === rows.length} onCheckedChange={(c) => setSelected(c ? rows.map((r) => r.id) : [])} aria-label="Select all" /> Select all on this page
                    </label>
                    {rows.map((r) => (
                        <div key={r.id} className="rounded-lg border border-border bg-card p-4">
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                <div className="flex min-w-0 items-start gap-3">
                                    <Checkbox className="mt-1" checked={selected.includes(r.id)} onCheckedChange={(c) => setSelected((prev) => (c ? [...prev, r.id] : prev.filter((x) => x !== r.id)))} aria-label={`Select ${personName(r.membership?.user)}`} />
                                    <div className="min-w-0">
                                        <Link to={TimePaths.timesheet(r.id)} className="font-medium text-foreground hover:underline">{personName(r.membership?.user)}</Link>
                                        <div className="text-xs text-muted-foreground tabular">{formatDate(r.period_start, "d MMM")} – {formatDate(r.period_end, "d MMM yyyy")} · submitted {formatDate(r.submitted_at)}</div>
                                        {r.submission_comment && <p className="mt-1 text-[13px] text-muted-foreground">“{r.submission_comment}”</p>}
                                    </div>
                                </div>
                                <div className="flex shrink-0 items-center gap-2">
                                    <span className="text-[13px] tabular text-foreground">{formatMinutes(r.total_minutes)}</span>
                                    {r.expected_minutes !== null && r.total_minutes < r.expected_minutes && <Badge variant="warning">Under {formatMinutes(r.expected_minutes)}</Badge>}
                                    <Button size="sm" variant="outline" onClick={() => setDeciding({ row: r, mode: "reject" })}><X /> Return</Button>
                                    <Button size="sm" onClick={() => setDeciding({ row: r, mode: "approve" })}><Check /> Approve</Button>
                                </div>
                            </div>
                            {!!r.projects.length && (
                                <div className="mt-3 flex flex-wrap gap-1.5 pl-7">
                                    {r.projects.map((p) => <span key={p.project?.id ?? "internal"} className="rounded-xs border border-border px-1.5 py-0.5 text-xs text-muted-foreground">{p.project?.name ?? "Internal"} · <span className="tabular text-foreground">{formatMinutes(p.minutes)}</span></span>)}
                                </div>
                            )}
                        </div>
                    ))}
                    {q.data && q.data.pagination.total_pages > 1 && <Pagination currentPage={q.data.pagination.page} totalPages={q.data.pagination.total_pages} onPageChange={setPage} />}
                </div>
            )}
            <DecideDialog
                mode={deciding?.mode ?? null}
                title={deciding?.mode === "approve" ? `Approve ${personName(deciding.row.membership?.user)}'s week?` : "Return this timesheet?"}
                description={deciding?.mode === "approve" ? "Entries are approved and, if configured, locked." : "The member can edit and resubmit."}
                loading={false}
                onClose={() => setDeciding(null)}
                onConfirm={(comment) => {
                    if (!deciding) return;
                    // Optimistic: the timesheet leaves the queue at once; a refusal brings it back with one error toast.
                    if (deciding.mode === "approve") approve.mutate({ id: deciding.row.id, comment: comment || undefined });
                    else reject.mutate({ id: deciding.row.id, comment });
                    setSelected((prev) => prev.filter((x) => x !== deciding.row.id));
                    setDeciding(null);
                }}
            />
        </Page>
    );
}
