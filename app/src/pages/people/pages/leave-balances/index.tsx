import { useState } from "react";
import { Scale, SlidersHorizontal } from "lucide-react";
import { Page, PageHeader } from "@/components/ui/page";
import { DataTable, TableToolbar, type DataTableColumn } from "@/components/ui/data-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ListSkeleton } from "@/components/ui/states";
import { useListParams } from "@/hooks/use-list-params";
import { usePermission, usePermissions } from "@/hooks/use-permission";
import { useAdjustBalance, useLeaveBalances, useLeaveTransactions } from "@/features/people/leave/hooks/use-leave";
import type { EmployeeBalances, LeaveBalance } from "@/features/people/leave/interfaces/leave.interfaces";
import { formatDate, formatNumber } from "@/lib/format";
import { toast } from "@/hooks/use-toast";
import { getApiErrorMessage } from "@/lib/api-error";
import { cn } from "@/lib/utils";
import { PersonCell } from "../../components/person";
import { PeoplePaths } from "../../paths";

const YEAR = new Date().getFullYear();
const YEARS = [YEAR + 1, YEAR, YEAR - 1, YEAR - 2].map(String);

/**
 * /people/leave/balances — balances per employee and leave type (available = entitled + accrued + carried + adjusted − used − pending).
 * @perm employees.leave.read_all (scope) or read_own · adjust employees.leave.manage_balances · @api GET /people/leave-balances · POST /:id/adjust
 */
export default function LeaveBalancesPage() {
    const p = usePermissions();
    const { params, setPage, search, setSearch, filters, setFilter } = useListParams();
    const year = filters.year ?? String(YEAR);
    const q = useLeaveBalances({ ...params, year });
    const [selected, setSelected] = useState<{ employee: string; balance: LeaveBalance } | null>(null);
    const types = q.data?.data[0]?.balances.map((b) => b.leave_type) ?? [];

    const columns: DataTableColumn<EmployeeBalances>[] = [
        { key: "employee", header: "Employee", cell: (r) => <PersonCell name={r.employee.name} photoUrl={r.employee.photo_url} subtitle={r.employee.department?.name} to={PeoplePaths.employee(r.employee.id, "leave")} /> },
        ...types.map((t, i) => ({
            key: t.id,
            header: t.name,
            hideBelow: (i > 1 ? "md" : undefined) as DataTableColumn<EmployeeBalances>["hideBelow"],
            className: "text-right",
            headerClassName: "text-right",
            cell: (r: EmployeeBalances) => {
                const b = r.balances.find((x) => x.leave_type.id === t.id);
                if (!b) return <span className="text-ash">—</span>;
                return (
                    <button type="button" className="text-right" onClick={(e) => { e.stopPropagation(); setSelected({ employee: r.employee.name, balance: b }); }}>
                        <div className={cn("tabular font-medium", b.available_days < 0 ? "text-danger" : "text-foreground")}>{formatNumber(b.available_days, 1)}</div>
                        <div className="text-[11px] text-muted-foreground tabular">{formatNumber(b.used_days, 1)} used{Number(b.pending_days) ? ` · ${formatNumber(b.pending_days, 1)} pend.` : ""}</div>
                    </button>
                );
            },
        })),
    ];

    return (
        <Page>
            <PageHeader title="Leave balances" description="Days available this period. Click a balance for its ledger." back={{ to: PeoplePaths.leave, label: "Leave" }} />
            <TableToolbar search={p.can("employees.leave.read_all") ? search : undefined} onSearch={p.can("employees.leave.read_all") ? setSearch : undefined} placeholder="Search employee…">
                <Select value={year} onValueChange={(v) => setFilter("year", v === String(YEAR) ? null : v)}>
                    <SelectTrigger className="h-8 w-full sm:w-28" aria-label="Year"><SelectValue /></SelectTrigger>
                    <SelectContent>{YEARS.map((y) => <SelectItem key={y} value={y}>{y}</SelectItem>)}</SelectContent>
                </Select>
            </TableToolbar>
            <DataTable
                columns={columns}
                data={q.data?.data}
                rowKey={(r) => r.employee.id}
                loading={q.isFetching}
                error={q.error}
                onRetry={() => q.refetch()}
                pagination={q.data?.pagination}
                onPageChange={setPage}
                empty={{ icon: Scale, title: "No balances", description: "Balances are created from leave policies for employees with an HR record." }}
            />
            <BalanceDialog selected={selected} onClose={() => setSelected(null)} />
        </Page>
    );
}

function BalanceDialog({ selected, onClose }: { selected: { employee: string; balance: LeaveBalance } | null; onClose: () => void }) {
    const canAdjust = usePermission("employees.leave.manage_balances");
    const tx = useLeaveTransactions(selected?.balance.id);
    const adjust = useAdjustBalance();
    const [days, setDays] = useState("");
    const [reason, setReason] = useState("");
    const b = selected?.balance;
    return (
        <Dialog open={!!selected} onOpenChange={(o) => { if (!o) { onClose(); setDays(""); setReason(""); } }}>
            <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle>{b?.leave_type.name} · {selected?.employee}</DialogTitle>
                    <DialogDescription>{b && `${formatDate(b.period_start)} – ${formatDate(b.period_end)}${b.policy ? ` · ${b.policy.name}` : ""}`}</DialogDescription>
                </DialogHeader>
                {b && (
                    <div className="grid grid-cols-3 gap-2 text-center text-xs">
                        {[["Entitled", b.entitled_days], ["Accrued", b.accrued_days], ["Carried over", b.carried_over_days], ["Adjusted", b.adjusted_days], ["Used", b.used_days], ["Pending", b.pending_days]].map(([l, v]) => (
                            <div key={l} className="rounded-md border border-border p-2"><div className="text-muted-foreground">{l}</div><div className="tabular text-sm text-foreground">{formatNumber(v, 1)}</div></div>
                        ))}
                    </div>
                )}
                <div className="max-h-48 overflow-y-auto rounded-md border border-border">
                    {tx.isLoading ? <ListSkeleton rows={3} /> : !tx.data?.length ? <p className="p-3 text-[13px] text-muted-foreground">No movements.</p> : (
                        <ul className="divide-y divide-border text-[13px]">
                            {tx.data.map((t) => (
                                <li key={t.id} className="flex justify-between gap-2 px-3 py-2">
                                    <span className="min-w-0 truncate text-foreground">{t.type.toLowerCase().replace("_", " ")}{t.reason ? ` · ${t.reason}` : ""}</span>
                                    <span className={cn("shrink-0 tabular", Number(t.days) < 0 ? "text-danger" : "text-success")}>{Number(t.days) > 0 ? "+" : ""}{formatNumber(t.days, 1)}</span>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
                {canAdjust && b && (
                    <div className="space-y-3 border-t border-border pt-3">
                        <div className="flex items-center gap-1.5 text-[13px] font-medium text-foreground"><SlidersHorizontal className="size-4" /> Adjust balance</div>
                        <div className="grid gap-3 sm:grid-cols-3">
                            <div className="space-y-1.5"><Label htmlFor="adj-days">Days (±)</Label><Input id="adj-days" type="number" step="0.5" value={days} onChange={(e) => setDays(e.target.value)} /></div>
                            <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="adj-reason">Reason</Label><Input id="adj-reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Carry-over correction" /></div>
                        </div>
                    </div>
                )}
                <DialogFooter>
                    <Button variant="ghost" onClick={onClose}>Close</Button>
                    {canAdjust && b && (
                        <Button disabled={!Number(days) || reason.trim().length < 3} loading={adjust.isPending} onClick={() => adjust.mutate({ id: b.id, days: Number(days), reason: reason.trim() }, {
                            onSuccess: () => { toast({ title: "Balance adjusted" }); onClose(); setDays(""); setReason(""); },
                            onError: (e) => toast({ variant: "destructive", title: "Could not adjust", description: getApiErrorMessage(e) }),
                        })}>Apply adjustment</Button>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
