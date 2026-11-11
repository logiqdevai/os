import { Link } from "react-router-dom";
import { FileMinus } from "lucide-react";
import { Page, PageHeader } from "@/components/ui/page";
import { DataTable, TableToolbar, type DataTableColumn } from "@/components/ui/data-table";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useListParams } from "@/hooks/use-list-params";
import { usePermission } from "@/hooks/use-permission";
import { useCreditNoteAction, useCreditNotes } from "@/features/billing/hooks/use-billing";
import type { CreditNote } from "@/features/billing/interfaces/billing.interfaces";
import { CreditNoteStatusFilterOptions } from "@/config/constants/dropdowns/billing/billing.options";
import { formatDate, formatMoney } from "@/lib/format";
import { CreditNoteStatusBadge } from "../components/billing-badges";

/**
 * /billing/credit-notes — credit notes; create them from an invoice.
 * @perm VIEW finance.invoices.read · issue/apply/void finance.credit_notes.manage
 * @api GET /finance/credit-notes · POST /finance/credit-notes/:id/{issue|apply|void}
 */
export default function CreditNotesPage() {
    const { params, setPage, search, setSearch, filters, setFilter } = useListParams();
    const list = useCreditNotes(params);
    const canManage = usePermission("finance.credit_notes.manage");
    const act = useCreditNoteAction();
    const columns: DataTableColumn<CreditNote>[] = [
        { key: "number", header: "Credit note", cell: (c) => <span className="font-medium text-foreground">{c.status === "DRAFT" ? "Draft" : c.number}</span> },
        { key: "invoice", header: "Invoice", cell: (c) => (c.invoice ? <Link className="hover:underline" to={`/billing/invoices/${c.invoice.id}`}>{c.invoice.number}</Link> : "—") },
        { key: "customer", header: "Customer", cell: (c) => c.billing_profile?.legal_name, hideBelow: "md" },
        { key: "reason", header: "Reason", cell: (c) => <span className="line-clamp-1">{c.reason}</span>, hideBelow: "lg" },
        { key: "status", header: "Status", cell: (c) => <CreditNoteStatusBadge status={c.status} /> },
        { key: "issued", header: "Issued", cell: (c) => formatDate(c.issued_at), hideBelow: "lg" },
        { key: "total", header: "Total", cell: (c) => <span className="tabular">{formatMoney(c.total, c.currency)}</span>, className: "text-right", headerClassName: "text-right" },
        {
            key: "actions", header: <span className="sr-only">Actions</span>, className: "w-24 text-right",
            cell: (c) => canManage && (c.status === "DRAFT" || c.status === "ISSUED") && (
                <Button size="sm" variant="outline" loading={act.isPending && act.variables?.id === c.id} onClick={() => act.mutate({ id: c.id, action: c.status === "DRAFT" ? "issue" : "apply" })}>{c.status === "DRAFT" ? "Issue" : "Apply"}</Button>
            ),
        },
    ];
    return (
        <Page>
            <PageHeader title="Credit notes" description="Credits reduce what a customer owes and the income in the ledger. Create one from an invoice." />
            <TableToolbar search={search} onSearch={setSearch} placeholder="Search number, reason or customer…">
                <Select value={filters.status ?? "all"} onValueChange={(v) => setFilter("status", v)}>
                    <SelectTrigger className="h-8 w-40" aria-label="Filter by status"><SelectValue /></SelectTrigger>
                    <SelectContent>{CreditNoteStatusFilterOptions.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent>
                </Select>
            </TableToolbar>
            <DataTable columns={columns} data={list.data?.data} rowKey={(c) => c.id} loading={list.isFetching} error={list.error} onRetry={() => list.refetch()} pagination={list.data?.pagination} onPageChange={setPage}
                empty={{ icon: FileMinus, title: "No credit notes", description: "Open a finalized invoice and choose Credit note." }} />
        </Page>
    );
}
