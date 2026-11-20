import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Archive, Download, FileUp, Lock, MoreHorizontal, Pencil, Plus, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ErrorState, ListSkeleton, PageSkeleton } from "@/components/ui/states";
import ConfirmationDialog from "@/components/ui/confirmation-dialog";
import { usePageMetadata } from "@/hooks/use-page-metadata";
import { usePermissions } from "@/hooks/use-permission";
import { formatRelative, personName } from "@/lib/format";
import { getDropdownOptionLabel } from "@/lib/dropdown-option-label.utils";
import { WikiSpaceKindFormOptions } from "@/config/constants/dropdowns/docs/docs.options";
import { useArchiveSpace, useCreateUntitledPage, usePages, useSpace } from "@/features/docs/hooks/use-docs";
import { DocIcon, SpaceFormDialog } from "../../components/docs-ui";
import { SpaceMembersSheet } from "../../components/space-members-sheet";
import { ExportDocsDialog, ImportDocsDialog } from "../../components/transfer-dialogs";

/**
 * /docs/spaces/:id — a space as a Notion top-level page: icon, name, description, then its pages as page rows and
 * "+ New page" (creates "Untitled" and opens it). Settings, access, import / export and archive sit in the ⋯ menu.
 * @perm VIEW docs.pages.read (+ space membership for private spaces) · edit/archive docs.spaces.manage · new page docs.pages.create
 * @api GET /docs/spaces/:id · GET /docs/pages?space_id=&parent_page_id=root · POST /docs/pages
 */
export default function SpaceDetailPage() {
    const { id = "" } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const p = usePermissions();
    const space = useSpace(id);
    const pages = usePages({ space_id: id, parent_page_id: "root", limit: 200, order_by: "sort_order", order_direction: "asc" }, !!space.data);
    const archive = useArchiveSpace();
    const newPage = useCreateUntitledPage();
    const [editOpen, setEditOpen] = useState(false);
    const [membersOpen, setMembersOpen] = useState(false);
    const [archiving, setArchiving] = useState(false);
    const [transfer, setTransfer] = useState<null | "import" | "export">(null);
    usePageMetadata({ title: space.data?.name });

    if (space.isPending) return <PageSkeleton />;
    if (space.error) return <div className="p-6"><ErrorState error={space.error} onRetry={() => space.refetch()} /></div>;
    const s = space.data;
    const canWrite = p.can("docs.pages.create") && ["EDIT", "MANAGE"].includes(s.my_level);
    const canManage = p.can("docs.spaces.manage");

    return (
        <div className="min-h-full bg-background">
            <header className="sticky top-0 z-20 flex h-11 items-center gap-2 bg-background/95 px-3 backdrop-blur md:px-4">
                <nav aria-label="Breadcrumb" className="flex min-w-0 flex-1 items-center gap-1 text-[13px] text-muted-foreground">
                    <Link to="/docs/spaces" className="rounded px-1 py-0.5 hover:bg-accent hover:text-foreground">Spaces</Link>
                    <span>/</span>
                    <span className="flex min-w-0 items-center gap-1 px-1 text-foreground"><DocIcon icon={s.icon} className="size-3.5" /><span className="truncate">{s.name}</span></span>
                </nav>
                <Button variant="ghost" size="sm" onClick={() => setMembersOpen(true)}><Users /> {s.members.length}</Button>
                {(canManage || (canWrite && p.can("docs.pages.import")) || p.can("docs.pages.export")) && (
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild><Button variant="ghost" size="icon-sm" aria-label="Space actions"><MoreHorizontal /></Button></DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-52">
                            {canManage && <DropdownMenuItem onSelect={() => setEditOpen(true)}><Pencil /> Space settings</DropdownMenuItem>}
                            <DropdownMenuItem onSelect={() => setMembersOpen(true)}><Users /> {canManage || s.my_level === "MANAGE" ? "Manage access" : "Members"}</DropdownMenuItem>
                            {canWrite && p.can("docs.pages.import") && <DropdownMenuItem onSelect={() => setTransfer("import")}><FileUp /> Import Markdown</DropdownMenuItem>}
                            {p.can("docs.pages.export") && <DropdownMenuItem onSelect={() => setTransfer("export")}><Download /> Export as Markdown</DropdownMenuItem>}
                            {canManage && !s.archived_at && (
                                <>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem className="text-danger focus:text-danger" onSelect={() => setArchiving(true)}><Archive /> Archive space</DropdownMenuItem>
                                </>
                            )}
                        </DropdownMenuContent>
                    </DropdownMenu>
                )}
            </header>

            <div className="mx-auto w-full max-w-[760px] px-6 pb-32 pt-16 sm:px-14 lg:px-16">
                <DocIcon icon={s.icon} className="size-16 text-foreground" />
                <h1 className="mt-3 break-words text-[40px] font-bold leading-tight tracking-tight text-foreground">{s.name}</h1>
                {s.description && <p className="mt-2 text-[15px] text-muted-foreground">{s.description}</p>}
                <div className="mt-4 flex flex-wrap items-center gap-2 border-b border-border pb-3 text-xs text-muted-foreground">
                    <Badge variant="outline">{getDropdownOptionLabel(WikiSpaceKindFormOptions, s.kind)}</Badge>
                    {s.is_private && <Badge variant="neutral"><Lock className="size-3" /> Private</Badge>}
                    {s.archived_at && <Badge variant="warning">Archived</Badge>}
                    {s.owner && <span>Owner: {personName(s.owner.user)}</span>}
                </div>

                <div className="mt-6 space-y-0.5">
                    {pages.isPending ? <ListSkeleton rows={4} className="p-0" /> : pages.error ? <ErrorState error={pages.error} /> : pages.data.data.map((pg) => (
                        <Link key={pg.id} to={`/docs/pages/${pg.id}`} className="group flex items-center gap-2.5 rounded-md px-1.5 py-1.5 hover:bg-accent">
                            <DocIcon icon={pg.icon} className="size-[18px]" />
                            <span className="min-w-0 flex-1">
                                <span className="block truncate text-[15px] font-medium text-foreground underline decoration-border underline-offset-4">{pg.title || "Untitled"}</span>
                                {pg.excerpt && <span className="block truncate text-[13px] text-muted-foreground">{pg.excerpt}</span>}
                            </span>
                            <span className="hidden flex-none text-xs text-muted-foreground group-hover:inline">{formatRelative(pg.last_edited_at ?? pg.updated_at)}</span>
                        </Link>
                    ))}
                    {canWrite && !s.archived_at && (
                        <button type="button" disabled={newPage.isPending} onClick={() => newPage.create({ space_id: s.id })}
                            className="flex w-full items-center gap-2.5 rounded-md px-1.5 py-1.5 text-left text-[15px] text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-60">
                            <Plus className="size-[18px]" /> New page
                        </button>
                    )}
                    {!pages.isPending && !pages.error && !pages.data.data.length && !canWrite && <p className="px-1.5 py-2 text-[13px] text-muted-foreground">No pages in this space yet.</p>}
                </div>
            </div>

            <SpaceMembersSheet space={s} open={membersOpen} onOpenChange={setMembersOpen} canManage={canManage || s.my_level === "MANAGE"} />
            <SpaceFormDialog open={editOpen} onOpenChange={setEditOpen} space={s} />
            <ImportDocsDialog open={transfer === "import"} onOpenChange={(o) => setTransfer(o ? "import" : null)} spaceId={s.id} />
            <ExportDocsDialog open={transfer === "export"} onOpenChange={(o) => setTransfer(o ? "export" : null)} spaceId={s.id} />
            <ConfirmationDialog
                isOpen={archiving}
                onClose={() => setArchiving(false)}
                title={`Archive ${s.name}?`}
                description="The space and its pages become read-only and are hidden from Docs home."
                confirmText="Archive"
                variant="destructive"
                onConfirm={() => { archive.mutate(s.id); setArchiving(false); navigate("/docs/spaces"); }}
            />
        </div>
    );
}
