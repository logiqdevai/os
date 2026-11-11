import { Activity } from "lucide-react";
import { Page, PageHeader } from "@/components/ui/page";
import { DataTable, TableToolbar, type DataTableColumn } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useListParams } from "@/hooks/use-list-params";
import { formatDateTime, formatRelative } from "@/lib/format";
import { getDropdownOptionLabel } from "@/lib/dropdown-option-label.utils";
import { RunModeFilterOptions, RunModeFormOptions, RunStatusFilterOptions } from "@/config/constants/dropdowns/automation/automation.options";
import { useRuns } from "@/features/automation/hooks/use-automation";
import type { RunListItem } from "@/features/automation/interfaces/automation.interfaces";
import { StatusBadge, formatDuration } from "../../components/automation-ui";

/**
 * /automation/runs — run history (20 §8)
 * @perm VIEW automation.runs.read (scoped by the workflow's scope)
 * @api GET /automation/runs?status=&mode=&rule_id=&entity_id=&search=
 */
export default function RunsPage() {
    const { params, setPage, search, setSearch, filters, setFilter } = useListParams();
    const runs = useRuns(params);

    const columns: DataTableColumn<RunListItem>[] = [
        {
            key: "rule",
            header: "Workflow",
            cell: (r) => (
                <div className="min-w-0">
                    <div className="truncate font-medium text-foreground">{r.rule.name}</div>
                    <div className="truncate font-mono text-xs text-muted-foreground">{r.trigger_key}{r.entity_id ? ` · ${r.entity_id.slice(0, 8)}` : ""}</div>
                </div>
            ),
        },
        { key: "status", header: "Status", cell: (r) => <div className="flex flex-wrap items-center gap-1"><StatusBadge status={r.status} />{r.performed_destructive_action && <Badge variant="danger">destructive</Badge>}</div> },
        { key: "mode", header: "Mode", cell: (r) => (r.mode === "LIVE" ? <span className="text-muted-foreground">Live</span> : <Badge variant="info">{getDropdownOptionLabel(RunModeFormOptions, r.mode)}</Badge>), hideBelow: "md" },
        { key: "attempt", header: "Attempt", cell: (r) => <span className="tabular">{r.attempt}/{r.max_attempts}</span>, hideBelow: "lg" },
        { key: "started", header: "Started", cell: (r) => <span title={formatDateTime(r.created_at)}>{formatRelative(r.created_at)}</span>, hideBelow: "sm" },
        { key: "duration", header: "Duration", cell: (r) => formatDuration(r.duration_ms), hideBelow: "lg" },
        { key: "error", header: "Error", cell: (r) => <span className="line-clamp-1 max-w-64 text-xs text-danger">{r.error_message}</span>, hideBelow: "xl" },
    ];

    return (
        <Page>
            <PageHeader title="Runs" description="Every execution with its trigger, steps, result and duration. Retries and dead letters show here too." />
            <TableToolbar search={search} onSearch={setSearch} placeholder="Search workflow, trigger or error…">
                <Select value={filters.status ?? "all"} onValueChange={(v) => setFilter("status", v)}>
                    <SelectTrigger className="h-8 w-full sm:w-44" aria-label="Filter by status"><SelectValue /></SelectTrigger>
                    <SelectContent>{RunStatusFilterOptions.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent>
                </Select>
                <Select value={filters.mode ?? "all"} onValueChange={(v) => setFilter("mode", v)}>
                    <SelectTrigger className="h-8 w-full sm:w-32" aria-label="Filter by mode"><SelectValue /></SelectTrigger>
                    <SelectContent>{RunModeFilterOptions.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent>
                </Select>
            </TableToolbar>
            <DataTable
                columns={columns}
                data={runs.data?.data}
                rowKey={(r) => r.id}
                loading={runs.isFetching}
                error={runs.error}
                onRetry={() => runs.refetch()}
                pagination={runs.data?.pagination}
                onPageChange={setPage}
                rowHref={(r) => `/automation/runs/${r.id}`}
                empty={{ icon: Activity, title: search || Object.keys(filters).length ? "No runs match" : "No runs yet", description: "Runs appear when enabled workflows are triggered." }}
            />
        </Page>
    );
}
