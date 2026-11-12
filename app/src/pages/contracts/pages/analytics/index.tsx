import { useState } from "react";
import { Link } from "react-router-dom";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AlarmClock, ChartColumn, Lock, RefreshCcw, Timer } from "lucide-react";
import { Page, PageHeader, Section } from "@/components/ui/page";
import { StatCard, StatGrid } from "@/components/ui/stat-card";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { ProgressBar } from "@/components/ui/progress-bar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { usePageMetadata } from "@/hooks/use-page-metadata";
import { formatDate, formatMoney, formatNumber } from "@/lib/format";
import { getDropdownOptionLabel } from "@/lib/dropdown-option-label.utils";
import { ContractStatusFormOptions } from "@/config/constants/dropdowns/contracts/contract-status.options";
import { ContractAnalyticsPeriodOptions, ContractCycleStageOptions, ContractRiskLevelOptions } from "@/config/constants/dropdowns/contracts/contract-analytics.options";
import { useContractAnalytics } from "@/features/contracts/hooks/use-contracts";
import type { ContractAnalytics } from "@/features/contracts/interfaces/contracts.interfaces";
import { ContractStatusBadge } from "../../components/contract-badges";

const tooltipStyle = { background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12, color: "var(--popover-foreground)" };
const daysLabel = (d: number | null) => (d === null ? "—" : `${formatNumber(d, 1)} days`);
const RISK_TONE: Record<string, "success" | "warning" | "danger" | "default"> = { LOW: "success", MEDIUM: "warning", HIGH: "danger", CRITICAL: "danger" };

/**
 * /contracts/analytics — speed, value, risk and renewals across agreements (04 §65–66, §52).
 * @perm contracts.contracts.read (scoped) · values need contracts.confidential_terms.read (otherwise counts only)
 * @api GET /contracts/analytics?from=&to=
 * @states loading · empty · error · no-access (route gate) · values restricted
 */
export default function ContractAnalyticsPage() {
    usePageMetadata({ title: "Contract analytics" });
    const [period, setPeriod] = useState("365");
    const to = new Date();
    const from = new Date(to.getTime() - (Number(period) - 1) * 86_400_000);
    const q = useContractAnalytics({ from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) });
    const a = q.data;
    const total = a?.by_status.reduce((s, x) => s + x.count, 0) ?? 0;

    return (
        <Page>
            <PageHeader
                title="Contract analytics"
                description="Speed, value, risk and renewals across your agreements."
                actions={
                    <Select value={period} onValueChange={setPeriod}>
                        <SelectTrigger className="h-8 w-40" aria-label="Period"><SelectValue /></SelectTrigger>
                        <SelectContent>{ContractAnalyticsPeriodOptions.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent>
                    </Select>
                }
            />
            {q.isPending ? (
                <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-[86px]" />)}</div>
                    <div className="grid gap-4 lg:grid-cols-2"><Skeleton className="h-72" /><Skeleton className="h-72" /></div>
                </div>
            ) : q.error ? (
                <ErrorState error={q.error} onRetry={() => q.refetch()} />
            ) : !a || total === 0 ? (
                <EmptyState icon={ChartColumn} title="No contracts to analyse yet" description="Analytics fill in once contracts are drafted, approved and signed." />
            ) : (
                <div className="space-y-6">
                    {!a.values_visible && (
                        <p className="flex items-center gap-2 rounded-md bg-info-soft px-3 py-2 text-[13px] text-info"><Lock className="size-4 shrink-0" /> Contract values are hidden: they need the confidential terms permission. Counts are shown instead.</p>
                    )}
                    <StatGrid>
                        <StatCard label="Draft to signed" value={daysLabel(a.kpis.cycle_time_days)} hint={`median · ${a.kpis.signed_in_range} signed`} icon={Timer} />
                        <StatCard label="Signature turnaround" value={daysLabel(a.kpis.signature_turnaround_days)} hint={`approval ${daysLabel(a.kpis.approval_time_days)}`} />
                        <StatCard label="Renewal rate" value={a.kpis.renewal_rate === null ? "—" : `${a.kpis.renewal_rate}%`} hint={`${a.kpis.renewed} of ${a.kpis.due_for_renewal} ended`} icon={RefreshCcw} tone="success" />
                        <StatCard label="Overdue obligations" value={a.kpis.overdue_obligations} hint={a.values_visible && a.kpis.active_value !== null ? `active value ${formatMoney(a.kpis.active_value, "EUR", { compact: true })}` : `${a.kpis.active_count} active contracts`} icon={AlarmClock} tone={a.kpis.overdue_obligations ? "danger" : "default"} />
                    </StatGrid>

                    <div className="grid gap-4 lg:grid-cols-2">
                        <Section title="Signed per month" description={`${formatDate(`${a.signed_per_month[0]?.month}-01`, "MMM yyyy")} – ${formatDate(a.range.to, "MMM yyyy")}`}>
                            <div className="h-64 rounded-lg border border-border bg-card p-3">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={a.signed_per_month.map((m) => ({ ...m, label: formatDate(`${m.month}-01`, "MMM") }))} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                                        <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
                                        <XAxis dataKey="label" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} tickLine={false} axisLine={false} />
                                        <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} tickLine={false} axisLine={false} width={40} />
                                        <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "var(--accent)" }} />
                                        <Bar dataKey="signed" name="Signed" fill="var(--chart-2)" radius={[3, 3, 0, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </Section>
                        <Section title="Cycle time by stage" description="Median days per stage for contracts signed in the period.">
                            <BarList rows={a.cycle_by_stage.map((s) => ({ key: s.stage, label: getDropdownOptionLabel(ContractCycleStageOptions, s.stage), value: s.days ?? 0, display: daysLabel(s.days) }))} />
                        </Section>
                    </div>

                    <div className="grid gap-4 lg:grid-cols-2">
                        <Section title="By status" description={a.values_visible ? "Count and contract value" : "Count"}>
                            <ValueTable rows={a.by_status.map((s) => ({ key: s.status, label: <ContractStatusBadge status={s.status} />, count: s.count, value: s.value }))} showValue={a.values_visible} />
                        </Section>
                        <Section title="By type" description="Contracts in flight or live">
                            <ValueTable rows={a.by_type.map((t) => ({ key: t.type_id ?? "none", label: t.type, count: t.count, value: t.value }))} showValue={a.values_visible} />
                        </Section>
                    </div>

                    <div className="grid gap-4 lg:grid-cols-2">
                        <Section title="Renewals pipeline" description="Live contracts by renewal or end date.">
                            <BarList rows={a.renewals_pipeline.map((b) => ({ key: b.key, label: b.label, value: b.count, display: a.values_visible && b.value !== null ? `${b.count} · ${formatMoney(b.value, "EUR", { compact: true })}` : String(b.count) }))} />
                        </Section>
                        <Section title="Risk distribution" description="Live contracts by risk level.">
                            {a.risk.length ? (
                                <BarList rows={a.risk.map((r) => ({ key: r.level ?? "none", label: getDropdownOptionLabel(ContractRiskLevelOptions, r.level ?? "none"), value: r.count, display: String(r.count), tone: RISK_TONE[r.level ?? ""] }))} />
                            ) : <EmptyState compact title="No live contracts" />}
                        </Section>
                    </div>

                    <Section title="Slowest in flight" description="Open contracts with the longest time since their last change.">
                        <SlowestTable rows={a.slowest_in_flight} />
                    </Section>
                </div>
            )}
        </Page>
    );
}

function BarList({ rows }: { rows: { key: string; label: string; value: number; display: string; tone?: "success" | "warning" | "danger" | "default" }[] }) {
    const max = Math.max(1, ...rows.map((r) => r.value));
    return (
        <ul className="space-y-2.5 rounded-lg border border-border bg-card p-3">
            {rows.map((r) => (
                <li key={r.key} className="grid grid-cols-[minmax(0,9rem)_minmax(0,1fr)_auto] items-center gap-3 text-[13px]">
                    <span className="truncate text-foreground">{r.label}</span>
                    <ProgressBar value={r.value ? Math.max(3, (r.value / max) * 100) : 0} tone={r.tone ?? "default"} />
                    <span className="tabular text-muted-foreground">{r.display}</span>
                </li>
            ))}
        </ul>
    );
}

function ValueTable({ rows, showValue }: { rows: { key: string; label: React.ReactNode; count: number; value: number | null }[]; showValue: boolean }) {
    if (!rows.length) return <EmptyState compact title="Nothing to show" />;
    return (
        <div className="overflow-hidden rounded-lg border border-border bg-card">
            <Table>
                <TableHeader><TableRow><TableHead>Group</TableHead><TableHead className="text-right">Count</TableHead>{showValue && <TableHead className="text-right">Value</TableHead>}</TableRow></TableHeader>
                <TableBody>
                    {rows.map((r) => (
                        <TableRow key={r.key}>
                            <TableCell className="max-w-48 truncate">{r.label}</TableCell>
                            <TableCell className="text-right tabular">{r.count}</TableCell>
                            {showValue && <TableCell className="text-right tabular">{formatMoney(r.value ?? 0, "EUR", { compact: true })}</TableCell>}
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
    );
}

function SlowestTable({ rows }: { rows: ContractAnalytics["slowest_in_flight"] }) {
    if (!rows.length) return <EmptyState compact title="Nothing in flight" description="Every contract is signed or closed." />;
    return (
        <div className="overflow-hidden rounded-lg border border-border bg-card">
            <Table>
                <TableHeader>
                    <TableRow><TableHead>Contract</TableHead><TableHead className="hidden sm:table-cell">Stage</TableHead><TableHead className="text-right">Days</TableHead></TableRow>
                </TableHeader>
                <TableBody>
                    {rows.map((c) => (
                        <TableRow key={c.id}>
                            <TableCell className="min-w-0">
                                <Link to={`/contracts/${c.id}`} className="block truncate text-foreground hover:underline">{c.title}</Link>
                                <span className="font-mono text-xs text-muted-foreground">{c.number}{c.company ? ` · ${c.company}` : ""}</span>
                                <span className="block sm:hidden text-xs text-muted-foreground">{getDropdownOptionLabel(ContractStatusFormOptions, c.status)}</span>
                            </TableCell>
                            <TableCell className="hidden sm:table-cell"><ContractStatusBadge status={c.status} /></TableCell>
                            <TableCell className="text-right tabular">{c.days_in_stage}</TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
    );
}
