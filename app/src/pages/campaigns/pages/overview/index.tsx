import { Link, useNavigate } from "react-router-dom";
import { AlertTriangle, CalendarClock, CheckCircle2, Mail, MessageSquareText, MousePointerClick, Plus, Send, TriangleAlert } from "lucide-react";
import { Page, PageHeader, Section } from "@/components/ui/page";
import { StatCard, StatGrid } from "@/components/ui/stat-card";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState, PageSkeleton } from "@/components/ui/states";
import { Can } from "@/components/access/can";
import { usePermission } from "@/hooks/use-permission";
import { formatDateTime, formatNumber } from "@/lib/format";
import { useAnalyticsSummary, useCommOverview } from "@/features/communications/hooks/use-communications";
import type { ProviderChannelStatus } from "@/features/communications/interfaces/communications.interfaces";
import { CampaignStatusBadge, ChannelBadge, pct } from "../../components/comm-badges";
import { CampaignPaths } from "../../campaign-paths";
import { DailySendsChart } from "../../components/daily-sends-chart";

function ProviderRow({ label, icon: Icon, status }: { label: string; icon: typeof Mail; status: ProviderChannelStatus }) {
    return (
        <div className="flex min-w-0 items-start gap-3 rounded-lg border border-border bg-card p-3">
            <div className="grid size-8 shrink-0 place-items-center rounded-md bg-secondary text-muted-foreground"><Icon className="size-4" /></div>
            <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 text-[13px] font-medium text-foreground">
                    {label}
                    {status.connected ? <CheckCircle2 className="size-3.5 text-success" /> : <TriangleAlert className="size-3.5 text-warning" />}
                </div>
                <p className="truncate text-xs text-muted-foreground">
                    {status.connected ? `${status.name ?? status.provider}${status.default_from ? ` · ${status.default_from}` : ""}` : status.reason ?? status.last_error ?? "Not connected"}
                </p>
            </div>
        </div>
    );
}

/**
 * /campaigns/overview
 * @perm communications.campaigns.read | communications.messages.read · KPI cards need communications.analytics.read (hidden without it)
 * @api GET /communications/overview · GET /communications/analytics/summary
 */
export default function CampaignsOverviewPage() {
    const navigate = useNavigate();
    const canAnalytics = usePermission("communications.analytics.read");
    const overview = useCommOverview();
    const summary = useAnalyticsSummary({}, canAnalytics);

    if (overview.isPending) return <PageSkeleton />;
    if (overview.error) return <Page><ErrorState error={overview.error} onRetry={() => overview.refetch()} /></Page>;
    const o = overview.data;
    const s = summary.data;

    return (
        <Page>
            <PageHeader
                title="Campaigns overview"
                description="What is sending, what is scheduled and how the last 30 days performed."
                actions={<Can permission="communications.campaigns.create"><Button onClick={() => navigate(CampaignPaths.new)}><Plus /> New campaign</Button></Can>}
            />
            <div className="space-y-6">
                {canAnalytics && (
                    <StatGrid>
                        <StatCard label="Sent (30 days)" icon={Send} value={formatNumber(s?.totals.sent_count ?? 0)} hint={s ? `${formatNumber(s.previous.totals.sent_count)} previous period` : undefined} />
                        <StatCard label="Delivery rate" icon={CheckCircle2} tone="success" value={pct(s?.rates.delivery_rate ?? 0)} />
                        <StatCard label="Open rate" icon={Mail} tone="info" value={pct(s?.rates.open_rate ?? 0)} hint={s ? `Click rate ${pct(s.rates.click_rate)}` : undefined} />
                        <StatCard label="Bounces" icon={AlertTriangle} tone={o.failed_last_24h ? "danger" : "default"} value={pct(s?.rates.bounce_rate ?? 0)} hint={`${o.failed_last_24h} failed in the last 24 h`} />
                    </StatGrid>
                )}

                <div className="grid gap-3 sm:grid-cols-2">
                    <ProviderRow label="Email (Resend)" icon={Mail} status={o.providers.email} />
                    <ProviderRow label="SMS (Twilio)" icon={MessageSquareText} status={o.providers.sms} />
                </div>

                {canAnalytics && s && (
                    <Section title="Daily sends" description={`${s.from} – ${s.to}`} actions={<Button variant="ghost" size="sm" asChild><Link to={CampaignPaths.analytics}>Analytics</Link></Button>}>
                        <div className="rounded-lg border border-border bg-card p-3">
                            <DailySendsChart series={s.series} />
                        </div>
                    </Section>
                )}

                <div className="grid gap-6 lg:grid-cols-2">
                    <Section title="Live and upcoming">
                        <div className="divide-y divide-border-soft rounded-lg border border-border bg-card">
                            {o.upcoming.length === 0 ? (
                                <EmptyState compact icon={CalendarClock} title="Nothing scheduled" description="Scheduled, sending and paused campaigns show here." />
                            ) : (
                                o.upcoming.map((c) => (
                                    <Link key={c.id} to={CampaignPaths.detail(c.id)} className="flex items-center gap-3 px-3 py-2.5 transition-colors hover:bg-accent">
                                        <div className="min-w-0 flex-1">
                                            <div className="truncate text-[13px] font-medium text-foreground">{c.name}</div>
                                            <div className="text-xs text-muted-foreground">
                                                {c.status === "SENDING" ? `${formatNumber(c.sent_count)} of ${formatNumber(c.audience_count)} sent` : formatDateTime(c.scheduled_at)}
                                            </div>
                                        </div>
                                        <ChannelBadge channel={c.channel} />
                                        <CampaignStatusBadge status={c.status} />
                                    </Link>
                                ))
                            )}
                        </div>
                    </Section>
                    <Section title="Recently sent">
                        <div className="divide-y divide-border-soft rounded-lg border border-border bg-card">
                            {o.recent.length === 0 ? (
                                <EmptyState compact icon={MousePointerClick} title="No campaigns sent yet" description="Results appear here once a campaign finishes sending." />
                            ) : (
                                o.recent.map((c) => (
                                    <Link key={c.id} to={CampaignPaths.detail(c.id)} className="flex items-center gap-3 px-3 py-2.5 transition-colors hover:bg-accent">
                                        <div className="min-w-0 flex-1">
                                            <div className="truncate text-[13px] font-medium text-foreground">{c.name}</div>
                                            <div className="text-xs text-muted-foreground">{formatDateTime(c.completed_at)} · {formatNumber(c.sent_count)} sent</div>
                                        </div>
                                        <div className="text-right text-xs tabular">
                                            <div className="text-foreground">{pct(c.open_rate)} open</div>
                                            <div className="text-muted-foreground">{pct(c.click_rate)} click</div>
                                        </div>
                                    </Link>
                                ))
                            )}
                        </div>
                    </Section>
                </div>
            </div>
        </Page>
    );
}
