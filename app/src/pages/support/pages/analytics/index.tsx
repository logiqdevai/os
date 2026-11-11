import { useMemo, useState } from "react";
import { CheckCircle2, Clock, Inbox, Smile, Ticket, Timer } from "lucide-react";
import { Page, PageHeader, Section } from "@/components/ui/page";
import { StatCard, StatGrid } from "@/components/ui/stat-card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MemberAvatar } from "@/components/ui/member-avatar";
import { ErrorState, PageSkeleton } from "@/components/ui/states";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { usePermission } from "@/hooks/use-permission";
import { formatMinutes, formatPercent } from "@/lib/format";
import { getDropdownOptionLabel } from "@/lib/dropdown-option-label.utils";
import { AnalyticsRangeOptions, SlaMetricOptions, TicketPriorityFormOptions, TicketSourceOptions } from "@/config/constants/dropdowns/support/support.options";
import { useCsatSummary, useInboxes, useSupportAnalytics } from "@/features/support/hooks/use-support";

/**
 * Support analytics — /support/analytics (mockup 13-support `analytics`, `csat`).
 * @perm support.analytics.read (scope-limited) · CSAT block support.csat.read
 */
export default function SupportAnalyticsPage() {
    const [days, setDays] = useState("30");
    const [inbox, setInbox] = useState("all");
    const inboxes = useInboxes();
    const canCsat = usePermission("support.csat.read");
    const params = useMemo(() => {
        const to = new Date();
        const from = new Date(to.getTime() - Number(days) * 86400_000);
        return { from: from.toISOString(), to: to.toISOString(), ...(inbox !== "all" && { inbox_id: inbox }) };
    }, [days, inbox]);
    const data = useSupportAnalytics(params);
    const csat = useCsatSummary({ from: params.from, to: params.to }, canCsat);
    const a = data.data;
    const max = Math.max(1, ...(a?.volume.map((v) => Math.max(v.created, v.resolved)) ?? [1]));

    return (
        <Page>
            <PageHeader
                title="Support analytics"
                description={a && !a.org_wide ? "Figures cover the inboxes and teams you can see." : "How fast and how well your team answers customers."}
                actions={
                    <>
                        <Select value={inbox} onValueChange={setInbox}>
                            <SelectTrigger className="h-8 w-40" aria-label="Inbox"><SelectValue /></SelectTrigger>
                            <SelectContent><SelectItem value="all">All inboxes</SelectItem>{inboxes.data?.map((i) => <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>)}</SelectContent>
                        </Select>
                        <Select value={days} onValueChange={setDays}>
                            <SelectTrigger className="h-8 w-36" aria-label="Period"><SelectValue /></SelectTrigger>
                            <SelectContent>{AnalyticsRangeOptions.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent>
                        </Select>
                    </>
                }
            />
            {data.isLoading ? (
                <PageSkeleton />
            ) : data.error || !a ? (
                <ErrorState error={data.error} onRetry={() => data.refetch()} />
            ) : (
                <div className="space-y-6">
                    <StatGrid>
                        <StatCard label="Tickets created" value={a.totals.tickets_created} icon={Ticket} hint={`${a.totals.conversations_created} conversations`} />
                        <StatCard label="Tickets resolved" value={a.totals.tickets_resolved} icon={CheckCircle2} tone="success" hint={`${a.totals.open_backlog} still open`} />
                        <StatCard label="First response (median)" value={a.first_response.median_minutes !== null ? formatMinutes(a.first_response.median_minutes) : "—"} icon={Clock} hint={a.first_response.average_minutes !== null ? `avg ${formatMinutes(a.first_response.average_minutes)}` : "No replies yet"} />
                        <StatCard label="Resolution (median)" value={a.resolution.median_minutes !== null ? formatMinutes(a.resolution.median_minutes) : "—"} icon={Timer} hint={a.resolution.average_minutes !== null ? `avg ${formatMinutes(a.resolution.average_minutes)}` : "Nothing resolved"} />
                        <StatCard label="SLA compliance" value={formatPercent(a.sla.compliance, 1)} icon={Inbox} tone={a.sla.compliance === null ? "default" : a.sla.compliance >= 90 ? "success" : a.sla.compliance >= 75 ? "warning" : "danger"} hint={`${a.sla.by_metric.reduce((s, m) => s + m.breached, 0)} breaches`} />
                        <StatCard label="CSAT" value={a.csat.satisfied_percent !== null ? formatPercent(a.csat.satisfied_percent) : "—"} icon={Smile} hint={a.csat.responses ? `${a.csat.responses} ratings · avg ${a.csat.average}` : "No ratings yet"} />
                    </StatGrid>

                    <Section title="Volume" description="Tickets created and resolved per day.">
                        <div className="rounded-lg border border-border bg-card p-4">
                            <div className="flex h-40 items-end gap-0.5" role="img" aria-label="Tickets created and resolved per day">
                                {a.volume.map((v) => (
                                    <Tooltip key={v.date}>
                                        <TooltipTrigger asChild>
                                            <div className="flex h-full min-w-0 flex-1 items-end gap-px">
                                                <div className="flex-1 rounded-t-sm bg-chart-1" style={{ height: `${(v.created / max) * 100}%` }} />
                                                <div className="flex-1 rounded-t-sm bg-chart-2" style={{ height: `${(v.resolved / max) * 100}%` }} />
                                            </div>
                                        </TooltipTrigger>
                                        <TooltipContent>{v.date}: {v.created} created · {v.resolved} resolved</TooltipContent>
                                    </Tooltip>
                                ))}
                            </div>
                            <div className="mt-3 flex gap-4 text-xs text-muted-foreground">
                                <span className="flex items-center gap-1.5"><span className="size-2 rounded-sm bg-chart-1" /> Created</span>
                                <span className="flex items-center gap-1.5"><span className="size-2 rounded-sm bg-chart-2" /> Resolved</span>
                            </div>
                        </div>
                    </Section>

                    <div className="grid gap-6 lg:grid-cols-2">
                        <Section title="SLA by metric">
                            <div className="space-y-3 rounded-lg border border-border bg-card p-4">
                                {a.sla.by_metric.map((m) => (
                                    <Bar key={m.metric} label={getDropdownOptionLabel(SlaMetricOptions, m.metric)} value={m.compliance ?? 0} display={m.compliance === null ? "—" : `${m.compliance}%`} hint={`${m.met} met · ${m.breached} breached`} />
                                ))}
                            </div>
                        </Section>
                        <Section title="Open backlog by priority">
                            <div className="space-y-3 rounded-lg border border-border bg-card p-4">
                                {a.backlog_by_priority.length ? a.backlog_by_priority.map((b) => {
                                    const total = a.totals.open_backlog || 1;
                                    return <Bar key={b.priority} label={getDropdownOptionLabel(TicketPriorityFormOptions, b.priority)} value={(b.count / total) * 100} display={String(b.count)} />;
                                }) : <p className="text-[13px] text-muted-foreground">No open tickets.</p>}
                            </div>
                        </Section>
                        <Section title="Where tickets come from">
                            <div className="space-y-3 rounded-lg border border-border bg-card p-4">
                                {a.by_source.length ? a.by_source.map((s) => <Bar key={s.key} label={getDropdownOptionLabel(TicketSourceOptions, s.key)} value={(s.count / (a.totals.tickets_created || 1)) * 100} display={String(s.count)} />) : <p className="text-[13px] text-muted-foreground">No tickets in this period.</p>}
                            </div>
                        </Section>
                        <Section title="Categories">
                            <div className="space-y-3 rounded-lg border border-border bg-card p-4">
                                {a.by_category.length ? a.by_category.map((s) => <Bar key={s.key} label={s.key === "NONE" ? "Uncategorized" : s.key} value={(s.count / (a.totals.tickets_created || 1)) * 100} display={String(s.count)} />) : <p className="text-[13px] text-muted-foreground">No tickets in this period.</p>}
                            </div>
                        </Section>
                    </div>

                    {canCsat && csat.data && (
                        <Section title="Customer satisfaction" description={csat.data.enabled ? `${csat.data.responses} of ${csat.data.requested} surveys answered` : "CSAT surveys are switched off in Support settings."}>
                            <div className="space-y-3 rounded-lg border border-border bg-card p-4">
                                {csat.data.distribution.slice().reverse().map((d) => <Bar key={d.rating} label={`${d.rating} ★`} value={(d.count / (csat.data?.responses || 1)) * 100} display={String(d.count)} />)}
                            </div>
                        </Section>
                    )}

                    {a.agents.length > 0 && (
                        <Section title="Agents">
                            <div className="overflow-x-auto rounded-lg border border-border bg-card">
                                <table className="w-full text-[13px]">
                                    <thead><tr className="border-b border-border text-xs text-muted-foreground"><th className="p-3 text-left font-medium">Agent</th><th className="p-3 text-right font-medium">Assigned</th><th className="p-3 text-right font-medium">Resolved</th><th className="hidden p-3 text-right font-medium sm:table-cell">Median first response</th></tr></thead>
                                    <tbody>
                                        {a.agents.map((g, i) => (
                                            <tr key={g.agent?.id ?? i} className="border-b border-border-soft last:border-0">
                                                <td className="p-3"><MemberAvatar person={g.agent?.user} showName size="xs" /></td>
                                                <td className="p-3 text-right tabular">{g.assigned}</td>
                                                <td className="p-3 text-right tabular">{g.resolved}</td>
                                                <td className="hidden p-3 text-right tabular sm:table-cell">{g.median_first_response_minutes !== null ? formatMinutes(g.median_first_response_minutes) : "—"}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </Section>
                    )}
                </div>
            )}
        </Page>
    );
}

function Bar({ label, value, display, hint }: { label: string; value: number; display: string; hint?: string }) {
    return (
        <div>
            <div className="mb-1 flex justify-between gap-2 text-[13px]"><span className="text-foreground">{label}</span><span className="tabular text-muted-foreground">{display}{hint ? ` · ${hint}` : ""}</span></div>
            <div className="h-2 overflow-hidden rounded-full bg-secondary"><div className="h-full rounded-full bg-chart-1" style={{ width: `${Math.min(100, Math.max(0, value))}%` }} /></div>
        </div>
    );
}
