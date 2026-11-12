import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { AlertTriangle, CheckCircle2, Download, Eye, Play, Save, Undo2 } from "lucide-react";
import { Page, PageHeader } from "@/components/ui/page";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ProgressBar } from "@/components/ui/progress-bar";
import { StatCard, StatGrid } from "@/components/ui/stat-card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import ConfirmationDialog from "@/components/ui/confirmation-dialog";
import { ErrorState, PageSkeleton } from "@/components/ui/states";
import { toast } from "@/hooks/use-toast";
import { getApiErrorMessage } from "@/lib/api-error";
import { formatDateTime, formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import { getDropdownOptionLabel } from "@/lib/dropdown-option-label.utils";
import { CustomFieldEntityOptions } from "@/config/constants/dropdowns/crm/custom-field.options";
import { DuplicateModeOptions, ImportStatusOptions, RowPlanOptions } from "@/config/constants/dropdowns/crm/crm-import.options";
import {
    useDownloadImportErrors, useImport, usePreviewImport, useRollbackImport, useSavedMappings, useSetImportMapping, useStartImport,
} from "@/features/crm/imports/hooks/use-imports";
import type { DuplicateMode, ImportJob, ImportRowResult } from "@/features/crm/imports/interfaces/imports.interfaces";
import { CrmPaths } from "../../crm-paths";
import { Panel } from "../../components/crm-ui";

const SKIP = "__skip";
const STEPS = ["Upload", "Map columns", "Preview", "Import"] as const;

const stepOf = (status: ImportJob["status"]) => (status === "PENDING" ? 1 : status === "VALIDATING" || status === "PREVIEW" ? 2 : 3);

/**
 * Import job wizard (mockups `import-map`, `import-dupes`, `import-preview`, `import-run`, 02 §22).
 * @route /crm/imports/:importId
 * @perm crm.records.import (+ entity create key; update key for "update existing")
 * @api GET /crm/imports/:id (polled while importing) · PUT /:id/mapping · POST /:id/preview · POST /:id/start · GET /:id/errors.csv · POST /:id/rollback
 * @mcp crm_records_import_get|map|preview|start|rollback
 * @states setting up · validating · preview (nothing written) · importing (progress; safe to leave) · completed · failed · rolled back
 */
export default function ImportDetailPage() {
    const { importId } = useParams();
    const job = useImport(importId);
    if (job.isPending) return <PageSkeleton />;
    if (job.error) return <Page><ErrorState error={job.error} onRetry={() => job.refetch()} /></Page>;
    const j = job.data;
    const status = ImportStatusOptions.find((o) => o.id === j.status);
    const step = stepOf(j.status);
    return (
        <Page width="wide">
            <PageHeader
                back={{ to: CrmPaths.imports, label: "Import" }}
                title={j.file_name ?? "Import"}
                meta={<><Badge variant={status?.variant}>{status?.label}</Badge><Badge>{getDropdownOptionLabel(CustomFieldEntityOptions, j.entity_type)}</Badge></>}
                description={`${formatNumber(j.total_rows)} rows · uploaded ${formatDateTime(j.created_at)}`}
            />
            <ol className="mb-5 flex flex-wrap gap-x-4 gap-y-1 text-[13px]" aria-label="Import steps">
                {STEPS.map((s, i) => (
                    <li key={s} className={cn("flex items-center gap-1.5", i === step ? "font-medium text-foreground" : i < step ? "text-success" : "text-muted-foreground")}>
                        <span className={cn("flex size-5 items-center justify-center rounded-full border text-[11px]", i < step ? "border-success bg-success-soft" : i === step ? "border-foreground" : "border-border")}>{i < step ? "✓" : i + 1}</span>{s}
                    </li>
                ))}
            </ol>
            {j.status === "PENDING" && <MappingStep job={j} />}
            {(j.status === "VALIDATING" || j.status === "PREVIEW") && <PreviewStep job={j} />}
            {j.status !== "PENDING" && j.status !== "VALIDATING" && j.status !== "PREVIEW" && <ResultStep job={j} />}
        </Page>
    );
}

function MappingStep({ job }: { job: ImportJob }) {
    const setMapping = useSetImportMapping();
    const preview = usePreviewImport();
    const saved = useSavedMappings(job.entity_type);
    const headers = job.file?.headers ?? [];
    const fields = job.target?.fields ?? [];
    const matchKeys = job.target?.match_keys ?? [];
    const [mapping, setMap] = useState<Record<string, string>>(job.field_mapping ?? {});
    const [mode, setMode] = useState<DuplicateMode>(job.duplicate_strategy?.mode ?? "skip");
    const [matchKey, setMatchKey] = useState(job.duplicate_strategy?.match_key ?? matchKeys[0]?.key ?? "name");
    const [saveAs, setSaveAs] = useState("");
    const [error, setError] = useState<string | null>(null);

    const used = new Set(Object.values(mapping));
    const missing = fields.filter((f) => f.required && !used.has(f.key) && !(f.key === "first_name" && used.has("full_name")));

    const apply = (id: string) => {
        const m = saved.data?.find((x) => x.id === id);
        if (!m) return;
        setMap(Object.fromEntries(headers.filter((h) => m.field_mapping[h]).map((h) => [h, m.field_mapping[h]])));
        if (m.duplicate_strategy) { setMode(m.duplicate_strategy.mode); setMatchKey(m.duplicate_strategy.match_key); }
        toast({ title: `Mapping “${m.name}” applied` });
    };

    const next = () => {
        setError(null);
        if (missing.length) return setError(`Map a column to ${missing.map((f) => f.label).join(", ")}`);
        setMapping.mutate({ id: job.id, field_mapping: mapping, duplicate_strategy: { mode, match_key: matchKey }, save_as: saveAs.trim() || undefined }, {
            onSuccess: () => preview.mutate(job.id, { onError: (e) => setError(getApiErrorMessage(e)) }),
            onError: (e) => setError(getApiErrorMessage(e)),
        });
    };

    if (!job.file) return <ErrorState error={new Error("The uploaded file could not be read. Upload it again.")} />;
    return (
        <div className="space-y-4">
            <Panel
                title="2 · Map columns"
                actions={!!saved.data?.length && (
                    <Select onValueChange={apply}>
                        <SelectTrigger className="h-8 w-44" aria-label="Apply a saved mapping"><SelectValue placeholder="Saved mappings" /></SelectTrigger>
                        <SelectContent>{saved.data.map((m) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}</SelectContent>
                    </Select>
                )}
                bodyClassName="p-0"
            >
                <div className="overflow-x-auto">
                    <Table>
                        <TableHeader>
                            <TableRow className="hover:bg-transparent">
                                <TableHead className="text-xs">CSV column</TableHead>
                                <TableHead className="hidden text-xs sm:table-cell">Sample</TableHead>
                                <TableHead className="text-xs">CRM field</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {headers.map((h, i) => (
                                <TableRow key={h} className="border-border-soft">
                                    <TableCell className="py-2 text-[13px] font-medium text-foreground">{h}<div className="truncate text-xs font-normal text-muted-foreground sm:hidden">{job.file!.sample.map((r) => r[i]).filter(Boolean).slice(0, 2).join(", ")}</div></TableCell>
                                    <TableCell className="hidden max-w-56 truncate py-2 text-xs text-muted-foreground sm:table-cell">{job.file!.sample.map((r) => r[i]).filter(Boolean).slice(0, 3).join(" · ") || "—"}</TableCell>
                                    <TableCell className="py-2">
                                        <Select value={mapping[h] || SKIP} onValueChange={(v) => setMap((p) => ({ ...p, [h]: v === SKIP ? "" : v }))}>
                                            <SelectTrigger className="h-8 w-full min-w-40 sm:w-60" aria-label={`Field for ${h}`}><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value={SKIP}>— Don't import —</SelectItem>
                                                {fields.map((f) => <SelectItem key={f.key} value={f.key} disabled={used.has(f.key) && mapping[h] !== f.key}>{f.label}{f.required ? " *" : ""}</SelectItem>)}
                                            </SelectContent>
                                        </Select>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            </Panel>
            <Panel title="3 · Duplicates">
                <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5">
                        <Label>When a row matches an existing record</Label>
                        <Select value={mode} onValueChange={(v) => setMode(v as DuplicateMode)}>
                            <SelectTrigger aria-label="Duplicate handling"><SelectValue /></SelectTrigger>
                            <SelectContent>{DuplicateModeOptions.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent>
                        </Select>
                    </div>
                    {mode !== "create" && (
                        <div className="space-y-1.5">
                            <Label>Match on</Label>
                            <Select value={matchKey} onValueChange={setMatchKey}>
                                <SelectTrigger aria-label="Match key"><SelectValue /></SelectTrigger>
                                <SelectContent>{matchKeys.map((m) => <SelectItem key={m.key} value={m.key}>{m.label}</SelectItem>)}</SelectContent>
                            </Select>
                        </div>
                    )}
                    <div className="space-y-1.5 sm:col-span-2">
                        <Label htmlFor="save-as">Save this mapping as (optional)</Label>
                        <Input id="save-as" value={saveAs} onChange={(e) => setSaveAs(e.target.value)} placeholder="e.g. HubSpot companies export" maxLength={80} />
                    </div>
                </div>
                {mode === "update" && <p className="mt-2 text-xs text-muted-foreground">Updated records cannot be rolled back. Only records the import creates can be removed later.</p>}
            </Panel>
            {error && <p role="alert" className="text-[13px] text-danger">{error}</p>}
            <div className="flex justify-end">
                <Button onClick={next} loading={setMapping.isPending || preview.isPending}><Eye /> Check rows</Button>
            </div>
        </div>
    );
}

function RowsTable({ rows }: { rows: ImportRowResult[] }) {
    return (
        <div className="overflow-x-auto">
            <Table>
                <TableHeader>
                    <TableRow className="hover:bg-transparent">
                        <TableHead className="w-16 text-xs">Row</TableHead>
                        <TableHead className="text-xs">Record</TableHead>
                        <TableHead className="text-xs">Result</TableHead>
                        <TableHead className="hidden text-xs md:table-cell">Details</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {rows.map((r) => {
                        const o = RowPlanOptions.find((x) => x.id === r.plan);
                        return (
                            <TableRow key={r.row} className="border-border-soft">
                                <TableCell className="py-2 text-xs text-muted-foreground tabular">{r.row}</TableCell>
                                <TableCell className="max-w-48 truncate py-2 text-[13px] text-foreground">{r.label || "—"}<div className="text-xs text-danger md:hidden">{r.message}</div></TableCell>
                                <TableCell className="py-2"><Badge variant={o?.variant}>{o?.label}</Badge></TableCell>
                                <TableCell className={cn("hidden py-2 text-xs md:table-cell", r.plan === "error" ? "text-danger" : "text-muted-foreground")}>{r.message ?? ""}</TableCell>
                            </TableRow>
                        );
                    })}
                </TableBody>
            </Table>
        </div>
    );
}

function PreviewStep({ job }: { job: ImportJob }) {
    const start = useStartImport();
    const setMapping = useSetImportMapping();
    const [filter, setFilter] = useState<"all" | "error">("all");
    const summary = job.preview_summary;
    const rows = useMemo(() => (job.preview_rows ?? []).filter((r) => (filter === "all" ? r.row <= 101 : r.plan === "error")), [job.preview_rows, filter]);
    const writes = (summary?.create ?? 0) + (summary?.update ?? 0);

    if (job.status === "VALIDATING" || !summary) return <Panel title="Checking rows…"><ProgressBar value={50} /><p className="mt-2 text-[13px] text-muted-foreground">Every row is validated. Nothing is written yet.</p></Panel>;
    return (
        <div className="space-y-4">
            <StatGrid>
                <StatCard label="Will be created" value={formatNumber(summary.create)} tone="success" />
                <StatCard label="Will be updated" value={formatNumber(summary.update)} tone="info" />
                <StatCard label="Skipped (duplicates)" value={formatNumber(summary.skip)} />
                <StatCard label="Errors" value={formatNumber(summary.error)} tone={summary.error ? "danger" : "default"} hint={summary.error ? "These rows are not imported" : undefined} />
            </StatGrid>
            <Panel
                title="Preview · nothing has been written yet"
                actions={
                    <Select value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
                        <SelectTrigger className="h-8 w-36" aria-label="Show rows"><SelectValue /></SelectTrigger>
                        <SelectContent><SelectItem value="all">First rows</SelectItem><SelectItem value="error">Errors only</SelectItem></SelectContent>
                    </Select>
                }
                bodyClassName="p-0"
            >
                {rows.length ? <RowsTable rows={rows} /> : <p className="p-4 text-[13px] text-muted-foreground">No rows to show.</p>}
            </Panel>
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <Button variant="outline" loading={setMapping.isPending} onClick={() => setMapping.mutate({ id: job.id, field_mapping: job.field_mapping ?? {}, duplicate_strategy: job.duplicate_strategy ?? { mode: "skip", match_key: "name" } })}>Back to mapping</Button>
                <Button disabled={!writes} loading={start.isPending} onClick={() => start.mutate(job.id, { onSuccess: () => toast({ title: "Import started", description: "You can leave this page; it keeps running." }), onError: (e) => toast({ variant: "destructive", title: "Could not start", description: getApiErrorMessage(e) }) })}>
                    <Play /> Import {formatNumber(writes)} row{writes === 1 ? "" : "s"}
                </Button>
            </div>
        </div>
    );
}

function ResultStep({ job }: { job: ImportJob }) {
    const rollback = useRollbackImport();
    const download = useDownloadImportErrors();
    const [confirm, setConfirm] = useState(false);
    const running = job.status === "IMPORTING";
    const pct = job.total_rows ? (job.processed_rows / job.total_rows) * 100 : 0;
    return (
        <div className="space-y-4">
            {running && (
                <Panel title="Importing…">
                    <ProgressBar value={pct} />
                    <p className="mt-2 text-[13px] text-muted-foreground tabular">{formatNumber(job.processed_rows)} of {formatNumber(job.total_rows)} rows · you can leave this page.</p>
                </Panel>
            )}
            {job.status === "COMPLETED" && <div className="flex items-center gap-2 rounded-md border border-success/40 bg-success-soft p-3 text-[13px] text-success"><CheckCircle2 className="size-4" /> Import finished {job.completed_at ? formatDateTime(job.completed_at) : ""}.</div>}
            {job.status === "FAILED" && <div className="flex items-center gap-2 rounded-md border border-danger/40 bg-danger-soft p-3 text-[13px] text-danger"><AlertTriangle className="size-4" /> The import stopped early. Records created before the failure are listed below and can be rolled back.</div>}
            {job.status === "ROLLED_BACK" && <div className="rounded-md border border-border bg-muted/50 p-3 text-[13px] text-muted-foreground">Rolled back {job.rolled_back_at ? formatDateTime(job.rolled_back_at) : ""}: the created records were deleted{job.created_count ? ` (${job.created_count} kept because other records now depend on them)` : ""}.</div>}
            <StatGrid>
                <StatCard label="Created" value={formatNumber(job.imported_rows)} tone="success" />
                <StatCard label="Updated" value={formatNumber(job.updated_rows)} tone="info" />
                <StatCard label="Skipped" value={formatNumber(job.skipped_rows)} />
                <StatCard label="Errors" value={formatNumber(job.error_rows)} tone={job.error_rows ? "danger" : "default"} />
            </StatGrid>
            {!!job.error_sample.length && (
                <Panel title="Rows with errors" actions={<Button size="sm" variant="outline" loading={download.isPending} onClick={() => download.mutate(job.id, { onError: (e) => toast({ variant: "destructive", title: "Could not download", description: getApiErrorMessage(e) }) })}><Download /> Error file</Button>} bodyClassName="p-0">
                    <RowsTable rows={job.error_sample} />
                </Panel>
            )}
            {(job.status === "COMPLETED" || job.status === "FAILED") && job.created_count > 0 && (
                <div className="flex justify-end">
                    <Button variant="outline" onClick={() => setConfirm(true)}><Undo2 /> Roll back {job.created_count} created record{job.created_count === 1 ? "" : "s"}</Button>
                </div>
            )}
            <ConfirmationDialog
                isOpen={confirm}
                onClose={() => setConfirm(false)}
                title="Roll back this import?"
                description={`Deletes the ${job.created_count} record(s) this import created, with their notes, tags and custom field values. Updated records keep their new values. Companies that already have deals are kept.`}
                confirmText="Roll back"
                variant="destructive"
                isLoading={rollback.isPending}
                onConfirm={() => rollback.mutate(job.id, {
                    onSuccess: (r) => { toast({ title: "Import rolled back", description: `${r.deleted} deleted${r.kept ? `, ${r.kept} kept` : ""}.` }); setConfirm(false); },
                    onError: (e) => toast({ variant: "destructive", title: "Could not roll back", description: getApiErrorMessage(e) }),
                })}
            />
            {!running && <div className="flex justify-end"><Button variant="ghost" asChild><Link to={CrmPaths.imports}><Save /> New import</Link></Button></div>}
        </div>
    );
}
