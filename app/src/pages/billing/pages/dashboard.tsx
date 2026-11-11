import { Link } from "react-router-dom";
import { AlertTriangle, CircleDollarSign, Plus, Receipt, Repeat, Wallet } from "lucide-react";
import { Page, PageHeader } from "@/components/ui/page";
import { StatCard, StatGrid } from "@/components/ui/stat-card";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState, PageSkeleton } from "@/components/ui/states";
import { Can } from "@/components/access/can";
import { useFinanceDashboard } from "@/features/billing/hooks/use-billing";
import { formatDate, formatMoney, formatPercent } from "@/lib/format";
import { getDropdownOptionLabel } from "@/lib/dropdown-option-label.utils";
import { AgingBucketOptions, PaymentMethodTypeOptions } from "@/config/constants/dropdowns/billing/billing.options";
import { ChartCard, HorizontalMoneyBars, MonthlyMoneyChart } from "../components/money-charts";
import { PaymentStatusBadge } from "../components/billing-badges";

/**
 * /billing — billing KPIs (08 "Financial Dashboard").
 * @perm finance.dashboard.read · collected/fees/refunds need finance.payments.read (null otherwise)
 * @api GET /finance/dashboard
 */
export default function BillingDashboardPage() {
    const q = useFinanceDashboard({});
    const d = q.data;
    return (
        <Page>
            <PageHeader
                title="Billing"
                description="Receivables, recurring revenue and collections."
                actions={
                    <Can permission="finance.invoices.create">
                        <Button asChild><Link to="/billing/invoices/new"><Plus /> New invoice</Link></Button>
                    </Can>
                }
            />
            {q.isPending ? (
                <PageSkeleton />
            ) : q.error ? (
                <ErrorState error={q.error} onRetry={() => q.refetch()} />
            ) : d ? (
                <div className="space-y-4">
                    <StatGrid>
                        <StatCard label="Outstanding" value={formatMoney(d.kpis.outstanding, d.currency)} hint={`${d.kpis.outstanding_count} open invoice${d.kpis.outstanding_count === 1 ? "" : "s"}`} icon={Receipt} tone="info" />
                        <StatCard label="Overdue" value={formatMoney(d.kpis.overdue, d.currency)} hint={`${d.kpis.overdue_count} overdue`} icon={AlertTriangle} tone={d.kpis.overdue_count ? "danger" : "default"} />
                        <StatCard label="MRR" value={formatMoney(d.kpis.mrr, d.currency)} hint={`ARR ${formatMoney(d.kpis.arr, d.currency, { compact: true })} · ${d.kpis.active_subscriptions} active`} icon={Repeat} tone="success" />
                        <StatCard label="Collected this month" value={d.kpis.collected_this_month === null ? "—" : formatMoney(d.kpis.collected_this_month, d.currency)} hint={d.kpis.fees_this_month ? `Fees ${formatMoney(d.kpis.fees_this_month, d.currency)}` : `${d.kpis.payments_this_month} payments`} icon={Wallet} />
                    </StatGrid>
                    <StatGrid>
                        <StatCard label="Revenue this year (net)" value={formatMoney(d.kpis.revenue_ytd, d.currency)} icon={CircleDollarSign} />
                        <StatCard label="Avg revenue per customer" value={d.kpis.arpu_ytd === null ? "—" : formatMoney(d.kpis.arpu_ytd, d.currency)} />
                        <StatCard label="Payment success (90 days)" value={formatPercent(d.kpis.payment_success_rate)} />
                        <StatCard label="Refunds this year" value={d.kpis.refunds_ytd === null ? "—" : formatMoney(d.kpis.refunds_ytd, d.currency)} />
                    </StatGrid>
                    {d.other_currencies.length > 0 && (
                        <p className="text-xs text-muted-foreground">
                            Figures are in {d.currency}. Also outstanding: {d.other_currencies.map((o) => `${formatMoney(o.outstanding, o.currency)} (${o.count})`).join(" · ")}
                        </p>
                    )}
                    <div className="grid gap-4 lg:grid-cols-3">
                        <div className="lg:col-span-2">
                            <ChartCard title="Invoiced vs collected" description="Last 12 months, net of discounts; collected net of refunds">
                                <MonthlyMoneyChart data={d.monthly} currency={d.currency} series={[{ key: "invoiced", label: "Invoiced", color: 1 }, { key: "collected", label: "Collected", color: 2, type: "line" }]} />
                            </ChartCard>
                        </div>
                        <ChartCard title="Receivables aging" description="Unpaid amount by days past due">
                            {d.aging.every((a) => a.amount === 0) ? (
                                <EmptyState compact title="Nothing outstanding" />
                            ) : (
                                <HorizontalMoneyBars data={d.aging.map((a) => ({ label: getDropdownOptionLabel(AgingBucketOptions, a.bucket), value: a.amount }))} currency={d.currency} color={4} />
                            )}
                        </ChartCard>
                    </div>
                    <div className="grid gap-4 lg:grid-cols-2">
                        <ChartCard title="Top customers this year" description="Invoiced amount">
                            {d.top_customers.length ? (
                                <HorizontalMoneyBars data={d.top_customers.map((c) => ({ label: c.name, value: c.invoiced }))} currency={d.currency} color={3} />
                            ) : (
                                <EmptyState compact title="No invoices yet this year" />
                            )}
                        </ChartCard>
                        <ChartCard title="Recent payments" action={<Can permission="finance.payments.read"><Button variant="ghost" size="sm" asChild><Link to="/billing/payments">All payments</Link></Button></Can>}>
                            {d.recent_payments.length ? (
                                <ul className="divide-y divide-border-soft">
                                    {d.recent_payments.map((p) => (
                                        <li key={p.id}>
                                            <Link to={`/billing/payments/${p.id}`} className="flex items-center justify-between gap-3 py-2 hover:bg-border-soft">
                                                <div className="min-w-0">
                                                    <div className="truncate text-[13px] text-foreground">{p.billing_profile?.legal_name ?? "Unassigned"}</div>
                                                    <div className="text-xs text-muted-foreground">{getDropdownOptionLabel(PaymentMethodTypeOptions, p.method_type)} · {formatDate(p.received_at)}</div>
                                                </div>
                                                <div className="flex shrink-0 items-center gap-2">
                                                    <span className="tabular text-[13px] text-foreground">{formatMoney(p.amount, p.currency)}</span>
                                                    <PaymentStatusBadge status={p.status} />
                                                </div>
                                            </Link>
                                        </li>
                                    ))}
                                </ul>
                            ) : (
                                <EmptyState compact title="No payments yet" />
                            )}
                        </ChartCard>
                    </div>
                </div>
            ) : null}
        </Page>
    );
}
