import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FileUp, Upload } from "lucide-react";
import { Page, PageHeader } from "@/components/ui/page";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useListParams } from "@/hooks/use-list-params";
import { getApiErrorMessage } from "@/lib/api-error";
import { formatDateTime, formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import { getDropdownOptionLabel } from "@/lib/dropdown-option-label.utils";
import { CustomFieldEntityOptions } from "@/config/constants/dropdowns/crm/custom-field.options";
import { ImportStatusOptions } from "@/config/constants/dropdowns/crm/crm-import.options";
import { useImports, useUploadImport } from "@/features/crm/imports/hooks/use-imports";
import type { ImportEntity, ImportJobListItem } from "@/features/crm/imports/interfaces/imports.interfaces";
import { CrmPaths } from "../../crm-paths";
import { MemberChip, Panel } from "../../components/crm-ui";

const MAX_MB = 5;

/**
 * Import (mockup `imports` step 1 + history, 02 §22).
 * @route /crm/imports
 * @perm crm.records.import (sensitive) + the record type's create key (checked by the API)
 * @api POST /crm/imports (multipart) · GET /crm/imports
 * @mcp crm_records_import_list
 */
export default function ImportsPage() {
    const navigate = useNavigate();
    const { params, setPage } = useListParams({ limit: 20 });
    const history = useImports(params);
    const upload = useUploadImport();
    const [entity, setEntity] = useState<ImportEntity>("CRM_COMPANY");
    const [file, setFile] = useState<File | null>(null);
    const [drag, setDrag] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const input = useRef<HTMLInputElement>(null);

    const pick = (f: File | undefined | null) => {
        setError(null);
        if (!f) return;
        if (!/\.(csv|txt)$/i.test(f.name)) return setError("Choose a .csv file");
        if (f.size > MAX_MB * 1024 * 1024) return setError(`The file is larger than ${MAX_MB} MB. Split it into smaller files.`);
        setFile(f);
    };

    const start = () => {
        if (!file) return setError("Choose a CSV file first");
        upload.mutate({ file, entity_type: entity }, {
            onSuccess: (job) => navigate(CrmPaths.import(job.id)),
            onError: (e) => setError(getApiErrorMessage(e)),
        });
    };

    const columns: DataTableColumn<ImportJobListItem>[] = [
        { key: "file", header: "File", cell: (j) => <div className="min-w-0"><div className="truncate font-medium text-foreground">{j.file_name ?? "Import"}</div><div className="text-xs text-muted-foreground">{getDropdownOptionLabel(CustomFieldEntityOptions, j.entity_type)} · {formatNumber(j.total_rows)} rows</div></div> },
        { key: "status", header: "Status", cell: (j) => { const o = ImportStatusOptions.find((x) => x.id === j.status); return <Badge variant={o?.variant}>{o?.label ?? j.status}</Badge>; } },
        { key: "result", header: "Result", cell: (j) => (j.status === "COMPLETED" || j.status === "ROLLED_BACK" ? <span className="text-xs text-muted-foreground tabular">{j.imported_rows} new · {j.updated_rows} updated · {j.skipped_rows} skipped · {j.error_rows} errors</span> : "—"), hideBelow: "md" },
        { key: "by", header: "By", cell: (j) => <MemberChip member={j.started_by} />, hideBelow: "lg" },
        { key: "at", header: "Created", cell: (j) => formatDateTime(j.created_at), hideBelow: "sm" },
    ];

    return (
        <Page width="wide">
            <PageHeader back={{ to: CrmPaths.root, label: "CRM" }} title="Import" description="Bring companies, contacts, leads or deals in from a CSV file. Nothing is written until you confirm the preview." />
            <Panel title="1 · Upload" className="mb-5">
                <div className="grid gap-4 md:grid-cols-[14rem_1fr]">
                    <div className="space-y-1.5">
                        <Label>Import as</Label>
                        <Select value={entity} onValueChange={(v) => setEntity(v as ImportEntity)}>
                            <SelectTrigger aria-label="Record type"><SelectValue /></SelectTrigger>
                            <SelectContent>{CustomFieldEntityOptions.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent>
                        </Select>
                        <p className="text-xs text-muted-foreground">Import companies before contacts and deals so they can be linked by company name.</p>
                    </div>
                    <div>
                        <button
                            type="button"
                            onClick={() => input.current?.click()}
                            onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
                            onDragLeave={() => setDrag(false)}
                            onDrop={(e) => { e.preventDefault(); setDrag(false); pick(e.dataTransfer.files?.[0]); }}
                            className={cn("flex w-full flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border px-4 py-8 text-center transition-colors hover:bg-muted/50", drag && "border-primary bg-muted/50")}
                        >
                            <FileUp className="size-6 text-muted-foreground" />
                            {file ? <span className="text-[13px] font-medium text-foreground">{file.name} · {(file.size / 1024).toFixed(0)} KB</span> : <span className="text-[13px] text-foreground">Drop a CSV here or click to choose</span>}
                            <span className="text-xs text-muted-foreground">UTF-8, first row = column names · up to {MAX_MB} MB and 10 000 rows</span>
                        </button>
                        <input ref={input} type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => { pick(e.target.files?.[0]); e.target.value = ""; }} />
                        {error && <p role="alert" className="mt-2 text-[13px] text-danger">{error}</p>}
                        <div className="mt-3 flex justify-end"><Button onClick={start} loading={upload.isPending} disabled={!file}><Upload /> Upload and map columns</Button></div>
                    </div>
                </div>
            </Panel>
            <h2 className="mb-2 text-[13px] font-medium text-foreground">History</h2>
            <DataTable
                columns={columns}
                data={history.data?.data}
                rowKey={(j) => j.id}
                loading={history.isFetching}
                error={history.error}
                onRetry={() => history.refetch()}
                pagination={history.data?.pagination}
                onPageChange={setPage}
                rowHref={(j) => CrmPaths.import(j.id)}
                empty={{ icon: FileUp, title: "No imports yet", description: "Your imports and their results appear here." }}
            />
        </Page>
    );
}
