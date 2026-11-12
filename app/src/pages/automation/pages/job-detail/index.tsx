import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Pause, Play } from "lucide-react";
import { Page, PageHeader, KeyValueList, Section } from "@/components/ui/page";
import { Button } from "@/components/ui/button";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { ErrorState, PageSkeleton } from "@/components/ui/states";
import { Can } from "@/components/access/can";
import { formatDateTime, personName } from "@/lib/format";
import { getDropdownOptionLabel } from "@/lib/dropdown-option-label.utils";
import { ModuleKeyOptions } from "@/config/constants/dropdowns/automation/automation.options";
import { useJob, useJobAction, useJobRuns } from "@/features/automation/hooks/use-automation";
import type { JobRun } from "@/features/automation/interfaces/automation.interfaces";
import { JsonBlock, StatusBadge, describeSchedule, formatDuration } from "../../components/automation-ui";

/**
 * /automation/jobs/:id — job config and run log (20 §7)
 * @perm VIEW automation.jobs.read · run now/pause/resume automation.jobs.manage
 * @api GET /automation/jobs/:id · GET /automation/jobs/:id/runs · POST /automation/jobs/:id/run-now|pause|resume
 */
export default function JobDetailPage() {
    const { id = "" } = useParams<{ id: string }>();
    const job = useJob(id);
    const [page, setPage] = useState(1);
    const runs = useJobRuns(id, { page, limit: 20 });
    const action = useJobAction();

    if (job.isPending) return <PageSkeleton />;
    if (job.error) return <Page><ErrorState error={job.error} onRetry={() => job.refetch()} /></Page>;
    const j = job.data;
    const act = (a: "pause" | "resume" | "run-now") =>
        action.mutate({ id: j.id, action: a }); // pause / resume are optimistic; the run shows up in Runs

    const columns: DataTableColumn<JobRun>[] = [
        { key: "status", header: "Status", cell: (r) => <StatusBadge status={r.status} /> },
        { key: "for", header: "Scheduled for", cell: (r) => formatDateTime(r.scheduled_for) },
        { key: "duration", header: "Duration", cell: (r) => formatDuration(r.duration_ms), hideBelow: "sm" },
        { key: "attempt", header: "Attempt", cell: (r) => `${r.attempt}/${r.max_attempts}`, hideBelow: "md" },
        { key: "by", header: "Triggered by", cell: (r) => (r.triggered_by ? personName(r.triggered_by.user) : "Schedule"), hideBelow: "lg" },
        { key: "result", header: "Result", cell: (r) => (r.error_message ? <span className="line-clamp-1 text-xs text-danger">{r.error_message}</span> : <span className="line-clamp-1 font-mono text-xs text-muted-foreground">{r.output ? JSON.stringify(r.output) : ""}</span>), hideBelow: "md" },
    ];

    return (
        <Page width="wide">
            <PageHeader
                back={{ to: "/automation/jobs", label: "Scheduled jobs" }}
                title={j.name}
                description={j.description ?? undefined}
                meta={<StatusBadge status={j.status} />}
                actions={
                    <Can permission="automation.jobs.manage">
                        {!j.rule_id && (j.status === "ACTIVE" ? <Button variant="outline" onClick={() => act("pause")}><Pause /> Pause</Button> : <Button variant="outline" onClick={() => act("resume")}><Play /> Resume</Button>)}
                        <Button onClick={() => act("run-now")} loading={action.isPending && action.variables?.action === "run-now"}><Play /> Run now</Button>
                    </Can>
                }
            />
            {j.last_error && <div className="mb-4 rounded-lg border border-danger/40 bg-danger-soft px-3 py-2 text-[13px] text-danger">{j.last_error}</div>}
            <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
                <Section title="Runs">
                    <DataTable
                        columns={columns}
                        data={runs.data?.data}
                        rowKey={(r) => r.id}
                        loading={runs.isFetching}
                        error={runs.error}
                        onRetry={() => runs.refetch()}
                        pagination={runs.data?.pagination}
                        onPageChange={setPage}
                        empty={{ title: "No runs yet", description: "The first run happens at the next scheduled time." }}
                    />
                </Section>
                <Section title="Configuration">
                    <div className="space-y-4 rounded-lg border border-border bg-card p-4">
                        <KeyValueList
                            columns={1}
                            items={[
                                { label: "Key", value: <code className="font-mono text-xs">{j.key}</code> },
                                { label: "Module", value: getDropdownOptionLabel(ModuleKeyOptions, j.module) },
                                { label: "Handler", value: j.handler_info?.name ?? j.handler },
                                { label: "Schedule", value: <span className="font-mono text-xs">{describeSchedule(j)}</span> },
                                { label: "Next run", value: j.next_run_at ? formatDateTime(j.next_run_at) : null },
                                { label: "Workflow", value: j.rule ? <Link className="text-info hover:underline" to={`/automation/workflows/${j.rule.id}`}>{j.rule.name}</Link> : null },
                                { label: "Runs", value: `${j.run_count} (${j.failure_count} failed)` },
                                { label: "Retries", value: `${j.max_retries} · backoff ${j.retry_backoff_seconds}s` },
                            ]}
                        />
                        {j.payload && <div className="space-y-1"><div className="text-xs text-muted-foreground">Payload</div><JsonBlock value={j.payload} maxHeight="max-h-40" /></div>}
                    </div>
                </Section>
            </div>
        </Page>
    );
}
