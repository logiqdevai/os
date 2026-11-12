import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { NavLink } from "react-router-dom";
import { Archive, Check, ChevronsUpDown, CheckCircle2, ChevronRight, CircleAlert, File, FileImage, FileSpreadsheet, FileText, FileVideo, Folder, FolderOpen, Music, Presentation, Upload, X } from "lucide-react";
import { Badge, type BadgeVariant } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { personName } from "@/lib/format";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ListSkeleton } from "@/components/ui/states";
import { environments } from "@/config/environments";
import { getApiErrorMessage } from "@/lib/api-error";
import { getDropdownOptionLabel } from "@/lib/dropdown-option-label.utils";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import { DocumentStatusOptions, FileApprovalStatusOptions, ShareStatusOptions } from "@/config/constants/dropdowns/files/files.options";
import * as service from "@/features/files/services/files.services";
import { useFolderTree, useShareDirectory, useUploadFile } from "@/features/files/hooks/use-files";
import type { DocumentTypeGroup, FolderNode } from "@/features/files/interfaces/files.interfaces";

export const formatBytes = (n: number | null | undefined) => {
    if (n === null || n === undefined) return "—";
    if (n < 1024) return `${n} B`;
    const units = ["KB", "MB", "GB", "TB"];
    let v = n / 1024;
    let i = 0;
    while (v >= 1024 && i < units.length - 1) { v /= 1024; i++; }
    return `${v.toFixed(v < 10 ? 1 : 0)} ${units[i]}`;
};

const ICONS: Record<DocumentTypeGroup, typeof File> = { image: FileImage, pdf: FileText, document: FileText, spreadsheet: FileSpreadsheet, presentation: Presentation, video: FileVideo, audio: Music, archive: Archive, text: FileText, other: File };
const ICON_TONE: Partial<Record<DocumentTypeGroup, string>> = { pdf: "text-danger", image: "text-violet", spreadsheet: "text-success", presentation: "text-warning", document: "text-info" };

export function FileIcon({ type, className }: { type: DocumentTypeGroup | string | null | undefined; className?: string }) {
    const t = (type ?? "other") as DocumentTypeGroup;
    const Icon = ICONS[t] ?? File;
    return <Icon className={cn("size-4 shrink-0", ICON_TONE[t] ?? "text-muted-foreground", className)} aria-hidden />;
}

const TONE: Record<string, BadgeVariant> = { DRAFT: "warning", ACTIVE: "neutral", APPROVED: "success", ARCHIVED: "neutral", DELETED: "danger", PENDING: "warning", REJECTED: "danger", CHANGES_REQUESTED: "violet", CANCELLED: "neutral", EXPIRED: "neutral", REVOKED: "danger" };
const LABELS = [...DocumentStatusOptions, ...FileApprovalStatusOptions, ...ShareStatusOptions];
export function FilesStatusBadge({ status }: { status: string | null | undefined }) {
    if (!status) return null;
    return <Badge variant={TONE[status] ?? "neutral"} dot>{getDropdownOptionLabel(LABELS, status)}</Badge>;
}

/** Signed, short-lived download / preview URL (the browser cannot send the bearer header on plain links). */
export async function openDocument(id: string, disposition: "inline" | "attachment" = "attachment", versionId?: string) {
    try {
        const url = await service.getDownloadUrl(id, { disposition, version_id: versionId });
        const base = environments.API_URL.replace(/\/$/, "");
        window.open(`${base}${url.path}`, disposition === "inline" ? "_blank" : "_self", "noopener");
    } catch (e) {
        toast({ variant: "destructive", title: "Could not open the file", description: getApiErrorMessage(e) });
    }
}

export { CopyButton } from "@/components/ui/copy-button";

export const apiUrl = (path: string) => `${environments.API_URL.replace(/\/$/, "")}${path}`;

/**
 * Grid tile preview (17 §8): images load a lazy thumbnail through a signed inline URL once the tile scrolls into view;
 * every other type (and any error) shows the file-type icon. No server-side thumbnail generation is needed.
 */
export function DocumentThumbnail({ id, type, title }: { id: string; type: DocumentTypeGroup | string | null | undefined; title: string }) {
    const ref = useRef<HTMLDivElement>(null);
    const [src, setSrc] = useState<string | null>(null);
    const [failed, setFailed] = useState(false);
    const isImage = type === "image";
    useEffect(() => {
        if (!isImage || !ref.current) return;
        let cancelled = false;
        const el = ref.current;
        const io = new IntersectionObserver((entries) => {
            if (!entries.some((e) => e.isIntersecting)) return;
            io.disconnect();
            service.getDownloadUrl(id, { disposition: "inline" }).then((u) => !cancelled && setSrc(apiUrl(u.path))).catch(() => !cancelled && setFailed(true));
        }, { rootMargin: "200px" });
        io.observe(el);
        return () => { cancelled = true; io.disconnect(); };
    }, [id, isImage]);
    return (
        <div ref={ref} className="flex size-full items-center justify-center overflow-hidden">
            {src && !failed
                ? <img src={src} alt={title} loading="lazy" className="size-full object-cover" onError={() => setFailed(true)} />
                : <FileIcon type={type} className="size-10" />}
        </div>
    );
}

interface TreeItem extends FolderNode { children: TreeItem[] }

/** Folder tree (left column of the browser; in a sheet on phones). */
export function FolderTree({ activeId, onNavigate }: { activeId: string | null; onNavigate?: () => void }) {
    const tree = useFolderTree();
    const roots = useMemo(() => {
        const map = new Map<string, TreeItem>((tree.data ?? []).map((f) => [f.id, { ...f, children: [] }]));
        const out: TreeItem[] = [];
        map.forEach((f) => { const p = f.parent_folder_id ? map.get(f.parent_folder_id) : null; if (p) p.children.push(f); else out.push(f); });
        return out;
    }, [tree.data]);
    const activePath = useMemo(() => new Set((tree.data?.find((f) => f.id === activeId)?.path ?? "").split("/").filter(Boolean)), [tree.data, activeId]);
    if (tree.isPending) return <ListSkeleton rows={6} className="p-0" />;
    if (tree.error) return <p className="text-xs text-danger">{getApiErrorMessage(tree.error)}</p>;
    return (
        <nav aria-label="Folders">
            <NavLink to="/files" end onClick={onNavigate} className={({ isActive }) => cn("flex items-center gap-2 rounded-md px-2 py-1.5 text-[13px]", isActive && !activeId ? "bg-secondary text-foreground" : "text-muted-foreground hover:bg-secondary hover:text-foreground")}>
                <FolderOpen className="size-4" /> All files
            </NavLink>
            <ul className="mt-1">{roots.map((f) => <FolderTreeNode key={f.id} node={f} depth={0} activeId={activeId} activePath={activePath} onNavigate={onNavigate} />)}</ul>
            {!roots.length && <p className="px-2 py-1 text-xs text-muted-foreground">No folders yet.</p>}
        </nav>
    );
}

function FolderTreeNode({ node, depth, activeId, activePath, onNavigate }: { node: TreeItem; depth: number; activeId: string | null; activePath: Set<string>; onNavigate?: () => void }) {
    const [open, setOpen] = useState(activePath.has(node.id) || node.id === activeId);
    return (
        <li>
            <div className={cn("flex items-center rounded-md text-[13px]", node.id === activeId ? "bg-secondary text-foreground" : "text-muted-foreground hover:bg-secondary hover:text-foreground")} style={{ paddingLeft: depth * 12 }}>
                <button type="button" className={cn("grid size-6 place-items-center", !node.children.length && "invisible")} onClick={() => setOpen((o) => !o)} aria-label={open ? `Collapse ${node.name}` : `Expand ${node.name}`}>
                    <ChevronRight className={cn("size-3.5 transition-transform", open && "rotate-90")} />
                </button>
                <NavLink to={`/files?folder=${node.id}`} onClick={onNavigate} className="flex min-w-0 flex-1 items-center gap-1.5 py-1">
                    <Folder className="size-4 shrink-0" style={node.color ? { color: node.color } : undefined} />
                    <span className="truncate">{node.name}</span>
                    {node._count.documents > 0 && <span className="ml-auto pr-2 text-xs tabular text-muted-foreground">{node._count.documents}</span>}
                </NavLink>
            </div>
            {open && node.children.length > 0 && <ul>{node.children.map((c) => <FolderTreeNode key={c.id} node={c} depth={depth + 1} activeId={activeId} activePath={activePath} onNavigate={onNavigate} />)}</ul>}
        </li>
    );
}

interface QueueItem { id: string; file: File; progress: number; status: "queued" | "uploading" | "done" | "error"; error?: string }

/**
 * Upload dialog: drag & drop or pick several files; uploads one by one with a progress bar each (errors show on the
 * file's row). When every file is uploaded the dialog closes by itself: the files appear in the list (no toast).
 * `documentId` uploads a new version of that document instead.
 */
export function UploadDialog({ open, onOpenChange, folderId, documentId, title }: { open: boolean; onOpenChange: (o: boolean) => void; folderId?: string | null; documentId?: string; title?: string }) {
    const upload = useUploadFile();
    const inputRef = useRef<HTMLInputElement>(null);
    const [queue, setQueue] = useState<QueueItem[]>([]);
    const [dragging, setDragging] = useState(false);
    const running = queue.some((q) => q.status === "uploading");

    const add = useCallback((files: FileList | File[]) => {
        const list = Array.from(files).slice(0, documentId ? 1 : 20);
        setQueue((q) => [...(documentId ? [] : q.filter((x) => x.status !== "done")), ...list.map((file) => ({ id: `${file.name}-${file.size}-${Math.random().toString(36).slice(2)}`, file, progress: 0, status: "queued" as const }))]);
    }, [documentId]);

    const start = async () => {
        let failed = 0;
        for (const item of queue.filter((q) => q.status === "queued" || q.status === "error")) {
            setQueue((q) => q.map((x) => (x.id === item.id ? { ...x, status: "uploading", progress: 0, error: undefined } : x)));
            try {
                await upload.mutateAsync({ file: item.file, folder_id: folderId ?? undefined, document_id: documentId, onProgress: (pct) => setQueue((q) => q.map((x) => (x.id === item.id ? { ...x, progress: pct } : x))) });
                setQueue((q) => q.map((x) => (x.id === item.id ? { ...x, status: "done", progress: 100 } : x)));
            } catch (e) {
                failed++;
                setQueue((q) => q.map((x) => (x.id === item.id ? { ...x, status: "error", error: getApiErrorMessage(e) } : x)));
            }
        }
        if (!failed) { onOpenChange(false); setQueue([]); }
    };
    const pending = queue.filter((q) => q.status === "queued" || q.status === "error").length;
    const done = queue.filter((q) => q.status === "done").length;

    return (
        <Dialog open={open} onOpenChange={(o) => { if (running) return; onOpenChange(o); if (!o) setQueue([]); }}>
            <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle>{title ?? (documentId ? "Upload a new version" : "Upload files")}</DialogTitle>
                    <DialogDescription>{documentId ? "The new file becomes the current version; older versions are kept." : "Drop files here or choose them. Size and type limits come from the organization settings."}</DialogDescription>
                </DialogHeader>
                <div
                    role="button"
                    tabIndex={0}
                    onClick={() => inputRef.current?.click()}
                    onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && inputRef.current?.click()}
                    onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                    onDragLeave={() => setDragging(false)}
                    onDrop={(e) => { e.preventDefault(); setDragging(false); if (e.dataTransfer.files.length) add(e.dataTransfer.files); }}
                    className={cn("flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-4 py-8 text-center transition-colors", dragging ? "border-info bg-info-soft" : "border-border hover:bg-secondary")}
                >
                    <Upload className="size-6 text-muted-foreground" />
                    <p className="text-[13px] text-foreground">Drop {documentId ? "a file" : "files"} here or <span className="text-info">browse</span></p>
                    <input ref={inputRef} type="file" multiple={!documentId} className="hidden" onChange={(e) => { if (e.target.files) add(e.target.files); e.target.value = ""; }} />
                </div>
                {queue.length > 0 && (
                    <ul className="max-h-64 space-y-2 overflow-y-auto">
                        {queue.map((q) => (
                            <li key={q.id} className="rounded-md border border-border p-2">
                                <div className="flex items-center gap-2 text-[13px]">
                                    {q.status === "done" ? <CheckCircle2 className="size-4 shrink-0 text-success" /> : q.status === "error" ? <CircleAlert className="size-4 shrink-0 text-danger" /> : <File className="size-4 shrink-0 text-muted-foreground" />}
                                    <span className="min-w-0 flex-1 truncate">{q.file.name}</span>
                                    <span className="text-xs tabular text-muted-foreground">{formatBytes(q.file.size)}</span>
                                    {q.status === "queued" && <Button variant="ghost" size="icon-sm" aria-label={`Remove ${q.file.name}`} onClick={() => setQueue((list) => list.filter((x) => x.id !== q.id))}><X /></Button>}
                                </div>
                                {q.status === "uploading" && <Progress value={q.progress} className="mt-2 h-1.5" />}
                                {q.error && <p className="mt-1 text-xs text-danger">{q.error}</p>}
                            </li>
                        ))}
                    </ul>
                )}
                <DialogFooter>
                    <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={running}>{done && !pending ? "Close" : "Cancel"}</Button>
                    <Button onClick={() => void start()} disabled={!pending} loading={running}>
                        <Upload /> Upload{pending > 1 ? ` ${pending} files` : ""}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

/** Member picker backed by the files share directory (works for anyone who can share, approve or manage the vault). */
export function FilesMemberPicker({ value, onChange, multiple, placeholder = "Choose a member" }: { value: string[]; onChange: (ids: string[]) => void; multiple?: boolean; placeholder?: string }) {
    const [open, setOpen] = useState(false);
    const directory = useShareDirectory(open || value.length > 0);
    const members = directory.data?.members ?? [];
    const selected = members.filter((m) => value.includes(m.id));
    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button type="button" variant="outline" role="combobox" aria-expanded={open} className="w-full justify-between font-normal">
                    <span className={cn("truncate", !selected.length && "text-muted-foreground")}>{selected.length ? selected.map((m) => personName(m.user)).join(", ") : placeholder}</span>
                    <ChevronsUpDown className="opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[var(--radix-popover-trigger-width)] min-w-64 p-0" align="start">
                <Command>
                    <CommandInput placeholder="Search members…" />
                    <CommandList>
                        <CommandEmpty>{directory.isError ? "Members could not be loaded" : directory.isPending ? "Loading…" : "No member found"}</CommandEmpty>
                        <CommandGroup>
                            {members.map((m) => {
                                const on = value.includes(m.id);
                                return (
                                    <CommandItem key={m.id} value={`${personName(m.user)} ${m.user.email}`} onSelect={() => { if (multiple) onChange(on ? value.filter((v) => v !== m.id) : [...value, m.id]); else { onChange([m.id]); setOpen(false); } }}>
                                        <Check className={cn("size-4", on ? "opacity-100" : "opacity-0")} />
                                        <div className="min-w-0"><div className="truncate text-[13px]">{personName(m.user)}</div><div className="truncate text-xs text-muted-foreground">{m.user.email}</div></div>
                                    </CommandItem>
                                );
                            })}
                        </CommandGroup>
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    );
}
