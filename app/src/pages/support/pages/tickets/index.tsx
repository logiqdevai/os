import { Link } from "react-router-dom";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Ticket } from "lucide-react";
import { Page, PageHeader } from "@/components/ui/page";
import { DataTable, TableToolbar, type DataTableColumn } from "@/components/ui/data-table";
import { Button } from "@/components/ui/button";
import { MemberAvatar } from "@/components/ui/member-avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Can } from "@/components/access/can";
import { useListParams } from "@/hooks/use-list-params";
import { usePermission } from "@/hooks/use-permission";
import { formatRelative } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { DropdownOption } from "@/lib/dropdown-option-label.utils";
import {
    TicketAssigneeFilterOptions,
    TicketPriorityFilterOptions,
    TicketSlaFilterOptions,
    TicketSourceFilterOptions,
    TicketStateFilterOptions,
} from "@/config/constants/dropdowns/support/support.options";
import { useTicketCounts, useTickets } from "@/features/support/hooks/use-support";
import type { TicketCounts, TicketListItem } from "@/features/support/interfaces/support.interfaces";
import { PriorityBadge, SlaChip, TicketStatusBadge } from "../../components/support-badges";
import { SUPPORT_PATHS } from "../../support-paths";

const VIEWS: { id: string; label: string; filters: Record<string, string | null>; count: keyof TicketCounts }[] = [
    { id: "open", label: "Open", filters: { state: "open", assignee: null, sla: null }, count: "open" },
    { id: "mine", label: "Mine", filters: { state: "open", assignee: "me", sla: null }, count: "mine" },
    { id: "unassigned", label: "Unassigned", filters: { state: "open", assignee: "unassigned", sla: null }, count: "unassigned" },
    { id: "breached", label: "SLA breached", filters: { state: "open", assignee: null, sla: "breached" }, count: "breached" },
    { id: "resolved", label: "Resolved", filters: { state: "closed", assignee: null, sla: null }, count: "resolved" },
];

function FilterSelect({ value, options, onChange, label, className }: { value: string; options: DropdownOption<string>[]; onChange: (v: string) => void; label: string; className?: string }) {
    return (
        <Select value={value} onValueChange={onChange}>
            <SelectTrigger className={cn("h-8 w-full sm:w-40", className)} aria-label={label}>
                <SelectValue />
            </SelectTrigger>
            <SelectContent>
                {options.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}
            </SelectContent>
        </Select>
    );
}

/**
 * Tickets — /support/tickets (mockup 13-support `tickets`).
 * @perm VIEW support.tickets.read (scope-limited) · create support.tickets.create
 * @api GET /support/tickets · GET /support/tickets/counts
 */
export default function TicketsPage() {
    const { params, setPage, search, setSearch, filters, setFilter } = useListParams();
    const state = filters.state ?? "open";
    const tickets = useTickets({ ...params, state: state === "everything" ? "all" : state });
    const counts = useTicketCounts();
    const canCreate = usePermission("support.tickets.create");
    const activeView = VIEWS.find((v) => v.filters.state === state && (filters.assignee ?? null) === v.filters.assignee && (filters.sla ?? null) === v.filters.sla)?.id;

    const applyView = (id: string) => {
        const v = VIEWS.find((x) => x.id === id);
        if (!v) return;
        Object.entries(v.filters).forEach(([k, val]) => setFilter(k, k === "state" && val === "open" ? null : val));
    };

    const columns: DataTableColumn<TicketListItem>[] = [
        {
            key: "subject",
            header: "Ticket",
            cell: (t) => (
                <div className="min-w-0">
                    <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground tabular">{t.reference}</span>
                        <span className="sm:hidden"><TicketStatusBadge status={t.status} /></span>
                    </div>
                    <Link to={SUPPORT_PATHS.ticket(t.reference)} className="block truncate font-medium text-foreground hover:underline">{t.subject}</Link>
                    <div className="truncate text-xs text-muted-foreground">{t.company?.name ?? t.requester_name ?? t.requester_email ?? "—"}</div>
                </div>
            ),
        },
        { key: "status", header: "Status", cell: (t) => <TicketStatusBadge status={t.status} />, hideBelow: "sm" },
        { key: "priority", header: "Priority", cell: (t) => <PriorityBadge priority={t.priority} />, hideBelow: "md" },
        { key: "sla", header: "SLA", cell: (t) => <SlaChip breached={t.sla_breached} atRisk={t.sla_at_risk} due={t.first_response_due_at ?? t.next_response_due_at ?? t.resolution_due_at} />, hideBelow: "md" },
        { key: "assignee", header: "Assignee", cell: (t) => <MemberAvatar person={t.assignee?.user} showName size="xs" />, hideBelow: "lg" },
        { key: "updated", header: "Updated", cell: (t) => <span className="text-xs text-muted-foreground">{formatRelative(t.updated_at)}</span>, hideBelow: "xl" },
    ];

    return (
        <Page>
            <PageHeader
                title="Tickets"
                description="Structured support cases with priority, SLA and ownership."
                actions={
                    <Can permission="support.tickets.create">
                        <Button asChild><Link to={SUPPORT_PATHS.newTicket}><Plus /> New ticket</Link></Button>
                    </Can>
                }
            />
            <Tabs value={activeView} onValueChange={applyView} className="mb-3">
                <div className="overflow-x-auto"><TabsList className="w-max">
                    {VIEWS.map((v) => (
                        <TabsTrigger key={v.id} value={v.id}>
                            {v.label}
                            {counts.data && <span className="ml-1.5 text-xs text-muted-foreground tabular">{counts.data[v.count]}</span>}
                        </TabsTrigger>
                    ))}
                </TabsList></div>
            </Tabs>
            <TableToolbar search={search} onSearch={setSearch} placeholder="Search reference, subject, customer…">
                <FilterSelect label="State" value={state} options={TicketStateFilterOptions} onChange={(v) => setFilter("state", v === "open" ? null : v)} />
                <FilterSelect label="Assignee" value={filters.assignee ?? "all"} options={TicketAssigneeFilterOptions} onChange={(v) => setFilter("assignee", v)} />
                <FilterSelect label="Priority" value={filters.priority ?? "all"} options={TicketPriorityFilterOptions} onChange={(v) => setFilter("priority", v)} />
                <FilterSelect label="SLA" value={filters.sla ?? "all"} options={TicketSlaFilterOptions} onChange={(v) => setFilter("sla", v)} />
                <FilterSelect label="Source" value={filters.source ?? "all"} options={TicketSourceFilterOptions} onChange={(v) => setFilter("source", v)} />
            </TableToolbar>
            <DataTable
                columns={columns}
                data={tickets.data?.data}
                rowKey={(t) => t.id}
                loading={tickets.isFetching}
                error={tickets.error}
                onRetry={() => tickets.refetch()}
                pagination={tickets.data?.pagination}
                onPageChange={setPage}
                rowHref={(t) => SUPPORT_PATHS.ticket(t.reference)}
                empty={{
                    icon: Ticket,
                    title: search ? "No tickets match these filters" : "No tickets here",
                    description: "Tickets are created from conversations, the client portal or manually.",
                    action: canCreate && !search ? <Button size="sm" asChild><Link to={SUPPORT_PATHS.newTicket}><Plus /> New ticket</Link></Button> : undefined,
                }}
            />
        </Page>
    );
}
