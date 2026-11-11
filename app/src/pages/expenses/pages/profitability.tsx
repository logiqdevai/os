import { useSearchParams } from "react-router-dom";
import { TrendingUp } from "lucide-react";
import { Page, PageHeader } from "@/components/ui/page";
import { StatCard, StatGrid } from "@/components/ui/stat-card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState, ErrorState, ListSkeleton } from "@/components/ui/states";
import { useProfitability } from "@/features/expenses/hooks/use-expenses";
import { ProfitabilityScopeOptions } from "@/config/constants/dropdowns/expenses/expenses.options";
import { formatMoney, formatNumber, formatPercent } from "@/lib/format";
import { cn } from "@/lib/utils";
import { RangeBar } from "../components/ledger-ui";
import { presetRange } from "../utils/ranges";

/**
 * /expenses/profitability — revenue vs direct expenses and employee cost (approved time × cost rate) per project or customer.
 * @perm finance.profitability.read
 * @api GET /ledger/profitability?scope&from&to
 */
export default function ProfitabilityPage() {
    const [sp, setSp] = useSearchParams();
    const preset = sp.get("period") ?? "this_year";
    const scope = sp.get("scope") ?? "PROJECT";
    const q = useProfitability({ ...presetRange(preset), scope });
    const set = (k: string, v: string) => setSp((p) => { const n = new URLSearchParams(p); n.set(k, v); return n; }, { replace: true });
    const d = q.data;
    const cur = d?.currency ?? "EUR";
    return (
        <Page width="wide">
            <PageHeader title="Profitability" description="Which projects and customers actually make money." />
            <RangeBar preset={preset} onPreset={(v) => set("period", v)}>
                <div className="space-y-1.5 sm:w-40"><Label>Per</Label><Select value={scope} onValueChange={(v) => set("scope", v)}><SelectTrigger aria-label="Per"><SelectValue /></SelectTrigger><SelectContent>{ProfitabilityScopeOptions.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent></Select></div>
            </RangeBar>
            {q.isPending ? <ListSkeleton /> : q.error || !d ? <ErrorState error={q.error} onRetry={() => q.refetch()} /> : (
                <div className="space-y-4">
                    <StatGrid>
                        <StatCard label="Revenue" value={formatMoney(d.totals.revenue, cur)} />
                        <StatCard label="Direct expenses" value={formatMoney(d.totals.direct_expenses, cur)} />
                        <StatCard label="Employee cost" value={formatMoney(d.totals.employee_costs, cur)} />
                        <StatCard label="Gross profit" value={formatMoney(d.totals.gross_profit, cur)} tone={d.totals.gross_profit < 0 ? "danger" : "success"} />
                    </StatGrid>
                    {d.items.length ? (
                        <div className="overflow-x-auto rounded-lg border border-border bg-card">
                            <Table>
                                <TableHeader><TableRow className="hover:bg-transparent"><TableHead className="text-xs">{scope === "PROJECT" ? "Project" : "Customer"}</TableHead><TableHead className="text-right text-xs">Revenue</TableHead><TableHead className="hidden text-right text-xs md:table-cell">Received</TableHead><TableHead className="hidden text-right text-xs lg:table-cell">Expenses</TableHead><TableHead className="hidden text-right text-xs lg:table-cell">Employee cost</TableHead><TableHead className="hidden text-right text-xs xl:table-cell">Hours</TableHead><TableHead className="text-right text-xs">Profit</TableHead><TableHead className="text-right text-xs">Margin</TableHead></TableRow></TableHeader>
                                <TableBody>
                                    {d.items.map((i) => (
                                        <TableRow key={i.id} className="border-border-soft">
                                            <TableCell className="text-[13px]"><div className="font-medium text-foreground">{i.name}</div>{i.customer && <div className="text-xs text-muted-foreground">{i.customer}</div>}</TableCell>
                                            <TableCell className="text-right tabular text-[13px]">{formatMoney(i.revenue, cur)}</TableCell>
                                            <TableCell className="hidden text-right tabular text-[13px] md:table-cell">{formatMoney(i.payments_received, cur)}</TableCell>
                                            <TableCell className="hidden text-right tabular text-[13px] lg:table-cell">{formatMoney(i.direct_expenses, cur)}</TableCell>
                                            <TableCell className="hidden text-right tabular text-[13px] lg:table-cell">{formatMoney(i.employee_costs, cur)}</TableCell>
                                            <TableCell className="hidden text-right tabular text-[13px] xl:table-cell">{formatNumber(i.hours, 1)}</TableCell>
                                            <TableCell className={cn("text-right tabular text-[13px] font-medium", i.gross_profit < 0 ? "text-danger" : "text-foreground")}>{formatMoney(i.gross_profit, cur)}</TableCell>
                                            <TableCell className={cn("text-right tabular text-[13px]", (i.margin_percent ?? 0) < 0 && "text-danger")}>{formatPercent(i.margin_percent, 0)}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    ) : <EmptyState icon={TrendingUp} title="Nothing to show" description="Link income and expenses to projects or customers, and approve time with cost rates." />}
                </div>
            )}
        </Page>
    );
}
