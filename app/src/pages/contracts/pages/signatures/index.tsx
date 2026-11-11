import { Link } from "react-router-dom";
import { Send } from "lucide-react";
import { Page, PageHeader } from "@/components/ui/page";
import { DataTable, TableToolbar, type DataTableColumn } from "@/components/ui/data-table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useListParams } from "@/hooks/use-list-params";
import { formatDateTime } from "@/lib/format";
import { SignatureRequestStatusFilterOptions } from "@/config/constants/dropdowns/contracts/signature.options";
import { useSignatureRequests } from "@/features/contracts/hooks/use-contracts";
import type { SignatureRequest } from "@/features/contracts/interfaces/contracts.interfaces";
import { SignatureStatusBadge } from "../../components/contract-badges";

/**
 * /contracts/signatures — every signature request with progress. Actions (remind, new link, cancel) live on the contract's Signatures tab.
 * @perm contracts.signatures.read · @api GET /signature-requests
 */
export default function SignatureRequestsPage() {
    const { params, setPage, search, setSearch, filters, setFilter } = useListParams();
    const list = useSignatureRequests(params);
    const columns: DataTableColumn<SignatureRequest>[] = [
        {
            key: "contract",
            header: "Contract",
            cell: (r) => (
                <div className="min-w-0 max-w-[300px]">
                    <div className="font-mono text-xs text-muted-foreground">{r.contract.number} · {r.contract_version?.label}</div>
                    <div className="truncate font-medium text-foreground">{r.contract.title}</div>
                </div>
            ),
        },
        { key: "status", header: "Status", cell: (r) => <SignatureStatusBadge status={r.status} /> },
        { key: "progress", header: "Signed", cell: (r) => <span className="tabular">{r.signers.filter((s) => s.status === "SIGNED").length}/{r.signers.length}</span> },
        { key: "signers", header: "Signers", hideBelow: "lg", cell: (r) => <span className="text-xs text-muted-foreground">{r.signers.map((s) => s.name).join(", ")}</span> },
        { key: "sent", header: "Sent", hideBelow: "md", cell: (r) => <span className="text-muted-foreground">{formatDateTime(r.sent_at ?? r.created_at)}</span> },
        { key: "expires", header: "Expires", hideBelow: "xl", cell: (r) => <span className="text-muted-foreground">{r.completed_at ? `done ${formatDateTime(r.completed_at)}` : formatDateTime(r.expires_at)}</span> },
    ];
    return (
        <Page>
            <PageHeader title="Signature requests" description="Contracts out for signature and their signers' progress." />
            <TableToolbar search={search} onSearch={setSearch} placeholder="Search contract…">
                <Select value={filters.status ?? "all"} onValueChange={(v) => setFilter("status", v)}>
                    <SelectTrigger className="h-8 w-44" aria-label="Filter by status"><SelectValue /></SelectTrigger>
                    <SelectContent>{SignatureRequestStatusFilterOptions.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent>
                </Select>
            </TableToolbar>
            <DataTable
                columns={columns}
                data={list.data?.data}
                rowKey={(r) => r.id}
                loading={list.isFetching}
                error={list.error}
                onRetry={() => list.refetch()}
                pagination={list.data?.pagination}
                onPageChange={setPage}
                rowHref={(r) => `/contracts/${r.contract.id}?tab=signatures`}
                empty={{ icon: Send, title: "No signature requests", description: <>Send an approved contract version for signature from its <Link className="underline" to="/contracts">contract page</Link>.</> }}
            />
        </Page>
    );
}
