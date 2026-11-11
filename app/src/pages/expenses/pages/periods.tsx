import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { CalendarRange, Lock, MoreHorizontal, Unlock } from "lucide-react";
import { Page, PageHeader } from "@/components/ui/page";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import ConfirmationDialog from "@/components/ui/confirmation-dialog";
import { usePermission } from "@/hooks/use-permission";
import { useCreateVatReturn, useGeneratePeriods, usePeriodAction, usePeriods } from "@/features/expenses/hooks/use-expenses";
import type { FinancialPeriod } from "@/features/expenses/interfaces/expenses.interfaces";
import { formatDate } from "@/lib/format";
import { PeriodStatusBadge } from "../components/ledger-ui";

/**
 * /expenses/periods — financial periods: open → closed (no new postings) → locked (no edits).
 * @perm VIEW finance.income.read or finance.expenses.read · manage finance.periods.manage · VAT return finance.vat.manage
 * @api GET /ledger/periods · POST /ledger/periods/generate · POST /ledger/periods/:id/{close|reopen|lock} · POST /ledger/vat-returns
 */
export default function PeriodsPage() {
    const [sp, setSp] = useSearchParams();
    const year = Number(sp.get("year") ?? new Date().getFullYear());
    const list = usePeriods({ year });
    const canManage = usePermission("finance.periods.manage");
    const canVat = usePermission("finance.vat.manage");
    const generate = useGeneratePeriods();
    const act = usePeriodAction();
    const vat = useCreateVatReturn();
    const [confirm, setConfirm] = useState<{ period: FinancialPeriod; action: "close" | "reopen" | "lock" } | null>(null);
    const columns: DataTableColumn<FinancialPeriod>[] = [
        { key: "name", header: "Period", cell: (p) => <span className="font-medium text-foreground">{p.name}</span> },
        { key: "range", header: "Dates", cell: (p) => `${formatDate(p.start_date)} – ${formatDate(p.end_date)}`, hideBelow: "md" },
        { key: "records", header: "Records", cell: (p) => p._count?.records ?? 0, className: "tabular", hideBelow: "sm" },
        { key: "status", header: "Status", cell: (p) => <PeriodStatusBadge status={p.status} /> },
        {
            key: "actions", header: <span className="sr-only">Actions</span>, className: "w-10",
            cell: (p) => (canManage && p.status !== "LOCKED") || (canVat && p.status !== "OPEN") ? (
                <DropdownMenu>
                    <DropdownMenuTrigger asChild><Button variant="ghost" size="icon-sm" aria-label={`Actions for ${p.name}`}><MoreHorizontal /></Button></DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        {canManage && p.status === "OPEN" && <DropdownMenuItem onSelect={() => setConfirm({ period: p, action: "close" })}><Lock /> Close</DropdownMenuItem>}
                        {canManage && p.status === "CLOSED" && <DropdownMenuItem onSelect={() => setConfirm({ period: p, action: "reopen" })}><Unlock /> Reopen</DropdownMenuItem>}
                        {canManage && p.status !== "LOCKED" && <DropdownMenuItem onSelect={() => setConfirm({ period: p, action: "lock" })}><Lock /> Lock permanently</DropdownMenuItem>}
                        {canVat && p.status !== "OPEN" && <DropdownMenuItem onSelect={() => vat.mutate({ period_id: p.id })}>Prepare VAT return</DropdownMenuItem>}
                    </DropdownMenuContent>
                </DropdownMenu>
            ) : null,
        },
    ];
    const text = { close: "No new records can be posted into it; totals are frozen.", reopen: "Records can be posted and edited again.", lock: "Locking cannot be undone. Posted records stay read-only for good." };
    return (
        <Page>
            <PageHeader
                title="Financial periods"
                description="Close a month once it is reconciled; lock it after filing."
                actions={canManage && <Button variant="outline" loading={generate.isPending} onClick={() => generate.mutate({ fiscal_year: year, type: "MONTH" })}><CalendarRange /> Create months for {year}</Button>}
            />
            <div className="mb-4 w-32 space-y-1.5">
                <Label>Year</Label>
                <Select value={String(year)} onValueChange={(v) => setSp({ year: v }, { replace: true })}><SelectTrigger aria-label="Year"><SelectValue /></SelectTrigger><SelectContent>{[year - 1, year, year + 1].map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent></Select>
            </div>
            <DataTable columns={columns} data={list.data} rowKey={(p) => p.id} loading={list.isFetching} error={list.error} onRetry={() => list.refetch()}
                empty={{ icon: CalendarRange, title: `No periods for ${year}`, description: "Create the months of the fiscal year to close them as you go.", action: canManage ? <Button size="sm" onClick={() => generate.mutate({ fiscal_year: year, type: "MONTH" })}>Create months</Button> : undefined }} />
            <ConfirmationDialog
                isOpen={!!confirm}
                onClose={() => setConfirm(null)}
                title={confirm ? `${confirm.action === "close" ? "Close" : confirm.action === "reopen" ? "Reopen" : "Lock"} ${confirm.period.name}?` : ""}
                description={confirm ? text[confirm.action] : ""}
                confirmText={confirm?.action === "reopen" ? "Reopen" : confirm?.action === "lock" ? "Lock" : "Close period"}
                variant={confirm?.action === "lock" ? "destructive" : "default"}
                isLoading={act.isPending}
                onConfirm={() => confirm && act.mutate({ id: confirm.period.id, action: confirm.action }, { onSuccess: () => setConfirm(null) })}
            />
        </Page>
    );
}
