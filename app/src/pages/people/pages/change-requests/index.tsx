import { useState } from "react";
import { ArrowRight, Check, ClipboardCheck, X } from "lucide-react";
import { Page, PageHeader } from "@/components/ui/page";
import { DataTable, TableToolbar, type DataTableColumn } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useListParams } from "@/hooks/use-list-params";
import { usePermissions } from "@/hooks/use-permission";
import { useChangeRequests, useDecideChangeRequest } from "@/features/people/employees/hooks/use-employees";
import type { ChangeRequest } from "@/features/people/employees/interfaces/employees.interfaces";
import { ChangeRequestStatusFilterOptions, ChangeRequestStatusFormOptions, ChangeRequestStatusTone, ProfileFieldFormOptions } from "@/config/constants/dropdowns/people/employee-form.options";
import { getDropdownOptionLabel } from "@/lib/dropdown-option-label.utils";
import { formatDate } from "@/lib/format";
import { toast } from "@/hooks/use-toast";
import { getApiErrorMessage } from "@/lib/api-error";
import { PersonCell } from "../../components/person";
import { PeoplePaths } from "../../paths";

function show(value: unknown): string {
    if (value === null || value === undefined || value === "") return "—";
    if (Array.isArray(value)) return value.join(", ") || "—";
    if (typeof value === "object") return Object.values(value as Record<string, unknown>).filter((v) => v !== null && v !== "").join(", ") || "—";
    return String(value);
}

/** Personal values (01 §60) come back masked from the API for callers without employees.personal_data.read. */
function Diff({ field, change }: { field: string; change: { from: unknown; to: unknown; masked?: boolean } }) {
    const masked = !!change.masked;
    return (
        <div className="flex min-w-0 flex-wrap items-center gap-x-1.5 text-[13px]">
            <span className="text-muted-foreground">{getDropdownOptionLabel(ProfileFieldFormOptions, field)}</span>
            {masked ? <span className="text-xs italic text-muted-foreground">changed (hidden)</span> : (
                <>
                    <span className="break-all text-muted-foreground line-through">{show(change.from)}</span>
                    <ArrowRight className="size-3 shrink-0 text-muted-foreground" />
                    <span className="break-all font-medium text-foreground">{show(change.to)}</span>
                </>
            )}
        </div>
    );
}

/**
 * /people/changes — self-service profile edits waiting for HR (EmployeeHrSettings.profile_changes_require_approval).
 * @perm VIEW employees.employees.update (scoped) or employees.profile.update_own (own requests) · decide employees.employees.update
 * @api GET /people/change-requests · POST /people/change-requests/:id/approve|reject · POST /people/me/change-requests/:id/cancel
 */
export default function ChangeRequestsPage() {
    const p = usePermissions();
    const { params, setPage, filters, setFilter } = useListParams({ filters: { status: "PENDING" } });
    const status = filters.status ?? "PENDING";
    const q = useChangeRequests({ page: params.page, limit: 25, status: status === "all" ? undefined : status });
    const [reviewing, setReviewing] = useState<ChangeRequest | null>(null);
    const canDecide = p.can("employees.employees.update");

    const columns: DataTableColumn<ChangeRequest>[] = [
        { key: "employee", header: "Employee", cell: (r) => <PersonCell name={r.employee.name} subtitle={r.employee.employee_number} to={PeoplePaths.employee(r.employee.id)} /> },
        { key: "changes", header: "Changes", cell: (r) => <div className="space-y-0.5">{Object.entries(r.changes).map(([f, c]) => <Diff key={f} field={f} change={c} />)}</div> },
        { key: "note", header: "Employee note", cell: (r) => <span className="line-clamp-2 text-[13px] text-muted-foreground">{r.employee_note || "—"}</span>, hideBelow: "lg" },
        { key: "submitted", header: "Submitted", cell: (r) => <span className="tabular">{formatDate(r.created_at, "d MMM")}</span>, hideBelow: "md" },
        { key: "status", header: "Status", cell: (r) => <Badge variant={ChangeRequestStatusTone[r.status]}>{getDropdownOptionLabel(ChangeRequestStatusFormOptions, r.status)}</Badge> },
        {
            key: "actions", header: <span className="sr-only">Actions</span>, className: "w-20",
            cell: (r) => canDecide && r.status === "PENDING" && !r.is_mine && <Button size="sm" onClick={() => setReviewing(r)}>Review</Button>,
        },
    ];

    return (
        <Page>
            <PageHeader title="Profile change requests" description="Self-service edits waiting for HR approval." />
            <TableToolbar>
                <Select value={status} onValueChange={(v) => setFilter("status", v)}>
                    <SelectTrigger className="h-8 w-full sm:w-44" aria-label="Filter by status"><SelectValue /></SelectTrigger>
                    <SelectContent>{ChangeRequestStatusFilterOptions.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent>
                </Select>
            </TableToolbar>
            <DataTable columns={columns} data={q.data?.data} rowKey={(r) => r.id} loading={q.isFetching} error={q.error} onRetry={() => q.refetch()} pagination={q.data?.pagination} onPageChange={setPage}
                empty={{ icon: ClipboardCheck, title: status === "PENDING" ? "No pending requests" : "No requests", description: "Requests appear when employees edit their profile and changes need approval." }} />
            <DecisionDialog request={reviewing} onClose={() => setReviewing(null)} />
        </Page>
    );
}

function DecisionDialog({ request, onClose }: { request: ChangeRequest | null; onClose: () => void }) {
    const decide = useDecideChangeRequest();
    const [note, setNote] = useState("");
    const [pending, setPending] = useState<"approve" | "reject" | null>(null);
    const close = () => { if (!decide.isPending) { onClose(); setNote(""); } };
    const run = (approve: boolean) => {
        if (!request) return;
        setPending(approve ? "approve" : "reject");
        decide.mutate({ id: request.id, approve, decision_note: note.trim() || undefined }, {
            onSuccess: () => { toast({ title: approve ? "Changes applied" : "Request rejected" }); setNote(""); onClose(); },
            onError: (e) => toast({ variant: "destructive", title: "Could not save the decision", description: getApiErrorMessage(e) }),
            onSettled: () => setPending(null),
        });
    };
    return (
        <Dialog open={!!request} onOpenChange={(o) => !o && close()}>
            <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle>Review changes · {request?.employee.name}</DialogTitle>
                    <DialogDescription>Approving applies every change at once.</DialogDescription>
                </DialogHeader>
                {request && (
                    <div className="space-y-4">
                        <div className="space-y-1.5 rounded-md border border-border p-3">{Object.entries(request.changes).map(([f, c]) => <Diff key={f} field={f} change={c} />)}</div>
                        {request.employee_note && <p className="text-[13px] text-muted-foreground">“{request.employee_note}”</p>}
                        <div className="space-y-1.5"><Label htmlFor="cr-note">Decision note</Label><Textarea id="cr-note" rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Shown to the employee" /></div>
                    </div>
                )}
                <DialogFooter>
                    <Button variant="outline" loading={pending === "reject"} disabled={decide.isPending} onClick={() => run(false)}><X /> Reject</Button>
                    <Button loading={pending === "approve"} disabled={decide.isPending} onClick={() => run(true)}><Check /> Approve</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
