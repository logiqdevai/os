import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Download, FileUp } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { usePermission } from "@/hooks/use-permission";
import { getApiErrorMessage } from "@/lib/api-error";
import { DocsExportScopeOptions } from "@/config/constants/dropdowns/docs/docs.options";
import { useExportDocs, useImportDocs } from "@/features/docs/hooks/use-docs";
import type { DocsExportScope, DocsImportResult } from "@/features/docs/interfaces/docs.interfaces";

interface ImportProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    spaceId: string;
    parentPageId?: string;
    parentTitle?: string;
}

/**
 * Import Markdown (15 §2): a .md file or a .zip of them; folders become parent pages.
 * @perm docs.pages.import + docs.pages.create (+ EDIT on the space) @api POST /docs/import (multipart) @audit wiki_page.imported
 */
export function ImportDocsDialog({ open, onOpenChange, spaceId, parentPageId, parentTitle }: ImportProps) {
    const navigate = useNavigate();
    const importDocs = useImportDocs();
    const canPublish = usePermission("docs.pages.publish");
    const [file, setFile] = useState<File | null>(null);
    const [publish, setPublish] = useState(false);
    const [result, setResult] = useState<DocsImportResult | null>(null);
    const input = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (open) { setFile(null); setPublish(false); setResult(null); }
    }, [open]);

    const submit = () => {
        if (!file) return;
        importDocs.mutate({ file, space_id: spaceId, parent_page_id: parentPageId, publish: canPublish && publish }, {
            onSuccess: (r) => setResult(r),
        });
    };

    return (
        <Dialog open={open} onOpenChange={(o) => !importDocs.isPending && onOpenChange(o)}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Import Markdown</DialogTitle>
                    <DialogDescription>{parentTitle ? `New pages go under “${parentTitle}”.` : "New pages go to the top level of this space."} Upload one .md file, or a .zip where folders become parent pages.</DialogDescription>
                </DialogHeader>
                {result ? (
                    <div className="space-y-3 text-[13px]">
                        <p className="text-foreground">{result.page_count} page(s) created as {publish && canPublish ? "published pages" : "drafts"}.</p>
                        {result.warnings.length > 0 && (
                            <ul className="max-h-40 list-inside list-disc overflow-auto rounded-md border border-warning/40 bg-warning-soft p-2 text-xs text-foreground">
                                {result.warnings.map((w) => <li key={w}>{w}</li>)}
                            </ul>
                        )}
                    </div>
                ) : (
                    <div className="space-y-4">
                        <input ref={input} type="file" accept=".md,.markdown,.txt,.zip,text/markdown,application/zip" className="sr-only" onChange={(e) => setFile(e.target.files?.[0] ?? null)} aria-label="Markdown or ZIP file" />
                        <button
                            type="button"
                            onClick={() => input.current?.click()}
                            className="flex w-full flex-col items-center gap-1 rounded-lg border border-dashed border-border bg-card p-6 text-center hover:bg-secondary"
                        >
                            <FileUp className="size-5 text-muted-foreground" />
                            <span className="text-[13px] text-foreground">{file ? file.name : "Choose a .md or .zip file"}</span>
                            <span className="text-xs text-muted-foreground">Up to 50 MB · at most 500 pages</span>
                        </button>
                        {canPublish && (
                            <div className="flex items-center justify-between gap-3">
                                <Label htmlFor="import-publish">Publish imported pages</Label>
                                <Switch id="import-publish" checked={publish} onCheckedChange={setPublish} />
                            </div>
                        )}
                        {importDocs.error && <p role="alert" className="text-xs text-danger">Import failed: {getApiErrorMessage(importDocs.error)}</p>}
                    </div>
                )}
                <DialogFooter>
                    {result ? (
                        <>
                            <Button variant="ghost" onClick={() => onOpenChange(false)}>Close</Button>
                            {result.root_page_id && <Button onClick={() => { onOpenChange(false); navigate(`/docs/pages/${result.root_page_id}`); }}>Open first page</Button>}
                        </>
                    ) : (
                        <>
                            <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={importDocs.isPending}>Cancel</Button>
                            <Button onClick={submit} loading={importDocs.isPending} disabled={!file}><FileUp /> Import</Button>
                        </>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

interface ExportProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    spaceId: string;
    pageId?: string;
}

/**
 * Export as Markdown ZIP (15 §2): one page, a page with its sub-pages, or the whole space — readable pages only.
 * @perm docs.pages.export (sensitive, audited) @api GET /docs/export?scope=&page_id=&space_id= @audit wiki_page.exported
 */
export function ExportDocsDialog({ open, onOpenChange, spaceId, pageId }: ExportProps) {
    const exportDocs = useExportDocs();
    const [scope, setScope] = useState<DocsExportScope>(pageId ? "SUBTREE" : "SPACE");
    useEffect(() => { if (open) setScope(pageId ? "SUBTREE" : "SPACE"); }, [open, pageId]);
    const options = DocsExportScopeOptions.filter((o) => pageId || o.id === "SPACE");

    const submit = () =>
        exportDocs.mutate({ scope, ...(scope === "SPACE" ? { space_id: spaceId } : { page_id: pageId }) }, {
            onSuccess: () => onOpenChange(false),
        });

    return (
        <Dialog open={open} onOpenChange={(o) => !exportDocs.isPending && onOpenChange(o)}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Export as Markdown</DialogTitle>
                    <DialogDescription>A ZIP with one .md file per page (with title, type and status in the front matter). Only pages you can open are included. Exports are logged.</DialogDescription>
                </DialogHeader>
                <div className="space-y-1.5">
                    <Label>What to export</Label>
                    <Select value={scope} onValueChange={(v) => setScope(v as DocsExportScope)}>
                        <SelectTrigger aria-label="What to export"><SelectValue /></SelectTrigger>
                        <SelectContent>{options.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent>
                    </Select>
                </div>
                <DialogFooter>
                    <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={exportDocs.isPending}>Cancel</Button>
                    <Button onClick={submit} loading={exportDocs.isPending}><Download /> Download ZIP</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
