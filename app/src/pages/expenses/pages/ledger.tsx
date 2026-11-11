import { useState } from "react";
import { Link } from "react-router-dom";
import { Download, List, Plus } from "lucide-react";
import { Page, PageHeader } from "@/components/ui/page";
import { DataTable, TableToolbar, type DataTableColumn } from "@/components/ui/data-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Can } from "@/components/access/can";
import { useListParams } from "@/hooks/use-list-params";
import { usePermissions } from "@/hooks/use-permission";
import { toast } from "@/hooks/use-toast";
import { getApiErrorMessage } from "@/lib/api-error";
import { useRecords } from "@/features/expenses/hooks/use-expenses";
import { exportRecords } from "@/features/expenses/services/expenses.services";
import type { LedgerRecord } from "@/features/expenses/interfaces/expenses.interfaces";
import { LedgerPaymentStatusFilterOptions, RecordStatusFilterOptions, RecordTypeFilterOptions } from "@/config/constants/dropdowns/expenses/expenses.options";
import { formatDate, formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";
import { LedgerPaymentBadge, RecordStatusBadge, TypeBadge } from "../components/ledger-ui";

/**
 * /expenses/ledger — all income and expense records with filters, totals and CSV export.
 * @perm finance.income.read (income rows) / finance.expenses.read (expense rows) · export .export
 * @api GET /ledger/records · GET /ledger/records/export
 */
export default function LedgerPage() {
    const { params, setPage, search, setSearch, filters, setFilter } = useListParams();
    const records = useRecords(params);
    const p = usePermissions();
    const [exporting, setExporting] = useState(false);
    const download = async () => {
        setExporting(true);
        try {
            const { page: _p, limit: _l, ...rest } = params;
            const csv = await exportRecords(rest);
            const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
            const a = document.createElement("a");
            a.href = url;
            a.download = "ledger.csv";
            a.click();
            URL.revokeObjectURL(url);
        } catch (e) {
            toast({ variant: "destructive", title: "Export failed", description: getApiErrorMessage(e) });
        } finally {
            setExporting(false);
        }
    };
    const columns: DataTableColumn<LedgerRecord>[] = [
        { key: "date", header: "Date", cell: (r) => <span className="whitespace-nowrap">{formatDate(r.transaction_date)}</span> },
        {
            key: "description", header: "Description",
            cell: (r) => (
                <div className="min-w-0 max-w-[22rem]">
                    <div className="truncate text-foreground">{r.description}</div>
                    <div className="truncate text-xs text-muted-foreground">{r.number}{r.counterparty_name ? ` · ${r.counterparty_name}` : ""}</div>
                </div>
            ),
        },
        { key: "type", header: "Type", cell: (r) => <TypeBadge type={r.type} />, hideBelow: "md" },
        { key: "category", header: "Category", cell: (r) => r.category_path_snapshot ?? r.category?.name ?? <span className="text-muted-foreground">Uncategorized</span>, hideBelow: "lg" },
        { key: "status", header: "Status", cell: (r) => (r.status === "POSTED" ? <LedgerPaymentBadge status={r.payment_status} /> : <RecordStatusBadge status={r.status} />), hideBelow: "sm" },
        { key: "vat", header: "VAT", cell: (r) => <span className="tabular">{formatMoney(r.vat_amount, r.currency)}</span>, className: "text-right", headerClassName: "text-right", hideBelow: "xl" },
        { key: "gross", header: "Gross", cell: (r) => <span className={cn("tabular font-medium", r.type === "INCOME" ? "text-success" : "text-foreground")}>{r.type === "EXPENSE" ? "−" : ""}{formatMoney(r.gross_amount, r.currency)}</span>, className: "text-right", headerClassName: "text-right" },
    ];
    const totals = records.data?.totals ?? [];
    const cur = records.data?.data[0]?.currency ?? "EUR";
    return (
        <Page>
            <PageHeader
                title="Ledger"
                description={totals.length ? totals.map((t) => `${t.type === "INCOME" ? "Income" : "Expenses"} ${formatMoney(t.gross, cur)} gross (${formatMoney(t.remaining, cur)} open)`).join(" · ") : "Every income and expense record."}
                actions={
                    <>
                        {p.canAny("finance.income.export", "finance.expenses.export") && <Button variant="outline" loading={exporting} onClick={download}><Download /> Export</Button>}
                        <Can permission="finance.expenses.create"><Button asChild><Link to="/expenses/new"><Plus /> New record</Link></Button></Can>
                    </>
                }
            />
            <TableToolbar search={search} onSearch={setSearch} placeholder="Search description, number, supplier…">
                <Select value={filters.type ?? "all"} onValueChange={(v) => setFilter("type", v)}>
                    <SelectTrigger className="h-8 w-40" aria-label="Type"><SelectValue /></SelectTrigger>
                    <SelectContent>{RecordTypeFilterOptions.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent>
                </Select>
                <Select value={filters.status ?? "all"} onValueChange={(v) => setFilter("status", v)}>
                    <SelectTrigger className="h-8 w-44" aria-label="Status"><SelectValue /></SelectTrigger>
                    <SelectContent>{RecordStatusFilterOptions.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent>
                </Select>
                <Select value={filters.payment_status ?? "all"} onValueChange={(v) => setFilter("payment_status", v)}>
                    <SelectTrigger className="h-8 w-44" aria-label="Payment status"><SelectValue /></SelectTrigger>
                    <SelectContent>{LedgerPaymentStatusFilterOptions.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent>
                </Select>
                <Input type="date" className="h-8 w-36" aria-label="From" value={filters.from ?? ""} onChange={(e) => setFilter("from", e.target.value)} />
                <Input type="date" className="h-8 w-36" aria-label="To" value={filters.to ?? ""} onChange={(e) => setFilter("to", e.target.value)} />
            </TableToolbar>
            <DataTable columns={columns} data={records.data?.data} rowKey={(r) => r.id} loading={records.isFetching} error={records.error} onRetry={() => records.refetch()} pagination={records.data?.pagination} onPageChange={setPage} rowHref={(r) => `/expenses/records/${r.id}`}
                empty={{ icon: List, title: search || Object.keys(filters).length ? "No records match" : "No records yet", description: "Invoices from Billing appear here automatically. Add expenses by hand or set up recurring ones." }} />
        </Page>
    );
}
