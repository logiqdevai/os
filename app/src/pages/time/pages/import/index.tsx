import { useRef, useState } from "react";
import { CheckCircle2, FileUp, History, Loader2, Play, RotateCcw, Upload } from "lucide-react";
import { Page, PageHeader } from "@/components/ui/page";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ErrorState } from "@/components/ui/states";
import { useListParams } from "@/hooks/use-list-params";
import { usePreviewTimeImport, useRunTimeImport, useTimeImport, useTimeImports, useUploadTimeImport } from "@/features/time/imports/hooks/use-imports";
import type { TimeImportDetail, TimeImportJob, TimeImportPreview } from "@/features/time/imports/interfaces/imports.interfaces";
import { TimeImportStatusFormOptions, TimeImportStatusTone } from "@/config/constants/dropdowns/time/time-form.options";
import { getDropdownOptionLabel } from "@/lib/dropdown-option-label.utils";
import { formatDate, formatDateTime, formatMinutes, personName } from "@/lib/format";
import { toast } from "@/hooks/use-toast";
import { Panel } from "@/pages/people/components/person";

const IGNORE = "__ignore__";

/**
 * /time/import — CSV import of time entries: upload → map → check → import in the background. Rows for other members need time.entries.create_team.
 * @perm time.imports.manage + time.entries.create_own · @api POST /time/imports · PUT /time/imports/:id/mapping · POST /time/imports/:id/run
 */
export default function TimeImportPage() {
    const [jobId, setJobId] = useState<string | null>(null);
    const job = useTimeImport(jobId);
    return (
        <Page width="wide">
            <PageHeader title="Import time" description="Bring in time entries from a CSV export of another tool." />
            {!jobId ? <UploadStep onUploaded={setJobId} /> : job.isLoading ? <Panel><div className="flex items-center gap-2 text-[13px] text-muted-foreground"><Loader2 className="size-4 animate-spin" /> Loading…</div></Panel>
                : job.error || !job.data ? <ErrorState error={job.error} onRetry={() => job.refetch()} />
                    : <Flow job={job.data} onReset={() => setJobId(null)} />}
            <div className="mt-8"><History2 onOpen={setJobId} /></div>
        </Page>
    );
}

function UploadStep({ onUploaded }: { onUploaded: (id: string) => void }) {
    const input = useRef<HTMLInputElement>(null);
    const upload = useUploadTimeImport();
    const pick = async (file: File | undefined) => {
        if (!file) return;
        if (file.size > 5 * 1024 * 1024) return toast({ variant: "destructive", title: "The file is larger than 5 MB" });
        upload.mutate({ file_name: file.name, csv: await file.text() }, { onSuccess: (j) => onUploaded(j.id) });
        if (input.current) input.current.value = "";
    };
    return (
        <Panel title="1 · Upload a CSV file">
            <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-border px-4 py-10 text-center" onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); void pick(e.dataTransfer.files[0]); }}>
                <FileUp className="size-8 text-muted-foreground" />
                <div className="text-[13px] text-foreground">Drop a CSV here or choose a file</div>
                <p className="max-w-md text-xs text-muted-foreground">Needs a date and a duration (hours, minutes, or start and end). Projects match by code or name, tasks by key (WEB-12), people by email. Entries are created as drafts.</p>
                <input ref={input} type="file" accept=".csv,text/csv" className="sr-only" aria-label="CSV file" onChange={(e) => void pick(e.target.files?.[0])} />
                <Button loading={upload.isPending} onClick={() => input.current?.click()}><Upload /> Choose file</Button>
            </div>
        </Panel>
    );
}

function Flow({ job, onReset }: { job: TimeImportDetail; onReset: () => void }) {
    const [columns, setColumns] = useState<Record<string, string>>(() => job.mapping?.columns ?? {});
    const [preview, setPreview] = useState<TimeImportPreview | null>(null);
    const check = usePreviewTimeImport();
    const run = useRunTimeImport();
    const used = new Set(Object.values(columns));
    const ready = used.has("date") && (used.has("hours") || used.has("minutes") || (used.has("start") && used.has("end")));

    if (job.status !== "PENDING") {
        const done = job.status !== "PROCESSING";
        return (
            <Panel title={<span className="flex items-center gap-2">{job.file_name}<Badge variant={TimeImportStatusTone[job.status]}>{getDropdownOptionLabel(TimeImportStatusFormOptions, job.status)}</Badge></span>}
                actions={done && <Button size="sm" variant="outline" onClick={onReset}><RotateCcw /> New import</Button>}>
                {!done && <div className="mb-4 space-y-2"><div className="flex items-center gap-2 text-[13px] text-muted-foreground"><Loader2 className="size-4 animate-spin" /> Importing…</div><Progress value={job.total_rows ? (job.imported_rows / job.total_rows) * 100 : 0} className="h-1.5" /></div>}
                <div className="grid grid-cols-3 gap-3">
                    <Count label="Imported" value={job.imported_rows} />
                    <Count label="Already imported" value={job.skipped_rows} />
                    <Count label="Failed" value={job.failed_rows} danger={job.failed_rows > 0} />
                </div>
                {job.status === "COMPLETED" && <p className="mt-4 flex items-center gap-2 text-[13px] text-foreground"><CheckCircle2 className="size-4 text-success" /> Finished {formatDateTime(job.completed_at)}. Entries are drafts in their timesheets.</p>}
                {!!job.errors?.length && <div className="mt-4"><Errors errors={job.errors} /></div>}
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
                                    {job.fields.map((f) => <SelectItem key={f.key} value={f.key} disabled={used.has(f.key) && columns[c] !== f.key}>{f.label}{f.required ? " *" : ""}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                    ))}
                </div>
                <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-xs text-muted-foreground">{ready ? "Ready to check." : "Map Date and a duration (Hours, Minutes, or Start and End)."}</p>
                    <Button disabled={!ready} loading={check.isPending} onClick={() => check.mutate({ id: job.id, columns }, { onSuccess: setPreview })}>Check file</Button>
                </div>
            </Panel>
            {preview && (
                <Panel title="3 · Preview" actions={<Button disabled={!preview.counts.valid} loading={run.isPending} onClick={() => run.mutate(job.id)}><Play /> Import {preview.counts.valid} rows</Button>}>
                    <div className="grid grid-cols-3 gap-3">
                        <Count label="Valid rows" value={preview.counts.valid} />
                        <Count label="Rows with errors" value={preview.counts.errors} danger={preview.counts.errors > 0} />
                        <div className="rounded-md border border-border p-3"><div className="text-xs text-muted-foreground">Time</div><div className="text-lg font-medium tabular text-foreground">{formatMinutes(preview.counts.minutes)}</div></div>
                    </div>
                    {!!preview.errors.length && <div className="mt-4"><Errors errors={preview.errors} /></div>}
                    <div className="mt-4 overflow-x-auto rounded-md border border-border">
                        <table className="w-full min-w-[28rem] text-[13px]">
                            <thead className="bg-secondary text-left text-xs text-muted-foreground"><tr><th className="px-3 py-2 font-medium">Row</th><th className="px-3 py-2 font-medium">Date</th><th className="px-3 py-2 font-medium">Time</th><th className="px-3 py-2 font-medium">Description</th></tr></thead>
                            <tbody className="divide-y divide-border">
                                {preview.preview.map((r) => <tr key={r.row}><td className="px-3 py-1.5 tabular text-muted-foreground">{r.row}</td><td className="px-3 py-1.5 tabular">{r.date ? formatDate(r.date) : "—"}</td><td className="px-3 py-1.5 tabular">{r.duration_minutes ? formatMinutes(r.duration_minutes) : "—"}</td><td className="max-w-[16rem] truncate px-3 py-1.5 text-muted-foreground">{r.description ?? "—"}</td></tr>)}
                            </tbody>
                        </table>
                    </div>
                </Panel>
            )}
        </div>
    );
}

function Count({ label, value, danger }: { label: string; value: number; danger?: boolean }) {
    return <div className="rounded-md border border-border p-3"><div className="text-xs text-muted-foreground">{label}</div><div className={danger ? "text-lg font-medium tabular text-danger" : "text-lg font-medium tabular text-foreground"}>{value}</div></div>;
}

function Errors({ errors }: { errors: { row: number; field?: string; message: string }[] }) {
    return (
        <ul className="max-h-60 divide-y divide-border overflow-y-auto rounded-md border border-border text-[13px]">
            {errors.slice(0, 200).map((e, i) => <li key={`${e.row}-${i}`} className="flex gap-3 px-3 py-1.5"><span className="w-14 shrink-0 tabular text-muted-foreground">{e.row ? `Row ${e.row}` : "File"}</span><span className="min-w-0 text-foreground">{e.field && <span className="text-muted-foreground">{e.field}: </span>}{e.message}</span></li>)}
        </ul>
    );
}

function History2({ onOpen }: { onOpen: (id: string) => void }) {
    const { params, setPage } = useListParams();
    const q = useTimeImports({ page: params.page, limit: 10 });
    const columns: DataTableColumn<TimeImportJob>[] = [
        { key: "file", header: "File", cell: (j) => <span className="font-medium text-foreground">{j.mapping?.file_name ?? "—"}</span> },
        { key: "by", header: "By", cell: (j) => (j.created_by ? personName(j.created_by.user) : "—"), hideBelow: "md" },
        { key: "when", header: "Uploaded", cell: (j) => <span className="tabular">{formatDateTime(j.created_at)}</span>, hideBelow: "sm" },
        { key: "status", header: "Status", cell: (j) => <Badge variant={TimeImportStatusTone[j.status]}>{getDropdownOptionLabel(TimeImportStatusFormOptions, j.status)}</Badge> },
    ];
    return (
        <section className="space-y-3">
            <h2 className="flex items-center gap-2 text-[15px] font-medium text-foreground"><History className="size-4 text-muted-foreground" /> Previous imports</h2>
            <DataTable columns={columns} data={q.data?.data} rowKey={(j) => j.id} loading={q.isFetching} error={q.error} onRetry={() => q.refetch()} pagination={q.data?.pagination} onPageChange={setPage}
                onRowClick={(j) => onOpen(j.id)} empty={{ icon: History, title: "No imports yet", description: "Uploaded files appear here with their results." }} />
        </section>
    );
}
