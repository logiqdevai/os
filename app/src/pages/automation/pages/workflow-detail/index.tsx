import { useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Archive, ArchiveRestore, Copy, Download, FlaskConical, History, MoreHorizontal, Pencil, Play, Rocket, Trash2, Undo2 } from "lucide-react";
import { Page, PageHeader, KeyValueList, Section } from "@/components/ui/page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { EmptyState, ErrorState, PageSkeleton } from "@/components/ui/states";
import ConfirmationDialog from "@/components/ui/confirmation-dialog";
import { usePermissions } from "@/hooks/use-permission";
import { toast } from "@/hooks/use-toast";
import { getApiErrorMessage } from "@/lib/api-error";
import { formatDateTime, formatRelative, personName } from "@/lib/format";
import { getDropdownOptionLabel } from "@/lib/dropdown-option-label.utils";
import { ConditionOperatorOptions, RunModeFormOptions, TriggerKindFormOptions, ModuleKeyOptions, DateDirectionFormOptions } from "@/config/constants/dropdowns/automation/automation.options";
import * as service from "@/features/automation/services/automation.services";
import {
    useActionCatalog, useArchiveRule, useDeleteRule, useDiscardDraft, useDuplicateRule, usePublishRule, useRestoreRule, useRestoreRuleVersion, useRule, useRuleVersions,
    useRunRule, useRuns, useSetRuleEnabled, useTestRule,
} from "@/features/automation/hooks/use-automation";
import type { ConditionGroup, ConditionPredicate, RunListItem, RunMode, RuleStep } from "@/features/automation/interfaces/automation.interfaces";
import { StatusBadge, formatDuration } from "../../components/automation-ui";

/**
 * /automation/workflows/:id?tab=overview|versions|runs
 * @perm VIEW automation.rules.read · edit automation.rules.update · publish/enable automation.rules.enable · delete/archive automation.rules.delete · runs automation.runs.read · run now automation.rules.run
 * @api GET /automation/rules/:id · /versions · POST publish|enable|disable|discard-draft|test|run|duplicate|archive|restore · GET export · GET /automation/runs?rule_id=
 */
export default function WorkflowDetailPage() {
    const { id = "" } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [sp, setSp] = useSearchParams();
    const tab = sp.get("tab") ?? "overview";
    const p = usePermissions();
    const rule = useRule(id);
    const actions = useActionCatalog();
    const versions = useRuleVersions(id, tab === "versions");
    const [runsPage, setRunsPage] = useState(1);
    const runs = useRuns({ rule_id: id, page: runsPage, limit: 20 }, { enabled: tab === "runs" && p.can("automation.runs.read") });
    const publish = usePublishRule();
    const setEnabled = useSetRuleEnabled();
    const discard = useDiscardDraft();
    const duplicate = useDuplicateRule();
    const archive = useArchiveRule();
    const restore = useRestoreRule();
    const remove = useDeleteRule();
    const restoreVersion = useRestoreRuleVersion();
    const run = useRunRule();
    const test = useTestRule();
    const [publishOpen, setPublishOpen] = useState(false);
    const [summary, setSummary] = useState("");
    const [testOpen, setTestOpen] = useState(false);
    const [confirm, setConfirm] = useState<null | "delete" | "archive" | "discard" | "run" | { version: number }>(null);

    if (rule.isPending) return <PageSkeleton />;
    if (rule.error) return <Page><ErrorState error={rule.error} onRetry={() => rule.refetch()} /></Page>;
    const r = rule.data;
    const actionName = (key: string) => actions.data?.find((a) => a.key === key)?.name ?? key;
    const steps = (r.actions ?? []) as RuleStep[];
    const conditions = flatten(r.conditions);

    const doExport = async () => {
        try {
            const data = await service.exportRule(r.id);
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
            const a = document.createElement("a");
            a.href = URL.createObjectURL(blob);
            a.download = `${r.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.workflow.json`;
            a.click();
            URL.revokeObjectURL(a.href);
        } catch (e) {
            toast({ variant: "destructive", title: "Could not export", description: getApiErrorMessage(e) });
        }
    };

    const runColumns: DataTableColumn<RunListItem>[] = [
        { key: "status", header: "Status", cell: (x) => <StatusBadge status={x.status} /> },
        { key: "mode", header: "Mode", cell: (x) => (x.mode === "LIVE" ? <span className="text-muted-foreground">Live</span> : <Badge variant="info">{getDropdownOptionLabel(RunModeFormOptions, x.mode)}</Badge>), hideBelow: "sm" },
        { key: "version", header: "Version", cell: (x) => `v${x.rule_version}`, hideBelow: "md" },
        { key: "when", header: "Started", cell: (x) => formatRelative(x.created_at) },
        { key: "duration", header: "Duration", cell: (x) => formatDuration(x.duration_ms), hideBelow: "md" },
        { key: "error", header: "Error", cell: (x) => <span className="line-clamp-1 text-xs text-danger">{x.error_message}</span>, hideBelow: "lg" },
    ];

    return (
        <Page width="wide">
            <PageHeader
                back={{ to: "/automation/workflows", label: "Workflows" }}
                title={r.name}
                description={r.description ?? undefined}
                meta={
                    <>
                        <StatusBadge status={r.status} />
                        {r.status === "PUBLISHED" && <Badge variant="outline">v{r.current_version}</Badge>}
                        {r.draft_definition && <Badge variant="warning">Unpublished changes</Badge>}
                    </>
                }
                actions={
                    <>
                        {r.status === "PUBLISHED" && (
                            <label className="flex items-center gap-2 rounded-md border border-border px-2.5 py-1.5 text-[13px]">
                                <Switch
                                    checked={r.enabled}
                                    disabled={!p.can("automation.rules.enable")}
                                    onCheckedChange={(enabled) => setEnabled.mutate({ id: r.id, enabled })}
                                    aria-label="Enabled"
                                />
                                {r.enabled ? "On" : "Off"}
                            </label>
                        )}
                        {p.can("automation.rules.update") && r.status !== "ARCHIVED" && <Button variant="outline" asChild><Link to={`/automation/workflows/${r.id}/edit`}><Pencil /> Edit</Link></Button>}
                        {p.can("automation.rules.enable") && r.status !== "ARCHIVED" && (r.status === "DRAFT" || r.draft_definition) && (
                            <Button onClick={() => { setSummary(""); setPublishOpen(true); }}><Rocket /> Publish</Button>
                        )}
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild><Button variant="outline" size="icon" aria-label="More actions"><MoreHorizontal /></Button></DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                <DropdownMenuItem onSelect={() => setTestOpen(true)}><FlaskConical /> Test with a sample event</DropdownMenuItem>
                                {p.can("automation.rules.run") && r.status === "PUBLISHED" && <DropdownMenuItem onSelect={() => setConfirm("run")}><Play /> Run now</DropdownMenuItem>}
                                {p.can("automation.rules.update") && r.draft_definition && <DropdownMenuItem onSelect={() => setConfirm("discard")}><Undo2 /> Discard unpublished changes</DropdownMenuItem>}
                                <DropdownMenuItem onSelect={doExport}><Download /> Export JSON</DropdownMenuItem>
                                {p.can("automation.rules.create") && <DropdownMenuItem onSelect={() => duplicate.mutate(r.id, { onSuccess: (c) => navigate(`/automation/workflows/${c.id}`) })}><Copy /> Duplicate</DropdownMenuItem>}
                                {r.status === "ARCHIVED" && p.can("automation.rules.update") && <DropdownMenuItem onSelect={() => restore.mutate(r.id)}><ArchiveRestore /> Restore</DropdownMenuItem>}
                                {p.can("automation.rules.delete") && (
                                    <>
                                        <DropdownMenuSeparator />
                                        {r.status !== "ARCHIVED" && <DropdownMenuItem onSelect={() => setConfirm("archive")}><Archive /> Archive</DropdownMenuItem>}
                                        <DropdownMenuItem className="text-danger focus:text-danger" onSelect={() => setConfirm("delete")}><Trash2 /> Delete</DropdownMenuItem>
                                    </>
                                )}
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </>
                }
            />

            {r.draft_definition && (
                <div className="mb-4 rounded-lg border border-warning/40 bg-warning-soft px-3 py-2 text-[13px] text-foreground">
                    Unpublished changes saved {formatRelative(r.draft_updated_at)}. The live version v{r.current_version} keeps running until you publish.
                </div>
            )}

            <Tabs value={tab} onValueChange={(v) => setSp((prev) => { const n = new URLSearchParams(prev); n.set("tab", v); return n; }, { replace: true })}>
                <TabsList className="mb-4">
                    <TabsTrigger value="overview">Overview</TabsTrigger>
                    <TabsTrigger value="versions">Versions ({r._count.versions})</TabsTrigger>
                    {p.can("automation.runs.read") && <TabsTrigger value="runs">Runs ({r._count.runs})</TabsTrigger>}
                </TabsList>

                <TabsContent value="overview" className="space-y-6">
                    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
                        <div className="space-y-6">
                            <Section title="When">
                                <div className="rounded-lg border border-border bg-card p-4">
                                    <div className="text-[13px] font-medium text-foreground">{getDropdownOptionLabel(TriggerKindFormOptions, r.trigger_kind)}</div>
                                    <div className="mt-0.5 font-mono text-xs text-muted-foreground">{r.trigger_key}</div>
                                    {r.trigger_kind === "DATE_RELATIVE" && r.trigger_config && (
                                        <div className="mt-2 text-xs text-muted-foreground">
                                            {r.trigger_config.direction === "on" ? "On the day" : `${r.trigger_config.offset_days ?? 0} day(s) ${getDropdownOptionLabel(DateDirectionFormOptions, r.trigger_config.direction ?? "before").replace(/^days? /, "")}`} · checked hourly, once per record
                                        </div>
                                    )}
                                    {r.trigger_config?.cron && <div className="mt-2 text-xs text-muted-foreground">Cron <code className="font-mono">{r.trigger_config.cron}</code> · {r.trigger_config.timezone ?? "UTC"}{r.next_run_at && ` · next ${formatDateTime(r.next_run_at)}`}</div>}
                                </div>
                            </Section>
                            <Section title="Only if">
                                <div className="rounded-lg border border-border bg-card p-4 text-[13px]">
                                    {conditions.length ? (
                                        <ul className="space-y-1">
                                            {conditions.map((c, i) => (
                                                <li key={i} className="flex flex-wrap gap-1.5">
                                                    <code className="font-mono text-xs">{c.path}</code>
                                                    <span className="text-muted-foreground">{getDropdownOptionLabel(ConditionOperatorOptions, c.operator)}</span>
                                                    {c.value !== undefined && <code className="font-mono text-xs">{Array.isArray(c.value) ? c.value.join(", ") : String(c.value)}</code>}
                                                </li>
                                            ))}
                                        </ul>
                                    ) : <span className="text-muted-foreground">Always (no conditions)</span>}
                                </div>
                            </Section>
                            <Section title="Then">
                                <ol className="space-y-2">
                                    {steps.length ? steps.map((s, i) => (
                                        <li key={s.key} className="flex items-start gap-3 rounded-lg border border-border bg-card p-3">
                                            <span className="grid size-6 shrink-0 place-items-center rounded-full bg-secondary text-xs tabular">{i + 1}</span>
                                            <div className="min-w-0">
                                                <div className="text-[13px] font-medium text-foreground">{actionName(s.action_key)}</div>
                                                <div className="truncate font-mono text-xs text-muted-foreground">{s.key} · {s.on_error === "continue" ? "continue on error" : "stop on error"}</div>
                                            </div>
                                        </li>
                                    )) : <EmptyState compact title="No steps yet" description="Edit the workflow to add steps." />}
                                </ol>
                            </Section>
                        </div>
                        <Section title="Details">
                            <div className="rounded-lg border border-border bg-card p-4">
                                <KeyValueList
                                    columns={1}
                                    items={[
                                        { label: "Module", value: r.module ? getDropdownOptionLabel(ModuleKeyOptions, r.module) : null },
                                        { label: "Owner", value: r.owner ? personName(r.owner.user) : null },
                                        { label: "Runs as", value: r.run_as ? <Badge variant="violet">{r.run_as.name}</Badge> : "Owner" },
                                        { label: "Scope", value: r.branch ? `Branch · ${r.branch.name}` : "Whole organization" },
                                        { label: "Runs", value: `${r.run_count} (${r.failure_count} failed)` },
                                        { label: "Last run", value: r.last_run_at ? <span className="flex items-center gap-1.5"><StatusBadge status={r.last_run_status} /> {formatRelative(r.last_run_at)}</span> : null },
                                        { label: "Published", value: r.published_at ? formatDateTime(r.published_at) : null },
                                        { label: "Destructive steps", value: r.allow_destructive_actions ? (r.require_approval_for_destructive ? "Allowed with approval" : "Allowed") : "Not allowed" },
                                    ]}
                                />
                            </div>
                        </Section>
                    </div>
                </TabsContent>

                <TabsContent value="versions">
                    {versions.isPending ? <PageSkeleton /> : versions.error ? <ErrorState error={versions.error} /> : !versions.data?.length ? (
                        <EmptyState icon={History} title="Not published yet" description="Every publish creates an immutable version here." />
                    ) : (
                        <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-card">
                            {versions.data.map((v) => (
                                <li key={v.id} className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center">
                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-2 text-[13px] font-medium text-foreground">
                                            v{v.version} {!v.superseded_at && <Badge variant="success">Live</Badge>}
                                        </div>
                                        <div className="text-xs text-muted-foreground">
                                            {v.change_summary ?? "No summary"} · {v.author ? personName(v.author.user) : "—"} · {formatDateTime(v.published_at)} · {v._count.runs} runs
                                        </div>
                                    </div>
                                    {v.superseded_at && p.can("automation.rules.update") && p.can("automation.rules.enable") && (
                                        <Button size="sm" variant="outline" onClick={() => setConfirm({ version: v.version })}>Restore as new version</Button>
                                    )}
                                </li>
                            ))}
                        </ul>
                    )}
                </TabsContent>

                <TabsContent value="runs">
                    <DataTable
                        columns={runColumns}
                        data={runs.data?.data}
                        rowKey={(x) => x.id}
                        loading={runs.isFetching}
                        error={runs.error}
                        onRetry={() => runs.refetch()}
                        pagination={runs.data?.pagination}
                        onPageChange={setRunsPage}
                        rowHref={(x) => `/automation/runs/${x.id}`}
                        empty={{ title: "No runs yet", description: "Runs appear once the workflow is triggered, tested or run manually." }}
                    />
                </TabsContent>
            </Tabs>

            <Dialog open={publishOpen} onOpenChange={(o) => !publish.isPending && setPublishOpen(o)}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Publish v{r.current_version + 1}</DialogTitle>
                        <DialogDescription>The new version replaces the live one{r.enabled ? " immediately" : ""}. Runs already in progress finish on their version.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-1.5">
                        <Label htmlFor="publish-summary">What changed?</Label>
                        <Input id="publish-summary" value={summary} onChange={(e) => setSummary(e.target.value)} placeholder="Added an approval step" maxLength={500} />
                    </div>
                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setPublishOpen(false)} disabled={publish.isPending}>Cancel</Button>
                        <Button loading={publish.isPending} onClick={() => publish.mutate({ id: r.id, change_summary: summary || undefined }, { onSuccess: () => setPublishOpen(false) })}>
                            Publish
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <TestDialog
                open={testOpen}
                onOpenChange={setTestOpen}
                canTest={p.can("automation.rules.update")}
                pending={test.isPending}
                onRun={(mode, payload) => test.mutate({ id: r.id, mode, payload }, { onSuccess: (x) => { setTestOpen(false); if (x) navigate(`/automation/runs/${x.id}`); } })}
            />

            <ConfirmationDialog
                isOpen={!!confirm}
                onClose={() => setConfirm(null)}
                title={
                    confirm === "delete" ? `Delete ${r.name}?` : confirm === "archive" ? `Archive ${r.name}?` : confirm === "discard" ? "Discard unpublished changes?" : confirm === "run" ? "Run now?" : `Restore version ${typeof confirm === "object" && confirm ? confirm.version : ""}?`
                }
                description={
                    confirm === "delete" ? "The workflow, its versions and run history are deleted permanently." : confirm === "archive" ? "The workflow is disabled and hidden from the list." : confirm === "discard" ? "Your draft is dropped; the live version stays as it is." : confirm === "run" ? "The published version runs live with an empty payload." : "Its definition is published again as a new version. History is never rewritten."
                }
                confirmText={confirm === "delete" ? "Delete" : confirm === "archive" ? "Archive" : confirm === "discard" ? "Discard" : confirm === "run" ? "Run now" : "Restore"}
                variant={confirm === "delete" || confirm === "archive" || confirm === "discard" ? "destructive" : "default"}
                isLoading={discard.isPending || run.isPending || restoreVersion.isPending}
                onConfirm={() => {
                    const done = { onSuccess: () => setConfirm(null) };
                    // Delete and archive are optimistic (the workflow leaves the lists at once); the others wait for the API.
                    if (confirm === "delete") { remove.mutate(r.id); navigate("/automation/workflows"); }
                    else if (confirm === "archive") { archive.mutate(r.id); setConfirm(null); }
                    else if (confirm === "discard") discard.mutate(r.id, done);
                    else if (confirm === "run") run.mutate({ id: r.id }, { onSuccess: (x) => { setConfirm(null); navigate(`/automation/runs/${x.id}`); } });
                    else if (confirm && typeof confirm === "object") restoreVersion.mutate({ id: r.id, version: confirm.version }, done);
                }}
            />
        </Page>
    );
}

function TestDialog({ open, onOpenChange, onRun, pending, canTest }: { open: boolean; onOpenChange: (o: boolean) => void; onRun: (mode: RunMode, payload?: Record<string, unknown>) => void; pending: boolean; canTest: boolean }) {
    const [text, setText] = useState("");
    const [error, setError] = useState<string | null>(null);
    const submit = (mode: RunMode) => {
        let payload: Record<string, unknown> | undefined;
        if (text.trim()) {
            try {
                payload = JSON.parse(text);
            } catch {
                setError("The payload must be valid JSON");
                return;
            }
        }
        setError(null);
        onRun(mode, payload);
    };
    return (
        <Dialog open={open} onOpenChange={(o) => !pending && onOpenChange(o)}>
            <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle>Test with a sample event</DialogTitle>
                    <DialogDescription>A dry run evaluates conditions and resolves inputs without executing anything. A test run executes the steps (waits and approvals are skipped). Unpublished changes are used.</DialogDescription>
                </DialogHeader>
                <div className="space-y-1.5">
                    <Label htmlFor="test-payload">Event payload (JSON, optional — the trigger's sample is used when empty)</Label>
                    <Textarea id="test-payload" rows={6} className="font-mono text-xs" value={text} onChange={(e) => setText(e.target.value)} placeholder='{ "name": "Website redesign", "amount": 12000 }' />
                    {error && <p className="text-xs text-danger">{error}</p>}
                </div>
                <DialogFooter>
                    <Button variant="outline" loading={pending} onClick={() => submit("DRY_RUN")}>Dry run</Button>
                    {canTest && <Button loading={pending} onClick={() => submit("TEST")}><FlaskConical /> Test run</Button>}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

function flatten(group: ConditionGroup | null | undefined): ConditionPredicate[] {
    if (!group) return [];
    return [...(group.all ?? []), ...(group.any ?? [])].flatMap((n) => ("operator" in n ? [n as ConditionPredicate] : flatten(n as ConditionGroup)));
}
