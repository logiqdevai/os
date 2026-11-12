import type { ReactElement, ReactNode } from "react";
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ChartColumn } from "lucide-react";
import { Page, PageHeader, Section } from "@/components/ui/page";
import { StatCard, StatGrid } from "@/components/ui/stat-card";
import { EmptyState, ErrorState, ListSkeleton } from "@/components/ui/states";
import { MemberAvatar } from "@/components/ui/member-avatar";
import { ProgressBar } from "@/components/ui/progress-bar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TableToolbar } from "@/components/ui/data-table";
import { useListParams } from "@/hooks/use-list-params";
import { useCycles, useTaskReport, useWorkflows } from "@/features/tasks/hooks/use-tasks";
import { TaskPriorityFormOptions, TaskReportRangeOptions } from "@/config/constants/dropdowns/tasks/task-form.options";
import { getDropdownOptionLabel } from "@/lib/dropdown-option-label.utils";
import { formatDate, formatNumber } from "@/lib/format";
import { ProjectPicker } from "../../components/task-pickers";

const TOOLTIP = { background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12, color: "var(--popover-foreground)" };
const TICK = { fontSize: 11, fill: "var(--muted-foreground)" };
const days = (n: number | null) => (n === null ? "—" : `${formatNumber(n, 1)} d`);

/** Monday `weeks - 1` weeks before this week, as YYYY-MM-DD (matches the API's Monday buckets). */
const rangeStart = (weeks: number) => {
    const now = new Date();
    const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
    const monday = today - (((new Date(today).getUTCDay() + 6) % 7) * 86_400_000);
    return new Date(monday - (weeks - 1) * 7 * 86_400_000).toISOString().slice(0, 10);
};

/**
 * /tasks/reports?range=8&team_id=&project_id=&cycle_id= — how work flows (06 §11). Every number is limited to the tasks the
 * caller can see and computed from TaskStatusHistory / task dates.
 * @perm VIEW tasks.tasks.read (scope-limited)
 * @api GET /tasks/reports · GET /cycles (burn-up picker) · MCP tasks_reports_read
 * @states loading · empty (no tasks in range) · error · no-access (route gate)
 */
export default function TaskReportsPage() {
    const { filters, setFilter } = useListParams();
    const weeks = Number(filters.range ?? 8);
    const teamId = filters.team_id ?? null;
    const workflows = useWorkflows();
    const cycles = useCycles({ team_id: teamId ?? undefined, limit: 30 });
    const report = useTaskReport({ from: rangeStart(weeks), team_id: teamId ?? undefined, project_id: filters.project_id || undefined, cycle_id: filters.cycle_id || undefined });
    const teams = (workflows.data ?? []).map((w) => w.team).filter((t): t is NonNullable<typeof t> => !!t);

    return (
        <Page>
            <PageHeader title="Reports" description="Throughput, cycle time and where work piles up. Only tasks you can see are counted." />
            <TableToolbar>
                <Select value={String(weeks)} onValueChange={(v) => setFilter("range", v === "8" ? null : v)}>
                    <SelectTrigger className="h-8 w-36" aria-label="Range"><SelectValue /></SelectTrigger>
                    <SelectContent>{TaskReportRangeOptions.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent>
                </Select>
                <Select value={teamId ?? "all"} onValueChange={(v) => { setFilter("cycle_id", null); setFilter("team_id", v); }}>
                    <SelectTrigger className="h-8 w-36" aria-label="Team"><SelectValue /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All teams</SelectItem>
                        {teams.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                    </SelectContent>
                </Select>
                <div className="w-full sm:w-48">
                    <ProjectPicker value={filters.project_id ?? null} currentName={filters.project_name} onChange={(v) => setFilter("project_id", v)} />
                </div>
            </TableToolbar>

            {report.isPending ? <ListSkeleton rows={8} /> : report.error ? <ErrorState error={report.error} onRetry={() => report.refetch()} /> : (() => {
                const r = report.data;
                const t = r.totals;
                const weekly = r.weekly.map((w) => ({ week: formatDate(w.week_start, "d MMM"), Created: w.created, Completed: w.completed, "Cycle time": w.median_cycle_days, "Lead time": w.median_lead_days }));
                const priority = r.by_priority.filter((p) => p.completed || p.open).map((p) => ({ name: getDropdownOptionLabel(TaskPriorityFormOptions, p.priority), Completed: p.completed, Open: p.open }));
                const maxAssignee = Math.max(1, ...r.by_assignee.map((a) => a.completed + a.open));
                const maxLabel = Math.max(1, ...r.by_label.map((l) => l.completed + l.open));
                if (!t.created && !t.completed && !t.open) {
                    return <div className="rounded-lg border border-border bg-card"><EmptyState icon={ChartColumn} title="No tasks in this range" description="Pick a longer range or another team or project." /></div>;
                }
                return (
                    <div className="space-y-8">
                        {r.truncated && <p className="text-xs text-warning">Large result: the first 10,000 tasks are counted. Narrow the range or filter by team.</p>}
                        <StatGrid>
                            <StatCard label="Completed" value={formatNumber(t.completed)} hint={`${formatNumber(t.throughput_per_week, 1)} per week`} />
                            <StatCard label="Created" value={formatNumber(t.created)} hint={t.created > t.completed ? "More in than out" : "Keeping up"} tone={t.created > t.completed * 1.2 ? "warning" : "default"} />
                            <StatCard label="Lead time" value={days(t.median_lead_days)} hint="median, created → done" />
                            <StatCard label="Cycle time" value={days(t.median_cycle_days)} hint="median, started → done" />
                            <StatCard label="Overdue" value={formatNumber(t.overdue)} hint={`of ${formatNumber(t.open)} open`} tone={t.overdue ? "danger" : "default"} />
                            <StatCard label="Blocked" value={formatNumber(t.blocked)} hint="open now" tone={t.blocked ? "warning" : "default"} />
                        </StatGrid>

                        <div className="grid gap-6 lg:grid-cols-2">
                            <ChartCard title="Created vs completed" description="Tasks per week. Throughput is the completed bar.">
                                <BarChart data={weekly} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
                                    <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
                                    <XAxis dataKey="week" tick={TICK} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                                    <YAxis allowDecimals={false} tick={TICK} tickLine={false} axisLine={false} />
                                    <Tooltip contentStyle={TOOLTIP} cursor={{ fill: "var(--border-soft)" }} />
                                    <Legend wrapperStyle={{ fontSize: 12 }} />
                                    <Bar dataKey="Created" fill="var(--chart-4)" radius={[3, 3, 0, 0]} />
                                    <Bar dataKey="Completed" fill="var(--chart-1)" radius={[3, 3, 0, 0]} />
                                </BarChart>
                            </ChartCard>
                            <ChartCard title="Cycle and lead time" description="Median days per week of completion.">
                                <LineChart data={weekly} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
                                    <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
                                    <XAxis dataKey="week" tick={TICK} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                                    <YAxis tick={TICK} tickLine={false} axisLine={false} />
                                    <Tooltip contentStyle={TOOLTIP} formatter={(v) => (typeof v === "number" ? `${formatNumber(v, 1)} d` : "—")} />
                                    <Legend wrapperStyle={{ fontSize: 12 }} />
                                    <Line type="monotone" dataKey="Lead time" stroke="var(--chart-3)" strokeWidth={2} dot={false} connectNulls />
                                    <Line type="monotone" dataKey="Cycle time" stroke="var(--chart-2)" strokeWidth={2} dot={false} connectNulls />
                                </LineChart>
                            </ChartCard>
                        </div>

                        <Section
                            title="Cycle burn-up"
                            description={r.burnup ? `${r.burnup.cycle.name ?? `Cycle ${r.burnup.cycle.number}`} · ${formatDate(r.burnup.cycle.starts_at)} – ${formatDate(r.burnup.cycle.ends_at)}` : "Scope against completed work, day by day."}
                            actions={
                                <Select value={filters.cycle_id ?? r.burnup?.cycle.id ?? "none"} onValueChange={(v) => setFilter("cycle_id", v === "none" ? null : v)}>
                                    <SelectTrigger className="h-8 w-48" aria-label="Cycle"><SelectValue placeholder="Choose a cycle" /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="none">{teamId ? "Active cycle" : "Choose a cycle"}</SelectItem>
                                        {(cycles.data?.data ?? []).map((c) => <SelectItem key={c.id} value={c.id}>{c.name ?? `Cycle ${c.number}`}{c.team ? ` · ${c.team.name}` : ""}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            }
                        >
                            {r.burnup?.days.length ? (
                                <div className="h-64 rounded-lg border border-border bg-card p-3">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <LineChart data={r.burnup.days.map((d) => ({ day: formatDate(d.date, "d MMM"), Scope: d.scope, Completed: d.completed }))} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
                                            <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
                                            <XAxis dataKey="day" tick={TICK} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                                            <YAxis allowDecimals={false} tick={TICK} tickLine={false} axisLine={false} />
                                            <Tooltip contentStyle={TOOLTIP} />
                                            <Legend wrapperStyle={{ fontSize: 12 }} />
                                            <Line type="stepAfter" dataKey="Scope" stroke="var(--ash)" strokeDasharray="4 4" dot={false} />
                                            <Line type="monotone" dataKey="Completed" stroke="var(--chart-1)" strokeWidth={2} dot={false} />
                                        </LineChart>
                                    </ResponsiveContainer>
                                </div>
                            ) : (
                                <div className="rounded-lg border border-border bg-card"><EmptyState compact icon={ChartColumn} title="No cycle selected" description="Pick a cycle, or a team with an active cycle." /></div>
                            )}
                        </Section>

                        <div className="grid gap-6 lg:grid-cols-3">
                            <BreakdownCard title="By assignee" empty="No assigned work">
                                {r.by_assignee.map((a, i) => (
                                    <BreakdownRow key={a.membership?.id ?? `none-${i}`} label={<MemberAvatar person={a.membership?.user} size="xs" showName emptyLabel="Unassigned" />} completed={a.completed} open={a.open} max={maxAssignee} extra={a.median_cycle_days !== null ? `${days(a.median_cycle_days)} cycle` : undefined} />
                                ))}
                            </BreakdownCard>
                            <BreakdownCard title="By label" empty="No labelled tasks">
                                {r.by_label.map((l) => <BreakdownRow key={l.label.id} label={<span className="truncate text-[13px] text-foreground">{l.label.name}</span>} completed={l.completed} open={l.open} max={maxLabel} />)}
                            </BreakdownCard>
                            <ChartCard title="By priority" description="Completed in range and open now." height="h-56">
                                <BarChart data={priority} layout="vertical" margin={{ top: 0, right: 8, bottom: 0, left: 8 }}>
                                    <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" horizontal={false} />
                                    <XAxis type="number" allowDecimals={false} tick={TICK} tickLine={false} axisLine={false} />
                                    <YAxis type="category" dataKey="name" width={70} tick={TICK} tickLine={false} axisLine={false} />
                                    <Tooltip contentStyle={TOOLTIP} cursor={{ fill: "var(--border-soft)" }} />
                                    <Legend wrapperStyle={{ fontSize: 12 }} />
                                    <Bar dataKey="Completed" stackId="p" fill="var(--chart-1)" />
                                    <Bar dataKey="Open" stackId="p" fill="var(--chart-4)" radius={[0, 3, 3, 0]} />
                                </BarChart>
                            </ChartCard>
                        </div>
                    </div>
                );
            })()}
        </Page>
    );
}

function ChartCard({ title, description, children, height = "h-64" }: { title: string; description?: string; children: ReactElement; height?: string }) {
    return (
        <Section title={title} description={description}>
            <div className={`${height} rounded-lg border border-border bg-card p-3`}>
                <ResponsiveContainer width="100%" height="100%">{children}</ResponsiveContainer>
            </div>
        </Section>
    );
}

function BreakdownCard({ title, empty, children }: { title: string; empty: string; children: ReactNode[] }) {
    return (
        <Section title={title} description="Completed in range · open now">
            <div className="rounded-lg border border-border bg-card">
                {children.length ? <ul className="divide-y divide-border-soft">{children}</ul> : <p className="p-4 text-[13px] text-muted-foreground">{empty}</p>}
            </div>
        </Section>
    );
}

function BreakdownRow({ label, completed, open, max, extra }: { label: ReactNode; completed: number; open: number; max: number; extra?: string }) {
    return (
        <li className="space-y-1.5 px-3 py-2.5">
            <div className="flex items-center gap-2">
                <div className="min-w-0 flex-1">{label}</div>
                <span className="tabular text-xs text-muted-foreground">{completed} done · {open} open</span>
            </div>
            <div className="flex items-center gap-2">
                <ProgressBar value={((completed + open) / max) * 100} tone="success" className="flex-1" />
                {extra && <span className="whitespace-nowrap text-[11px] text-muted-foreground">{extra}</span>}
            </div>
        </li>
    );
}
