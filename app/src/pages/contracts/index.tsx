import { useNavigate } from "react-router-dom";
import { PenLine, Plus } from "lucide-react";
import { Page, PageHeader } from "@/components/ui/page";
import { DataTable, TableToolbar, type DataTableColumn } from "@/components/ui/data-table";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Can } from "@/components/access/can";
import { useListParams } from "@/hooks/use-list-params";
import { usePermission } from "@/hooks/use-permission";
import { formatDate } from "@/lib/format";
import { getDropdownOptionLabel } from "@/lib/dropdown-option-label.utils";
import { ContractStatusFilterOptions } from "@/config/constants/dropdowns/contracts/contract-status.options";
import { ContractRelationKindOptions } from "@/config/constants/dropdowns/contracts/contract-terms.options";
import { useContracts, useContractTypes } from "@/features/contracts/hooks/use-contracts";
import type { ContractListItem } from "@/features/contracts/interfaces/contracts.interfaces";
import { ContractStatusBadge, Member, contractValue } from "./components/contract-badges";

/**
 * /contracts — all contracts (scoped). Filters: status, type, archived; search number/title/customer.
 * @perm contracts.contracts.read · create · values need contracts.confidential_terms.read
 * @api GET /contracts · GET /contract-types
 */
export default function ContractsListPage() {
    const navigate = useNavigate();
    const canCreate = usePermission("contracts.contracts.create");
    const { params, setPage, search, setSearch, filters, setFilter } = useListParams();
    const list = useContracts(params);
    const types = useContractTypes({ limit: 100 });

    const columns: DataTableColumn<ContractListItem>[] = [
        {
            key: "contract",
            header: "Contract",
            cell: (c) => (
                <div className="min-w-0 max-w-[280px]">
                    <div className="font-mono text-xs text-muted-foreground">{c.number}{c.relation_kind !== "STANDALONE" ? ` · ${getDropdownOptionLabel(ContractRelationKindOptions, c.relation_kind)}` : ""}</div>
                    <div className="truncate font-medium text-foreground">{c.title}</div>
                    <div className="truncate text-xs text-muted-foreground sm:hidden">{c.primary_company?.name ?? "—"}</div>
                </div>
            ),
        },
        { key: "customer", header: "Customer", hideBelow: "sm", cell: (c) => c.primary_company?.name ?? <span className="text-muted-foreground">—</span> },
        { key: "type", header: "Type", hideBelow: "lg", cell: (c) => c.type?.name ?? <span className="text-muted-foreground">—</span> },
        { key: "status", header: "Status", cell: (c) => <ContractStatusBadge status={c.status} /> },
        { key: "value", header: "Value", hideBelow: "md", className: "text-right tabular", headerClassName: "text-right", cell: (c) => contractValue(c.total_value, c.currency, c.confidential_hidden) },
        { key: "end", header: "Ends", hideBelow: "md", cell: (c) => <span className="text-muted-foreground">{c.end_date ? formatDate(c.end_date) : "—"}</span> },
        { key: "owner", header: "Owner", hideBelow: "xl", cell: (c) => <Member member={c.owner} /> },
    ];

    return (
        <Page>
            <PageHeader
                title="Contracts"
                description="Agreements from draft to signature, with renewals, amendments and obligations."
                actions={<Can permission="contracts.contracts.create"><Button onClick={() => navigate("/contracts/new")}><Plus /> New contract</Button></Can>}
            />
            <TableToolbar search={search} onSearch={setSearch} placeholder="Search number, title, customer…">
                <Select value={filters.status ?? "all"} onValueChange={(v) => setFilter("status", v)}>
                    <SelectTrigger className="h-8 w-44" aria-label="Filter by status"><SelectValue /></SelectTrigger>
                    <SelectContent>{ContractStatusFilterOptions.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent>
                </Select>
                <Select value={filters.type_id ?? "all"} onValueChange={(v) => setFilter("type_id", v)}>
                    <SelectTrigger className="h-8 w-40" aria-label="Filter by type"><SelectValue /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All types</SelectItem>
                        {types.data?.data.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                    </SelectContent>
                </Select>
                <Select value={filters.archived === "true" ? "archived" : "active"} onValueChange={(v) => setFilter("archived", v === "archived" ? "true" : null)}>
                    <SelectTrigger className="h-8 w-32" aria-label="Archived"><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="active">Active</SelectItem><SelectItem value="archived">Archived</SelectItem></SelectContent>
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
                empty={{
                    icon: PenLine,
                    title: search || filters.status || filters.type_id ? "No contracts match these filters" : "No contracts yet",
                    description: "Create a contract from a template, or convert an accepted proposal.",
                    action: canCreate && !search ? <Button size="sm" onClick={() => navigate("/contracts/new")}><Plus /> New contract</Button> : undefined,
                }}
            />
        </Page>
    );
}
