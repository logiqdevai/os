import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Download, FileBarChart } from "lucide-react";
import { Page, PageHeader } from "@/components/ui/page";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState, ErrorState, ListSkeleton } from "@/components/ui/states";
import { usePermission } from "@/hooks/use-permission";
import { toast } from "@/hooks/use-toast";
import { getApiErrorMessage } from "@/lib/api-error";
import { useFinanceReport } from "@/features/billing/hooks/use-billing";
import { exportFinanceReport } from "@/features/billing/services/billing.services";
import { FinanceReportOptions } from "@/config/constants/dropdowns/billing/billing.options";
import { formatDate, formatMoney, formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";

const yearStart = () => `${new Date().getFullYear()}-01-01`;
const todayStr = () => new Date().toISOString().slice(0, 10);

/**
 * /billing/reports — revenue, invoices, outstanding, tax, customers, payments, subscriptions; CSV export.
 * @perm finance.reports.read · export finance.reports.export
 * @api GET /finance/reports/:report · GET /finance/reports/:report/export
 */
export default function BillingReportsPage() {
    const [sp, setSp] = useSearchParams();
    const report = sp.get("report") ?? "revenue";
    const from = sp.get("from") ?? yearStart();
    const to = sp.get("to") ?? todayStr();
    const q = useFinanceReport(report, { from, to });
    const canExport = usePermission("finance.reports.export");
    const [exporting, setExporting] = useState(false);
    const set = (k: string, v: string) => setSp((prev) => { const n = new URLSearchParams(prev); n.set(k, v); return n; }, { replace: true });
    const currencyOf = (row: Record<string, unknown>) => (typeof row.currency === "string" ? row.currency : "EUR");

    const download = async () => {
        setExporting(true);
        try {
            const csv = await exportFinanceReport(report, { from, to });
            const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
            const a = document.createElement("a");
            a.href = url;
            a.download = `${report}-${from}-${to}.csv`;
            a.click();
            URL.revokeObjectURL(url);
        } catch (e) {
            toast({ variant: "destructive", title: "Export failed", description: getApiErrorMessage(e) });
        } finally {
            setExporting(false);
        }
    };

    return (
        <Page>
            <PageHeader title="Billing reports" description="Profit & loss, VAT position and profitability are under Income & expenses." actions={canExport && <Button variant="outline" loading={exporting} onClick={download}><Download /> Export CSV</Button>} />
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end">
                <div className="space-y-1.5 sm:w-64">
                    <Label>Report</Label>
                    <Select value={report} onValueChange={(v) => set("report", v)}>
                        <SelectTrigger aria-label="Report"><SelectValue /></SelectTrigger>
                        <SelectContent>{FinanceReportOptions.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent>
                    </Select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5"><Label htmlFor="from">From</Label><Input id="from" type="date" value={from} onChange={(e) => e.target.value && set("from", e.target.value)} /></div>
                    <div className="space-y-1.5"><Label htmlFor="to">To</Label><Input id="to" type="date" value={to} onChange={(e) => e.target.value && set("to", e.target.value)} /></div>
                </div>
            </div>
            <div className="overflow-hidden rounded-lg border border-border bg-card">
                {q.isPending ? <ListSkeleton /> : q.error ? <ErrorState error={q.error} onRetry={() => q.refetch()} /> : !q.data?.rows.length ? <EmptyState icon={FileBarChart} title="No data for this period" /> : (
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow className="hover:bg-transparent">
                                    {q.data.columns.map((c) => <TableHead key={c.key} className={cn("whitespace-nowrap text-xs", (c.type === "money" || c.type === "number") && "text-right")}>{c.label}</TableHead>)}
                                </TableRow>
                            </TableHeader>
                            <TableBody className={cn(q.isFetching && "opacity-60")}>
                                {q.data.rows.map((row, i) => (
                                    <TableRow key={i} className="border-border-soft">
                                        {q.data.columns.map((c) => (
                                            <TableCell key={c.key} className={cn("whitespace-nowrap py-2 text-[13px]", (c.type === "money" || c.type === "number") && "text-right tabular")}>
                                                {c.type === "money" ? formatMoney(row[c.key] as number, currencyOf(row)) : c.type === "date" ? formatDate(row[c.key] as string) : c.type === "number" ? formatNumber(row[c.key] as number, 2) : String(row[c.key] ?? "—")}
                                            </TableCell>
                                        ))}
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                )}
            </div>
        </Page>
    );
}
