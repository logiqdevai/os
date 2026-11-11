import { Link } from "react-router-dom";
import { Plus, Receipt } from "lucide-react";
import { Page, PageHeader } from "@/components/ui/page";
import { DataTable, TableToolbar, type DataTableColumn } from "@/components/ui/data-table";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Can } from "@/components/access/can";
import { useListParams } from "@/hooks/use-list-params";
import { usePermission } from "@/hooks/use-permission";
import { useInvoices } from "@/features/billing/hooks/use-billing";
import type { Invoice, InvoiceStatus } from "@/features/billing/interfaces/billing.interfaces";
import { InvoiceStatusFilterOptions, InvoiceStatusOptions } from "@/config/constants/dropdowns/billing/billing.options";
import { getDropdownOptionLabel } from "@/lib/dropdown-option-label.utils";
import { formatDate, formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";
import { InvoiceStatusBadge } from "../components/billing-badges";

const QUICK: InvoiceStatus[] = ["DRAFT", "OPEN", "OVERDUE", "PARTIALLY_PAID", "PAID"];

/**
 * /billing/invoices — list with URL filters (status, search, page).
 * @perm VIEW finance.invoices.read · create finance.invoices.create
 * @api GET /finance/invoices
 */
export default function InvoicesPage() {
    const { params, setPage, search, setSearch, filters, setFilter } = useListParams();
    const invoices = useInvoices(params);
    const canCreate = usePermission("finance.invoices.create");
    const summary = invoices.data?.summary ?? [];

    const columns: DataTableColumn<Invoice>[] = [
        {
            key: "number",
            header: "Invoice",
            cell: (i) => (
                <div className="min-w-0">
                    <div className="font-medium text-foreground">{i.status === "DRAFT" ? "Draft" : i.number}</div>
                    <div className="truncate text-xs text-muted-foreground sm:hidden">{i.company?.name}</div>
                </div>
            ),
        },
        { key: "customer", header: "Customer", cell: (i) => <span className="truncate">{i.company?.name ?? i.billing_profile?.legal_name}</span>, hideBelow: "sm" },
        { key: "status", header: "Status", cell: (i) => <InvoiceStatusBadge status={i.status} /> },
        { key: "issued", header: "Issued", cell: (i) => formatDate(i.issue_date), hideBelow: "lg" },
        { key: "due", header: "Due", cell: (i) => <span className={cn(i.status === "OVERDUE" && "text-danger")}>{formatDate(i.due_date)}</span>, hideBelow: "md" },
        { key: "total", header: "Total", cell: (i) => <span className="tabular">{formatMoney(i.total, i.currency)}</span>, className: "text-right", headerClassName: "text-right", hideBelow: "md" },
        { key: "due_amount", header: "Amount due", cell: (i) => <span className="tabular font-medium text-foreground">{formatMoney(i.amount_due, i.currency)}</span>, className: "text-right", headerClassName: "text-right" },
    ];

    return (
        <Page>
            <PageHeader
                title="Invoices"
                description="Drafts, sent and paid invoices. Approve, send and collect from each invoice."
                actions={<Can permission="finance.invoices.create"><Button asChild><Link to="/billing/invoices/new"><Plus /> New invoice</Link></Button></Can>}
            />
            <div className="mb-3 flex gap-2 overflow-x-auto pb-1">
                {QUICK.map((s) => {
                    const row = summary.find((x) => x.status === s);
                    const active = filters.status === s;
                    return (
                        <button
                            key={s}
                            type="button"
                            onClick={() => setFilter("status", active ? null : s)}
                            className={cn("shrink-0 rounded-lg border px-3 py-2 text-left transition-colors", active ? "border-border-strong bg-accent" : "border-border bg-card hover:bg-accent")}
                        >
                            <div className="text-xs text-muted-foreground">{getDropdownOptionLabel(InvoiceStatusOptions, s)}</div>
                            <div className="text-sm font-medium tabular text-foreground">{row?.count ?? 0}</div>
                        </button>
                    );
                })}
            </div>
            <TableToolbar search={search} onSearch={setSearch} placeholder="Search number or customer…">
                <Select value={filters.status ?? "all"} onValueChange={(v) => setFilter("status", v)}>
                    <SelectTrigger className="h-8 w-44" aria-label="Filter by status"><SelectValue /></SelectTrigger>
                    <SelectContent>{InvoiceStatusFilterOptions.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent>
                </Select>
            </TableToolbar>
            <DataTable
                columns={columns}
                data={invoices.data?.data}
                rowKey={(i) => i.id}
                loading={invoices.isFetching}
                error={invoices.error}
                onRetry={() => invoices.refetch()}
                pagination={invoices.data?.pagination}
                onPageChange={setPage}
                rowHref={(i) => `/billing/invoices/${i.id}`}
                empty={{
                    icon: Receipt,
                    title: search || filters.status ? "No invoices match" : "No invoices yet",
                    description: "Create an invoice for a customer billing profile, or let subscriptions generate them.",
                    action: canCreate && !search ? <Button size="sm" asChild><Link to="/billing/invoices/new"><Plus /> New invoice</Link></Button> : undefined,
                }}
            />
        </Page>
    );
}
