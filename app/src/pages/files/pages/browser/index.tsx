import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ChevronRight, Download, Eye, Folder, FolderPlus, FolderTree as FolderTreeIcon, LayoutGrid, List, MoreHorizontal, Star, Trash2, Upload } from "lucide-react";
import { Page, PageHeader } from "@/components/ui/page";
import { DataTable, TableToolbar, type DataTableColumn } from "@/components/ui/data-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Pagination } from "@/components/ui/pagination";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { EmptyState, ErrorState, ListSkeleton } from "@/components/ui/states";
import ConfirmationDialog from "@/components/ui/confirmation-dialog";
import { Can } from "@/components/access/can";
import { useListParams } from "@/hooks/use-list-params";
import { usePermissions } from "@/hooks/use-permission";
import { formatRelative } from "@/lib/format";
import { DocumentTypeFilterOptions } from "@/config/constants/dropdowns/files/files.options";
import { useCreateFolder, useDeleteDocument, useDeleteFolder, useDocuments, useFolder, useSetDocumentFavorite } from "@/features/files/hooks/use-files";
import type { DocumentRow } from "@/features/files/interfaces/files.interfaces";
import { FileIcon, FolderTree, UploadDialog, formatBytes, openDocument, DocumentThumbnail } from "../../components/files-ui";

const VIEW_KEY = "files.view";

/**
 * /files?folder=<id>&q=&type= — file browser: folder tree, breadcrumbs, grid/list, upload (drag & drop + progress), new folder (17 §2–6)
 * @perm VIEW documents.documents.read · upload documents.documents.create · folders documents.folders.manage · trash documents.documents.delete
 * @api GET /files/folders/tree · GET /files/folders/:id · GET /files/documents?folder_id= · POST /files/upload · POST /files/folders
 */
export default function FileBrowserPage() {
    const navigate = useNavigate();
    const [sp, setSp] = useSearchParams();
    const folderId = sp.get("folder");
    const { params, setPage, search, setSearch, filters, setFilter } = useListParams({ limit: 48 });
    const listParams: Record<string, unknown> = { ...params, folder_id: folderId ?? (params.search || params.type ? undefined : "root") };
    delete listParams.folder;
    delete listParams.upload;
    const docs = useDocuments(listParams);
    const folder = useFolder(folderId);
    const p = usePermissions();
    const favorite = useSetDocumentFavorite();
    const trash = useDeleteDocument();
    const createFolder = useCreateFolder();
    const deleteFolder = useDeleteFolder();
    const [view, setView] = useState<"grid" | "list">(() => { try { return (localStorage.getItem(VIEW_KEY) as "grid" | "list") || "list"; } catch { return "list"; } });
    const [uploadOpen, setUploadOpen] = useState(sp.get("upload") === "1");
    const [treeOpen, setTreeOpen] = useState(false);
    const [folderOpen, setFolderOpen] = useState(false);
    const [folderName, setFolderName] = useState("");
    const [trashing, setTrashing] = useState<DocumentRow | null>(null);
    const [deletingFolder, setDeletingFolder] = useState(false);

    useEffect(() => { try { localStorage.setItem(VIEW_KEY, view); } catch { /* private mode */ } }, [view]);
    useEffect(() => { if (sp.get("upload") === "1") { setUploadOpen(true); setSp((prev) => { const n = new URLSearchParams(prev); n.delete("upload"); return n; }, { replace: true }); } }, [sp, setSp]);

    const subfolders = folderId ? folder.data?.children ?? [] : [];

    const rowMenu = (d: DocumentRow) => (
        <DropdownMenu>
            <DropdownMenuTrigger asChild><Button variant="ghost" size="icon-sm" aria-label={`Actions for ${d.title}`}><MoreHorizontal /></Button></DropdownMenuTrigger>
            <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={() => openDocument(d.id, "inline")}><Eye /> Open</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => openDocument(d.id, "attachment")}><Download /> Download</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => favorite.mutate({ id: d.id, on: !d.is_favorite })}><Star /> {d.is_favorite ? "Remove from favorites" : "Add to favorites"}</DropdownMenuItem>
                {p.can("documents.documents.delete") && <><DropdownMenuSeparator /><DropdownMenuItem className="text-danger focus:text-danger" onSelect={() => setTrashing(d)}><Trash2 /> Move to trash</DropdownMenuItem></>}
            </DropdownMenuContent>
        </DropdownMenu>
    );

    const columns: DataTableColumn<DocumentRow>[] = [
        {
            key: "name",
            header: "Name",
            cell: (d) => (
                <div className="flex min-w-0 items-center gap-2">
                    <FileIcon type={d.type_group} />
                    <div className="min-w-0">
                        <div className="flex items-center gap-1.5"><span className="truncate font-medium text-foreground">{d.title}</span>{d.is_favorite && <Star className="size-3 shrink-0 fill-warning text-warning" />}{d.legal_hold && <Badge variant="danger">Hold</Badge>}</div>
                        {d.title !== d.filename && <div className="truncate text-xs text-muted-foreground">{d.filename}</div>}
                    </div>
                </div>
            ),
        },
        { key: "size", header: "Size", cell: (d) => <span className="tabular">{formatBytes(d.size)}</span>, hideBelow: "sm" },
        { key: "version", header: "Version", cell: (d) => (d.current_version ? `v${d.current_version.version_number}` : "—"), hideBelow: "lg" },
        { key: "folder", header: "Folder", cell: (d) => d.folder?.name ?? <span className="text-muted-foreground">—</span>, hideBelow: "xl" },
        { key: "updated", header: "Updated", cell: (d) => formatRelative(d.updated_at), hideBelow: "md" },
        { key: "actions", header: <span className="sr-only">Actions</span>, className: "w-10", cell: rowMenu },
    ];

    const title = folderId ? folder.data?.name ?? "Folder" : search ? "Search" : "All files";

    return (
        <div className="lg:grid lg:grid-cols-[240px_minmax(0,1fr)]">
            <aside className="hidden border-r border-border px-3 py-5 lg:block"><div className="sticky top-4 max-h-[calc(100vh-6rem)] overflow-y-auto"><FolderTree activeId={folderId} /></div></aside>
            <Page>
                <PageHeader
                    title={title}
                    actions={
                        <>
                            <Sheet open={treeOpen} onOpenChange={setTreeOpen}>
                                <SheetTrigger asChild><Button variant="outline" className="lg:hidden"><FolderTreeIcon /> Folders</Button></SheetTrigger>
                                <SheetContent side="left" className="w-[85vw] max-w-sm overflow-y-auto"><SheetHeader><SheetTitle>Folders</SheetTitle></SheetHeader><div className="mt-4"><FolderTree activeId={folderId} onNavigate={() => setTreeOpen(false)} /></div></SheetContent>
                            </Sheet>
                            <Can permission="documents.folders.manage"><Button variant="outline" onClick={() => { setFolderName(""); setFolderOpen(true); }}><FolderPlus /> New folder</Button></Can>
                            <Can permission="documents.documents.create"><Button onClick={() => setUploadOpen(true)}><Upload /> Upload</Button></Can>
                        </>
                    }
                />
                {folderId && folder.data?.breadcrumbs && (
                    <nav aria-label="Breadcrumb" className="-mt-3 mb-4 flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
                        <Link to="/files" className="hover:text-foreground">All files</Link>
                        {folder.data.breadcrumbs.map((b) => <span key={b.id} className="flex items-center gap-1"><ChevronRight className="size-3" /><Link to={`/files?folder=${b.id}`} className="hover:text-foreground">{b.name}</Link></span>)}
                        {p.can("documents.folders.manage") && <Button variant="ghost" size="sm" className="ml-2 h-6 text-danger" onClick={() => setDeletingFolder(true)}><Trash2 /> Delete folder</Button>}
                    </nav>
                )}
                <TableToolbar search={search} onSearch={setSearch} placeholder="Search files…">
                    <Select value={filters.type ?? "all"} onValueChange={(v) => setFilter("type", v)}>
                        <SelectTrigger className="h-8 w-full sm:w-36" aria-label="Filter by type"><SelectValue /></SelectTrigger>
                        <SelectContent>{DocumentTypeFilterOptions.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent>
                    </Select>
                    <div className="flex rounded-md border border-border">
                        <Button variant={view === "list" ? "secondary" : "ghost"} size="icon-sm" aria-label="List view" aria-pressed={view === "list"} onClick={() => setView("list")}><List /></Button>
                        <Button variant={view === "grid" ? "secondary" : "ghost"} size="icon-sm" aria-label="Grid view" aria-pressed={view === "grid"} onClick={() => setView("grid")}><LayoutGrid /></Button>
                    </div>
                </TableToolbar>

                {subfolders.length > 0 && (
                    <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
                        {subfolders.map((f) => (
                            <Link key={f.id} to={`/files?folder=${f.id}`} className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2.5 text-[13px] hover:bg-secondary">
                                <Folder className="size-4 shrink-0 text-muted-foreground" style={f.color ? { color: f.color } : undefined} />
                                <span className="min-w-0 flex-1 truncate text-foreground">{f.name}</span>
                                <span className="text-xs tabular text-muted-foreground">{f._count.documents}</span>
                            </Link>
                        ))}
                    </div>
                )}

                {view === "list" ? (
                    <DataTable
                        columns={columns}
                        data={docs.data?.data}
                        rowKey={(d) => d.id}
                        loading={docs.isFetching}
                        error={docs.error}
                        onRetry={() => docs.refetch()}
                        pagination={docs.data?.pagination}
                        onPageChange={setPage}
                        rowHref={(d) => `/files/documents/${d.id}`}
                        empty={{ icon: Upload, title: search ? "No files match" : "No files here", description: search ? "Try another search." : "Upload files or drop them in the upload dialog.", action: !search && p.can("documents.documents.create") ? <Button size="sm" onClick={() => setUploadOpen(true)}><Upload /> Upload</Button> : undefined }}
                    />
                ) : docs.isPending ? <ListSkeleton /> : docs.error ? <ErrorState error={docs.error} onRetry={() => docs.refetch()} /> : !docs.data.data.length ? (
                    <div className="rounded-lg border border-border bg-card"><EmptyState icon={Upload} title={search ? "No files match" : "No files here"} /></div>
                ) : (
                    <>
                        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-6">
                            {docs.data.data.map((d) => (
                                <div key={d.id} className="group relative flex flex-col rounded-lg border border-border bg-card transition-colors hover:bg-secondary">
                                    <button type="button" onClick={() => navigate(`/files/documents/${d.id}`)} className="flex aspect-[4/3] items-center justify-center overflow-hidden rounded-t-lg bg-secondary/60" aria-label={`Open ${d.title}`}>
                                        <DocumentThumbnail id={d.id} type={d.type_group} title={d.title} />
                                    </button>
                                    <div className="flex items-start gap-1 p-2">
                                        <Link to={`/files/documents/${d.id}`} className="min-w-0 flex-1">
                                            <div className="truncate text-[13px] font-medium text-foreground">{d.title}</div>
                                            <div className="text-xs text-muted-foreground">{formatBytes(d.size)} · {formatRelative(d.updated_at)}</div>
                                        </Link>
                                        {rowMenu(d)}
                                    </div>
                                </div>
                            ))}
                        </div>
                        {docs.data.pagination.total_pages > 1 && <div className="mt-4 flex justify-center"><Pagination currentPage={docs.data.pagination.page} totalPages={docs.data.pagination.total_pages} onPageChange={setPage} /></div>}
                    </>
                )}
            </Page>

            <UploadDialog open={uploadOpen} onOpenChange={setUploadOpen} folderId={folderId} title={folderId && folder.data ? `Upload to ${folder.data.name}` : undefined} />
            <Dialog open={folderOpen} onOpenChange={(o) => !createFolder.isPending && setFolderOpen(o)}>
                <DialogContent className="sm:max-w-sm">
                    <form onSubmit={(e) => { e.preventDefault(); if (!folderName.trim()) return; createFolder.mutate({ name: folderName.trim(), parent_folder_id: folderId ?? undefined }, { onSuccess: (f) => { setFolderOpen(false); navigate(`/files?folder=${f.id}`); } }); }} className="space-y-4">
                        <DialogHeader><DialogTitle>New folder</DialogTitle><DialogDescription>{folderId && folder.data ? `Inside ${folder.data.name}` : "At the top level"}</DialogDescription></DialogHeader>
                        <div className="space-y-1.5"><Label htmlFor="folder-name">Name</Label><Input id="folder-name" autoFocus value={folderName} onChange={(e) => setFolderName(e.target.value)} maxLength={120} /></div>
                        <DialogFooter><Button type="button" variant="ghost" onClick={() => setFolderOpen(false)} disabled={createFolder.isPending}>Cancel</Button><Button type="submit" loading={createFolder.isPending} disabled={!folderName.trim()}>Create</Button></DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
            <ConfirmationDialog isOpen={!!trashing} onClose={() => setTrashing(null)} title={`Move “${trashing?.title}” to trash?`} description="You can restore it from Trash until it is deleted for good." confirmText="Move to trash" variant="destructive" onConfirm={() => { if (trashing) trash.mutate(trashing.id); setTrashing(null); }} />
            <ConfirmationDialog isOpen={deletingFolder} onClose={() => setDeletingFolder(false)} title={`Delete folder “${folder.data?.name}”?`} description="The folder must be empty. Files under a legal hold block deletion." confirmText="Delete folder" variant="destructive" onConfirm={() => { if (folderId) deleteFolder.mutate(folderId); setDeletingFolder(false); navigate(folder.data?.parent_folder_id ? `/files?folder=${folder.data.parent_folder_id}` : "/files"); }} />
        </div>
    );
}
