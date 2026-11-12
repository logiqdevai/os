import { Link } from "react-router-dom";
import { AlertTriangle, CalendarClock, Handshake, Percent, Target, TrendingUp, Trophy, UserPlus } from "lucide-react";
import { Page, PageHeader } from "@/components/ui/page";
import { StatCard, StatGrid } from "@/components/ui/stat-card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { EmptyState, ErrorState, PageSkeleton } from "@/components/ui/states";
import { Can } from "@/components/access/can";
import { useListParams } from "@/hooks/use-list-params";
import { formatDate, formatDateTime, formatMoney, formatPercent } from "@/lib/format";
import { cn } from "@/lib/utils";
import { OwnerFilterOptions } from "@/config/constants/dropdowns/crm/crm-filter.options";
import { useCrmDashboard } from "@/features/crm/insights/hooks/use-insights";
import { usePipelines } from "@/features/crm/pipelines/hooks/use-pipelines";
import { CrmPaths } from "../../crm-paths";
import { MemberAvatar, Money, Panel, ToneBadge } from "../../components/crm-ui";
import { ACTIVITY_ICON } from "../../components/activity-items";
import { TargetsPanel } from "../../components/target-progress";

const monthLabel = (m: string) => formatDate(`${m}-01`, "MMM");

/**
 * CRM dashboard (mockup `dashboard`).
 * @route /crm?pipeline_id=&owner=
 * @perm VIEW crm.dashboards.read · money crm.financials.read · my activities crm.activities.read
 * @api GET /crm/dashboard (one aggregate call; numbers computed on the server)
 */
export default function CrmDashboardPage() {
    const { filters, setFilter } = useListParams();
    const pipelines = usePipelines();
    const dash = useCrmDashboard({ pipeline_id: filters.pipeline_id, owner: filters.owner });

    if (dash.isPending) return <PageSkeleton />;
    if (dash.error) return <Page><PageHeader title="CRM" /><ErrorState error={dash.error} onRetry={() => dash.refetch()} /></Page>;
    const d = dash.data;
    const k = d.kpis;
    const cur = d.currency ?? "EUR";
    const maxStage = Math.max(1, ...d.pipeline.stages.map((s) => (d.financials_hidden ? s.count : s.value ?? 0)));
    const maxMonth = Math.max(1, ...d.won_by_month.map((m) => (d.financials_hidden ? m.count : m.value ?? 0)));

    return (
        <Page>
            <PageHeader
                title="Sales dashboard"
                description={d.financials_hidden ? "Amounts are hidden — you need the CRM financials permission to see them." : `${d.pipeline.name} pipeline and team performance`}
                actions={
                    <>
                        {(pipelines.data?.length ?? 0) > 1 && (
                            <Select value={filters.pipeline_id ?? d.pipeline.id} onValueChange={(v) => setFilter("pipeline_id", v)}>
                                <SelectTrigger className="h-8 w-full sm:w-40" aria-label="Pipeline"><SelectValue /></SelectTrigger>
                                <SelectContent>{pipelines.data?.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                            </Select>
                        )}
                        <Select value={filters.owner ?? "all"} onValueChange={(v) => setFilter("owner", v)}>
                            <SelectTrigger className="h-8 w-full sm:w-40" aria-label="Owner"><SelectValue /></SelectTrigger>
                            <SelectContent>{OwnerFilterOptions.filter((o) => o.id !== "unassigned").map((o) => <SelectItem key={o.id} value={o.id}>{o.id === "all" ? "Whole team" : "Only mine"}</SelectItem>)}</SelectContent>
                        </Select>
                    </>
                }
            />

            <StatGrid>
                <StatCard label="Pipeline value" icon={Handshake} value={<Money value={k.pipeline_value} currency={cur} compact />} hint={`${k.open_deals} open deals`} />
                <StatCard label="Weighted value" icon={Target} tone="info" value={<Money value={k.weighted_value} currency={cur} compact />} hint="value × probability" />
                <StatCard label="Won this month" icon={Trophy} tone="success" value={<Money value={k.won_value_this_month} currency={cur} compact />} hint={`${k.won_this_month} won · ${k.lost_this_month} lost`} />
                <StatCard label="Win rate (90 days)" icon={Percent} value={formatPercent(k.win_rate_90d)} hint={k.avg_won_deal_90d != null ? `avg won ${formatMoney(k.avg_won_deal_90d, cur, { compact: true })}` : undefined} />
            </StatGrid>
            <StatGrid className="mt-3">
                <StatCard label="New leads this month" icon={UserPlus} value={k.new_leads_this_month} />
                <StatCard label="Lead conversion (90 days)" icon={TrendingUp} value={formatPercent(k.lead_conversion_90d)} />
            </StatGrid>

            <div className="mt-5 grid gap-4 lg:grid-cols-2">
                <Can permission="crm.targets.read"><TargetsPanel owner={filters.owner} /></Can>
                <Panel title={`Open pipeline by stage${d.financials_hidden ? " (deals)" : ""}`} actions={<Button variant="ghost" size="sm" asChild><Link to={CrmPaths.deals}>Board</Link></Button>}>
                    {!d.pipeline.stages.some((s) => s.count) ? (
                        <EmptyState compact icon={Handshake} title="No open deals" description="Open deals appear here by stage." />
                    ) : (
                        <ul className="space-y-2.5" aria-label="Open pipeline by stage">
                            {d.pipeline.stages.map((s) => {
                                const v = d.financials_hidden ? s.count : s.value ?? 0;
                                return (
                                    <li key={s.id} className="grid grid-cols-[7rem_1fr_auto] items-center gap-3 text-[13px] sm:grid-cols-[9rem_1fr_auto]">
                                        <span className="truncate text-muted-foreground">{s.name}</span>
                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                                <div className="h-3 w-full rounded-r-xs bg-secondary" aria-hidden>
                                                    <div className="h-full rounded-r-[4px] bg-chart-1" style={{ width: `${Math.max(v ? 2 : 0, (v / maxStage) * 100)}%` }} />
                                                </div>
                                            </TooltipTrigger>
                                            <TooltipContent>{s.name}: {s.count} deals{s.value != null && ` · ${formatMoney(s.value, cur)}`} · {s.probability}%</TooltipContent>
                                        </Tooltip>
                                        <span className="tabular text-foreground">{d.financials_hidden ? s.count : formatMoney(s.value, cur, { compact: true })}</span>
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                </Panel>

                <Panel title={`Won ${d.financials_hidden ? "deals" : "revenue"} — last 6 months`}>
                    <div className="flex h-40 items-end gap-2" role="list" aria-label="Won by month">
                        {d.won_by_month.map((m) => {
                            const v = d.financials_hidden ? m.count : m.value ?? 0;
                            return (
                                <Tooltip key={m.month}>
                                    <TooltipTrigger asChild>
                                        <div role="listitem" className="flex h-full flex-1 flex-col justify-end gap-1 text-center">
                                            <span className="text-[11px] text-muted-foreground tabular">{v ? (d.financials_hidden ? v : formatMoney(v, cur, { compact: true })) : ""}</span>
                                            <div className={cn("w-full rounded-t-[4px]", v ? "bg-chart-1" : "bg-border")} style={{ height: `${v ? Math.max(4, (v / maxMonth) * 100) : 2}%` }} />
                                            <span className="text-[11px] text-muted-foreground">{monthLabel(m.month)}</span>
                                        </div>
                                    </TooltipTrigger>
                                    <TooltipContent>{monthLabel(m.month)}: {m.count} won{m.value != null && ` · ${formatMoney(m.value, cur)}`}</TooltipContent>
                                </Tooltip>
                            );
                        })}
                    </div>
                </Panel>

                <Panel title="Closing soon" actions={<Can permission="crm.forecast.read"><Button variant="ghost" size="sm" asChild><Link to={CrmPaths.forecast}>Forecast</Link></Button></Can>}>
                    {!d.closing_soon.length ? <EmptyState compact icon={CalendarClock} title="No close dates set" description="Add expected close dates to deals to see them here." /> : (
                        <ul className="divide-y divide-border-soft">
                            {d.closing_soon.map((x) => (
                                <li key={x.id} className="flex items-center gap-3 py-2 text-[13px]">
                                    <MemberAvatar member={x.owner} />
                                    <div className="min-w-0 flex-1">
                                        <Link to={CrmPaths.deal(x.id)} className="block truncate font-medium text-foreground hover:underline">{x.name}</Link>
                                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                            <span className={cn(x.is_overdue && "text-danger")}>{x.is_overdue && <AlertTriangle className="mr-1 inline size-3" />}{formatDate(x.expected_close_date)}</span>
                                            {x.company && <span className="truncate">· {x.company.name}</span>}
                                        </div>
                                    </div>
                                    <div className="flex shrink-0 flex-col items-end gap-1">
                                        <Money value={x.value} currency={x.currency} compact />
                                        <ToneBadge tone={x.stage.color}>{x.stage.name}</ToneBadge>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    )}
                </Panel>

                {d.my_activities && (
                    <Panel title="My next activities" actions={<Button variant="ghost" size="sm" asChild><Link to={CrmPaths.activities}>All</Link></Button>}>
                        {!d.my_activities.length ? <EmptyState compact title="You're all caught up" description="No open activities assigned to you." /> : (
                            <ul className="divide-y divide-border-soft">
                                {d.my_activities.map((a) => {
                                    const Icon = ACTIVITY_ICON[a.type];
                                    return (
                                        <li key={a.id} className="flex items-center gap-3 py-2 text-[13px]">
                                            <Icon className={cn("size-4 shrink-0", a.is_overdue ? "text-danger" : "text-muted-foreground")} />
                                            <div className="min-w-0 flex-1">
                                                <div className="truncate text-foreground">{a.title}</div>
                                                <div className="truncate text-xs text-muted-foreground">{a.starts_at ? formatDateTime(a.starts_at) : "No due date"}{(a.deal ?? a.company) && ` · ${(a.deal ?? a.company)!.name}`}</div>
                                            </div>
                                            {a.is_overdue && <span className="text-xs text-danger">Overdue</span>}
                                        </li>
                                    );
                                })}
                            </ul>
                        )}
                    </Panel>
                )}
            </div>
        </Page>
    );
}
