import { endOfMonth, format, parseISO, startOfMonth } from "date-fns";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { BarChart3, Download } from "lucide-react";
import { Page, PageHeader } from "@/components/ui/page";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatCard, StatGrid } from "@/components/ui/stat-card";
import { Progress } from "@/components/ui/progress";
import { EmptyState, ErrorState, ListSkeleton } from "@/components/ui/states";
import { Can } from "@/components/access/can";
import { useListParams } from "@/hooks/use-list-params";
import { usePermissions } from "@/hooks/use-permission";
import { useDownloadTimeCsv, useSummaryReport, useUtilizationReport } from "@/features/time/reports/hooks/use-reports";
import type { ReportFilters, ReportGroupBy } from "@/features/time/reports/interfaces/reports.interfaces";
import { NonBillableCategoryFormOptions, ReportGroupByOptions, TimeScopeOptions } from "@/config/constants/dropdowns/time/time-form.options";
import { getDropdownOptionLabel } from "@/lib/dropdown-option-label.utils";
import { formatMinutes, formatMoney, formatPercent, personName } from "@/lib/format";
import { toast } from "@/hooks/use-toast";
import { getApiErrorMessage } from "@/lib/api-error";
import { Panel } from "@/pages/people/components/person";

/** Chart colors are theme tokens (light + dark defined in index.css). Billable = info, non-billable = recessive ash. */
const BILLABLE = "var(--info)";
const NON_BILLABLE = "var(--ash)";
const hours = (m: number) => Math.round((m / 60) * 10) / 10;

function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: { name: string; value: number; color: string }[]; label?: string }) {
    if (!active || !payload?.length) return null;
    return (
        <div className="rounded-md border border-border bg-popover px-3 py-2 text-xs shadow-md">
            <div className="mb-1 font-medium text-foreground">{label}</div>
            {payload.map((p) => <div key={p.name} className="flex items-center gap-2 text-muted-foreground"><span className="size-2 rounded-full" style={{ background: p.color }} />{p.name}<span className="ml-auto tabular text-foreground">{p.value}h</span></div>)}
        </div>
    );
}

/**
 * /time/reports — hours by project/customer/person/activity, billable split per day, utilization. Amounts need time.rates.read.
 * @perm time.reports.read · export time.entries.export · @api GET /time/reports/summary|utilization · GET /time/reports/export
 */
export default function TimeReportsPage() {
    const p = usePermissions();
    const { filters, setFilter } = useListParams();
    const scopes = TimeScopeOptions.filter((s) => p.can(`time.entries.read_${s.id === "mine" ? "own" : s.id}`));
    const f: ReportFilters = {
        from: filters.from ?? format(startOfMonth(new Date()), "yyyy-MM-dd"),
        to: filters.to ?? format(endOfMonth(new Date()), "yyyy-MM-dd"),
        group_by: (filters.group_by as ReportGroupBy) ?? "project",
        scope: filters.scope ?? scopes[scopes.length - 1]?.id,
    };
    const summary = useSummaryReport(f);
    const utilization = useUtilizationReport(f, f.scope !== "mine");
    const download = useDownloadTimeCsv();
    const s = summary.data;
    const currency = s?.currency ?? "EUR";
    const byDay = s?.by_day.map((d) => ({ day: format(parseISO(d.date), "d MMM"), Billable: hours(d.billable_minutes), "Non-billable": hours(d.non_billable_minutes) })) ?? [];
    const groups = s?.groups.slice(0, 12).map((g) => ({ name: g.label, Hours: hours(g.total_minutes) })) ?? [];

    return (
        <Page>
            <PageHeader
                title="Time reports"
                actions={<Can permission="time.entries.export"><Button variant="outline" loading={download.isPending} onClick={() => download.mutate(f, { onSuccess: (r) => toast({ title: "Export ready", description: r.rows ? `${r.rows} rows` : undefined }), onError: (e) => toast({ variant: "destructive", title: "Export failed", description: getApiErrorMessage(e) }) })}><Download /> Export CSV</Button></Can>}
            />
            <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
                <Input type="date" value={f.from} onChange={(e) => setFilter("from", e.target.value)} className="h-8 w-full sm:w-40" aria-label="From" />
                <Input type="date" value={f.to} onChange={(e) => setFilter("to", e.target.value)} className="h-8 w-full sm:w-40" aria-label="To" />
                <Select value={f.group_by} onValueChange={(v) => setFilter("group_by", v)}>
                    <SelectTrigger className="h-8 w-full sm:w-40" aria-label="Group by"><SelectValue /></SelectTrigger>
                    <SelectContent>{ReportGroupByOptions.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent>
                </Select>
                {scopes.length > 1 && (
                    <Select value={f.scope} onValueChange={(v) => setFilter("scope", v)}>
                        <SelectTrigger className="h-8 w-full sm:w-32" aria-label="Scope"><SelectValue /></SelectTrigger>
                        <SelectContent>{scopes.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent>
                    </Select>
                )}
            </div>
            {summary.isLoading ? <ListSkeleton /> : summary.error ? <ErrorState error={summary.error} onRetry={() => summary.refetch()} /> : !s?.totals.entries ? (
                <EmptyState icon={BarChart3} title="No time in this range" description="Pick another period or scope." />
            ) : (
                <div className="space-y-4">
                    <StatGrid>
                        <StatCard label="Logged" value={formatMinutes(s.totals.total_minutes)} hint={`${s.totals.entries} entries`} />
                        <StatCard label="Billable" value={formatMinutes(s.totals.billable_minutes)} tone="info" hint={s.totals.billable_ratio !== null ? `${formatPercent(s.totals.billable_ratio)} of logged` : undefined} />
                        <StatCard label="Non-billable" value={formatMinutes(s.totals.non_billable_minutes)} />
                        {s.totals.billable_amount !== undefined ? <StatCard label="Billable value" value={formatMoney(s.totals.billable_amount, currency, { compact: true })} tone="success" hint={s.totals.cost_amount !== undefined ? `Cost ${formatMoney(s.totals.cost_amount, currency, { compact: true })}` : undefined} /> : <StatCard label="Utilization" value={utilization.data?.totals.utilization_percent != null ? formatPercent(utilization.data.totals.utilization_percent) : "—"} />}
                    </StatGrid>
                    <div className="grid gap-4 xl:grid-cols-2">
                        <Panel title="Billable vs non-billable per day">
                            <div className="mb-2 flex gap-4 text-xs text-muted-foreground" aria-hidden>
                                <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-xs bg-info" /> Billable</span>
                                <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-xs bg-ash" /> Non-billable</span>
                            </div>
                            <div className="h-64" role="img" aria-label="Hours per day, billable and non-billable">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={byDay} margin={{ top: 4, right: 4, bottom: 0, left: -20 }} barCategoryGap={4}>
                                        <CartesianGrid vertical={false} stroke="var(--border)" />
                                        <XAxis dataKey="day" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} tickLine={false} axisLine={false} minTickGap={12} />
                                        <YAxis tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} tickLine={false} axisLine={false} />
                                        <Tooltip content={<ChartTooltip />} cursor={{ fill: "var(--secondary)" }} />
                                        <Bar dataKey="Billable" stackId="h" fill={BILLABLE} stroke="var(--card)" strokeWidth={1} />
                                        <Bar dataKey="Non-billable" stackId="h" fill={NON_BILLABLE} radius={[4, 4, 0, 0]} stroke="var(--card)" strokeWidth={1} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </Panel>
                        <Panel title={`Hours ${getDropdownOptionLabel(ReportGroupByOptions, f.group_by).toLowerCase()}`}>
                            <div className="h-64" role="img" aria-label="Hours per group">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={groups} layout="vertical" margin={{ top: 0, right: 12, bottom: 0, left: 0 }} barCategoryGap={6}>
                                        <CartesianGrid horizontal={false} stroke="var(--border)" />
                                        <XAxis type="number" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} tickLine={false} axisLine={false} />
                                        <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} tickLine={false} axisLine={false} />
                                        <Tooltip content={<ChartTooltip />} cursor={{ fill: "var(--secondary)" }} />
                                        <Bar dataKey="Hours" fill={BILLABLE} radius={[0, 4, 4, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </Panel>
                    </div>
                    <Panel title="Breakdown">
                        <div className="overflow-x-auto">
                            <table className="w-full text-[13px]">
                                <thead><tr className="border-b border-border text-xs text-muted-foreground"><th className="py-2 text-left font-medium">Group</th><th className="py-2 text-right font-medium">Total</th><th className="hidden py-2 text-right font-medium sm:table-cell">Billable</th><th className="hidden py-2 text-right font-medium md:table-cell">Entries</th>{s.totals.billable_amount !== undefined && <th className="hidden py-2 text-right font-medium md:table-cell">Value</th>}</tr></thead>
                                <tbody>
                                    {s.groups.map((g) => (
                                        <tr key={g.key} className="border-b border-border last:border-0">
                                            <td className="py-2"><div className="truncate text-foreground">{g.label}</div>{g.sublabel && <div className="truncate text-xs text-muted-foreground">{g.sublabel}</div>}</td>
                                            <td className="py-2 text-right tabular text-foreground">{formatMinutes(g.total_minutes)}</td>
                                            <td className="hidden py-2 text-right tabular sm:table-cell">{formatMinutes(g.billable_minutes)}</td>
                                            <td className="hidden py-2 text-right tabular md:table-cell">{g.entries}</td>
                                            {s.totals.billable_amount !== undefined && <td className="hidden py-2 text-right tabular md:table-cell">{formatMoney(g.billable_amount ?? 0, currency)}</td>}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        {!!s.non_billable_by_category.length && (
                            <div className="mt-4 flex flex-wrap gap-2 text-xs text-muted-foreground">Non-billable: {s.non_billable_by_category.map((c) => <span key={c.category} className="rounded-xs border border-border px-1.5">{getDropdownOptionLabel(NonBillableCategoryFormOptions, c.category)} {formatMinutes(c.minutes)}</span>)}</div>
                        )}
                    </Panel>
                    {f.scope !== "mine" && utilization.data && (
                        <Panel title={`Utilization${utilization.data.target_percent !== null ? ` · target ${formatPercent(utilization.data.target_percent)}` : ""}`}>
                            <ul className="space-y-3">
                                {utilization.data.rows.map((r) => (
                                    <li key={r.membership.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 sm:grid-cols-[12rem_minmax(0,1fr)_8rem]">
                                        <span className="truncate text-[13px] text-foreground">{personName(r.membership.user)}</span>
                                        <span className="text-right text-xs tabular text-muted-foreground sm:order-3">{formatMinutes(r.logged_minutes)} / {formatMinutes(r.expected_minutes)}</span>
                                        <div className="col-span-2 flex items-center gap-2 sm:order-2 sm:col-span-1"><Progress value={Math.min(100, r.utilization_percent ?? 0)} className="h-1.5" /><span className="w-12 shrink-0 text-right text-xs tabular text-foreground">{formatPercent(r.utilization_percent)}</span></div>
                                    </li>
                                ))}
                            </ul>
                        </Panel>
                    )}
                </div>
            )}
        </Page>
    );
}
