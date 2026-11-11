import { Link, useSearchParams } from "react-router-dom";
import { AlertTriangle, ArrowDownLeft, ArrowUpRight, Landmark, Plus, Scale } from "lucide-react";
import { Page, PageHeader } from "@/components/ui/page";
import { StatCard, StatGrid } from "@/components/ui/stat-card";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState, PageSkeleton } from "@/components/ui/states";
import { Can } from "@/components/access/can";
import { useLedgerDashboard } from "@/features/expenses/hooks/use-expenses";
import { formatDate, formatMoney, formatPercent } from "@/lib/format";
import { ChartCard, HorizontalMoneyBars, MonthlyMoneyChart } from "../components/money-charts";
import { RangeBar } from "../components/ledger-ui";
import { presetRange } from "../utils/ranges";

/**
 * /expenses — income & expense overview (09 "Financial Dashboard").
 * @perm finance.income.read or finance.expenses.read (each figure only covers the types the caller may read)
 * @api GET /ledger/dashboard?from&to&basis
 */
export default function LedgerOverviewPage() {
    const [sp, setSp] = useSearchParams();
    const preset = sp.get("period") ?? "this_year";
    const basis = sp.get("basis") ?? "ACCRUAL";
    const q = useLedgerDashboard({ ...presetRange(preset), basis });
    const d = q.data;
    const set = (k: string, v: string) => setSp((p) => { const n = new URLSearchParams(p); n.set(k, v); return n; }, { replace: true });
    return (
        <Page>
            <PageHeader
                title="Income & expenses"
                description="Every income and expense record, with VAT and cash position."
                actions={
                    <>
                        <Can permission="finance.income.create"><Button variant="outline" asChild><Link to="/expenses/new?type=INCOME"><Plus /> Income</Link></Button></Can>
                        <Can permission="finance.expenses.create"><Button asChild><Link to="/expenses/new"><Plus /> Expense</Link></Button></Can>
                    </>
                }
            />
            <RangeBar preset={preset} onPreset={(v) => set("period", v)} basis={basis} onBasis={(v) => set("basis", v)} />
            {q.isPending ? <PageSkeleton /> : q.error ? <ErrorState error={q.error} onRetry={() => q.refetch()} /> : d ? (
                <div className="space-y-4">
                    {d.pending_review > 0 && (
                        <Link to="/expenses/approvals" className="flex items-center gap-2 rounded-lg border border-border bg-warning-soft px-4 py-3 text-[13px] text-warning hover:underline">
                            <AlertTriangle className="size-4" /> {d.pending_review} record{d.pending_review === 1 ? "" : "s"} waiting for approval
                        </Link>
                    )}
                    <StatGrid>
                        <StatCard label="Income (net)" value={d.can.income ? formatMoney(d.totals.total_income, d.currency) : "—"} icon={ArrowDownLeft} tone="success" />
                        <StatCard label="Expenses (net)" value={d.can.expenses ? formatMoney(d.totals.total_expenses, d.currency) : "—"} icon={ArrowUpRight} tone="info" hint={d.totals.payroll_expenses ? `Payroll ${formatMoney(d.totals.payroll_expenses, d.currency)}` : undefined} />
                        <StatCard label="Net profit" value={d.can.income && d.can.expenses ? formatMoney(d.totals.net_profit, d.currency) : "—"} icon={Scale} tone={d.totals.net_profit < 0 ? "danger" : "default"} hint={d.totals.margin_percent !== null ? `Margin ${formatPercent(d.totals.margin_percent, 1)}` : undefined} />
                        <StatCard label="Net VAT" value={formatMoney(d.totals.net_vat, d.currency)} icon={Landmark} hint={`Collected ${formatMoney(d.totals.vat_collected, d.currency)} · paid ${formatMoney(d.totals.vat_paid, d.currency)}`} />
                    </StatGrid>
                    <StatGrid>
                        <StatCard label="Receivables" value={formatMoney(d.receivables.amount, d.currency)} hint={d.receivables.overdue_count ? `${formatMoney(d.receivables.overdue_amount, d.currency)} overdue` : `${d.receivables.count} open`} tone={d.receivables.overdue_count ? "warning" : "default"} />
                        <StatCard label="Payables" value={formatMoney(d.payables.amount, d.currency)} hint={d.payables.overdue_count ? `${formatMoney(d.payables.overdue_amount, d.currency)} overdue` : `${d.payables.count} open`} tone={d.payables.overdue_count ? "danger" : "default"} />
                        <StatCard label="Recurring costs" value={formatMoney(d.totals.recurring_expenses, d.currency)} />
                        <StatCard label="Operating expenses" value={formatMoney(d.totals.operating_expenses, d.currency)} />
                    </StatGrid>
                    <div className="grid gap-4 lg:grid-cols-3">
                        <div className="lg:col-span-2">
                            <ChartCard title="Income vs expenses" description={basis === "CASH" ? "Money actually received and paid" : "By transaction date (net of VAT)"}>
                                <MonthlyMoneyChart data={d.trend} currency={d.currency} series={[{ key: "income", label: "Income", color: 2 }, { key: "expenses", label: "Expenses", color: 1 }, { key: "profit", label: "Profit", color: 3, type: "line" }]} />
                            </ChartCard>
                        </div>
                        <ChartCard title="Expenses by category">
                            {d.expenses_by_category.length ? <HorizontalMoneyBars data={d.expenses_by_category.slice(0, 8).map((c) => ({ label: c.name, value: c.amount }))} currency={d.currency} color={1} /> : <EmptyState compact title="No expenses in this period" />}
                        </ChartCard>
                    </div>
                    <div className="grid gap-4 lg:grid-cols-2">
                        <ChartCard title="Cash position" description="Tracked bank accounts and cash boxes">
                            {d.cash_position.length ? (
                                <ul className="divide-y divide-border-soft">{d.cash_position.map((c) => <li key={c.id} className="flex justify-between gap-2 py-2 text-[13px]"><span>{c.name}</span><span className={c.balance < 0 ? "tabular text-danger" : "tabular text-foreground"}>{formatMoney(c.balance, c.currency ?? d.currency)}</span></li>)}</ul>
                            ) : <EmptyState compact title="No tracked accounts" description="Turn on balance tracking for a payment method in Categories." />}
                        </ChartCard>
                        <ChartCard title="Upcoming expenses" description="Next 30 days" action={<Button variant="ghost" size="sm" asChild><Link to="/expenses/recurring">Recurring</Link></Button>}>
                            {d.upcoming_expenses.length ? (
                                <ul className="divide-y divide-border-soft">{d.upcoming_expenses.map((u) => <li key={u.id} className="flex justify-between gap-2 py-2 text-[13px]"><span className="truncate">{u.name} · {formatDate(u.next_occurrence_date)}</span><span className="tabular">{formatMoney(u.expected_gross_amount, u.currency)}</span></li>)}</ul>
                            ) : <EmptyState compact title="Nothing due soon" />}
                        </ChartCard>
                    </div>
                </div>
            ) : null}
        </Page>
    );
}
