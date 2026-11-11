import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Archive, ArchiveRestore, CheckCircle2, ChevronRight, FilePlus, History, Link2, MessageSquare, MoreHorizontal, Pencil, Rocket, Star, Trash2 } from "lucide-react";
import { Page } from "@/components/ui/page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Markdown } from "@/components/ui/markdown";
import { Textarea } from "@/components/ui/textarea";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { EmptyState, ErrorState, ListSkeleton, PageSkeleton } from "@/components/ui/states";
import ConfirmationDialog from "@/components/ui/confirmation-dialog";
import { usePageMetadata } from "@/hooks/use-page-metadata";
import { toast } from "@/hooks/use-toast";
import { getApiErrorMessage } from "@/lib/api-error";
import { formatDate, formatDateTime, formatRelative, personName } from "@/lib/format";
import { getDropdownOptionLabel } from "@/lib/dropdown-option-label.utils";
import { WikiPageTypeFormOptions } from "@/config/constants/dropdowns/docs/docs.options";
import * as service from "@/features/docs/services/docs.services";
import {
    useAddComment, useCommentAction, useDeleteComment, usePage, usePageAction, usePageComments, usePageLinks, usePageVersion, usePageVersions, useRestoreVersion, useSetFavorite,
} from "@/features/docs/hooks/use-docs";
import type { WikiPageDetail } from "@/features/docs/interfaces/docs.interfaces";
import { DocIcon, DocsStatusBadge, SpaceLayout } from "../../components/docs-ui";

/**
 * /docs/pages/:id — read a page (15 §3–6): content, children, comments, versions, backlinks, favorite, acknowledge
 * @perm VIEW docs.pages.read + page level · edit = EDIT level + docs.pages.update · publish docs.pages.publish · archive/trash docs.pages.archive
 * @api GET /docs/pages/:id · POST view|favorite|acknowledge|publish|archive|trash · GET versions · GET/POST comments · GET links
 */
export default function PageViewPage() {
    const { id = "" } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const page = usePage(id);
    const favorite = useSetFavorite();
    const action = usePageAction();
    const [panel, setPanel] = useState<null | "history" | "comments" | "links">(null);
    const [confirm, setConfirm] = useState<null | "trash" | "archive">(null);
    usePageMetadata({ title: page.data?.title });

    // Reader analytics: one view per open (the API de-duplicates).
    useEffect(() => {
        if (page.data?.id) service.recordView(page.data.id).catch(() => undefined);
    }, [page.data?.id]);

    if (page.isPending) return <PageSkeleton />;
    if (page.error) return <Page><ErrorState error={page.error} onRetry={() => page.refetch()} /></Page>;
    const pg = page.data;
    const fail = (title: string) => (e: unknown) => toast({ variant: "destructive", title, description: getApiErrorMessage(e) });
    const act = (a: "publish" | "unpublish" | "archive" | "unarchive" | "trash" | "acknowledge", msg: string, after?: () => void) =>
        action.mutate({ id: pg.id, action: a }, { onSuccess: () => { toast({ title: msg }); after?.(); }, onError: fail("Could not update the page") });

    return (
        <SpaceLayout spaceId={pg.space_id} activeId={pg.id} ancestorIds={pg.breadcrumbs.map((b) => b.id)} canCreate={pg.can.edit}>
            <Page width="narrow">
                <nav aria-label="Breadcrumb" className="mb-3 flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
                    <Link to={`/docs/spaces/${pg.space.id}`} className="hover:text-foreground">{pg.space.name}</Link>
                    {pg.breadcrumbs.map((b) => (
                        <span key={b.id} className="flex items-center gap-1"><ChevronRight className="size-3" /><Link to={`/docs/pages/${b.id}`} className="hover:text-foreground">{b.title}</Link></span>
                    ))}
                </nav>

                <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                        <h1 className="flex items-center gap-2 text-2xl font-semibold text-foreground"><DocIcon icon={pg.icon} className="text-2xl" /><span className="break-words">{pg.title}</span></h1>
                        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                            <DocsStatusBadge status={pg.status} />
                            {pg.page_type !== "GENERAL" && <Badge variant="outline">{getDropdownOptionLabel(WikiPageTypeFormOptions, pg.page_type)}</Badge>}
                            {pg.has_unpublished_changes && <Badge variant="warning">Unpublished changes</Badge>}
                            <span>{pg.owner ? personName(pg.owner.user) : "No owner"} · updated {formatRelative(pg.last_edited_at ?? pg.updated_at)} · v{pg.current_version_number}</span>
                            {pg.next_review_at && <span>· review {formatDate(pg.next_review_at)}</span>}
                        </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        <Button variant="outline" size="icon" aria-label={pg.is_favorite ? "Remove from favorites" : "Add to favorites"} onClick={() => favorite.mutate({ id: pg.id, on: !pg.is_favorite }, { onError: fail("Could not update favorites") })}>
                            <Star className={pg.is_favorite ? "fill-warning text-warning" : ""} />
                        </Button>
                        {pg.can.edit && !pg.archived_at && <Button variant="outline" asChild><Link to={`/docs/pages/${pg.id}/edit`}><Pencil /> Edit</Link></Button>}
                        {pg.can.publish && (pg.status !== "PUBLISHED" || pg.has_unpublished_changes) && !pg.archived_at && <Button onClick={() => act("publish", "Page published")} loading={action.isPending}><Rocket /> Publish</Button>}
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild><Button variant="outline" size="icon" aria-label="More actions"><MoreHorizontal /></Button></DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                <DropdownMenuItem onSelect={() => setPanel("comments")}><MessageSquare /> Comments ({pg.comment_count})</DropdownMenuItem>
                                <DropdownMenuItem onSelect={() => setPanel("history")}><History /> Version history</DropdownMenuItem>
                                <DropdownMenuItem onSelect={() => setPanel("links")}><Link2 /> Backlinks ({pg.backlink_count})</DropdownMenuItem>
                                {pg.can.edit && <DropdownMenuItem onSelect={() => navigate(`/docs/pages/new?space=${pg.space_id}&parent=${pg.id}`)}><FilePlus /> Add sub-page</DropdownMenuItem>}
                                {pg.can.publish && pg.status === "PUBLISHED" && <DropdownMenuItem onSelect={() => act("unpublish", "Page moved back to draft")}><Pencil /> Unpublish</DropdownMenuItem>}
                                {pg.can.archive && (
                                    <>
                                        <DropdownMenuSeparator />
                                        {pg.archived_at ? <DropdownMenuItem onSelect={() => act("unarchive", "Page restored")}><ArchiveRestore /> Unarchive</DropdownMenuItem> : <DropdownMenuItem onSelect={() => setConfirm("archive")}><Archive /> Archive</DropdownMenuItem>}
                                        <DropdownMenuItem className="text-danger focus:text-danger" onSelect={() => setConfirm("trash")}><Trash2 /> Move to trash</DropdownMenuItem>
                                    </>
                                )}
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                </div>

                {pg.archived_at && <div className="mb-4 rounded-lg border border-border bg-secondary px-3 py-2 text-[13px] text-muted-foreground">Archived {formatDate(pg.archived_at)} — read only.</div>}
                <AckBanner page={pg} onAck={() => act("acknowledge", "Thanks — acknowledged")} pending={action.isPending} />

                <article className="rounded-lg border border-border bg-card p-4 sm:p-6">
                    {pg.content_markdown?.trim() ? <Markdown source={pg.content_markdown} /> : <EmptyState compact title="This page is empty" description={pg.can.edit ? "Edit the page to add content." : undefined} />}
                </article>

                {pg.children.length > 0 && (
                    <section className="mt-6 space-y-2">
                        <h2 className="text-[13px] font-medium text-foreground">In this section</h2>
                        <div className="grid gap-2 sm:grid-cols-2">
                            {pg.children.map((c) => (
                                <Link key={c.id} to={`/docs/pages/${c.id}`} className="rounded-lg border border-border bg-card p-3 hover:bg-secondary">
                                    <div className="flex items-center gap-2"><DocIcon icon={c.icon} /><span className="truncate text-[13px] font-medium text-foreground">{c.title}</span></div>
                                    {c.excerpt && <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{c.excerpt}</p>}
                                </Link>
                            ))}
                        </div>
                    </section>
                )}
            </Page>

            <Sheet open={!!panel} onOpenChange={(o) => !o && setPanel(null)}>
                <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
                    {panel === "comments" && <CommentsPanel page={pg} />}
                    {panel === "history" && <HistoryPanel page={pg} />}
                    {panel === "links" && <LinksPanel pageId={pg.id} />}
                </SheetContent>
            </Sheet>
            <ConfirmationDialog
                isOpen={!!confirm}
                onClose={() => setConfirm(null)}
                title={confirm === "trash" ? `Move “${pg.title}” to trash?` : `Archive “${pg.title}”?`}
                description={confirm === "trash" ? "The page and its sub-pages go to the trash. You can restore them from Trash." : "Archived pages are read-only and hidden from the tree."}
                confirmText={confirm === "trash" ? "Move to trash" : "Archive"}
                variant="destructive"
                isLoading={action.isPending}
                onConfirm={() => confirm === "trash" ? act("trash", "Moved to trash", () => navigate(`/docs/spaces/${pg.space_id}`)) : act("archive", "Page archived", () => setConfirm(null))}
            />
        </SpaceLayout>
    );
}

function AckBanner({ page, onAck, pending }: { page: WikiPageDetail; onAck: () => void; pending: boolean }) {
    const ack = page.my_acknowledgement;
    if (!page.requires_acknowledgement || !ack) return null;
    if (ack.is_current) return <div className="mb-4 flex items-center gap-2 rounded-lg border border-success/40 bg-success-soft px-3 py-2 text-[13px] text-foreground"><CheckCircle2 className="size-4 text-success" /> You acknowledged this version on {formatDate(ack.acknowledged_at)}.</div>;
    return (
        <div className="mb-4 flex flex-col gap-2 rounded-lg border border-warning/40 bg-warning-soft px-3 py-2 text-[13px] text-foreground sm:flex-row sm:items-center">
            <span className="flex-1">Please read this page and confirm{ack.required_by ? ` by ${formatDate(ack.required_by)}` : ""}.</span>
            <Button size="sm" onClick={onAck} loading={pending}>I have read this</Button>
        </div>
    );
}

function CommentsPanel({ page }: { page: WikiPageDetail }) {
    const comments = usePageComments(page.id);
    const add = useAddComment();
    const act = useCommentAction();
    const remove = useDeleteComment();
    const [body, setBody] = useState("");
    const fail = (e: unknown) => toast({ variant: "destructive", title: "Could not update the comment", description: getApiErrorMessage(e) });
    return (
        <div className="space-y-4">
            <SheetHeader><SheetTitle>Comments</SheetTitle><SheetDescription>{page.title}</SheetDescription></SheetHeader>
            {page.can.comment && (
                <div className="space-y-2">
                    <Textarea rows={3} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Add a comment…" aria-label="New comment" />
                    <div className="flex justify-end"><Button size="sm" disabled={!body.trim()} loading={add.isPending} onClick={() => add.mutate({ id: page.id, body: body.trim() }, { onSuccess: () => setBody(""), onError: fail })}>Comment</Button></div>
                </div>
            )}
            {comments.isPending ? <ListSkeleton rows={3} /> : comments.error ? <ErrorState error={comments.error} /> : !comments.data.length ? <EmptyState compact icon={MessageSquare} title="No comments yet" /> : (
                <ul className="space-y-3">
                    {comments.data.map((c) => (
                        <li key={c.id} className={`rounded-md border border-border p-3 ${c.resolved_at ? "opacity-60" : ""}`}>
                            <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                                <span className="font-medium text-foreground">{c.author ? personName(c.author.user) : "Former member"}</span>
                                <span>{formatRelative(c.created_at)}</span>
                            </div>
                            <p className="mt-1 whitespace-pre-wrap text-[13px] text-foreground">{c.body}</p>
                            <div className="mt-2 flex gap-2">
                                {page.can.comment && <Button size="sm" variant="ghost" onClick={() => act.mutate({ id: page.id, commentId: c.id, action: c.resolved_at ? "reopen" : "resolve" }, { onError: fail })}>{c.resolved_at ? "Reopen" : "Resolve"}</Button>}
                                {page.can.manage && <Button size="sm" variant="ghost" className="text-danger" onClick={() => remove.mutate({ id: page.id, commentId: c.id }, { onError: fail })}>Delete</Button>}
                            </div>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}

function HistoryPanel({ page }: { page: WikiPageDetail }) {
    const versions = usePageVersions(page.id);
    const [selected, setSelected] = useState<number | null>(null);
    const version = usePageVersion(page.id, selected);
    const restore = useRestoreVersion();
    return (
        <div className="space-y-4">
            <SheetHeader><SheetTitle>Version history</SheetTitle><SheetDescription>Every save creates a version. Restoring creates a new version.</SheetDescription></SheetHeader>
            {versions.isPending ? <ListSkeleton rows={4} /> : versions.error ? <ErrorState error={versions.error} /> : (
                <ul className="divide-y divide-border rounded-md border border-border">
                    {versions.data.map((v) => (
                        <li key={v.id}>
                            <button type="button" onClick={() => setSelected(v.version_number)} className={`w-full px-3 py-2 text-left hover:bg-secondary ${selected === v.version_number ? "bg-secondary" : ""}`}>
                                <div className="flex items-center gap-2 text-[13px] font-medium text-foreground">v{v.version_number}{v.is_published_snapshot && <Badge variant="success">published</Badge>}{v.version_number === page.current_version_number && <Badge variant="outline">current</Badge>}</div>
                                <div className="text-xs text-muted-foreground">{v.change_summary ?? "No summary"} · {v.author ? personName(v.author.user) : "—"} · {formatDateTime(v.created_at)}</div>
                            </button>
                        </li>
                    ))}
                </ul>
            )}
            {selected !== null && (
                <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                        <h3 className="text-[13px] font-medium text-foreground">Version {selected}</h3>
                        {page.can.edit && selected !== page.current_version_number && (
                            <Button size="sm" variant="outline" loading={restore.isPending} onClick={() => restore.mutate({ id: page.id, n: selected }, { onSuccess: () => toast({ title: `Version ${selected} restored as a new version` }), onError: (e) => toast({ variant: "destructive", title: "Could not restore", description: getApiErrorMessage(e) }) })}>
                                Restore
                            </Button>
                        )}
                    </div>
                    <div className="rounded-md border border-border p-3">{version.isPending ? <ListSkeleton rows={3} /> : <Markdown source={version.data?.content_markdown} className="text-[13px]" />}</div>
                </div>
            )}
        </div>
    );
}

function LinksPanel({ pageId }: { pageId: string }) {
    const links = usePageLinks(pageId);
    return (
        <div className="space-y-4">
            <SheetHeader><SheetTitle>Links</SheetTitle><SheetDescription>Pages that link here, and what this page links to.</SheetDescription></SheetHeader>
            {links.isPending ? <ListSkeleton rows={3} /> : links.error ? <ErrorState error={links.error} /> : (
                <>
                    <div className="space-y-2">
                        <h3 className="text-[13px] font-medium text-foreground">Linked from</h3>
                        {links.data.backlinks.length ? (
                            <ul className="divide-y divide-border rounded-md border border-border">
                                {links.data.backlinks.map((b) => <li key={b.id}><Link to={`/docs/pages/${b.page.id}`} className="flex items-center gap-2 px-3 py-2 text-[13px] hover:bg-secondary"><DocIcon icon={b.page.icon} /><span className="truncate">{b.page.title}</span><span className="ml-auto text-xs text-muted-foreground">{b.page.space.name}</span></Link></li>)}
                            </ul>
                        ) : <p className="text-xs text-muted-foreground">No page links here yet.</p>}
                    </div>
                    <div className="space-y-2">
                        <h3 className="text-[13px] font-medium text-foreground">Links to</h3>
                        {links.data.outgoing.length ? (
                            <ul className="divide-y divide-border rounded-md border border-border">
                                {links.data.outgoing.map((o) => <li key={o.id} className="px-3 py-2 text-[13px]">{o.page ? <Link to={`/docs/pages/${o.page.id}`} className="hover:underline">{o.page.title}</Link> : <span className="text-muted-foreground">{o.label ?? `${o.entity_type} ${o.entity_id}`}</span>}</li>)}
                            </ul>
                        ) : <p className="text-xs text-muted-foreground">This page has no links.</p>}
                    </div>
                </>
            )}
        </div>
    );
}
