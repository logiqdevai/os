import { Link } from "react-router-dom";
import { LifeBuoy } from "lucide-react";
import { Page, PageHeader } from "@/components/ui/page";
import { DataTable, TableToolbar, type DataTableColumn } from "@/components/ui/data-table";
import { MemberAvatar } from "@/components/ui/member-avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useListParams } from "@/hooks/use-list-params";
import { formatRelative } from "@/lib/format";
import { getDropdownOptionLabel } from "@/lib/dropdown-option-label.utils";
import { TicketStateFilterOptions, TicketTypeFormOptions } from "@/config/constants/dropdowns/support/support.options";
import { useTickets } from "@/features/support/hooks/use-support";
import type { TicketListItem } from "@/features/support/interfaces/support.interfaces";
import { PriorityBadge, SlaChip, TicketStatusBadge } from "@/pages/support/components/support-badges";
import { SUPPORT_PATHS } from "@/pages/support/support-paths";

/**
 * Portal requests — /client-portal/requests (mockup 07-portal `requests`). Every portal request is a 13 ticket
 * with source PORTAL; work happens in Support.
 * @perm support.tickets.read (13)
 */
export default function PortalRequestsPage() {
    const { params, setPage, search, setSearch, filters, setFilter } = useListParams();
    const state = filters.state ?? "open";
    const tickets = useTickets({ ...params, source: "PORTAL", state: state === "everything" ? "all" : state });
    const columns: DataTableColumn<TicketListItem>[] = [
        {
            key: "subject",
            header: "Request",
            cell: (t) => (
                <div className="min-w-0">
                    <Link to={SUPPORT_PATHS.ticket(t.reference)} className="block truncate font-medium text-foreground hover:underline">{t.subject}</Link>
                    <div className="truncate text-xs text-muted-foreground">{t.reference} · {getDropdownOptionLabel(TicketTypeFormOptions, t.type)}</div>
                </div>
            ),
        },
        { key: "client", header: "Client", cell: (t) => t.company?.name ?? "—", hideBelow: "sm" },
        { key: "status", header: "Status", cell: (t) => <TicketStatusBadge status={t.status} /> },
        { key: "priority", header: "Priority", cell: (t) => <PriorityBadge priority={t.priority} />, hideBelow: "md" },
        { key: "sla", header: "SLA", cell: (t) => <SlaChip breached={t.sla_breached} atRisk={t.sla_at_risk} due={t.first_response_due_at ?? t.resolution_due_at} />, hideBelow: "lg" },
        { key: "assignee", header: "Assignee", cell: (t) => <MemberAvatar person={t.assignee?.user} showName size="xs" />, hideBelow: "lg" },
        { key: "created", header: "Opened", cell: (t) => <span className="text-xs text-muted-foreground">{formatRelative(t.created_at)}</span>, hideBelow: "xl" },
    ];
    return (
        <Page>
            <PageHeader title="Portal requests" description="Requests clients opened in the portal. Reply, assign and convert them in Support." />
            <TableToolbar search={search} onSearch={setSearch} placeholder="Search requests…">
                <Select value={state} onValueChange={(v) => setFilter("state", v === "open" ? null : v)}>
                    <SelectTrigger className="h-8 w-full sm:w-44" aria-label="State"><SelectValue /></SelectTrigger>
                    <SelectContent>{TicketStateFilterOptions.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent>
                </Select>
            </TableToolbar>
            <DataTable columns={columns} data={tickets.data?.data} rowKey={(t) => t.id} loading={tickets.isFetching} error={tickets.error} onRetry={() => tickets.refetch()} pagination={tickets.data?.pagination} onPageChange={setPage} rowHref={(t) => SUPPORT_PATHS.ticket(t.reference)} empty={{ icon: LifeBuoy, title: "No portal requests", description: "When clients open requests in the portal they show up here." }} />
        </Page>
    );
}
