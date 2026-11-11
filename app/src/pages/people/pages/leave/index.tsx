import { useState } from "react";
import { Link } from "react-router-dom";
import { CalendarDays, CalendarPlus, Check, Plane, X } from "lucide-react";
import { Page, PageHeader, KeyValueList } from "@/components/ui/page";
import { DataTable, TableToolbar, type DataTableColumn } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ErrorState, ListSkeleton } from "@/components/ui/states";
import { Can } from "@/components/access/can";
import { useListParams } from "@/hooks/use-list-params";
import { usePermissions } from "@/hooks/use-permission";
import { useApproveLeave, useCancelLeave, useLeaveRequest, useLeaveRequests, useRejectLeave } from "@/features/people/leave/hooks/use-leave";
import type { LeaveRequest } from "@/features/people/leave/interfaces/leave.interfaces";
import { LeaveDayPartFormOptions, LeaveStatusFilterOptions, LeaveStatusFormOptions, LeaveStatusTone } from "@/config/constants/dropdowns/people/leave-form.options";
import { getDropdownOptionLabel } from "@/lib/dropdown-option-label.utils";
import { formatDate, formatDateTime, formatNumber, personName } from "@/lib/format";
import { toast } from "@/hooks/use-toast";
import { getApiErrorMessage } from "@/lib/api-error";
import { PersonCell } from "../../components/person";
import { PeoplePaths } from "../../paths";
import { RequestLeaveDialog } from "./components/request-leave-dialog";

/**
 * /people/leave — leave requests. Tabs: Mine (read_own) · To approve (leave.approve) · All (read_all, scoped).
 * @api GET /people/leave-requests · POST /:id/approve|reject|cancel
 */
export default function LeaveRequestsPage() {
    const p = usePermissions();
    const { params, setPage, search, setSearch, filters, setFilter } = useListParams();
    const tabs = [
        { id: "mine", label: "My requests", show: p.can("employees.leave.read_own") },
        { id: "approve", label: "To approve", show: p.can("employees.leave.approve") },
        { id: "all", label: "All requests", show: p.can("employees.leave.read_all") },
    ].filter((t) => t.show);
    const tab = tabs.find((t) => t.id === filters.tab)?.id ?? tabs[0]?.id ?? "mine";
    const query = { ...params, tab: undefined, ...(tab === "mine" && { mine: true }), ...(tab === "approve" && { to_approve: true }) };
    const requests = useLeaveRequests(query);
    const [open, setOpen] = useState(false);
    const [selected, setSelected] = useState<string | null>(null);

    const columns: DataTableColumn<LeaveRequest>[] = [
        ...(tab !== "mine" ? [{ key: "employee", header: "Employee", cell: (r: LeaveRequest) => <PersonCell name={r.employee.name} photoUrl={r.employee.photo_url} subtitle={r.employee.department?.name} /> }] : []),
        { key: "type", header: "Type", cell: (r) => <span className="text-foreground">{r.leave_type.name}</span> },
        { key: "dates", header: "Dates", cell: (r) => <span className="tabular">{formatDate(r.start_date, "d MMM")} – {formatDate(r.end_date, "d MMM yyyy")}</span> },
        { key: "days", header: "Days", cell: (r) => <span className="tabular">{formatNumber(r.total_days, 1)}</span>, className: "text-right", headerClassName: "text-right", hideBelow: "sm" },
        { key: "conflict", header: "Overlap", cell: (r) => (r.has_conflicts ? <Badge variant="warning">Team overlap</Badge> : null), hideBelow: "lg" },
        { key: "status", header: "Status", cell: (r) => <Badge variant={LeaveStatusTone[r.status]}>{getDropdownOptionLabel(LeaveStatusFormOptions, r.status)}</Badge> },
    ];

    return (
        <Page>
            <PageHeader
                title="Leave"
                description="Time off requests, approvals and history."
                actions={
                    <>
                        <Button variant="outline" asChild><Link to={PeoplePaths.leaveCalendar}><CalendarDays /> Calendar</Link></Button>
                        <Can permission="employees.leave.request_own"><Button onClick={() => setOpen(true)}><CalendarPlus /> Request leave</Button></Can>
                    </>
                }
            />
            {tabs.length > 1 && (
                <Tabs value={tab} onValueChange={(v) => setFilter("tab", v === tabs[0].id ? null : v)} className="mb-3">
                    <TabsList>{tabs.map((t) => <TabsTrigger key={t.id} value={t.id}>{t.label}</TabsTrigger>)}</TabsList>
                </Tabs>
            )}
            <TableToolbar search={tab === "mine" ? undefined : search} onSearch={tab === "mine" ? undefined : setSearch} placeholder="Search employee…">
                {tab !== "approve" && (
                    <Select value={filters.status ?? "all"} onValueChange={(v) => setFilter("status", v)}>
                        <SelectTrigger className="h-8 w-full sm:w-36" aria-label="Filter by status"><SelectValue /></SelectTrigger>
                        <SelectContent>{LeaveStatusFilterOptions.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent>
                    </Select>
                )}
            </TableToolbar>
            <DataTable
                columns={columns}
                data={requests.data?.data}
                rowKey={(r) => r.id}
                loading={requests.isFetching}
                error={requests.error}
                onRetry={() => requests.refetch()}
                pagination={requests.data?.pagination}
                onPageChange={setPage}
                onRowClick={(r) => setSelected(r.id)}
                empty={{ icon: Plane, title: tab === "approve" ? "Nothing waiting for you" : "No requests", description: tab === "mine" ? "Request time off and it will show here." : undefined }}
            />
            <RequestLeaveDialog open={open} onOpenChange={setOpen} />
            <LeaveRequestSheet id={selected} onClose={() => setSelected(null)} />
        </Page>
    );
}

function LeaveRequestSheet({ id, onClose }: { id: string | null; onClose: () => void }) {
    const q = useLeaveRequest(id ?? undefined);
    const approve = useApproveLeave();
    const reject = useRejectLeave();
    const cancel = useCancelLeave();
    const [note, setNote] = useState("");
    const r = q.data;
    const pending = approve.isPending || reject.isPending || cancel.isPending;
    const opts = (title: string) => ({ onSuccess: () => { toast({ title }); setNote(""); onClose(); }, onError: (e: unknown) => toast({ variant: "destructive", title: "Action failed", description: getApiErrorMessage(e) }) });
    const canCancel = r && ((r.employee.is_me && ["DRAFT", "PENDING"].includes(r.status)) || (r.employee.is_me && r.status === "APPROVED" && r.start_date > new Date().toISOString().slice(0, 10)));

    return (
        <Sheet open={!!id} onOpenChange={(o) => !o && onClose()}>
            <SheetContent className="w-full overflow-y-auto sm:max-w-md">
                <SheetHeader>
                    <SheetTitle>{r ? `${r.leave_type.name} · ${r.employee.name}` : "Leave request"}</SheetTitle>
                    <SheetDescription>{r ? `${formatDate(r.start_date)} – ${formatDate(r.end_date)}` : "Loading…"}</SheetDescription>
                </SheetHeader>
                {q.isLoading ? <ListSkeleton rows={4} /> : q.error ? <ErrorState error={q.error} /> : r && (
                    <div className="mt-4 space-y-5">
                        <div className="flex flex-wrap gap-1.5">
                            <Badge variant={LeaveStatusTone[r.status]}>{getDropdownOptionLabel(LeaveStatusFormOptions, r.status)}</Badge>
                            {r.has_conflicts && <Badge variant="warning">Team overlap</Badge>}
                        </div>
                        <KeyValueList columns={2} items={[
                            { label: "Working days", value: formatNumber(r.total_days, 1) },
                            { label: "Hours", value: r.total_hours ? formatNumber(r.total_hours, 1) : null },
                            { label: "First day", value: getDropdownOptionLabel(LeaveDayPartFormOptions, r.start_day_part) },
                            { label: "Last day", value: getDropdownOptionLabel(LeaveDayPartFormOptions, r.end_day_part) },
                            { label: "Submitted", value: r.submitted_at ? formatDateTime(r.submitted_at) : null },
                            { label: "Covering", value: r.covering_employee?.name },
                        ]} />
                        {r.reason && <div><div className="text-xs text-muted-foreground">Note</div><p className="mt-0.5 whitespace-pre-line text-[13px] text-foreground">{r.reason}</p></div>}
                        {!!r.conflicts?.length && (
                            <div>
                                <div className="text-xs text-muted-foreground">Also away</div>
                                <ul className="mt-1 space-y-0.5 text-[13px]">{r.conflicts.map((c) => <li key={`${c.employee_id}${c.start_date}`} className="text-foreground">{c.name} <span className="text-muted-foreground tabular">· {formatDate(c.start_date, "d MMM")} – {formatDate(c.end_date, "d MMM")}</span></li>)}</ul>
                            </div>
                        )}
                        {!!r.approvals.length && (
                            <div>
                                <div className="text-xs text-muted-foreground">Approvals</div>
                                <ul className="mt-1 space-y-1 text-[13px]">{r.approvals.map((a) => <li key={a.id} className="flex justify-between gap-2"><span className="text-foreground">Step {a.step} · {personName(a.approver.user)}</span><span className="text-muted-foreground">{a.decision.toLowerCase()}</span></li>)}</ul>
                            </div>
                        )}
                        {r.decision_note && <div><div className="text-xs text-muted-foreground">Decision note</div><p className="mt-0.5 text-[13px] text-foreground">{r.decision_note}</p></div>}

                        {r.can_decide && (
                            <div className="space-y-2 border-t border-border pt-4">
                                <Label htmlFor="decision-note">Note (optional)</Label>
                                <Textarea id="decision-note" rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
                                <div className="flex gap-2">
                                    <Button className="flex-1" loading={approve.isPending} disabled={pending} onClick={() => approve.mutate({ id: r.id, note: note || undefined }, opts("Leave approved"))}><Check /> Approve</Button>
                                    <Button className="flex-1" variant="outline" loading={reject.isPending} disabled={pending} onClick={() => reject.mutate({ id: r.id, note: note || undefined }, opts("Leave rejected"))}><X /> Reject</Button>
                                </div>
                            </div>
                        )}
                        {canCancel && (
                            <Button variant="outline" className="w-full" loading={cancel.isPending} disabled={pending} onClick={() => cancel.mutate({ id: r.id }, opts(r.status === "APPROVED" ? "Leave cancelled" : "Request withdrawn"))}>
                                {r.status === "APPROVED" ? "Cancel leave" : "Withdraw request"}
                            </Button>
                        )}
                    </div>
                )}
            </SheetContent>
        </Sheet>
    );
}
