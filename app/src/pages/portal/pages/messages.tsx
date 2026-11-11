import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ChevronLeft, MessagesSquare, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EmptyState, ErrorState, ListSkeleton, PageSkeleton } from "@/components/ui/states";
import { toast } from "@/hooks/use-toast";
import { getApiErrorMessage } from "@/lib/api-error";
import { formatRelative } from "@/lib/format";
import { usePortalConversation, usePortalConversations, usePostPortalMessage, useStartPortalConversation } from "@/features/portal/hooks/use-portal";
import { usePortal } from "../components/portal-context";
import { PortalCard, PortalHeader, PortalThread } from "../components/portal-ui";
import { PORTAL_PATHS } from "../portal-paths";

/** Customer messages — /portal/messages (mockup 07-portal `cp-messages`). @perm portal.conversations.participate */
export function PortalMessagesPage() {
    const list = usePortalConversations({ limit: 50 });
    const start = useStartPortalConversation();
    const navigate = useNavigate();
    const [open, setOpen] = useState(false);
    const [subject, setSubject] = useState("");
    const [body, setBody] = useState("");
    return (
        <>
            <PortalHeader title="Messages" description="Talk to the team. For bugs and changes, a request is easier to track." actions={<Button onClick={() => setOpen(true)}><Plus /> New message</Button>} />
            {list.isLoading ? <ListSkeleton /> : list.error ? <ErrorState error={list.error} onRetry={() => list.refetch()} /> : !list.data?.data.length ? (
                <EmptyState icon={MessagesSquare} title="No messages yet" description="Start a conversation with the team." action={<Button size="sm" onClick={() => setOpen(true)}><Plus /> New message</Button>} />
            ) : (
                <PortalCard>
                    <ul className="divide-y divide-border-soft">
                        {list.data.data.map((c) => (
                            <li key={c.id}>
                                <Link to={PORTAL_PATHS.message(c.id)} className="flex items-center gap-3 py-3 hover:bg-secondary/40">
                                    {c.unread && <span className="size-2 shrink-0 rounded-full bg-info" aria-label="Unread" />}
                                    <div className="min-w-0 flex-1">
                                        <div className={c.unread ? "truncate text-[13px] font-semibold" : "truncate text-[13px] font-medium"}>{c.subject || "Conversation"}</div>
                                        <div className="truncate text-xs text-muted-foreground">{c.last_message?.body}</div>
                                    </div>
                                    {c.ticket && <Badge variant="neutral">{c.ticket.reference}</Badge>}
                                    <span className="shrink-0 text-xs text-muted-foreground">{formatRelative(c.last_message_at ?? c.created_at)}</span>
                                </Link>
                            </li>
                        ))}
                    </ul>
                </PortalCard>
            )}
            <Dialog open={open} onOpenChange={(o) => !start.isPending && setOpen(o)}>
                <DialogContent className="sm:max-w-lg">
                    <DialogHeader><DialogTitle>New message</DialogTitle><DialogDescription>The team usually replies within a working day.</DialogDescription></DialogHeader>
                    <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Subject" aria-label="Subject" maxLength={300} />
                    <Textarea rows={5} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Your message" aria-label="Message" />
                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setOpen(false)} disabled={start.isPending}>Cancel</Button>
                        <Button loading={start.isPending} disabled={!subject.trim() || !body.trim()} onClick={() => start.mutate({ subject: subject.trim(), body: body.trim() }, { onSuccess: (c) => { setOpen(false); setSubject(""); setBody(""); navigate(PORTAL_PATHS.message(c.id)); }, onError: (e) => toast({ variant: "destructive", title: "Could not send", description: getApiErrorMessage(e) }) })}>Send</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}

/** One conversation — /portal/messages/:id. Marks it read. */
export function PortalConversationPage() {
    const { id } = useParams();
    const { session } = usePortal();
    const conv = usePortalConversation(id);
    const post = usePostPortalMessage();
    const [body, setBody] = useState("");
    if (conv.isLoading) return <PageSkeleton />;
    if (conv.error || !conv.data) return <ErrorState error={conv.error} onRetry={() => conv.refetch()} />;
    const c = conv.data;
    const send = () => post.mutate({ id: c.id, body: body.trim() }, { onSuccess: () => setBody(""), onError: (e) => toast({ variant: "destructive", title: "Could not send", description: getApiErrorMessage(e) }) });
    return (
        <div className="mx-auto max-w-3xl">
            <Link to={PORTAL_PATHS.messages} className="mb-2 inline-flex items-center gap-1 text-[13px] text-muted-foreground hover:text-foreground"><ChevronLeft className="size-3.5" /> Messages</Link>
            <PortalHeader title={c.subject || "Conversation"} description={c.ticket ? <Link className="text-info hover:underline" to={PORTAL_PATHS.request(c.ticket.reference)}>Request {c.ticket.reference}</Link> : undefined} />
            <PortalCard className="mb-4"><PortalThread messages={c.messages} agencyName={session.organization?.display_name ?? "The team"} /></PortalCard>
            <PortalCard>
                <Textarea rows={3} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Write a message…" aria-label="Message" onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && body.trim()) { e.preventDefault(); send(); } }} />
                <div className="mt-2 flex justify-end"><Button onClick={send} loading={post.isPending} disabled={!body.trim()}>Send</Button></div>
            </PortalCard>
        </div>
    );
}
