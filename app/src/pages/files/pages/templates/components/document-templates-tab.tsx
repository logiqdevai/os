import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Archive, FilePlus2, FileText, MoreHorizontal, Plus, Wand2 } from "lucide-react";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { EntityPicker } from "@/components/ui/entity-picker";
import { ErrorState, ListSkeleton } from "@/components/ui/states";
import ConfirmationDialog from "@/components/ui/confirmation-dialog";
import { usePermission } from "@/hooks/use-permission";
import { toast } from "@/hooks/use-toast";
import { getApiErrorMessage } from "@/lib/api-error";
import { formatRelative } from "@/lib/format";
import {
    useArchiveDocumentTemplate, useCreateDocumentTemplate, useDocuments, useDocumentTemplate, useDocumentTemplates, useFolderTree, useGenerateFromTemplate,
} from "@/features/files/hooks/use-files";
import type { DocumentTemplate } from "@/features/files/interfaces/files.interfaces";

/**
 * Document templates (17 §4): a text document (Markdown, plain text, HTML, CSV) with {{placeholders}} that generates
 * new documents. Generated files are normal documents (source GENERATED) with versions, sharing and retention.
 * @perm VIEW documents.templates.read · ACTION documents.templates.manage · generate + documents.documents.create
 * @api GET/POST /files/document-templates · GET /:id · POST /:id/archive · POST /:id/generate @mcp documents_templates_list|get|generate
 * @audit document_template.created|archived|generated
 */
export function DocumentTemplatesTab() {
    const navigate = useNavigate();
    const canManage = usePermission("documents.templates.manage");
    const canGenerate = usePermission("documents.documents.create");
    const templates = useDocumentTemplates({ limit: 100 });
    const archive = useArchiveDocumentTemplate();
    const [createOpen, setCreateOpen] = useState(false);
    const [generating, setGenerating] = useState<DocumentTemplate | null>(null);
    const [archiving, setArchiving] = useState<DocumentTemplate | null>(null);

    const columns: DataTableColumn<DocumentTemplate>[] = [
        {
            key: "name",
            header: "Template",
            cell: (t) => (
                <div className="flex min-w-0 items-center gap-2">
                    <FileText className="size-4 shrink-0 text-muted-foreground" />
                    <div className="min-w-0">
                        <div className="truncate font-medium text-foreground">{t.name}</div>
                        <div className="truncate text-xs text-muted-foreground">{t.description ?? t.source_version.filename}</div>
                    </div>
                </div>
            ),
        },
        { key: "vars", header: "Fields", cell: (t) => <span className="tabular">{t.variables?.length ?? 0}</span>, hideBelow: "sm" },
        { key: "folder", header: "Saves to", cell: (t) => t.folder?.name ?? <span className="text-muted-foreground">Choose each time</span>, hideBelow: "md" },
        { key: "used", header: "Used", cell: (t) => <span className="text-xs text-muted-foreground">{t.usage_count}×{t.last_used_at ? ` · ${formatRelative(t.last_used_at)}` : ""}</span>, hideBelow: "lg" },
        {
            key: "actions",
            header: <span className="sr-only">Actions</span>,
            className: "w-36",
            cell: (t) => (
                <div className="flex justify-end gap-1">
                    {canGenerate && <Button size="sm" variant="outline" onClick={() => setGenerating(t)}><Wand2 /> Generate</Button>}
                    {canManage && (
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild><Button variant="ghost" size="icon-sm" aria-label={`Actions for ${t.name}`}><MoreHorizontal /></Button></DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                <DropdownMenuItem onSelect={() => navigate(`/files/documents/${t.source_version.document_id}`)}><FileText /> Open source document</DropdownMenuItem>
                                <DropdownMenuItem className="text-danger focus:text-danger" onSelect={() => setArchiving(t)}><Archive /> Archive</DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    )}
                </div>
            ),
        },
    ];

    return (
        <>
            {canManage && <div className="mb-3 flex justify-end"><Button size="sm" onClick={() => setCreateOpen(true)}><Plus /> New document template</Button></div>}
            <DataTable
                columns={columns}
                data={templates.data?.data}
                rowKey={(t) => t.id}
                loading={templates.isFetching}
                error={templates.error}
                onRetry={() => templates.refetch()}
                pagination={templates.data?.pagination}
                empty={{ icon: FileText, title: "No document templates", description: "Upload a Markdown or text file with {{client_name}}-style placeholders, then turn it into a template." }}
            />
            <CreateTemplateDialog open={createOpen} onOpenChange={setCreateOpen} />
            <GenerateDialog template={generating} onClose={() => setGenerating(null)} />
            <ConfirmationDialog
                isOpen={!!archiving}
                onClose={() => setArchiving(null)}
                title={`Archive ${archiving?.name}?`}
                description="Documents generated from it are kept. The template cannot generate new documents."
                confirmText="Archive"
                variant="destructive"
                isLoading={archive.isPending}
                onConfirm={() => archiving && archive.mutate(archiving.id, { onSuccess: () => { toast({ title: "Template archived" }); setArchiving(null); }, onError: (e) => toast({ variant: "destructive", title: "Could not archive", description: getApiErrorMessage(e) }) })}
            />
        </>
    );
}

function CreateTemplateDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
    const create = useCreateDocumentTemplate();
    const folders = useFolderTree();
    const [search, setSearch] = useState("");
    const docs = useDocuments({ search: search || undefined, limit: 30 }, open);
    const [documentId, setDocumentId] = useState<string | null>(null);
    const [name, setName] = useState("");
    const [description, setDescription] = useState("");
    const [folderId, setFolderId] = useState<string | null>(null);
    useEffect(() => { if (open) { setDocumentId(null); setName(""); setDescription(""); setFolderId(null); setSearch(""); } }, [open]);

    const docItems = useMemo(() => (docs.data?.data ?? []).map((d) => ({ id: d.id, label: d.title, hint: d.filename })), [docs.data]);
    const folderItems = useMemo(() => (folders.data ?? []).map((f) => ({ id: f.id, label: `${"— ".repeat(f.depth)}${f.name}`, keywords: f.name })), [folders.data]);

    const submit = () => documentId && name.trim() && create.mutate({ document_id: documentId, name: name.trim(), description: description || null, folder_id: folderId }, {
        onSuccess: (t) => { toast({ title: "Template created", description: `${t.variables?.length ?? 0} fields found` }); onOpenChange(false); },
        onError: (e) => toast({ variant: "destructive", title: "Could not create the template", description: getApiErrorMessage(e) }),
    });

    return (
        <Dialog open={open} onOpenChange={(o) => !create.isPending && onOpenChange(o)}>
            <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle>New document template</DialogTitle>
                    <DialogDescription>Pick an uploaded text document (Markdown, .txt, HTML, CSV). Its {"{{placeholders}}"} become the fields to fill; {"{{name | default}}"} sets a default.</DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                    <div className="space-y-1.5">
                        <Label>Source document</Label>
                        <EntityPicker items={docItems} value={documentId} onChange={(id) => { setDocumentId(id); const d = docItems.find((x) => x.id === id); if (d && !name) setName(d.label); }} onSearch={setSearch} placeholder="Search documents…" loading={docs.isFetching} emptyText="No document found" className="h-9" />
                    </div>
                    <div className="space-y-1.5"><Label htmlFor="dt-name">Name</Label><Input id="dt-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={160} placeholder="Statement of work" /></div>
                    <div className="space-y-1.5"><Label htmlFor="dt-desc">Description</Label><Textarea id="dt-desc" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} /></div>
                    <div className="space-y-1.5">
                        <Label>Save generated documents in</Label>
                        <EntityPicker items={folderItems} value={folderId} onChange={setFolderId} noneLabel="Choose each time (top level)" placeholder="Choose each time (top level)" searchPlaceholder="Search folders…" loading={folders.isPending} className="h-9" />
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={create.isPending}>Cancel</Button>
                    <Button onClick={submit} loading={create.isPending} disabled={!documentId || !name.trim()}><FilePlus2 /> Create template</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

function GenerateDialog({ template, onClose }: { template: DocumentTemplate | null; onClose: () => void }) {
    const navigate = useNavigate();
    const detail = useDocumentTemplate(template?.id ?? null);
    const folders = useFolderTree();
    const generate = useGenerateFromTemplate();
    const [values, setValues] = useState<Record<string, string>>({});
    const [title, setTitle] = useState("");
    const [folderId, setFolderId] = useState<string | null>(null);
    const vars = detail.data?.variables?.length ? detail.data.variables : detail.data?.detected_variables ?? [];

    useEffect(() => { if (template) { setValues({}); setTitle(""); setFolderId(null); } }, [template]);
    const folderItems = useMemo(() => (folders.data ?? []).map((f) => ({ id: f.id, label: `${"— ".repeat(f.depth)}${f.name}`, keywords: f.name })), [folders.data]);
    const missing = vars.filter((v) => v.required && !values[v.key]?.trim() && !v.default).map((v) => v.label || v.key);

    const submit = () => template && generate.mutate({ id: template.id, values, title: title.trim() || undefined, folder_id: folderId ?? undefined }, {
        onSuccess: (r) => { toast({ title: "Document created", description: r.filename }); onClose(); navigate(`/files/documents/${r.document_id}`); },
        onError: (e) => toast({ variant: "destructive", title: "Could not generate the document", description: getApiErrorMessage(e) }),
    });

    return (
        <Dialog open={!!template} onOpenChange={(o) => !o && !generate.isPending && onClose()}>
            <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle>Generate from “{template?.name}”</DialogTitle>
                    <DialogDescription>Fill in the fields; the new document keeps the template's file type.</DialogDescription>
                </DialogHeader>
                {detail.isPending ? <ListSkeleton /> : detail.error ? <ErrorState error={detail.error} onRetry={() => detail.refetch()} /> : (
                    <div className="space-y-4">
                        <div className="space-y-1.5"><Label htmlFor="gen-title">Document title</Label><Input id="gen-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={`${template?.name} ${new Date().toISOString().slice(0, 10)}`} /></div>
                        {!vars.length && <p className="text-xs text-muted-foreground">This template has no fields; the document is a copy of it.</p>}
                        {vars.map((v) => (
                            <div key={v.key} className="space-y-1.5">
                                <Label htmlFor={`gen-${v.key}`}>{v.label || v.key}{v.required && !v.default && <span className="text-danger"> *</span>}</Label>
                                <Input id={`gen-${v.key}`} value={values[v.key] ?? ""} placeholder={v.default ?? ""} onChange={(e) => setValues((x) => ({ ...x, [v.key]: e.target.value }))} />
                            </div>
                        ))}
                        {!detail.data.folder && (
                            <div className="space-y-1.5">
                                <Label>Save in</Label>
                                <EntityPicker items={folderItems} value={folderId} onChange={setFolderId} noneLabel="Top level" placeholder="Top level" searchPlaceholder="Search folders…" loading={folders.isPending} className="h-9" />
                            </div>
                        )}
                        {detail.data.folder && <Badge variant="neutral">Saved in {detail.data.folder.name}</Badge>}
                        {detail.data.body_preview && (
                            <details className="rounded-md border border-border">
                                <summary className="cursor-pointer px-2 py-1.5 text-xs text-muted-foreground">Template text</summary>
                                <pre className="max-h-48 overflow-auto whitespace-pre-wrap break-words p-2 font-mono text-xs text-foreground">{detail.data.body_preview}</pre>
                            </details>
                        )}
                    </div>
                )}
                <DialogFooter>
                    <Button variant="ghost" onClick={onClose} disabled={generate.isPending}>Cancel</Button>
                    <Button onClick={submit} loading={generate.isPending} disabled={!!missing.length || detail.isPending} title={missing.length ? `Fill in: ${missing.join(", ")}` : undefined}><Wand2 /> Generate</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
