import { AlertTriangle, Receipt } from "lucide-react";
import { Page, PageHeader } from "@/components/ui/page";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { StatCard, StatGrid } from "@/components/ui/stat-card";
import { EmptyState, ErrorState, ListSkeleton } from "@/components/ui/states";
import { useListParams } from "@/hooks/use-list-params";
import { useUnbilled } from "@/features/time/reports/hooks/use-reports";
import { formatDate, formatMinutes, formatMoney } from "@/lib/format";
import { Panel } from "@/pages/people/components/person";

/**
 * /time/unbilled — approved, billable, uninvoiced time grouped by customer and project (what Billing can invoice).
 * Time Tracking never creates invoices. @perm time.entries.read_all + time.reports.read · @api GET /time/unbilled
 */
export default function UnbilledPage() {
    const { filters, setFilter } = useListParams();
    const q = useUnbilled({ ...(filters.to && { to: filters.to }) });
    const d = q.data;
    const currency = d?.totals.currency ?? "EUR";
    return (
        <Page>
            <PageHeader
                title="Ready to invoice"
                description="Approved billable time that is not on an invoice yet."
                actions={<Input type="date" value={filters.to ?? ""} onChange={(e) => setFilter("to", e.target.value)} className="h-8 w-full sm:w-44" aria-label="Up to date" />}
            />
            {q.isLoading ? <ListSkeleton /> : q.error ? <ErrorState error={q.error} onRetry={() => q.refetch()} /> : !d?.groups.length ? (
                <EmptyState icon={Receipt} title="Nothing to invoice" description="All approved billable time is invoiced." />
            ) : (
                <div className="space-y-4">
                    <StatGrid>
                        <StatCard label="Billable time" value={formatMinutes(d.totals.billable_minutes)} hint={`${d.totals.entries} entries`} />
                        {d.totals.amount !== undefined && <StatCard label="Value" value={formatMoney(d.totals.amount, currency)} tone="success" />}
                        <StatCard label="Awaiting approval" value={formatMinutes(d.awaiting_approval.billable_minutes)} hint={`${d.awaiting_approval.entries} entries`} tone="info" />
                        <StatCard label="Without a rate" value={d.totals.missing_rate} tone={d.totals.missing_rate ? "warning" : "default"} hint="entries valued at 0" />
                    </StatGrid>
                    {d.groups.map((g) => (
                        <Panel key={g.customer?.id ?? "none"} title={g.customer?.name ?? "No customer"} actions={<span className="text-xs tabular text-muted-foreground">{formatMinutes(g.billable_minutes)}{g.amount !== undefined ? ` · ${formatMoney(g.amount, currency)}` : ""}</span>}>
                            <ul className="divide-y divide-border">
                                {g.projects.map((pr) => (
                                    <li key={pr.project?.id ?? "none"} className="flex flex-wrap items-center justify-between gap-2 py-2 first:pt-0 last:pb-0">
                                        <div className="min-w-0">
                                            <div className="truncate text-[13px] text-foreground">{pr.project?.name ?? "No project"}</div>
                                            <div className="text-xs text-muted-foreground tabular">{pr.entries} entries · {formatDate(pr.oldest_date, "d MMM")} – {formatDate(pr.newest_date, "d MMM yyyy")}</div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {!!pr.missing_rate && <Badge variant="warning"><AlertTriangle className="size-3" /> {pr.missing_rate} without rate</Badge>}
                                            <span className="tabular text-[13px] text-foreground">{formatMinutes(pr.billable_minutes)}</span>
                                            {pr.amount !== undefined && <span className="w-24 text-right tabular text-[13px] font-medium text-foreground">{formatMoney(pr.amount, pr.currency ?? currency)}</span>}
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        </Panel>
                    ))}
                </div>
            )}
        </Page>
    );
}
