import { CheckCheck } from "lucide-react";
import { Page, PageHeader } from "@/components/ui/page";
import { DataTable, TableToolbar, type DataTableColumn } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useListParams } from "@/hooks/use-list-params";
import { formatDate, formatRelative } from "@/lib/format";
import { getDropdownOptionLabel } from "@/lib/dropdown-option-label.utils";
import { DeliverableReviewStatusOptions, DeliverableReviewStatusTone, PortalApprovalStateOptions } from "@/config/constants/dropdowns/portal/portal.options";
import { usePortalApprovals } from "@/features/client-portal/hooks/use-client-portal";
import type { PortalApprovalRow } from "@/features/client-portal/interfaces/client-portal.interfaces";


/**
 * Deliverable approvals — /client-portal/approvals (mockup 07-portal `approvals`).
 * @perm projects.projects.read (05)
 */
export default function PortalApprovalsPage() {
    const { params, setPage, search, setSearch, filters, setFilter } = useListParams();
    const approvals = usePortalApprovals({ ...params, state: filters.state === "everything" ? "all" : filters.state ?? "awaiting" });
    const columns: DataTableColumn<PortalApprovalRow>[] = [
        { key: "name", header: "Deliverable", cell: (d) => <div className="min-w-0"><div className="truncate font-medium text-foreground">{d.name}</div><div className="truncate text-xs text-muted-foreground">{d.project.name}{d.project.company ? ` · ${d.project.company.name}` : ""}</div></div> },
        { key: "status", header: "Status", cell: (d) => <Badge variant={DeliverableReviewStatusTone[d.status] ?? "neutral"}>{getDropdownOptionLabel(DeliverableReviewStatusOptions, d.status)}</Badge> },
        { key: "approvers", header: "Approvers", cell: (d) => <span className="text-xs text-muted-foreground">{d.approvers.length ? d.approvers.map((a) => a.portal_membership.user.display_name ?? a.portal_membership.user.email).join(", ") : "Any approver"}{d.approval_mode === "ALL" && d.approvers.length > 1 ? " (all)" : ""}</span>, hideBelow: "md" },
        { key: "last", header: "Last decision", cell: (d) => (d.reviews[0] ? <span className="text-xs text-muted-foreground">{getDropdownOptionLabel(DeliverableReviewStatusOptions, d.reviews[0].decision)} · {formatRelative(d.reviews[0].decided_at)}</span> : <span className="text-ash">—</span>), hideBelow: "lg" },
        { key: "due", header: "Due", cell: (d) => <span className="text-xs text-muted-foreground">{formatDate(d.due_date)}</span>, hideBelow: "sm" },
    ];
    return (
        <Page>
            <PageHeader title="Deliverable approvals" description="Deliverables your clients review in the portal." />
            <TableToolbar search={search} onSearch={setSearch} placeholder="Search deliverables…">
                <Select value={filters.state ?? "awaiting"} onValueChange={(v) => setFilter("state", v === "awaiting" ? null : v)}>
                    <SelectTrigger className="h-8 w-full sm:w-48" aria-label="State"><SelectValue /></SelectTrigger>
                    <SelectContent>{PortalApprovalStateOptions.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent>
                </Select>
            </TableToolbar>
            <DataTable columns={columns} data={approvals.data?.data} rowKey={(d) => d.id} loading={approvals.isFetching} error={approvals.error} onRetry={() => approvals.refetch()} pagination={approvals.data?.pagination} onPageChange={setPage} rowHref={(d) => `/projects/${d.project.id}`} empty={{ icon: CheckCheck, title: "Nothing waiting for clients", description: "Mark deliverables visible to the client and submit them for review in Projects." }} />
        </Page>
    );
}
