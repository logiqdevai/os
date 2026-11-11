import { useState } from "react";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ChartColumn } from "lucide-react";
import { Page, PageHeader, Section } from "@/components/ui/page";
import { StatCard, StatGrid } from "@/components/ui/stat-card";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDate, formatMoney, formatNumber } from "@/lib/format";
import { getDropdownOptionLabel } from "@/lib/dropdown-option-label.utils";
import { ProposalLostReasonFormOptions } from "@/config/constants/dropdowns/proposals/proposal-content.options";
import { ProposalStatusFormOptions } from "@/config/constants/dropdowns/proposals/proposal-status.options";
import { useProposalAnalytics } from "@/features/proposals/hooks/use-proposals";
import { MemberChip } from "../../components/proposal-badges";

const RANGES = [
    { id: "3", label: "Last 3 months" },
    { id: "6", label: "Last 6 months" },
    { id: "12", label: "Last 12 months" },
];
const tooltipStyle = { background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12, color: "var(--popover-foreground)" };

/**
 * /proposals/analytics — funnel, win rate, values, monthly trend, owners and lost reasons.
 * @perm proposals.analytics.read · @api GET /proposals/analytics?from=&to=
 */
export default function ProposalAnalyticsPage() {
    const [months, setMonths] = useState("12");
    const to = new Date();
    const from = new Date(Date.UTC(to.getUTCFullYear(), to.getUTCMonth() - (Number(months) - 1), 1));
    const q = useProposalAnalytics({ from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) });
    const a = q.data;
    const currency = a?.currencies.length === 1 ? a.currencies[0] : "EUR";

    return (
        <Page>
            <PageHeader
                title="Proposal analytics"
                description="How proposals convert: what is sent, viewed, accepted and lost."
                actions={
                    <Select value={months} onValueChange={setMonths}>
                        <SelectTrigger className="h-8 w-40" aria-label="Period"><SelectValue /></SelectTrigger>
                        <SelectContent>{RANGES.map((r) => <SelectItem key={r.id} value={r.id}>{r.label}</SelectItem>)}</SelectContent>
                    </Select>
                }
            />
            {q.isPending ? (
                <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-[86px]" />)}</div>
                    <Skeleton className="h-72" />
                </div>
            ) : q.error ? (
                <ErrorState error={q.error} onRetry={() => q.refetch()} />
            ) : !a || (a.created === 0 && a.sent === 0 && a.accepted === 0) ? (
                <EmptyState icon={ChartColumn} title="No proposal activity in this period" description="Analytics fill in once proposals are created and sent." />
            ) : (
                <div className="space-y-6">
                    {a.currencies.length > 1 && <p className="rounded-md bg-warning-soft px-3 py-2 text-[13px] text-warning">Values mix currencies ({a.currencies.join(", ")}) and are summed without conversion.</p>}
                    <StatGrid>
                        <StatCard label="Sent" value={formatNumber(a.sent)} hint={a.viewed_rate === null ? `${a.created} created` : `${a.viewed_rate}% opened`} />
                        <StatCard label="Win rate" value={a.win_rate === null ? "—" : `${a.win_rate}%`} hint={`${a.accepted} won · ${a.lost} lost`} tone="success" />
                        <StatCard label="Accepted value" value={formatMoney(a.accepted_value, currency, { compact: true })} hint={a.avg_accepted_value === null ? undefined : `avg ${formatMoney(a.avg_accepted_value, currency, { compact: true })}`} />
                        <StatCard label="Time to accept" value={a.avg_days_to_accept === null ? "—" : `${Math.round(a.avg_days_to_accept)} days`} hint="from send to acceptance" />
                    </StatGrid>

                    <Section title="Monthly trend" description={`${formatDate(a.range.from)} – ${formatDate(a.range.to)}`}>
                        <div className="h-72 rounded-lg border border-border bg-card p-3">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={a.months.map((m) => ({ ...m, label: formatDate(`${m.month}-01`, "MMM yy") }))} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                                    <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
                                    <XAxis dataKey="label" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} tickLine={false} axisLine={false} />
                                    <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} tickLine={false} axisLine={false} width={40} />
                                    <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "var(--accent)" }} />
                                    <Legend wrapperStyle={{ fontSize: 12 }} />
                                    <Bar dataKey="created" name="Created" fill="var(--chart-3)" radius={[3, 3, 0, 0]} />
                                    <Bar dataKey="sent" name="Sent" fill="var(--chart-1)" radius={[3, 3, 0, 0]} />
                                    <Bar dataKey="accepted" name="Accepted" fill="var(--chart-2)" radius={[3, 3, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </Section>

                    <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
                        <Section title="By owner">
                            <div className="overflow-x-auto rounded-lg border border-border bg-card">
                                <Table>
                                    <TableHeader>
                                        <TableRow className="hover:bg-transparent">
                                            <TableHead className="text-xs">Owner</TableHead>
                                            <TableHead className="text-right text-xs">Sent</TableHead>
                                            <TableHead className="text-right text-xs">Won</TableHead>
                                            <TableHead className="hidden text-right text-xs sm:table-cell">Win rate</TableHead>
                                            <TableHead className="text-right text-xs">Value won</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {a.by_owner.map((o, i) => (
                                            <TableRow key={o.owner?.id ?? i}>
                                                <TableCell className="py-2"><MemberChip member={o.owner} /></TableCell>
                                                <TableCell className="text-right tabular">{o.sent}</TableCell>
                                                <TableCell className="text-right tabular">{o.accepted}</TableCell>
                                                <TableCell className="hidden text-right tabular sm:table-cell">{o.win_rate === null ? "—" : `${o.win_rate}%`}</TableCell>
                                                <TableCell className="text-right tabular">{formatMoney(o.accepted_value, currency, { compact: true })}</TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        </Section>
                        <div className="space-y-6">
                            <Section title="Created by status">
                                <ul className="divide-y divide-border rounded-lg border border-border bg-card">
                                    {Object.entries(a.by_status).map(([k, n]) => (
                                        <li key={k} className="flex justify-between px-3 py-1.5 text-[13px]"><span className="text-muted-foreground">{getDropdownOptionLabel(ProposalStatusFormOptions, k)}</span><span className="tabular text-foreground">{n}</span></li>
                                    ))}
                                </ul>
                            </Section>
                            <Section title="Lost reasons">
                                {Object.keys(a.lost_reasons).length === 0 ? (
                                    <p className="text-[13px] text-muted-foreground">No lost proposals.</p>
                                ) : (
                                    <ul className="divide-y divide-border rounded-lg border border-border bg-card">
                                        {Object.entries(a.lost_reasons).map(([k, n]) => (
                                            <li key={k} className="flex justify-between px-3 py-1.5 text-[13px]"><span className="text-muted-foreground">{k === "UNSPECIFIED" ? "Not recorded" : getDropdownOptionLabel(ProposalLostReasonFormOptions, k)}</span><span className="tabular text-foreground">{n}</span></li>
                                        ))}
                                    </ul>
                                )}
                            </Section>
                        </div>
                    </div>
                </div>
            )}
        </Page>
    );
}
