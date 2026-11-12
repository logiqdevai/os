import type { ReactNode } from "react";
import { useSearchParams } from "react-router-dom";
import { Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { BarChart3, Download } from "lucide-react";
import { Page, PageHeader } from "@/components/ui/page";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatCard, StatGrid } from "@/components/ui/stat-card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EmptyState, ErrorState, ListSkeleton } from "@/components/ui/states";
import { Can } from "@/components/access/can";
import { toast } from "@/hooks/use-toast";
import { getApiErrorMessage } from "@/lib/api-error";
import { formatDate, formatMoney, formatNumber, formatPercent } from "@/lib/format";
import { getDropdownOptionLabel } from "@/lib/dropdown-option-label.utils";
import { ActivityTypeFormOptions } from "@/config/constants/dropdowns/crm/activity-form.options";
import { OwnerFilterOptions } from "@/config/constants/dropdowns/crm/crm-filter.options";
import { useCrmReport, useExportReport } from "@/features/crm/reports/hooks/use-reports";
import { usePipelines } from "@/features/crm/pipelines/hooks/use-pipelines";
import type { ReportKey, ReportParams } from "@/features/crm/reports/interfaces/reports.interfaces";
import { MemberChip, Money, Panel } from "../../components/crm-ui";

const TABS: { id: ReportKey; label: string }[] = [
    { id: "pipeline", label: "Pipeline" },
    { id: "win-loss", label: "Win / loss" },
    { id: "conversion", label: "Lead conversion" },
    { id: "activity", label: "Activity" },
];
const AXIS = { fill: "var(--muted-foreground)", fontSize: 11 };
const monthLabel = (m: string) => formatDate(`${m}-01`, "MMM yy");

function Tip({ active, payload, label, fmt, labelFmt }: { active?: boolean; payload?: { name: string; value: number; color: string }[]; label?: string; fmt?: (v: number) => string; labelFmt?: (l: string) => string }) {
    if (!active || !payload?.length) return null;
    return (
        <div className="rounded-md border border-border bg-popover px-3 py-2 text-xs shadow-pop">
            <div className="mb-1 font-medium text-foreground">{labelFmt ? labelFmt(String(label)) : label}</div>
            {payload.map((p) => (
                <div key={p.name} className="flex items-center justify-between gap-4">
                    <span className="flex items-center gap-1.5 text-muted-foreground"><span className="size-2 rounded-full" style={{ background: p.color }} />{p.name}</span>
                    <span className="tabular text-foreground">{fmt ? fmt(p.value) : formatNumber(p.value)}</span>
                </div>
            ))}
        </div>
    );
}

function Chart({ height = 240, children }: { height?: number; children: ReactNode }) {
    return <div style={{ height }} className="w-full min-w-0"><ResponsiveContainer width="100%" height="100%">{children as React.ReactElement}</ResponsiveContainer></div>;
}

/**
 * CRM reports (mockup `reports`, 02 §32–33).
 * @route /crm/reports?tab=pipeline|win-loss|conversion|activity&from=&to=&pipeline_id=&owner=
 * @perm VIEW crm.dashboards.read · money crm.financials.read · export crm.records.export (sensitive, audited)
 * @api GET /crm/reports/:report · GET /crm/reports/:report/export
 * @mcp crm_reports_read
 * @states loading · empty ("No data for this period") · error · amounts hidden without the financials permission
 */
export default function CrmReportsPage() {
    const [sp, setSp] = useSearchParams();
    const tab = (TABS.find((t) => t.id === sp.get("tab"))?.id ?? "pipeline") as ReportKey;
    const pipelines = usePipelines();
    const exp = useExportReport();
    const params: ReportParams = {
        from: sp.get("from") ?? undefined,
        to: sp.get("to") ?? undefined,
        pipeline_id: sp.get("pipeline_id") ?? undefined,
        owner: sp.get("owner") ?? undefined,
    };
    const set = (k: string, v: string | null) => setSp((prev) => { const n = new URLSearchParams(prev); if (v && v !== "all") n.set(k, v); else n.delete(k); return n; }, { replace: true });

    return (
        <Page width="wide">
            <PageHeader
                title="Reports"
                description="Pipeline, win / loss, lead conversion and activity. Every number is computed on the server for the records you can see."
                actions={
                    <Can permission="crm.records.export">
                        <Button variant="outline" loading={exp.isPending} onClick={() => exp.mutate({ key: tab, params }, { onSuccess: () => toast({ title: "Report exported", description: "The export was logged." }), onError: (e) => toast({ variant: "destructive", title: "Could not export", description: getApiErrorMessage(e) }) })}>
                            <Download /> <span className="hidden sm:inline">Export CSV</span>
                        </Button>
                    </Can>
                }
            />
            <div className="mb-4 flex flex-col gap-2 lg:flex-row lg:items-center">
                <div className="-mx-4 overflow-x-auto px-4 md:mx-0 md:px-0">
                    <Tabs value={tab} onValueChange={(t) => set("tab", t)}>
                        <TabsList>{TABS.map((t) => <TabsTrigger key={t.id} value={t.id}>{t.label}</TabsTrigger>)}</TabsList>
                    </Tabs>
                </div>
                <div className="flex flex-wrap items-center gap-2 lg:ml-auto">
                    {tab !== "pipeline" && (
                        <>
                            <Input type="date" className="h-8 w-[9.5rem]" aria-label="From" value={params.from ?? ""} onChange={(e) => set("from", e.target.value || null)} />
                            <span className="text-xs text-muted-foreground">to</span>
                            <Input type="date" className="h-8 w-[9.5rem]" aria-label="To" value={params.to ?? ""} onChange={(e) => set("to", e.target.value || null)} />
                        </>
                    )}
                    {(tab === "pipeline" || tab === "win-loss") && (pipelines.data?.length ?? 0) > 1 && (
                        <Select value={params.pipeline_id ?? "all"} onValueChange={(v) => set("pipeline_id", v)}>
                            <SelectTrigger className="h-8 w-40" aria-label="Pipeline"><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">{tab === "pipeline" ? "Default pipeline" : "All pipelines"}</SelectItem>
                                {pipelines.data?.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    )}
                    <Select value={params.owner ?? "all"} onValueChange={(v) => set("owner", v)}>
                        <SelectTrigger className="h-8 w-36" aria-label="Owner"><SelectValue /></SelectTrigger>
                        <SelectContent>{OwnerFilterOptions.filter((o) => o.id !== "unassigned").map((o) => <SelectItem key={o.id} value={o.id}>{o.id === "all" ? "Whole team" : "Only mine"}</SelectItem>)}</SelectContent>
                    </Select>
                </div>
            </div>
            {tab === "pipeline" && <PipelineTab params={params} />}
            {tab === "win-loss" && <WinLossTab params={params} />}
            {tab === "conversion" && <ConversionTab params={params} />}
            {tab === "activity" && <ActivityTab params={params} />}
        </Page>
    );
}

function State({ q, empty, children }: { q: { isPending: boolean; error: unknown; refetch: () => unknown }; empty: boolean; children: ReactNode }) {
    if (q.isPending) return <ListSkeleton />;
    if (q.error) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
    if (empty) return <EmptyState icon={BarChart3} title="No data for this period" description="Try a longer date range or another owner." />;
    return <>{children}</>;
}

function OwnerTable({ head, rows }: { head: string[]; rows: { key: string; owner: ReactNode; cells: ReactNode[] }[] }) {
    return (
        <div className="overflow-x-auto">
            <Table>
                <TableHeader><TableRow className="hover:bg-transparent"><TableHead className="text-xs">Owner</TableHead>{head.map((h) => <TableHead key={h} className="text-right text-xs">{h}</TableHead>)}</TableRow></TableHeader>
                <TableBody>{rows.map((r) => <TableRow key={r.key} className="border-border-soft"><TableCell className="py-2 text-[13px]">{r.owner}</TableCell>{r.cells.map((c, i) => <TableCell key={i} className="py-2 text-right text-[13px] tabular">{c}</TableCell>)}</TableRow>)}</TableBody>
            </Table>
        </div>
    );
}

function PipelineTab({ params }: { params: ReportParams }) {
    const q = useCrmReport("pipeline", { pipeline_id: params.pipeline_id, owner: params.owner });
    const d = q.data;
    const cur = d?.currency ?? "EUR";
    const money = !d?.financials_hidden;
    const fmt = (v: number) => (money ? formatMoney(v, cur, { compact: true }) : formatNumber(v));
    return (
        <State q={q} empty={!!d && d.totals.count === 0}>
            {d && (
                <div className="space-y-4">
                    <StatGrid>
                        <StatCard label="Open deals" value={formatNumber(d.totals.count)} />
                        <StatCard label="Pipeline value" value={<Money value={d.totals.value} currency={cur} compact />} />
                        <StatCard label="Weighted value" tone="info" value={<Money value={d.totals.weighted} currency={cur} compact />} hint="value × probability" />
                        <StatCard label="Overdue close dates" tone="warning" value={formatNumber(d.by_owner.reduce((n, o) => n + o.overdue, 0))} />
                    </StatGrid>
                    <Panel title={`${d.pipeline.name} · by stage${money ? "" : " (deal count)"}`}>
                        <Chart height={260}>
                            <BarChart data={d.by_stage.map((s) => ({ stage: s.stage, Value: money ? s.value ?? 0 : s.count, Weighted: money ? s.weighted ?? 0 : undefined }))} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                                <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
                                <XAxis dataKey="stage" tick={AXIS} axisLine={{ stroke: "var(--border)" }} tickLine={false} interval={0} angle={-20} textAnchor="end" height={50} />
                                <YAxis tickFormatter={fmt} tick={AXIS} axisLine={false} tickLine={false} width={60} />
                                <Tooltip cursor={{ fill: "var(--border-soft)" }} content={<Tip fmt={fmt} />} />
                                <Legend wrapperStyle={{ fontSize: 12, color: "var(--muted-foreground)" }} iconType="circle" iconSize={8} />
                                <Bar dataKey="Value" name={money ? "Value" : "Deals"} fill="var(--chart-1)" radius={[3, 3, 0, 0]} maxBarSize={32} />
                                {money && <Bar dataKey="Weighted" fill="var(--chart-2)" radius={[3, 3, 0, 0]} maxBarSize={32} />}
                            </BarChart>
                        </Chart>
                    </Panel>
                    <Panel title="By owner" bodyClassName="p-0">
                        <OwnerTable head={["Deals", "Overdue", "Value", "Weighted"]} rows={d.by_owner.map((o) => ({ key: o.owner_membership_id ?? "none", owner: <MemberChip member={o.owner} />, cells: [o.count, o.overdue || "—", <Money key="v" value={o.value} currency={cur} compact />, <Money key="w" value={o.weighted} currency={cur} compact />] }))} />
                    </Panel>
                </div>
            )}
        </State>
    );
}

function WinLossTab({ params }: { params: ReportParams }) {
    const q = useCrmReport("win-loss", params);
    const d = q.data;
    const cur = d?.currency ?? "EUR";
    return (
        <State q={q} empty={!!d && d.totals.won + d.totals.lost === 0}>
            {d && (
                <div className="space-y-4">
                    <StatGrid>
                        <StatCard label="Win rate" value={formatPercent(d.totals.win_rate)} hint={`${d.totals.won} won · ${d.totals.lost} lost`} />
                        <StatCard label="Won value" tone="success" value={<Money value={d.totals.won_value} currency={cur} compact />} />
                        <StatCard label="Average won deal" value={<Money value={d.totals.avg_won_value} currency={cur} compact />} />
                        <StatCard label="Sales cycle" value={d.totals.avg_sales_cycle_days === null ? "—" : `${d.totals.avg_sales_cycle_days} days`} hint="created → won" />
                    </StatGrid>
                    <div className="grid gap-4 lg:grid-cols-2">
                        <Panel title="Won and lost per month">
                            <Chart>
                                <BarChart data={d.by_month.map((m) => ({ month: m.month, Won: m.won, Lost: m.lost }))} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                                    <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
                                    <XAxis dataKey="month" tickFormatter={monthLabel} tick={AXIS} axisLine={{ stroke: "var(--border)" }} tickLine={false} />
                                    <YAxis allowDecimals={false} tick={AXIS} axisLine={false} tickLine={false} width={32} />
                                    <Tooltip cursor={{ fill: "var(--border-soft)" }} content={<Tip labelFmt={monthLabel} />} />
                                    <Legend wrapperStyle={{ fontSize: 12, color: "var(--muted-foreground)" }} iconType="circle" iconSize={8} />
                                    <Bar dataKey="Won" fill="var(--success)" radius={[3, 3, 0, 0]} maxBarSize={24} />
                                    <Bar dataKey="Lost" fill="var(--danger)" radius={[3, 3, 0, 0]} maxBarSize={24} />
                                </BarChart>
                            </Chart>
                        </Panel>
                        <Panel title="Why deals were lost">
                            {!d.lost_reasons.length ? <p className="text-[13px] text-muted-foreground">No lost deals in this period.</p> : (
                                <Chart height={Math.max(160, d.lost_reasons.length * 34)}>
                                    <BarChart layout="vertical" data={d.lost_reasons.map((r) => ({ reason: r.reason, Deals: r.count }))} margin={{ top: 0, right: 16, left: 0, bottom: 0 }}>
                                        <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" horizontal={false} />
                                        <XAxis type="number" allowDecimals={false} tick={AXIS} axisLine={false} tickLine={false} />
                                        <YAxis type="category" dataKey="reason" tick={AXIS} axisLine={false} tickLine={false} width={130} />
                                        <Tooltip cursor={{ fill: "var(--border-soft)" }} content={<Tip />} />
                                        <Bar dataKey="Deals" fill="var(--chart-3)" radius={[0, 3, 3, 0]} maxBarSize={20} />
                                    </BarChart>
                                </Chart>
                            )}
                        </Panel>
                    </div>
                    <Panel title="By owner" bodyClassName="p-0">
                        <OwnerTable head={["Won", "Lost", "Win rate", "Won value"]} rows={d.by_owner.map((o) => ({ key: o.owner_membership_id ?? "none", owner: <MemberChip member={o.owner} />, cells: [o.won, o.lost, formatPercent(o.win_rate), <Money key="v" value={o.won_value} currency={cur} compact />] }))} />
                    </Panel>
                </div>
            )}
        </State>
    );
}

function ConversionTab({ params }: { params: ReportParams }) {
    const q = useCrmReport("conversion", { from: params.from, to: params.to, owner: params.owner });
    const d = q.data;
    const top = d?.funnel[0]?.count ?? 0;
    return (
        <State q={q} empty={!!d && d.totals.created === 0}>
            {d && (
                <div className="space-y-4">
                    <StatGrid>
                        <StatCard label="Leads created" value={formatNumber(d.totals.created)} hint={`${d.totals.open} still open`} />
                        <StatCard label="Conversion rate" tone="success" value={formatPercent(d.totals.conversion_rate)} hint={`${d.totals.converted} converted`} />
                        <StatCard label="Lost" tone="danger" value={formatNumber(d.totals.lost)} />
                        <StatCard label="Days to convert" value={d.totals.avg_days_to_convert === null ? "—" : formatNumber(d.totals.avg_days_to_convert)} hint="average" />
                    </StatGrid>
                    <div className="grid gap-4 lg:grid-cols-2">
                        <Panel title="Funnel">
                            <ul className="space-y-2.5">
                                {d.funnel.map((f, i) => (
                                    <li key={f.step} className="text-[13px]">
                                        <div className="mb-1 flex justify-between"><span className="text-foreground">{f.step}</span><span className="tabular text-muted-foreground">{formatNumber(f.count)}{i > 0 && top ? ` · ${Math.round((f.count / top) * 100)}%` : ""}</span></div>
                                        <div className="h-2 overflow-hidden rounded-full bg-secondary"><div className="h-full rounded-full" style={{ width: `${top ? (f.count / top) * 100 : 0}%`, background: `var(--chart-${(i % 5) + 1})` }} /></div>
                                    </li>
                                ))}
                            </ul>
                        </Panel>
                        <Panel title="Created and converted per month">
                            <Chart>
                                <LineChart data={d.by_month.map((m) => ({ month: m.month, Created: m.created, Converted: m.converted }))} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                                    <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
                                    <XAxis dataKey="month" tickFormatter={monthLabel} tick={AXIS} axisLine={{ stroke: "var(--border)" }} tickLine={false} />
                                    <YAxis allowDecimals={false} tick={AXIS} axisLine={false} tickLine={false} width={32} />
                                    <Tooltip content={<Tip labelFmt={monthLabel} />} />
                                    <Legend wrapperStyle={{ fontSize: 12, color: "var(--muted-foreground)" }} iconType="circle" iconSize={8} />
                                    <Line dataKey="Created" stroke="var(--chart-1)" strokeWidth={2} dot={false} type="monotone" />
                                    <Line dataKey="Converted" stroke="var(--success)" strokeWidth={2} dot={false} type="monotone" />
                                </LineChart>
                            </Chart>
                        </Panel>
                    </div>
                    <Panel title="By source" bodyClassName="p-0">
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader><TableRow className="hover:bg-transparent">{["Source", "Created", "Converted", "Lost", "Deal won", "Conversion"].map((h, i) => <TableHead key={h} className={i ? "text-right text-xs" : "text-xs"}>{h}</TableHead>)}</TableRow></TableHeader>
                                <TableBody>
                                    {d.by_source.map((s) => (
                                        <TableRow key={s.source} className="border-border-soft">
                                            <TableCell className="py-2 text-[13px] text-foreground">{s.source}</TableCell>
                                            {[s.created, s.converted, s.lost, s.won, formatPercent(s.conversion_rate)].map((v, i) => <TableCell key={i} className="py-2 text-right text-[13px] tabular">{v}</TableCell>)}
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    </Panel>
                </div>
            )}
        </State>
    );
}

function ActivityTab({ params }: { params: ReportParams }) {
    const q = useCrmReport("activity", { from: params.from, to: params.to, owner: params.owner });
    const d = q.data;
    const types = d?.by_type.map((t) => t.type) ?? [];
    return (
        <State q={q} empty={!!d && d.totals.completed === 0 && d.totals.overdue === 0 && d.totals.upcoming === 0}>
            {d && (
                <div className="space-y-4">
                    <StatGrid>
                        <StatCard label="Completed" tone="success" value={formatNumber(d.totals.completed)} />
                        <StatCard label="Overdue" tone="danger" value={formatNumber(d.totals.overdue)} hint="planned, past due" />
                        <StatCard label="Upcoming" tone="info" value={formatNumber(d.totals.upcoming)} />
                        <StatCard label="Most common" value={d.by_type[0] ? getDropdownOptionLabel(ActivityTypeFormOptions, d.by_type[0].type) : "—"} />
                    </StatGrid>
                    <div className="grid gap-4 lg:grid-cols-2">
                        <Panel title="Completed per week">
                            <Chart>
                                <BarChart data={d.by_week.map((w) => ({ week: w.week, Completed: w.completed }))} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                                    <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
                                    <XAxis dataKey="week" tickFormatter={(w) => formatDate(w, "d MMM")} tick={AXIS} axisLine={{ stroke: "var(--border)" }} tickLine={false} minTickGap={16} />
                                    <YAxis allowDecimals={false} tick={AXIS} axisLine={false} tickLine={false} width={32} />
                                    <Tooltip cursor={{ fill: "var(--border-soft)" }} content={<Tip labelFmt={(w) => `Week of ${formatDate(w)}`} />} />
                                    <Bar dataKey="Completed" fill="var(--chart-1)" radius={[3, 3, 0, 0]} maxBarSize={24} />
                                </BarChart>
                            </Chart>
                        </Panel>
                        <Panel title="By type">
                            {!d.by_type.length ? <p className="text-[13px] text-muted-foreground">No completed activities.</p> : (
                                <Chart height={Math.max(160, d.by_type.length * 34)}>
                                    <BarChart layout="vertical" data={d.by_type.map((t) => ({ type: getDropdownOptionLabel(ActivityTypeFormOptions, t.type), Count: t.count }))} margin={{ top: 0, right: 16, left: 0, bottom: 0 }}>
                                        <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" horizontal={false} />
                                        <XAxis type="number" allowDecimals={false} tick={AXIS} axisLine={false} tickLine={false} />
                                        <YAxis type="category" dataKey="type" tick={AXIS} axisLine={false} tickLine={false} width={100} />
                                        <Tooltip cursor={{ fill: "var(--border-soft)" }} content={<Tip />} />
                                        <Bar dataKey="Count" radius={[0, 3, 3, 0]} maxBarSize={20}>
                                            {d.by_type.map((t, i) => <Cell key={t.type} fill={`var(--chart-${(i % 5) + 1})`} />)}
                                        </Bar>
                                    </BarChart>
                                </Chart>
                            )}
                        </Panel>
                    </div>
                    <Panel title="By owner" bodyClassName="p-0">
                        <OwnerTable head={[...types.map((t) => getDropdownOptionLabel(ActivityTypeFormOptions, t)), "Total"]} rows={d.by_owner.map((o) => ({ key: o.owner_membership_id ?? "none", owner: <MemberChip member={o.owner} />, cells: [...types.map((t) => o.counts[t] ?? 0), <span key="t" className="font-medium">{o.total}</span>] }))} />
                    </Panel>
                </div>
            )}
        </State>
    );
}
