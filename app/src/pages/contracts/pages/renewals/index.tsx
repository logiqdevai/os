import { CalendarClock } from "lucide-react";
import { Page, PageHeader } from "@/components/ui/page";
import { DataTable, TableToolbar, type DataTableColumn } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useListParams } from "@/hooks/use-list-params";
import { formatDate } from "@/lib/format";
import { getDropdownOptionLabel } from "@/lib/dropdown-option-label.utils";
import { ContractRenewalTypeFilterOptions, ContractRenewalTypeFormOptions, RenewalDecisionOptions, RenewalWindowOptions } from "@/config/constants/dropdowns/contracts/contract-terms.options";
import { useRenewals } from "@/features/contracts/hooks/use-contracts";
import type { RenewalItem } from "@/features/contracts/interfaces/contracts.interfaces";
import { ContractStatusBadge, contractValue } from "../../components/contract-badges";

/**
 * /contracts/renewals?within_days= — live contracts ending, renewing or hitting a notice deadline inside the window.
 * @perm contracts.contracts.read · @api GET /contracts/renewals
 */
export default function RenewalsPage() {
    const { params, setPage, search, setSearch, filters, setFilter } = useListParams({ filters: { within_days: "90" } });
    const list = useRenewals(params);
    const columns: DataTableColumn<RenewalItem>[] = [
        {
            key: "contract",
            header: "Contract",
            cell: (c) => (
                <div className="min-w-0 max-w-[280px]">
                    <div className="font-mono text-xs text-muted-foreground">{c.number}</div>
                    <div className="truncate font-medium text-foreground">{c.title}</div>
                    <div className="truncate text-xs text-muted-foreground">{c.primary_company?.name ?? ""}</div>
                </div>
            ),
        },
        { key: "end", header: "Ends", cell: (c) => <div><div>{formatDate(c.end_date)}</div>{c.days_to_end !== null && <div className={c.days_to_end <= 30 ? "text-xs text-danger" : "text-xs text-muted-foreground"}>{c.days_to_end} days</div>}</div> },
        { key: "notice", header: "Notice deadline", hideBelow: "md", cell: (c) => <span className="text-muted-foreground">{formatDate(c.notice_deadline)}</span> },
        { key: "renewal", header: "Renewal", hideBelow: "sm", cell: (c) => getDropdownOptionLabel(ContractRenewalTypeFormOptions, c.renewal_type) },
        { key: "decision", header: "Decision", cell: (c) => (c.latest_decision ? <Badge variant={c.latest_decision.decision === "RENEW" ? "success" : "danger"}>{getDropdownOptionLabel(RenewalDecisionOptions, c.latest_decision.decision)}</Badge> : <span className="text-xs text-muted-foreground">Not decided</span>) },
        { key: "value", header: "Value", hideBelow: "lg", className: "text-right tabular", headerClassName: "text-right", cell: (c) => contractValue(c.total_value, c.currency, c.confidential_hidden) },
        { key: "status", header: "Status", hideBelow: "xl", cell: (c) => <ContractStatusBadge status={c.status} /> },
    ];
    return (
        <Page>
            <PageHeader title="Renewals" description="Decide in time: renew, renegotiate or let contracts end." />
            <TableToolbar search={search} onSearch={setSearch} placeholder="Search contracts…">
                <Select value={filters.within_days ?? "90"} onValueChange={(v) => setFilter("within_days", v)}>
                    <SelectTrigger className="h-8 w-40" aria-label="Window"><SelectValue /></SelectTrigger>
                    <SelectContent>{RenewalWindowOptions.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent>
                </Select>
                <Select value={filters.renewal_type ?? "all"} onValueChange={(v) => setFilter("renewal_type", v)}>
                    <SelectTrigger className="h-8 w-40" aria-label="Renewal type"><SelectValue /></SelectTrigger>
                    <SelectContent>{ContractRenewalTypeFilterOptions.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent>
                </Select>
            </TableToolbar>
            <DataTable
                columns={columns}
                data={list.data?.data}
                rowKey={(c) => c.id}
                loading={list.isFetching}
                error={list.error}
                onRetry={() => list.refetch()}
                pagination={list.data?.pagination}
                onPageChange={setPage}
                rowHref={(c) => `/contracts/${c.id}`}
                empty={{ icon: CalendarClock, title: "Nothing to renew in this window", description: "Try a longer window." }}
            />
        </Page>
    );
}
