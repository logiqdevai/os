import { Fragment } from "react";
import { useSearchParams } from "react-router-dom";
import { Page, PageHeader } from "@/components/ui/page";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ErrorState, ListSkeleton } from "@/components/ui/states";
import { useProfitLoss } from "@/features/expenses/hooks/use-expenses";
import { PlLineOptions } from "@/config/constants/dropdowns/expenses/expenses.options";
import { getDropdownOptionLabel } from "@/lib/dropdown-option-label.utils";
import { formatMoney, formatPercent } from "@/lib/format";
import { cn } from "@/lib/utils";
import { RangeBar } from "../components/ledger-ui";
import { presetRange } from "../utils/ranges";

/**
 * /expenses/pnl — profit & loss by P&L line with category breakdown and optional comparison.
 * @perm finance.profit_loss.read
 * @api GET /ledger/reports/profit-loss?from&to&basis&compare
 */
export default function ProfitLossPage() {
    const [sp, setSp] = useSearchParams();
    const preset = sp.get("period") ?? "this_year";
    const basis = sp.get("basis") ?? "ACCRUAL";
    const compare = sp.get("compare") ?? "none";
    const q = useProfitLoss({ ...presetRange(preset), basis, ...(compare !== "none" && { compare }) });
    const set = (k: string, v: string) => setSp((p) => { const n = new URLSearchParams(p); n.set(k, v); return n; }, { replace: true });
    const d = q.data;
    const prev = (line: string) => d?.comparison?.lines.find((l) => l.line === line)?.amount;
    const Amount = ({ v, strong }: { v: number | undefined; strong?: boolean }) => <span className={cn("tabular", strong && "font-medium text-foreground", (v ?? 0) < 0 && "text-danger")}>{v === undefined ? "—" : formatMoney(v, d?.currency ?? "EUR")}</span>;
    return (
        <Page width="wide">
            <PageHeader title="Profit & loss" description="Net amounts (without VAT) grouped into P&L lines by category." />
            <RangeBar preset={preset} onPreset={(v) => set("period", v)} basis={basis} onBasis={(v) => set("basis", v)}>
                <div className="space-y-1.5 sm:w-48">
                    <Label>Compare with</Label>
                    <Select value={compare} onValueChange={(v) => set("compare", v)}>
                        <SelectTrigger aria-label="Compare"><SelectValue /></SelectTrigger>
                        <SelectContent><SelectItem value="none">No comparison</SelectItem><SelectItem value="previous_period">Previous period</SelectItem><SelectItem value="previous_year">Same period last year</SelectItem></SelectContent>
                    </Select>
                </div>
            </RangeBar>
            {q.isPending ? <ListSkeleton /> : q.error || !d ? <ErrorState error={q.error} onRetry={() => q.refetch()} /> : (
                <div className={cn("overflow-x-auto rounded-lg border border-border bg-card", q.isFetching && "opacity-70")}>
                    <Table>
                        <TableHeader>
                            <TableRow className="hover:bg-transparent">
                                <TableHead className="text-xs">Line</TableHead>
                                <TableHead className="text-right text-xs">{d.from} – {d.to}</TableHead>
                                {d.comparison && <TableHead className="text-right text-xs">{d.compare_range?.from} – {d.compare_range?.to}</TableHead>}
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {d.lines.map((l) => (
                                <Fragment key={l.line}>
                                    <TableRow className="border-border-soft bg-secondary/50">
                                        <TableCell className="text-[13px] font-medium text-foreground">{getDropdownOptionLabel(PlLineOptions, l.line)}</TableCell>
                                        <TableCell className="text-right text-[13px]"><Amount v={l.amount} strong /></TableCell>
                                        {d.comparison && <TableCell className="text-right text-[13px]"><Amount v={prev(l.line)} /></TableCell>}
                                    </TableRow>
                                    {l.categories.map((c) => (
                                        <TableRow key={`${l.line}-${c.category_id ?? "none"}`} className="border-border-soft">
                                            <TableCell className="pl-8 text-[13px] text-muted-foreground">{c.name}</TableCell>
                                            <TableCell className="text-right text-[13px]"><Amount v={c.amount} /></TableCell>
                                            {d.comparison && <TableCell />}
                                        </TableRow>
                                    ))}
                                </Fragment>
                            ))}
                            <TableRow className="border-border"><TableCell className="text-[13px] font-medium">Total expenses</TableCell><TableCell className="text-right text-[13px]"><Amount v={d.total_expenses} strong /></TableCell>{d.comparison && <TableCell className="text-right text-[13px]"><Amount v={d.comparison.total_expenses} /></TableCell>}</TableRow>
                            <TableRow className="border-border">
                                <TableCell className="text-sm font-medium text-foreground">Net operating result{d.margin_percent !== null && <span className="ml-2 text-xs font-normal text-muted-foreground">margin {formatPercent(d.margin_percent, 1)}</span>}</TableCell>
                                <TableCell className="text-right text-sm"><Amount v={d.net_operating_result} strong /></TableCell>
                                {d.comparison && <TableCell className="text-right text-sm"><Amount v={d.comparison.net_operating_result} strong /></TableCell>}
                            </TableRow>
                        </TableBody>
                    </Table>
                </div>
            )}
        </Page>
    );
}
