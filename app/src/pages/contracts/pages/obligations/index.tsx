import { Page, PageHeader } from "@/components/ui/page";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TableToolbar } from "@/components/ui/data-table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useListParams } from "@/hooks/use-list-params";
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
            <Tabs value={view} onValueChange={(v) => setFilter("view", v)} className="mb-3">
                <TabsList className="h-9">
                    {ObligationViewOptions.map((v) => <TabsTrigger key={v.id} value={v.id}>{v.label}</TabsTrigger>)}
                </TabsList>
            </Tabs>
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
