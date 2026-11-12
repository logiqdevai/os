import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Archive, FolderPlus, FolderTree, MoreHorizontal, Pencil, Play, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { EntityPicker } from "@/components/ui/entity-picker";
import { EmptyState, ErrorState, ListSkeleton } from "@/components/ui/states";
import ConfirmationDialog from "@/components/ui/confirmation-dialog";
import { usePermission } from "@/hooks/use-permission";
import { SaveStatus } from "@/components/ui/save-status";
import { useAutosave } from "@/hooks/use-autosave";
import { getDropdownOptionLabel } from "@/lib/dropdown-option-label.utils";
import { FolderTemplateTargetOptions } from "@/config/constants/dropdowns/files/files.options";
import { useApplyFolderTemplate, useArchiveFolderTemplate, useCreateFolderTemplate, useFolderTemplates, useFolderTree, useUpdateFolderTemplate } from "@/features/files/hooks/use-files";
import type { FolderTemplate, FolderTemplateNode, FolderTemplateTarget } from "@/features/files/interfaces/files.interfaces";
import { outlineToTree, treeToOutline } from "../utils/folder-outline";

/**
 * Folder templates (17 §7): reusable folder trees applied under any folder (projects, customers, HR).
 * @perm VIEW documents.documents.read · ACTION documents.folders.manage
 * @api GET/POST /files/folder-templates · PATCH /:id · POST /:id/archive · POST /:id/apply @mcp documents_folder_templates_list|apply
 */
export function FolderTemplatesTab() {
    const canManage = usePermission("documents.folders.manage");
    const templates = useFolderTemplates({ limit: 100 });
    const archive = useArchiveFolderTemplate();
    const [editing, setEditing] = useState<FolderTemplate | null>(null);
    const [formOpen, setFormOpen] = useState(false);
    const [applying, setApplying] = useState<FolderTemplate | null>(null);
    const [archiving, setArchiving] = useState<FolderTemplate | null>(null);

    if (templates.isPending) return <ListSkeleton />;
    if (templates.error) return <ErrorState error={templates.error} onRetry={() => templates.refetch()} />;
    const rows = templates.data.data;

    return (
        <>
            {canManage && <div className="mb-3 flex justify-end"><Button size="sm" onClick={() => { setEditing(null); setFormOpen(true); }}><Plus /> New folder template</Button></div>}
            {!rows.length ? (
                <div className="rounded-lg border border-border bg-card"><EmptyState icon={FolderTree} title="No folder templates" description="Save the folder structure you use for every project or client once, then create it with one click." /></div>
            ) : (
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {rows.map((t) => (
                        <div key={t.id} className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4">
                            <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                    <div className="flex flex-wrap items-center gap-2"><span className="truncate text-[13px] font-medium text-foreground">{t.name}</span>{t.is_default && <Badge variant="info">Default</Badge>}</div>
                                    <div className="text-xs text-muted-foreground">{getDropdownOptionLabel(FolderTemplateTargetOptions, t.target)} · {t.folder_count ?? 0} folders{t.applied_count ? ` · used ${t.applied_count}×` : ""}</div>
                                </div>
                                {canManage && (
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild><Button variant="ghost" size="icon-sm" aria-label={`Actions for ${t.name}`}><MoreHorizontal /></Button></DropdownMenuTrigger>
                                        <DropdownMenuContent align="end">
                                            <DropdownMenuItem onSelect={() => { setEditing(t); setFormOpen(true); }}><Pencil /> Edit</DropdownMenuItem>
                                            <DropdownMenuItem className="text-danger focus:text-danger" onSelect={() => setArchiving(t)}><Archive /> Archive</DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                )}
                            </div>
                            {t.description && <p className="line-clamp-2 text-xs text-muted-foreground">{t.description}</p>}
                            <pre className="max-h-40 overflow-auto rounded-md bg-secondary p-2 font-mono text-xs text-foreground">{treeToOutline(t.structure)}</pre>
                            {canManage && <Button size="sm" variant="outline" className="mt-auto self-start" onClick={() => setApplying(t)}><Play /> Create folders</Button>}
                        </div>
                    ))}
                </div>
            )}
            <FolderTemplateDialog open={formOpen} onOpenChange={setFormOpen} template={editing} />
            <ApplyFolderTemplateDialog template={applying} onClose={() => setApplying(null)} />
            <ConfirmationDialog
                isOpen={!!archiving}
                onClose={() => setArchiving(null)}
                title={`Archive ${archiving?.name}?`}
                description="Folders already created from it stay as they are."
                confirmText="Archive"
                variant="destructive"
                onConfirm={() => { if (archiving) archive.mutate(archiving.id); setArchiving(null); }}
            />
        </>
    );
}

const SAMPLE = "01 Contracts\n02 Briefs & research\n03 Design\n  Drafts\n  Approved (customer)\n04 Deliverables (customer)\n05 Invoices";

/** New template: explicit "Create template". Edit: valid changes autosave (optimistic, <SaveStatus />); "Done" closes. */
function FolderTemplateDialog({ open, onOpenChange, template }: { open: boolean; onOpenChange: (o: boolean) => void; template: FolderTemplate | null }) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
                {open && <FolderTemplateForm key={template?.id ?? "new"} template={template} onClose={() => onOpenChange(false)} />}
            </DialogContent>
        </Dialog>
    );
}

/** Mounted fresh for each opened template, so its first values are the autosave baseline (nothing is re-saved on open). */
function FolderTemplateForm({ template, onClose }: { template: FolderTemplate | null; onClose: () => void }) {
    const create = useCreateFolderTemplate();
    const update = useUpdateFolderTemplate();
    const [name, setName] = useState(template?.name ?? "");
    const [description, setDescription] = useState(template?.description ?? "");
    const [target, setTarget] = useState<FolderTemplateTarget>(template?.target ?? "PROJECT_TYPE");
    const [outline, setOutline] = useState(() => (template ? treeToOutline(template.structure) : SAMPLE));
    const [touched, setTouched] = useState(false);

    const parsed = useMemo(() => outlineToTree(outline), [outline]);
    const nameError = (touched || !!template) && !name.trim() ? "Give the template a name" : null;
    const dto = useMemo(() => ({ name: name.trim(), description: description || null, target, structure: parsed.tree as FolderTemplateNode[] }), [name, description, target, parsed.tree]);
    const autosave = useAutosave({ value: dto, enabled: !!template && !!name.trim() && !parsed.error, save: (v) => update.mutateAsync({ id: template!.id, ...v }) });

    const submit = () => {
        setTouched(true);
        if (!name.trim() || parsed.error) return;
        create.mutate(dto, { onSuccess: onClose });
    };

    return (
        <>
                <DialogHeader>
                    <DialogTitle>{template ? "Edit folder template" : "New folder template"}</DialogTitle>
                    <DialogDescription>One folder per line; indent sub-folders with two spaces. Add “(customer)” to show a folder in the Customer Portal.{template ? " Changes save automatically." : ""}</DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                    <div className="space-y-1.5">
                        <Label htmlFor="ft-name">Name</Label>
                        <Input id="ft-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Website project" maxLength={120} aria-invalid={!!nameError} />
                        {nameError && <p className="text-xs text-danger">{nameError}</p>}
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-1.5">
                            <Label>Used for</Label>
                            <Select value={target} onValueChange={(v) => setTarget(v as FolderTemplateTarget)}>
                                <SelectTrigger aria-label="Used for"><SelectValue /></SelectTrigger>
                                <SelectContent>{FolderTemplateTargetOptions.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="ft-desc">Description</Label>
                            <Input id="ft-desc" value={description} onChange={(e) => setDescription(e.target.value)} />
                        </div>
                    </div>
                    <div className="space-y-1.5">
                        <Label htmlFor="ft-outline">Folders</Label>
                        <Textarea id="ft-outline" rows={10} className="font-mono text-xs" value={outline} onChange={(e) => setOutline(e.target.value)} onKeyDown={(e) => {
                            if (e.key === "Tab") {
                                e.preventDefault();
                                const el = e.currentTarget;
                                const s = el.selectionStart;
                                setOutline(`${outline.slice(0, s)}  ${outline.slice(el.selectionEnd)}`);
                                requestAnimationFrame(() => el.setSelectionRange(s + 2, s + 2));
                            }
                        }} />
                        {parsed.error ? <p className="text-xs text-danger">{parsed.error}</p> : <p className="text-xs text-muted-foreground">{countNodes(parsed.tree)} folders</p>}
                    </div>
                </div>
                {template ? (
                    <DialogFooter className="items-center sm:justify-between">
                        <SaveStatus state={autosave} />
                        <Button variant="outline" onClick={() => { autosave.flush(); onClose(); }}>Done</Button>
                    </DialogFooter>
                ) : (
                    <DialogFooter>
                        <Button variant="ghost" onClick={onClose} disabled={create.isPending}>Cancel</Button>
                        <Button onClick={submit} loading={create.isPending} disabled={!!parsed.error}>Create template</Button>
                    </DialogFooter>
                )}
        </>
    );
}

const countNodes = (nodes: FolderTemplateNode[]): number => nodes.reduce((n, x) => n + 1 + countNodes(x.children ?? []), 0);

function ApplyFolderTemplateDialog({ template, onClose }: { template: FolderTemplate | null; onClose: () => void }) {
    const navigate = useNavigate();
    const tree = useFolderTree();
    const apply = useApplyFolderTemplate();
    const [parent, setParent] = useState<string | null>(null);
    const [rootName, setRootName] = useState("");
    useEffect(() => { if (template) { setParent(null); setRootName(""); } }, [template]);

    const folders = useMemo(() => (tree.data ?? []).map((f) => ({ id: f.id, label: `${"— ".repeat(f.depth)}${f.name}`, keywords: f.name })), [tree.data]);
    const submit = () => template && apply.mutate({ id: template.id, parent_folder_id: parent ?? undefined, root_name: rootName.trim() || undefined }, {
        onSuccess: (r) => {
            onClose();
            const target = r.root_folder_id ?? parent;
            navigate(target ? `/files?folder=${target}` : "/files");
        },
    });

    return (
        <Dialog open={!!template} onOpenChange={(o) => !o && !apply.isPending && onClose()}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Create folders from “{template?.name}”</DialogTitle>
                    <DialogDescription>{template?.folder_count ?? 0} folders are created with the same names and portal visibility.</DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                    <div className="space-y-1.5">
                        <Label>Create inside</Label>
                        <EntityPicker items={folders} value={parent} onChange={setParent} noneLabel="Top level" placeholder="Top level" searchPlaceholder="Search folders…" loading={tree.isPending} className="h-9" />
                    </div>
                    <div className="space-y-1.5">
                        <Label htmlFor="ft-root">New folder to hold them (optional)</Label>
                        <Input id="ft-root" value={rootName} onChange={(e) => setRootName(e.target.value)} placeholder="e.g. Acme — Website 2026" maxLength={120} />
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="ghost" onClick={onClose} disabled={apply.isPending}>Cancel</Button>
                    <Button onClick={submit} loading={apply.isPending}><FolderPlus /> Create folders</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
