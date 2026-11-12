import { useRef, useState } from "react";
import { CheckCircle2, FileUp, History, Loader2, Play, RotateCcw, Upload } from "lucide-react";
import { Page, PageHeader } from "@/components/ui/page";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ErrorState } from "@/components/ui/states";
import { useListParams } from "@/hooks/use-list-params";
import { usePermissions } from "@/hooks/use-permission";
import { useEmployeeImport, useEmployeeImports, usePreviewEmployeeImport, useRunEmployeeImport, useUploadEmployeeImport } from "@/features/people/imports/hooks/use-imports";
import type { EmployeeImportDetail, EmployeeImportJob, EmployeeImportPreview, ImportRowError } from "@/features/people/imports/interfaces/imports.interfaces";
import { ImportStatusFormOptions, ImportStatusTone } from "@/config/constants/dropdowns/people/employee-form.options";
import { getDropdownOptionLabel } from "@/lib/dropdown-option-label.utils";
import { formatDateTime } from "@/lib/format";
import { toast } from "@/hooks/use-toast";
import { getApiErrorMessage } from "@/lib/api-error";
import { Panel } from "../../components/person";

const IGNORE = "__ignore__";
const fail = (title: string) => (e: unknown) => toast({ variant: "destructive", title, description: getApiErrorMessage(e) });

/**
 * /people/import — employee CSV import: upload → map columns → preview (dry run) → run in the background.
 * @perm employees.employees.import + employees.employees.create (update existing: employees.employees.update)
 * @api POST /people/imports · PUT /people/imports/:id/mapping · POST /people/imports/:id/run · GET /people/imports(/:id)
 */
export default function EmployeeImportPage() {
    const [jobId, setJobId] = useState<string | null>(null);
    const job = useEmployeeImport(jobId);
    return (
        <Page width="wide">
            <PageHeader title="Import employees" description="Create or update employee records from a CSV file." />
            {!jobId ? <UploadStep onUploaded={setJobId} /> : job.isLoading ? <Panel><div className="flex items-center gap-2 text-[13px] text-muted-foreground"><Loader2 className="size-4 animate-spin" /> Loading…</div></Panel>
                : job.error || !job.data ? <ErrorState error={job.error} onRetry={() => job.refetch()} />
                    : <JobFlow job={job.data} onReset={() => setJobId(null)} />}
            <div className="mt-8"><ImportHistory onOpen={setJobId} /></div>
        </Page>
    );
}

function UploadStep({ onUploaded }: { onUploaded: (id: string) => void }) {
    const input = useRef<HTMLInputElement>(null);
    const upload = useUploadEmployeeImport();
    const pick = async (file: File | undefined) => {
        if (!file) return;
        if (file.size > 5 * 1024 * 1024) return toast({ variant: "destructive", title: "The file is larger than 5 MB" });
        const csv = await file.text();
        upload.mutate({ file_name: file.name, csv }, { onSuccess: (j) => onUploaded(j.id), onError: fail("Could not read the file") });
        if (input.current) input.current.value = "";
    };
    return (
        <Panel title="1 · Upload a CSV file">
            <div
                className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-border px-4 py-10 text-center"
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => { e.preventDefault(); void pick(e.dataTransfer.files[0]); }}
            >
                <FileUp className="size-8 text-muted-foreground" />
                <div className="text-[13px] text-foreground">Drop a CSV here or choose a file</div>
                <p className="max-w-md text-xs text-muted-foreground">First row = column names. Required: work email; new employees also need a first or last name. Department and branch are matched by name, the manager by email.</p>
                <input ref={input} type="file" accept=".csv,text/csv" className="sr-only" aria-label="CSV file" onChange={(e) => void pick(e.target.files?.[0])} />
                <Button loading={upload.isPending} onClick={() => input.current?.click()}><Upload /> Choose file</Button>
            </div>
        </Panel>
    );
}

function JobFlow({ job, onReset }: { job: EmployeeImportDetail; onReset: () => void }) {
    const p = usePermissions();
    const [columns, setColumns] = useState<Record<string, string>>(() => job.mapping?.columns ?? {});
    const [updateExisting, setUpdateExisting] = useState(!!job.mapping?.update_existing);
    const [preview, setPreview] = useState<EmployeeImportPreview | null>(null);
    const previewing = usePreviewEmployeeImport();
    const run = useRunEmployeeImport();
    const done = job.status === "COMPLETED" || job.status === "FAILED";
    const running = job.status === "IMPORTING";
    const usedFields = new Set(Object.values(columns));
    const emailMapped = usedFields.has("email");

    if (running || done) {
        const processed = job.created_rows + job.updated_rows;
        return (
            <Panel title={<span className="flex items-center gap-2">{job.file_name}<Badge variant={ImportStatusTone[job.status]}>{getDropdownOptionLabel(ImportStatusFormOptions, job.status)}</Badge></span>}
                actions={done && <Button size="sm" variant="outline" onClick={onReset}><RotateCcw /> New import</Button>}>
                {running && (
                    <div className="mb-4 space-y-2">
                        <div className="flex items-center gap-2 text-[13px] text-muted-foreground"><Loader2 className="size-4 animate-spin" /> Importing… you can leave this page; the import continues.</div>
                        <Progress value={job.total_rows ? (processed / job.total_rows) * 100 : 0} className="h-1.5" />
                    </div>
                )}
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <Count label="Created" value={job.created_rows} />
                    <Count label="Updated" value={job.updated_rows} />
                    <Count label="Skipped" value={job.skipped_rows} />
                    <Count label="Rows with errors" value={job.error_rows} tone={job.error_rows ? "danger" : undefined} />
                </div>
                {done && job.status === "COMPLETED" && <p className="mt-4 flex items-center gap-2 text-[13px] text-foreground"><CheckCircle2 className="size-4 text-success" /> Finished {formatDateTime(job.completed_at)}. New hires were added as pending members; invite them from Admin → Members.</p>}
                {!!job.errors?.length && <div className="mt-4"><ErrorList errors={job.errors} /></div>}
            </Panel>
        );
    }

    return (
        <div className="space-y-4">
            <Panel title={`2 · Map columns · ${job.file_name ?? "file"} (${job.total_rows} rows)`} actions={<Button size="sm" variant="ghost" onClick={onReset}><RotateCcw /> Start over</Button>}>
                <div className="grid gap-3 md:grid-cols-2">
                    {job.columns.map((c, i) => (
                        <div key={c} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] items-center gap-2 rounded-md border border-border p-2">
                            <div className="min-w-0">
                                <div className="truncate text-[13px] font-medium text-foreground">{c}</div>
                                <div className="truncate text-xs text-muted-foreground">{job.sample.map((r) => r[i]).filter(Boolean).slice(0, 2).join(" · ") || "—"}</div>
                            </div>
                            <Select value={columns[c] ?? IGNORE} onValueChange={(v) => { setPreview(null); setColumns((prev) => { const n = { ...prev }; if (v === IGNORE) delete n[c]; else n[c] = v; return n; }); }}>
                                <SelectTrigger className="h-8" aria-label={`Field for ${c}`}><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value={IGNORE}>Don’t import</SelectItem>
                                    {job.fields.map((f) => <SelectItem key={f.key} value={f.key} disabled={usedFields.has(f.key) && columns[c] !== f.key}>{f.label}{f.required ? " *" : ""}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                    ))}
                </div>
                <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <label className="flex items-center gap-2 text-[13px] text-foreground">
                        <Switch checked={updateExisting} disabled={!p.can("employees.employees.update")} onCheckedChange={(v) => { setUpdateExisting(v); setPreview(null); }} />
                        Update employees that already exist
                    </label>
                    <Button disabled={!emailMapped} loading={previewing.isPending} onClick={() => previewing.mutate({ id: job.id, columns, update_existing: updateExisting }, { onSuccess: setPreview, onError: fail("Could not check the file") })}>Check file</Button>
                </div>
                {!emailMapped && <p className="mt-2 text-xs text-muted-foreground">Map a column to Work email to continue.</p>}
            </Panel>

            {preview && (
                <Panel title="3 · Preview" actions={
                    <Button disabled={!preview.counts.create && !preview.counts.update} loading={run.isPending} onClick={() => run.mutate(job.id, { onSuccess: () => toast({ title: "Import started" }), onError: fail("Could not start the import") })}>
                        <Play /> Import {preview.counts.create + preview.counts.update} row{preview.counts.create + preview.counts.update === 1 ? "" : "s"}
                    </Button>
                }>
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                        <Count label="New employees" value={preview.counts.create} />
                        <Count label="Updates" value={preview.counts.update} />
                        <Count label="Skipped (exist)" value={preview.counts.skip} />
                        <Count label="Rows with errors" value={preview.counts.errors} tone={preview.counts.errors ? "danger" : undefined} />
                    </div>
                    {!!preview.errors.length && <div className="mt-4"><ErrorList errors={preview.errors} note="Rows with errors are skipped." /></div>}
                    <div className="mt-4 overflow-x-auto rounded-md border border-border">
                        <table className="w-full min-w-[32rem] text-[13px]">
                            <thead className="bg-secondary text-left text-xs text-muted-foreground"><tr><th className="px-3 py-2 font-medium">Row</th><th className="px-3 py-2 font-medium">Action</th><th className="px-3 py-2 font-medium">Email</th><th className="px-3 py-2 font-medium">Name / title</th></tr></thead>
                            <tbody className="divide-y divide-border">
                                {preview.preview.map((r) => (
                                    <tr key={r.row}>
                                        <td className="px-3 py-1.5 tabular text-muted-foreground">{r.row}</td>
                                        <td className="px-3 py-1.5"><Badge variant={r.action === "create" ? "success" : r.action === "update" ? "info" : "neutral"}>{r.action === "create" ? "New" : r.action === "update" ? "Update" : "Skip"}</Badge></td>
                                        <td className="px-3 py-1.5 text-foreground">{r.email}</td>
                                        <td className="px-3 py-1.5 text-muted-foreground">{[r.preferred_name, r.job_title].filter(Boolean).map(String).join(" · ") || "—"}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </Panel>
            )}
        </div>
    );
}

function Count({ label, value, tone }: { label: string; value: number; tone?: "danger" }) {
    return (
        <div className="rounded-md border border-border p-3">
            <div className="text-xs text-muted-foreground">{label}</div>
            <div className={tone === "danger" ? "text-lg font-medium tabular text-danger" : "text-lg font-medium tabular text-foreground"}>{value}</div>
        </div>
    );
}

function ErrorList({ errors, note }: { errors: ImportRowError[]; note?: string }) {
    return (
        <div>
            <div className="mb-1.5 text-xs text-muted-foreground">{errors.length} problem{errors.length === 1 ? "" : "s"}{note ? ` · ${note}` : ""}</div>
            <ul className="max-h-60 divide-y divide-border overflow-y-auto rounded-md border border-border text-[13px]">
                {errors.slice(0, 200).map((e, i) => (
                    <li key={`${e.row}-${i}`} className="flex gap-3 px-3 py-1.5">
                        <span className="w-14 shrink-0 tabular text-muted-foreground">{e.row ? `Row ${e.row}` : "File"}</span>
                        <span className="min-w-0 text-foreground">{e.field ? <span className="text-muted-foreground">{e.field}: </span> : null}{e.message}</span>
                    </li>
                ))}
            </ul>
        </div>
    );
}

function ImportHistory({ onOpen }: { onOpen: (id: string) => void }) {
    const { params, setPage } = useListParams();
    const q = useEmployeeImports({ page: params.page, limit: 10 });
    const columns: DataTableColumn<EmployeeImportJob>[] = [
        { key: "file", header: "File", cell: (j) => <span className="font-medium text-foreground">{j.file_name ?? "—"}</span> },
        { key: "when", header: "Uploaded", cell: (j) => <span className="tabular">{formatDateTime(j.created_at)}</span>, hideBelow: "md" },
        { key: "rows", header: "Result", cell: (j) => <span className="text-xs text-muted-foreground tabular">{j.status === "COMPLETED" ? `${j.created_rows} new · ${j.updated_rows} updated · ${j.error_rows} errors` : `${j.total_rows} rows`}</span>, hideBelow: "sm" },
        { key: "status", header: "Status", cell: (j) => <Badge variant={ImportStatusTone[j.status]}>{getDropdownOptionLabel(ImportStatusFormOptions, j.status)}</Badge> },
    ];
    return (
        <section className="space-y-3">
            <h2 className="flex items-center gap-2 text-[15px] font-medium text-foreground"><History className="size-4 text-muted-foreground" /> Previous imports</h2>
            <DataTable columns={columns} data={q.data?.data} rowKey={(j) => j.id} loading={q.isFetching} error={q.error} onRetry={() => q.refetch()} pagination={q.data?.pagination} onPageChange={setPage}
                onRowClick={(j) => onOpen(j.id)} empty={{ icon: History, title: "No imports yet", description: "Uploaded files appear here with their results." }} />
        </section>
    );
}
