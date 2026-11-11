import { Building2 } from "lucide-react";
import { Page, PageHeader } from "@/components/ui/page";
import { DataTable, TableToolbar, type DataTableColumn } from "@/components/ui/data-table";
import { useListParams } from "@/hooks/use-list-params";
import { useSuppliers } from "@/features/expenses/hooks/use-expenses";
import type { Supplier } from "@/features/expenses/interfaces/expenses.interfaces";
import { useSessionData } from "@/features/session/hooks/use-session";
import { formatDate, formatMoney } from "@/lib/format";

/**
 * /expenses/vendors — suppliers (CRM companies of type Vendor) with spend this year.
 * @perm finance.expenses.read · editing defaults finance.expenses.update (on the detail page)
 * @api GET /ledger/suppliers
 */
export default function VendorsPage() {
    const { params, setPage, search, setSearch } = useListParams();
    const list = useSuppliers(params);
    const cur = useSessionData()?.active_organization?.default_currency ?? "EUR";
    const columns: DataTableColumn<Supplier>[] = [
        { key: "name", header: "Supplier", cell: (s) => <div className="min-w-0"><div className="truncate font-medium text-foreground">{s.name}</div><div className="truncate text-xs text-muted-foreground">{s.ledger_supplier_profile?.default_category?.name ?? "No default category"}</div></div> },
        { key: "vat", header: "VAT number", cell: (s) => s.ledger_supplier_profile?.vat_number ?? s.vat_number ?? "—", hideBelow: "lg" },
        { key: "terms", header: "Terms", cell: (s) => (s.ledger_supplier_profile?.payment_terms_days != null ? `${s.ledger_supplier_profile.payment_terms_days} days` : "—"), hideBelow: "md" },
        { key: "last", header: "Last expense", cell: (s) => formatDate(s.last_expense_at), hideBelow: "md" },
        { key: "open", header: "Unpaid", cell: (s) => <span className="tabular">{formatMoney(s.outstanding, cur)}</span>, className: "text-right", headerClassName: "text-right", hideBelow: "sm" },
        { key: "spend", header: "Spend this year", cell: (s) => <span className="tabular font-medium text-foreground">{formatMoney(s.spend_ytd, cur)}</span>, className: "text-right", headerClassName: "text-right" },
    ];
    return (
        <Page>
            <PageHeader title="Vendors" description="Suppliers are CRM companies of type Vendor. Set defaults so their expenses are categorized automatically." />
            <TableToolbar search={search} onSearch={setSearch} placeholder="Search suppliers…" />
            <DataTable columns={columns} data={list.data?.data} rowKey={(s) => s.id} loading={list.isFetching} error={list.error} onRetry={() => list.refetch()} pagination={list.data?.pagination} onPageChange={setPage} rowHref={(s) => `/expenses/vendors/${s.id}`}
                empty={{ icon: Building2, title: search ? "No suppliers match" : "No suppliers yet", description: "Add companies of type Vendor in CRM, or pick a supplier on an expense." }} />
        </Page>
    );
}
