import { Link } from "react-router-dom";
import { BarChart3, CheckCircle2, Eye, MousePointerClick, Send, TriangleAlert } from "lucide-react";
import { Page, PageHeader, Section } from "@/components/ui/page";
import { StatCard, StatGrid } from "@/components/ui/stat-card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EmptyState, ErrorState, PageSkeleton } from "@/components/ui/states";
import { useListParams } from "@/hooks/use-list-params";
import { formatNumber } from "@/lib/format";
import { useAnalyticsSummary } from "@/features/communications/hooks/use-communications";
import { CommChannelFilterOptions } from "@/config/constants/dropdowns/communications/comm-channel-form.options";
import { DailySendsChart } from "../../components/daily-sends-chart";
import { pct } from "../../components/comm-badges";
import { CampaignPaths } from "../../campaign-paths";

const RANGES = [
    { id: "7", label: "Last 7 days" },
    { id: "30", label: "Last 30 days" },
    { id: "90", label: "Last 90 days" },
];

const delta = (now: number, before: number) => (before ? `${now >= before ? "+" : ""}${Math.round(((now - before) / before) * 100)}% vs previous` : "No previous data");

/**
 * /campaigns/analytics
 * @perm communications.analytics.read
 * @api GET /communications/analytics/summary?from=&to=&channel=
 */
export default function CampaignAnalyticsPage() {
    const { filters, setFilter } = useListParams();
    const days = Number(filters.range ?? 30);
    const to = new Date();
    const from = new Date(to.getTime() - (days - 1) * 86_400_000);
    const params = { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10), ...(filters.channel && { channel: filters.channel }) };
    const summary = useAnalyticsSummary(params);
    const s = summary.data;

    return (
        <Page>
            <PageHeader
                title="Analytics"
                description="Email and SMS performance across campaigns and one-off messages (notification sends excluded)."
                actions={
                    <>
                        <Select value={String(days)} onValueChange={(v) => setFilter("range", v === "30" ? null : v)}>
                            <SelectTrigger className="h-8 w-36" aria-label="Period"><SelectValue /></SelectTrigger>
                            <SelectContent>{RANGES.map((r) => <SelectItem key={r.id} value={r.id}>{r.label}</SelectItem>)}</SelectContent>
                        </Select>
                        <Select value={filters.channel ?? "all"} onValueChange={(v) => setFilter("channel", v)}>
                            <SelectTrigger className="h-8 w-36" aria-label="Channel"><SelectValue /></SelectTrigger>
                            <SelectContent>{CommChannelFilterOptions.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent>
                        </Select>
                    </>
                }
            />
            {summary.isPending ? (
                <PageSkeleton />
            ) : summary.error ? (
                <ErrorState error={summary.error} onRetry={() => summary.refetch()} />
            ) : s && (
                <div className="space-y-6">
                    <StatGrid className="lg:grid-cols-5">
                        <StatCard label="Sent" icon={Send} value={formatNumber(s.totals.sent_count)} hint={delta(s.totals.sent_count, s.previous.totals.sent_count)} />
                        <StatCard label="Delivery rate" icon={CheckCircle2} tone="success" value={pct(s.rates.delivery_rate)} />
                        <StatCard label="Open rate" icon={Eye} tone="info" value={pct(s.rates.open_rate)} hint={`${formatNumber(s.totals.unique_opened_count)} unique opens`} />
                        <StatCard label="Click rate" icon={MousePointerClick} value={pct(s.rates.click_rate)} hint={`${formatNumber(s.totals.unique_clicked_count)} unique clicks`} />
                        <StatCard label="Bounce rate" icon={TriangleAlert} tone={s.rates.bounce_rate > 2 ? "danger" : "default"} value={pct(s.rates.bounce_rate)} hint={`${formatNumber(s.totals.unsubscribed_count)} unsubscribed`} />
                    </StatGrid>
                    <Section title="Per day">
                        <div className="rounded-lg border border-border bg-card p-3">
                            {s.totals.sent_count === 0 ? <EmptyState compact icon={BarChart3} title="Nothing sent in this period" /> : <DailySendsChart series={s.series} keys={["sent", "delivered", "opened", "clicked", "bounced"]} />}
                        </div>
                    </Section>
                    <Section title="Top campaigns">
                        <ul className="divide-y divide-border-soft rounded-lg border border-border bg-card">
                            {s.top_campaigns.length ? (
                                s.top_campaigns.map((c) => (
                                    <li key={c.id}>
                                        <Link to={CampaignPaths.detail(c.id)} className="flex items-center gap-3 px-3 py-2.5 transition-colors hover:bg-accent">
                                            <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-foreground">{c.name}</span>
                                            <span className="text-xs text-muted-foreground tabular">{formatNumber(c.sent_count)} sent · {pct(c.open_rate)} open · {pct(c.click_rate)} click</span>
                                        </Link>
                                    </li>
                                ))
                            ) : (
                                <li><EmptyState compact title="No campaigns in this period" /></li>
                            )}
                        </ul>
                    </Section>
                </div>
            )}
        </Page>
    );
}
