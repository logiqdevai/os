import { useState } from "react";
import { useParams } from "react-router-dom";
import { Check, RotateCcw, Unlock, X } from "lucide-react";
import { Page, PageHeader, KeyValueList } from "@/components/ui/page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { ErrorState, PageSkeleton } from "@/components/ui/states";
import { usePermissions } from "@/hooks/use-permission";
import { useApproveTimesheet, useRejectTimesheet, useReopenTimesheet, useTimesheet, useUnlockTimesheet } from "@/features/time/timesheets/hooks/use-timesheets";
import type { TimeEntry } from "@/features/time/entries/interfaces/time-entries.interfaces";
import { TimeEntryStatusFormOptions, TimeEntryStatusTone, TimesheetStatusFormOptions, TimesheetStatusTone } from "@/config/constants/dropdowns/time/time-form.options";
import { getDropdownOptionLabel } from "@/lib/dropdown-option-label.utils";
import { formatDate, formatDateTime, formatMinutes, personName } from "@/lib/format";
import { toast } from "@/hooks/use-toast";
import { getApiErrorMessage } from "@/lib/api-error";
import { Panel } from "@/pages/people/components/person";
import { TimePaths } from "../../paths";
import { DecideDialog } from "../../components/decide-dialog";

/**
 * /time/timesheets/:id — one member's period with its entries and history. OPEN → SUBMITTED → APPROVED | REJECTED;
 * REJECTED → OPEN (reopen); APPROVED → LOCKED; LOCKED → OPEN (unlock with reason).
 */
export default function TimesheetDetailPage() {
    const { timesheetId } = useParams();
    const p = usePermissions();
    const q = useTimesheet(timesheetId);
    const approve = useApproveTimesheet();
    const reject = useRejectTimesheet();
    const reopen = useReopenTimesheet();
    const unlock = useUnlockTimesheet();
    const [mode, setMode] = useState<"approve" | "reject" | "unlock" | null>(null);
    if (q.isLoading) return <PageSkeleton />;
    if (q.error || !q.data) return <Page><PageHeader title="Timesheet" back={{ to: TimePaths.approvals, label: "Approvals" }} /><ErrorState error={q.error} onRetry={() => q.refetch()} /></Page>;
    const t = q.data;
    const fail = (e: unknown) => toast({ variant: "destructive", title: "Action failed", description: getApiErrorMessage(e) });
    const columns: DataTableColumn<TimeEntry>[] = [
        { key: "date", header: "Date", cell: (e) => <span className="tabular">{formatDate(e.date, "EEE d MMM")}</span> },
        { key: "work", header: "Work", cell: (e) => <div className="min-w-0"><div className="truncate text-foreground">{e.project?.name ?? "Internal"}{e.task ? ` · ${e.task.title}` : ""}</div><div className="truncate text-xs text-muted-foreground">{e.description}</div></div> },
        { key: "billable", header: "Billable", cell: (e) => (e.is_billable ? "Yes" : "No"), hideBelow: "md" },
        { key: "time", header: "Time", cell: (e) => <span className="tabular">{formatMinutes(e.duration_minutes)}</span>, className: "text-right", headerClassName: "text-right" },
        { key: "status", header: "Status", cell: (e) => <Badge variant={TimeEntryStatusTone[e.status]}>{getDropdownOptionLabel(TimeEntryStatusFormOptions, e.status)}</Badge>, hideBelow: "sm" },
    ];
    return (
        <Page width="wide">
            <PageHeader
                back={{ to: TimePaths.approvals, label: "Approvals" }}
                title={`${personName(t.membership?.user)} · ${formatDate(t.period_start, "d MMM")} – ${formatDate(t.period_end, "d MMM yyyy")}`}
                meta={<Badge variant={TimesheetStatusTone[t.status]}>{getDropdownOptionLabel(TimesheetStatusFormOptions, t.status)}</Badge>}
                actions={
                    <>
                        {t.can_approve && t.status === "SUBMITTED" && <><Button variant="outline" onClick={() => setMode("reject")}><X /> Return</Button><Button onClick={() => setMode("approve")}><Check /> Approve</Button></>}
                        {t.status === "REJECTED" && p.canAny("time.timesheets.submit_own", "time.timesheets.approve") && <Button variant="outline" loading={reopen.isPending} onClick={() => reopen.mutate({ id: t.id }, { onSuccess: () => toast({ title: "Timesheet reopened" }), onError: fail })}><RotateCcw /> Reopen</Button>}
                        {["APPROVED", "LOCKED"].includes(t.status) && p.can("time.entries.unlock") && <Button variant="outline" onClick={() => setMode("unlock")}><Unlock /> Unlock</Button>}
                    </>
                }
            />
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
                <DataTable columns={columns} data={t.entries} rowKey={(e) => e.id} empty={{ title: "No entries in this period" }} />
                <div className="space-y-4">
                    <Panel title="Totals">
                        <KeyValueList columns={1} items={[
                            { label: "Logged", value: formatMinutes(t.total_minutes) },
                            { label: "Expected", value: t.expected_minutes !== null ? formatMinutes(t.expected_minutes) : null },
                            { label: "Billable", value: formatMinutes(t.billable_minutes) },
                            { label: "Non-billable", value: formatMinutes(t.non_billable_minutes) },
                            { label: "Approver", value: t.approver ? personName(t.approver.user) : null },
                        ]} />
                    </Panel>
                    <Panel title="History">
                        {!t.actions.length ? <p className="text-[13px] text-muted-foreground">No actions yet.</p> : (
                            <ol className="space-y-2 text-[13px]">
                                {t.actions.map((a) => (
                                    <li key={a.id} className="border-l-2 border-border pl-3">
                                        <div className="text-foreground">{a.action.toLowerCase()} · {a.actor ? personName(a.actor.user) : "System"}</div>
                                        <div className="text-xs text-muted-foreground">{formatDateTime(a.created_at)}</div>
                                        {a.comment && <div className="text-xs text-muted-foreground">“{a.comment}”</div>}
                                    </li>
                                ))}
                            </ol>
                        )}
                    </Panel>
                </div>
            </div>
            <DecideDialog
                mode={mode}
                title={mode === "approve" ? "Approve this timesheet?" : mode === "reject" ? "Return this timesheet?" : "Unlock this timesheet?"}
                loading={approve.isPending || reject.isPending || unlock.isPending}
                onClose={() => setMode(null)}
                onConfirm={(comment) => {
                    const done = { onSuccess: () => { toast({ title: "Done" }); setMode(null); }, onError: fail };
                    if (mode === "approve") approve.mutate({ id: t.id, comment: comment || undefined }, done);
                    if (mode === "reject") reject.mutate({ id: t.id, comment }, done);
                    if (mode === "unlock") unlock.mutate({ id: t.id, reason: comment }, done);
                }}
            />
        </Page>
    );
}
