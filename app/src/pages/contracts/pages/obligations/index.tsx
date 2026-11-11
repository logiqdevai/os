import { Page, PageHeader } from "@/components/ui/page";
import { TableToolbar } from "@/components/ui/data-table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useListParams } from "@/hooks/use-list-params";
import { cn } from "@/lib/utils";
import { ObligationStatusFilterOptions, ObligationTypeFilterOptions, ObligationViewOptions } from "@/config/constants/dropdowns/contracts/contract-obligation.options";
import { useObligations } from "@/features/contracts/hooks/use-contracts";
import { ObligationsTable } from "../../components/obligations-table";

/**
 * /contracts/obligations — obligations across all contracts in scope (views: all, overdue, due in 30 days, mine).
 * @perm contracts.contracts.read · manage contracts.obligations.manage · @api GET /contract-obligations
 */
export default function ObligationsPage() {
    const { params, setPage, search, setSearch, filters, setFilter } = useListParams();
    const view = filters.view ?? "all";
    const { view: _v, ...rest } = params as Record<string, string | number>;
    void _v;
    const query = { ...rest, ...(view === "overdue" && { overdue: "true" }), ...(view === "due_30" && { due_within_days: 30 }), ...(view === "mine" && { mine: "true" }) };
    const list = useObligations(query);
    return (
        <Page>
            <PageHeader title="Obligations" description="What each party must deliver, pay, report or notify under your contracts." />
            <div className="mb-3 flex flex-wrap gap-1" role="tablist" aria-label="Views">
                {ObligationViewOptions.map((v) => (
                    <button key={v.id} type="button" role="tab" aria-selected={view === v.id} onClick={() => setFilter("view", v.id)} className={cn("h-7 rounded-md px-2.5 text-[12.5px]", view === v.id ? "bg-secondary font-medium text-foreground ring-1 ring-border" : "text-muted-foreground hover:bg-accent")}>
                        {v.label}
                    </button>
                ))}
            </div>
            <TableToolbar search={search} onSearch={setSearch} placeholder="Search obligations…">
                <Select value={filters.type ?? "all"} onValueChange={(v) => setFilter("type", v)}>
                    <SelectTrigger className="h-8 w-40" aria-label="Filter by type"><SelectValue /></SelectTrigger>
                    <SelectContent>{ObligationTypeFilterOptions.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent>
                </Select>
                <Select value={filters.status ?? "all"} onValueChange={(v) => setFilter("status", v)}>
                    <SelectTrigger className="h-8 w-40" aria-label="Filter by status"><SelectValue /></SelectTrigger>
                    <SelectContent>{ObligationStatusFilterOptions.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent>
                </Select>
            </TableToolbar>
            <ObligationsTable
                showContract
                data={list.data?.data}
                loading={list.isFetching}
                error={list.error}
                onRetry={() => list.refetch()}
                pagination={list.data?.pagination}
                onPageChange={setPage}
                empty={{ title: view === "all" && !search ? "No obligations yet" : "Nothing matches", description: "Add obligations from a contract's Obligations tab." }}
            />
        </Page>
    );
}
