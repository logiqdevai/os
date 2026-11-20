import { useState } from "react";
import { Link } from "react-router-dom";
import { MessageSquare } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Markdown } from "@/components/ui/markdown";
import { Textarea } from "@/components/ui/textarea";
import { SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { EmptyState, ErrorState, ListSkeleton } from "@/components/ui/states";
import { useSessionData } from "@/features/session/hooks/use-session";
import { formatDateTime, formatRelative, personName } from "@/lib/format";
import { useAddComment, useCommentAction, useDeleteComment, usePageComments, usePageLinks, usePageVersion, usePageVersions, useRestoreVersion } from "@/features/docs/hooks/use-docs";
import type { WikiPageDetail } from "@/features/docs/interfaces/docs.interfaces";
import { DocIcon } from "./doc-icons";

/** Side panels of a page (opened from the top bar): comments, version history, backlinks. */
export function CommentsPanel({ page }: { page: WikiPageDetail }) {
    const comments = usePageComments(page.id);
    const add = useAddComment();
    const act = useCommentAction();
    const remove = useDeleteComment();
    const [body, setBody] = useState("");
    const me = useSessionData()?.user;
    // Display-only author for the optimistic comment (the server sets the real one).
    const author = me ? { id: "me", job_title: null, user: { id: me.id, email: me.email, display_name: me.display_name, first_name: me.first_name, last_name: me.last_name, profile_photo_url: me.profile_photo_url } } : null;
    return (
        <div className="space-y-4">
            <SheetHeader><SheetTitle>Comments</SheetTitle><SheetDescription>{page.title}</SheetDescription></SheetHeader>
            {page.can.comment && (
                <div className="space-y-2">
                    <Textarea rows={3} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Add a comment…" aria-label="New comment" />
                    <div className="flex justify-end"><Button size="sm" disabled={!body.trim()} onClick={() => { const text = body.trim(); setBody(""); add.mutate({ id: page.id, body: text, author }, { onError: () => setBody((b) => b || text) }); }}>Comment</Button></div>
                </div>
            )}
            {comments.isPending ? <ListSkeleton rows={3} /> : comments.error ? <ErrorState error={comments.error} /> : !comments.data.length ? <EmptyState compact icon={MessageSquare} title="No comments yet" /> : (
                <ul className="space-y-3">
                    {comments.data.map((c) => (
                        <li key={c.id} className={`rounded-md border border-border p-3 ${c.resolved_at || c.id.startsWith("temp-") ? "opacity-60" : ""}`}>
                            <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                                <span className="font-medium text-foreground">{c.author ? personName(c.author.user) : "Former member"}</span>
                                <span>{formatRelative(c.created_at)}</span>
                            </div>
                            <p className="mt-1 whitespace-pre-wrap text-[13px] text-foreground">{c.body}</p>
                            <div className="mt-2 flex gap-2">
                                {page.can.comment && !c.id.startsWith("temp-") && <Button size="sm" variant="ghost" onClick={() => act.mutate({ id: page.id, commentId: c.id, action: c.resolved_at ? "reopen" : "resolve" })}>{c.resolved_at ? "Reopen" : "Resolve"}</Button>}
                                {page.can.manage && !c.id.startsWith("temp-") && <Button size="sm" variant="ghost" className="text-danger" onClick={() => remove.mutate({ id: page.id, commentId: c.id })}>Delete</Button>}
                            </div>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}

export function HistoryPanel({ page }: { page: WikiPageDetail }) {
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
                                <div className="flex items-center gap-2 text-[13px] font-medium text-foreground">v{v.version_number}{v.version_number === page.current_version_number && <Badge variant="outline">current</Badge>}</div>
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
                            <Button size="sm" variant="outline" loading={restore.isPending} onClick={() => restore.mutate({ id: page.id, n: selected }, { onSuccess: () => setSelected(null) })}>
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

export function LinksPanel({ pageId }: { pageId: string }) {
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
