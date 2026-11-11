import { useNavigate, useSearchParams } from "react-router-dom";
import { addDays, format, parseISO, startOfWeek } from "date-fns";
import { ChevronLeft, ChevronRight, Users } from "lucide-react";
import { Page, PageHeader } from "@/components/ui/page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { StatCard, StatGrid } from "@/components/ui/stat-card";
import { EmptyState, ErrorState, ListSkeleton } from "@/components/ui/states";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { useTeamWeek } from "@/features/time/timesheets/hooks/use-timesheets";
import type { TeamWeekRow } from "@/features/time/timesheets/interfaces/timesheets.interfaces";
import { TimesheetStatusFormOptions, TimesheetStatusTone } from "@/config/constants/dropdowns/time/time-form.options";
import { getDropdownOptionLabel } from "@/lib/dropdown-option-label.utils";
import { formatMinutes, personName } from "@/lib/format";
import { TimePaths } from "../../paths";

/**
 * /time/team — every member's timesheet for a week (members without a row show "Not started").
 * @perm time.entries.read_team or read_all · @api GET /time/timesheets/team?period_start
 */
export default function TeamTimesheetsPage() {
    const navigate = useNavigate();
    const [sp, setSp] = useSearchParams();
    const start = sp.get("start") ?? format(startOfWeek(new Date(), { weekStartsOn: 1 }), "yyyy-MM-dd");
    const q = useTeamWeek({ period_start: start });
    const go = (n: number) => setSp(new URLSearchParams({ start: format(addDays(parseISO(q.data?.period_start ?? start), n * 7), "yyyy-MM-dd") }));

    const columns: DataTableColumn<TeamWeekRow>[] = [
        { key: "member", header: "Person", cell: (r) => <div className="min-w-0"><div className="truncate font-medium text-foreground">{personName(r.membership.user)}</div><div className="truncate text-xs text-muted-foreground">{r.membership.job_title}</div></div> },
        {
            key: "hours", header: "Logged", cell: (r) => (
                <div className="flex min-w-32 items-center gap-2">
                    <Progress value={r.expected_minutes ? Math.min(100, (r.total_minutes / r.expected_minutes) * 100) : 0} className="h-1.5" />
                    <span className="shrink-0 text-xs tabular text-muted-foreground">{formatMinutes(r.total_minutes)} / {formatMinutes(r.expected_minutes)}</span>
                </div>
            ),
        },
        { key: "billable", header: "Billable", cell: (r) => <span className="tabular">{formatMinutes(r.billable_minutes)}</span>, hideBelow: "md", className: "text-right", headerClassName: "text-right" },
        { key: "status", header: "Status", cell: (r) => <Badge variant={TimesheetStatusTone[r.status]}>{getDropdownOptionLabel(TimesheetStatusFormOptions, r.status)}</Badge> },
    ];

    return (
        <Page>
            <PageHeader
                title="Team timesheets"
                description={q.data ? `${format(parseISO(q.data.period_start), "d MMM")} – ${format(parseISO(q.data.period_end), "d MMM yyyy")}` : undefined}
                actions={
                    <div className="flex items-center gap-1">
                        <Button variant="outline" size="icon" aria-label="Previous week" onClick={() => go(-1)}><ChevronLeft /></Button>
                        <Button variant="outline" onClick={() => setSp(new URLSearchParams())}>This week</Button>
                        <Button variant="outline" size="icon" aria-label="Next week" onClick={() => go(1)}><ChevronRight /></Button>
                    </div>
                }
            />
            {q.isLoading ? <ListSkeleton /> : q.error ? <ErrorState error={q.error} onRetry={() => q.refetch()} /> : !q.data?.rows.length ? (
                <EmptyState icon={Users} title="No timesheets for this period" description="Members of the teams you lead appear here." />
            ) : (
                <div className="space-y-4">
                    <StatGrid>
                        <StatCard label="Not started" value={q.data.counts.NOT_STARTED ?? 0} />
                        <StatCard label="Open" value={q.data.counts.OPEN ?? 0} />
                        <StatCard label="Submitted" value={q.data.counts.SUBMITTED ?? 0} tone="info" />
                        <StatCard label="Approved" value={(q.data.counts.APPROVED ?? 0) + (q.data.counts.LOCKED ?? 0)} tone="success" />
                    </StatGrid>
                    <DataTable columns={columns} data={q.data.rows} rowKey={(r) => r.membership.id} onRowClick={(r) => r.timesheet && navigate(TimePaths.timesheet(r.timesheet.id))} />
                </div>
            )}
        </Page>
    );
}
