import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Check, ChevronDown, CircleSlash, RotateCcw, X } from "lucide-react";
import { Page, PageHeader, KeyValueList, Section } from "@/components/ui/page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { EmptyState, ErrorState, PageSkeleton } from "@/components/ui/states";
import ConfirmationDialog from "@/components/ui/confirmation-dialog";
import { usePermissions } from "@/hooks/use-permission";
import { useSessionData } from "@/features/session/hooks/use-session";
import { toast } from "@/hooks/use-toast";
import { getApiErrorMessage } from "@/lib/api-error";
import { formatDateTime, personName } from "@/lib/format";
import { getDropdownOptionLabel } from "@/lib/dropdown-option-label.utils";
import { ConditionOperatorOptions, RunModeFormOptions } from "@/config/constants/dropdowns/automation/automation.options";
import { useActionCatalog, useCancelRun, useDecideApproval, useRetryRun, useRun } from "@/features/automation/hooks/use-automation";
import type { RunStep } from "@/features/automation/interfaces/automation.interfaces";
import { JsonBlock, StatusBadge, formatDuration } from "../../components/automation-ui";

/**
 * /automation/runs/:id — one run with its steps (20 §8). Polls while the run is in progress.
 * @perm VIEW automation.runs.read · retry/cancel automation.runs.manage · approve/reject: only the requested approver
 * @api GET /automation/runs/:id · POST /automation/runs/:id/retry|cancel · POST /automation/approvals/:id/decide
 */
export default function RunDetailPage() {
    const { id = "" } = useParams<{ id: string }>();
    const run = useRun(id);
    const actions = useActionCatalog();
    const p = usePermissions();
    const retry = useRetryRun();
    const cancel = useCancelRun();
    const [confirm, setConfirm] = useState<null | "retry" | "cancel">(null);

    if (run.isPending) return <PageSkeleton />;
    if (run.error) return <Page><ErrorState error={run.error} onRetry={() => run.refetch()} /></Page>;
    const r = run.data;
    const canManage = p.can("automation.runs.manage");
    const retryable = ["FAILED", "DEAD_LETTERED", "CANCELLED", "RETRY_SCHEDULED"].includes(r.status);
    const cancellable = ["PENDING", "WAITING", "AWAITING_APPROVAL", "RETRY_SCHEDULED"].includes(r.status);
    const actionName = (key: string) => actions.data?.find((a) => a.key === key)?.name ?? key;

    return (
        <Page width="wide">
            <PageHeader
                back={{ to: "/automation/runs", label: "Runs" }}
                title={<Link to={`/automation/workflows/${r.rule.id}`} className="hover:underline">{r.rule.name}</Link>}
                documentTitle={`Run · ${r.rule.name}`}
                meta={
                    <>
                        <StatusBadge status={r.status} />
                        {r.mode !== "LIVE" && <Badge variant="info">{getDropdownOptionLabel(RunModeFormOptions, r.mode)}</Badge>}
                        {r.performed_destructive_action && <Badge variant="danger">Destructive action</Badge>}
                    </>
                }
                actions={
                    canManage && (
                        <>
                            {cancellable && <Button variant="outline" onClick={() => setConfirm("cancel")}><CircleSlash /> Cancel</Button>}
                            {retryable && <Button onClick={() => setConfirm("retry")}><RotateCcw /> Retry</Button>}
                        </>
                    )
                }
            />

            {r.error_message && (
                <div className="mb-4 rounded-lg border border-danger/40 bg-danger-soft px-3 py-2 text-[13px] text-danger">
                    <span className="font-mono text-xs">{r.error_code}</span> · {r.error_message}
                    {r.status === "RETRY_SCHEDULED" && r.next_retry_at && <span className="text-foreground"> — next attempt {formatDateTime(r.next_retry_at)}</span>}
                </div>
            )}
            {r.status === "WAITING" && r.wait_until && <div className="mb-4 rounded-lg border border-warning/40 bg-warning-soft px-3 py-2 text-[13px] text-foreground">Waiting until {formatDateTime(r.wait_until)}.</div>}

            <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
                <div className="space-y-6">
                    {r.conditions_result && r.conditions_result.length > 0 && (
                        <Section title="Conditions" description={r.conditions_passed ? "All conditions matched." : "Conditions did not match — the run was skipped."}>
                            <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-card">
                                {r.conditions_result.map((c, i) => (
                                    <li key={i} className="flex flex-wrap items-center gap-2 px-3 py-2 text-[13px]">
                                        {c.passed ? <Check className="size-4 text-success" /> : <X className="size-4 text-danger" />}
                                        <code className="font-mono text-xs">{c.path}</code>
                                        <span className="text-muted-foreground">{getDropdownOptionLabel(ConditionOperatorOptions, c.operator)}</span>
                                        <code className="font-mono text-xs">{JSON.stringify(c.expected)}</code>
                                        <span className="text-xs text-muted-foreground">actual: <code className="font-mono">{JSON.stringify(c.actual) ?? "undefined"}</code></span>
                                    </li>
                                ))}
                            </ul>
                        </Section>
                    )}
                    <Section title="Steps">
                        {r.steps.length ? (
                            <ol className="space-y-2">
                                {r.steps.map((s) => <StepRow key={s.id} step={s} name={actionName(s.action_key)} />)}
                            </ol>
                        ) : (
                            <EmptyState compact title="No steps executed" description={r.status === "SKIPPED" ? "The run was skipped before any step." : "Steps appear as the run progresses."} />
                        )}
                    </Section>
                    <Section title="Trigger event">
                        <JsonBlock value={r.input?.event ?? null} />
                    </Section>
                </div>
                <Section title="Details">
                    <div className="rounded-lg border border-border bg-card p-4">
                        <KeyValueList
                            columns={1}
                            items={[
                                { label: "Trigger", value: <code className="font-mono text-xs">{r.trigger_key}</code> },
                                { label: "Version", value: `v${r.rule_version}` },
                                { label: "Record", value: r.entity_id ? `${r.entity_type ?? r.entity_kind ?? ""} ${r.entity_id}` : null },
                                { label: "Started", value: formatDateTime(r.started_at ?? r.created_at) },
                                { label: "Finished", value: r.finished_at ? formatDateTime(r.finished_at) : null },
                                { label: "Duration", value: formatDuration(r.duration_ms) },
                                { label: "Attempt", value: `${r.attempt} of ${r.max_attempts}` },
                                { label: "Started by", value: r.actor_membership ? personName(r.actor_membership.user) : r.actor_type === "SYSTEM" ? "Event / schedule" : r.actor_type },
                                { label: "Ran as", value: r.run_as ? <Badge variant="violet">{r.run_as.name}</Badge> : "Workflow owner" },
                                { label: "Chain depth", value: String(r.trigger_depth) },
                                { label: "Caused by", value: r.parent_run ? <Link className="text-info hover:underline" to={`/automation/runs/${r.parent_run.id}`}>{r.parent_run.rule.name}</Link> : null },
                                { label: "Event", value: r.event_id ? <Link className="text-info hover:underline" to={`/automation/events?event=${r.event_id}`}>Open in event log</Link> : null },
                                { label: "Idempotency key", value: <code className="break-all font-mono text-xs">{r.idempotency_key}</code> },
                            ]}
                        />
                    </div>
                </Section>
            </div>

            <ConfirmationDialog
                isOpen={!!confirm}
                onClose={() => setConfirm(null)}
                title={confirm === "retry" ? "Retry this run?" : "Cancel this run?"}
                description={confirm === "retry" ? "The run continues from the failed step. Succeeded steps are not repeated." : "Waiting steps and pending approvals are cancelled. Nothing else runs."}
                confirmText={confirm === "retry" ? "Retry" : "Cancel run"}
                variant={confirm === "cancel" ? "destructive" : "default"}
                isLoading={retry.isPending || cancel.isPending}
                onConfirm={() => {
                    const opts = { onSuccess: () => { toast({ title: confirm === "retry" ? "Retry started" : "Run cancelled" }); setConfirm(null); }, onError: (e: unknown) => toast({ variant: "destructive" as const, title: "Could not update the run", description: getApiErrorMessage(e) }) };
                    if (confirm === "retry") retry.mutate(r.id, opts);
                    else cancel.mutate(r.id, opts);
                }}
            />
        </Page>
    );
}

function StepRow({ step, name }: { step: RunStep; name: string }) {
    const [open, setOpen] = useState(step.status === "FAILED" || step.status === "AWAITING_APPROVAL");
    return (
        <li className="rounded-lg border border-border bg-card">
            <Collapsible open={open} onOpenChange={setOpen}>
                <CollapsibleTrigger className="flex w-full items-center gap-3 px-3 py-2.5 text-left">
                    <span className="grid size-6 shrink-0 place-items-center rounded-full bg-secondary text-xs tabular">{step.step_index + 1}</span>
                    <div className="min-w-0 flex-1">
                        <div className="truncate text-[13px] font-medium text-foreground">{name}</div>
                        <div className="truncate font-mono text-xs text-muted-foreground">{step.step_key}{step.attempt > 1 ? ` · attempt ${step.attempt}` : ""}</div>
                    </div>
                    <span className="hidden text-xs text-muted-foreground sm:inline">{formatDuration(step.duration_ms)}</span>
                    <StatusBadge status={step.status} />
                    <ChevronDown className={`size-4 shrink-0 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-3 border-t border-border p-3">
                    {step.error_message && <p className="text-[13px] text-danger"><span className="font-mono text-xs">{step.error_code}</span> · {step.error_message}</p>}
                    {step.skipped_reason && <p className="text-[13px] text-muted-foreground">{step.skipped_reason}</p>}
                    {step.approval && <ApprovalBox approval={step.approval} />}
                    <div className="grid gap-3 md:grid-cols-2">
                        <div className="min-w-0 space-y-1"><div className="text-xs text-muted-foreground">Input</div><JsonBlock value={step.input} maxHeight="max-h-60" /></div>
                        <div className="min-w-0 space-y-1"><div className="text-xs text-muted-foreground">Output</div><JsonBlock value={step.output} maxHeight="max-h-60" /></div>
                    </div>
                    {step.webhook_deliveries.length > 0 && (
                        <div className="text-xs text-muted-foreground">
                            Deliveries: {step.webhook_deliveries.map((d) => `${d.status}${d.response_status_code ? ` (${d.response_status_code})` : ""}`).join(", ")}
                        </div>
                    )}
                </CollapsibleContent>
            </Collapsible>
        </li>
    );
}

function ApprovalBox({ approval }: { approval: NonNullable<RunStep["approval"]> }) {
    const session = useSessionData();
    const decide = useDecideApproval();
    const [comment, setComment] = useState("");
    const mine = approval.decision === "PENDING" && approval.requested_from_membership_id === session?.active_organization?.membership_id;
    return (
        <div className="space-y-2 rounded-md border border-violet/40 bg-violet-soft p-3 text-[13px] text-foreground">
            <div className="flex flex-wrap items-center gap-2">
                <StatusBadge status={approval.decision} />
                <span>Requested from {approval.requested_from_member ? personName(approval.requested_from_member.user) : "—"}</span>
                {approval.expires_at && <span className="text-xs text-muted-foreground">expires {formatDateTime(approval.expires_at)}</span>}
            </div>
            {approval.context?.message && <p>{approval.context.message}</p>}
            {approval.comment && <p className="text-muted-foreground">“{approval.comment}” — {approval.approver ? personName(approval.approver.user) : ""}</p>}
            {mine && (
                <div className="space-y-2">
                    <Textarea rows={2} value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Comment (optional)" aria-label="Approval comment" />
                    <div className="flex gap-2">
                        {(["APPROVED", "REJECTED"] as const).map((d) => (
                            <Button
                                key={d}
                                size="sm"
                                variant={d === "APPROVED" ? "default" : "outline"}
                                loading={decide.isPending}
                                onClick={() => decide.mutate({ id: approval.id, decision: d, comment: comment || undefined }, { onSuccess: () => toast({ title: d === "APPROVED" ? "Approved" : "Rejected" }), onError: (e) => toast({ variant: "destructive", title: "Could not decide", description: getApiErrorMessage(e) }) })}
                            >
                                {d === "APPROVED" ? "Approve" : "Reject"}
                            </Button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
