import { Link } from "react-router-dom";
import { Users } from "lucide-react";
import { Page, PageHeader } from "@/components/ui/page";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { MemberAvatar } from "@/components/ui/member-avatar";
import { Badge } from "@/components/ui/badge";
import { StatCard, StatGrid } from "@/components/ui/stat-card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useListParams } from "@/hooks/use-list-params";
import { useTaskWorkload, useWorkflows } from "@/features/tasks/hooks/use-tasks";
import type { TaskWorkload } from "@/features/tasks/interfaces/tasks.interfaces";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";

type Row = TaskWorkload["people"][number];
const FLAG_LABEL: Record<string, string> = { overdue: "Overdue work", blocked: "Blocked", overloaded: "Overloaded" };

/**
 * /tasks/workload?team_id= — open task distribution per person (06 §10). Capacity lives in People / Time.
 * @perm VIEW tasks.workload.read · @api GET /tasks/workload
 */
export default function TaskWorkloadPage() {
    const { filters, setFilter } = useListParams();
    const workflows = useWorkflows();
    const workload = useTaskWorkload({ team_id: filters.team_id });
    const teams = (workflows.data ?? []).filter((w) => w.team).map((w) => w.team!);
    const columns: DataTableColumn<Row>[] = [
        { key: "who", header: "Person", cell: (r) => <MemberAvatar person={r.membership?.user} showName /> },
        { key: "open", header: "Open", className: "tabular", cell: (r) => r.open },
        { key: "progress", header: "In progress", className: "tabular", hideBelow: "sm", cell: (r) => r.in_progress },
        { key: "overdue", header: "Overdue", className: "tabular", cell: (r) => <span className={cn(r.overdue && "text-danger")}>{r.overdue}</span> },
        { key: "week", header: "Due ≤ 7d", className: "tabular", hideBelow: "md", cell: (r) => r.due_this_week },
        { key: "blocked", header: "Blocked", className: "tabular", hideBelow: "md", cell: (r) => r.blocked },
        { key: "points", header: "Points", className: "tabular", hideBelow: "lg", cell: (r) => formatNumber(r.points, 1) },
        { key: "flags", header: "", hideBelow: "sm", cell: (r) => <div className="flex flex-wrap gap-1">{r.flags.map((f) => <Badge key={f} variant={f === "overloaded" ? "warning" : "danger"}>{FLAG_LABEL[f] ?? f}</Badge>)}</div> },
    ];
    const u = workload.data?.unassigned;
    return (
        <Page>
            <PageHeader
                title="Workload"
                description="Open tasks per person. Use it to rebalance before a cycle starts."
                actions={
                    <Select value={filters.team_id ?? "all"} onValueChange={(v) => setFilter("team_id", v)}>
                        <SelectTrigger className="h-8 w-44" aria-label="Team"><SelectValue /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All teams</SelectItem>
                            {teams.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                        </SelectContent>
                    </Select>
                }
            />
            {workload.data && (
                <StatGrid className="mb-4">
                    <StatCard label="Open tasks" value={workload.data.total_open} />
                    <StatCard label="People with work" value={workload.data.people.length} />
                    <StatCard label="Unassigned" value={u?.open ?? 0} tone={u?.open ? "warning" : "default"} hint={<Link to="/tasks/all?assignee=none" className="underline-offset-4 hover:underline">View unassigned</Link>} />
                    <StatCard label="Overdue" value={workload.data.people.reduce((s, r) => s + r.overdue, 0) + (u?.overdue ?? 0)} tone="danger" />
                </StatGrid>
            )}
            <DataTable
                columns={columns}
                data={workload.data?.people}
                rowKey={(r) => r.membership?.id ?? "x"}
                loading={workload.isFetching}
                error={workload.error}
                onRetry={() => workload.refetch()}
                empty={{ icon: Users, title: "No open assigned tasks" }}
            />
        </Page>
    );
}
