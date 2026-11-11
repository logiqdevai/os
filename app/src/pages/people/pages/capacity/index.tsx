import { useSearchParams } from "react-router-dom";
import { addWeeks, format, parseISO, startOfWeek } from "date-fns";
import { ChevronLeft, ChevronRight, Layers } from "lucide-react";
import { Page, PageHeader } from "@/components/ui/page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatCard, StatGrid } from "@/components/ui/stat-card";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { EmptyState, ErrorState, ListSkeleton } from "@/components/ui/states";
import { useCapacity } from "@/features/people/overview/hooks/use-overview";
import type { CapacityPeriod } from "@/features/people/overview/interfaces/overview.interfaces";
import { CapacityStatusFilterOptions, CapacityStatusOptions, CapacityStatusTone } from "@/config/constants/dropdowns/people/leave-form.options";
import { getDropdownOptionLabel } from "@/lib/dropdown-option-label.utils";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import { PersonCell } from "../../components/person";
import { PeoplePaths } from "../../paths";

const CELL: Record<CapacityPeriod["status"], string> = {
    UNDERUTILIZED: "border-info/30 bg-info-soft",
    BALANCED: "border-success/30 bg-success-soft",
    OVERLOADED: "border-danger/30 bg-danger-soft",
};

/**
 * /people/capacity — weekly capacity: available (schedule − holidays − leave), planned (05 allocations), logged (18).
 * @perm employees.capacity.read (scope) · @api GET /people/capacity?from&weeks&status
 */
export default function CapacityPage() {
    const [sp, setSp] = useSearchParams();
    const from = sp.get("from") ?? format(startOfWeek(new Date(), { weekStartsOn: 1 }), "yyyy-MM-dd");
    const status = sp.get("status") ?? "all";
    const q = useCapacity({ from, weeks: 4, ...(status !== "all" && { status }) });
    const set = (k: string, v: string | null) => setSp((prev) => { const n = new URLSearchParams(prev); if (v) n.set(k, v); else n.delete(k); return n; });
    const shift = (w: number) => set("from", format(addWeeks(parseISO(from), w), "yyyy-MM-dd"));

    return (
        <Page>
            <PageHeader
                title="Capacity"
                description="Available hours against planned project work and logged time, per week."
                actions={
                    <div className="flex flex-wrap items-center gap-2">
                        <Select value={status} onValueChange={(v) => set("status", v === "all" ? null : v)}>
                            <SelectTrigger className="h-8 w-40" aria-label="Filter by status"><SelectValue /></SelectTrigger>
                            <SelectContent>{CapacityStatusFilterOptions.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent>
                        </Select>
                        <Button variant="outline" size="icon" aria-label="Previous weeks" onClick={() => shift(-4)}><ChevronLeft /></Button>
                        <Button variant="outline" size="icon" aria-label="Next weeks" onClick={() => shift(4)}><ChevronRight /></Button>
                    </div>
                }
            />
            {q.isLoading ? <ListSkeleton /> : q.error ? <ErrorState error={q.error} onRetry={() => q.refetch()} /> : !q.data?.rows.length ? (
                <EmptyState icon={Layers} title="No capacity to show" description="Employees with an HR record in your scope appear here." />
            ) : (
                <div className="space-y-4">
                    <StatGrid>
                        <StatCard label="Available hours" value={formatNumber(q.data.totals.available_hours)} />
                        <StatCard label="Planned hours" value={formatNumber(q.data.totals.planned_hours)} tone="info" hint={q.data.totals.available_hours ? `${formatNumber((q.data.totals.planned_hours / q.data.totals.available_hours) * 100)}% allocated` : undefined} />
                        <StatCard label="Logged hours" value={formatNumber(q.data.totals.logged_hours)} tone="success" />
                        <StatCard label="Overloaded weeks" value={q.data.rows.reduce((s, r) => s + r.periods.filter((x) => x.status === "OVERLOADED").length, 0)} tone="danger" />
                    </StatGrid>
                    <div className="overflow-hidden rounded-lg border border-border bg-card">
                        <div className="overflow-x-auto">
                            <table className="w-full min-w-[640px] text-[13px]">
                                <thead>
                                    <tr className="border-b border-border text-xs text-muted-foreground">
                                        <th className="sticky left-0 z-10 bg-card px-4 py-2 text-left font-medium">Employee</th>
                                        {q.data.rows[0].periods.map((p) => <th key={p.period_start} className="px-2 py-2 text-left font-medium">Week of {format(parseISO(p.period_start), "d MMM")}</th>)}
                                    </tr>
                                </thead>
                                <tbody>
                                    {q.data.rows.map((r) => (
                                        <tr key={r.employee.id} className="border-b border-border last:border-0">
                                            <td className="sticky left-0 z-10 bg-card px-4 py-2"><PersonCell name={r.employee.name} photoUrl={r.employee.photo_url} subtitle={r.employee.job_title} to={PeoplePaths.employee(r.employee.id)} /></td>
                                            {r.periods.map((p) => (
                                                <td key={p.period_start} className="px-2 py-2">
                                                    <Tooltip>
                                                        <TooltipTrigger asChild>
                                                            <div className={cn("rounded-md border px-2 py-1.5", CELL[p.status])}>
                                                                <div className="flex items-center justify-between gap-2">
                                                                    <span className="tabular font-medium text-foreground">{formatNumber(p.allocation_percent)}%</span>
                                                                    <Badge variant={CapacityStatusTone[p.status]} className="hidden xl:inline-flex">{getDropdownOptionLabel(CapacityStatusOptions, p.status)}</Badge>
                                                                </div>
                                                                <div className="text-[11px] text-muted-foreground tabular">{formatNumber(p.planned_hours, 1)} / {formatNumber(p.available_hours, 1)}h · {formatNumber(p.logged_hours, 1)}h logged</div>
                                                            </div>
                                                        </TooltipTrigger>
                                                        <TooltipContent className="max-w-xs">
                                                            <div>Scheduled {formatNumber(p.scheduled_hours, 1)}h − holidays {formatNumber(p.holiday_hours, 1)}h − leave {formatNumber(p.leave_hours, 1)}h</div>
                                                            {p.breakdown.projects.map((pr) => <div key={pr.project_id}>{pr.name}: {formatNumber(pr.hours, 1)}h</div>)}
                                                        </TooltipContent>
                                                    </Tooltip>
                                                </td>
                                            ))}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                    <p className="text-xs text-muted-foreground">Overloaded above {q.data.thresholds.overload}% allocation, underutilized below {q.data.thresholds.underutilized}%. Planned hours come from project allocations, logged hours from Time.</p>
                </div>
            )}
        </Page>
    );
}
