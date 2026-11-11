import { useState, type ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AtSign, Bookmark, ChevronLeft, CheckCheck, Hash, Lock, MessagesSquare, Plus, Search, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Pagination } from "@/components/ui/pagination";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { Can } from "@/components/access/can";
import { useListParams } from "@/hooks/use-list-params";
import { usePageMetadata } from "@/hooks/use-page-metadata";
import { toast } from "@/hooks/use-toast";
import { getApiErrorMessage } from "@/lib/api-error";
import { formatDateTime, formatNumber, formatRelative } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useBrowseChannels, useJoinChannel, useMarkMentionsRead, useMentions, useMessageSearch, useSavedMessages, useSetSaved, useThreadsInbox } from "@/features/messaging/hooks/use-messaging";
import type { MessageWithChannel } from "@/features/messaging/interfaces/messaging.interfaces";
import { MessageBody } from "../components/message-body";
import { PersonAvatar } from "../components/person-avatar";
import { MessagesPaths } from "../messages-paths";

function InboxShell({ title, icon: Icon, actions, children }: { title: string; icon: typeof AtSign; actions?: ReactNode; children: ReactNode }) {
    const navigate = useNavigate();
    usePageMetadata({ title });
    return (
        <div className="flex h-full min-w-0 flex-1 flex-col">
            <header className="flex h-12 shrink-0 items-center gap-2 border-b border-border px-2 md:px-4">
                <Button variant="ghost" size="icon-sm" className="md:hidden" onClick={() => navigate(MessagesPaths.root)} aria-label="Back to channels"><ChevronLeft /></Button>
                <Icon className="size-4 text-muted-foreground" />
                <h1 className="flex-1 truncate text-sm font-semibold text-foreground">{title}</h1>
                {actions}
            </header>
            <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
        </div>
    );
}

const channelName = (m: MessageWithChannel) => (m.channel.kind === "DIRECT" || m.channel.kind === "GROUP_DIRECT" ? "Direct message" : `#${m.channel.name ?? m.channel.slug}`);

/** A message card that opens the conversation (or the thread for replies). */
function MessageCard({ message, extra, unread }: { message: MessageWithChannel; extra?: ReactNode; unread?: boolean }) {
    const to = message.parent_message_id ? MessagesPaths.thread(message.channel_id, message.parent_message_id) : MessagesPaths.channel(message.channel_id);
    return (
        <Link to={to} className={cn("flex gap-3 border-b border-border-soft px-4 py-3 transition-colors hover:bg-accent/40", unread && "bg-info-soft/40")}>
            <PersonAvatar name={message.author?.name ?? "Unknown"} src={message.author?.profile_photo_url} />
            <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline gap-x-2 text-xs text-muted-foreground">
                    <span className="text-[13px] font-semibold text-foreground">{message.author?.name ?? "Unknown"}</span>
                    <span>{channelName(message)}</span>
                    <span>{formatDateTime(message.created_at)}</span>
                    {message.parent_message_id && <span>· in a thread</span>}
                </div>
                <MessageBody body={message.body} className="line-clamp-4" />
                {extra}
            </div>
        </Link>
    );
}

const ListSkeleton = () => <div className="space-y-3 p-4">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}</div>;

/** /messages/threads — threads you started, replied to or follow. @api GET /messaging/threads */
export function ThreadsInboxPage() {
    const threads = useThreadsInbox();
    return (
        <InboxShell title="Threads" icon={MessagesSquare}>
            {threads.isPending ? <ListSkeleton /> : threads.error ? <ErrorState error={threads.error} onRetry={() => threads.refetch()} /> : threads.data.data.length === 0 ? (
                <EmptyState icon={MessagesSquare} title="No threads yet" description="Threads you start, reply to or follow show up here." />
            ) : (
                threads.data.data.map((t) => (
                    <MessageCard
                        key={t.root.id}
                        message={t.root}
                        unread={t.unread}
                        extra={
                            <div className="mt-1.5 space-y-1 border-l-2 border-border pl-3">
                                {t.last_replies.map((r) => (
                                    <div key={r.id} className="text-[13px]"><span className="font-medium text-foreground">{r.author?.name}: </span><span className="text-muted-foreground">{r.body_plain ?? r.body}</span></div>
                                ))}
                                <div className="text-xs font-medium text-primary">{t.root.reply_count} {t.root.reply_count === 1 ? "reply" : "replies"}{t.unread && " · new"}</div>
                            </div>
                        }
                    />
                ))
            )}
        </InboxShell>
    );
}

/** /messages/mentions — messages that mention you. @api GET /messaging/mentions · POST /messaging/mentions/read */
export function MentionsPage() {
    const mentions = useMentions();
    const markAll = useMarkMentionsRead();
    const unread = mentions.data?.data.some((m) => !m.read_at);
    return (
        <InboxShell
            title="Mentions"
            icon={AtSign}
            actions={unread && <Button variant="ghost" size="sm" loading={markAll.isPending} onClick={() => markAll.mutate(undefined, { onError: (e) => toast({ variant: "destructive", title: "Could not mark as read", description: getApiErrorMessage(e) }) })}><CheckCheck /> Mark all read</Button>}
        >
            {mentions.isPending ? <ListSkeleton /> : mentions.error ? <ErrorState error={mentions.error} onRetry={() => mentions.refetch()} /> : mentions.data.data.length === 0 ? (
                <EmptyState icon={AtSign} title="No mentions" description="When someone @mentions you, it shows up here." />
            ) : (
                mentions.data.data.map((m) => <MessageCard key={m.id} message={m.message} unread={!m.read_at} />)
            )}
        </InboxShell>
    );
}

/** /messages/saved — your bookmarked messages. @api GET /messaging/saved · DELETE /messaging/messages/:id/save */
export function SavedPage() {
    const saved = useSavedMessages();
    const setSaved = useSetSaved();
    return (
        <InboxShell title="Saved" icon={Bookmark}>
            {saved.isPending ? <ListSkeleton /> : saved.error ? <ErrorState error={saved.error} onRetry={() => saved.refetch()} /> : saved.data.data.length === 0 ? (
                <EmptyState icon={Bookmark} title="Nothing saved" description="Save messages to come back to them later." />
            ) : (
                saved.data.data.map((s) => (
                    <div key={s.id} className="relative">
                        <MessageCard message={s.message} extra={<div className="mt-1 text-xs text-muted-foreground">Saved {formatRelative(s.saved_at)}</div>} />
                        <Button
                            variant="ghost"
                            size="sm"
                            className="absolute right-3 top-3"
                            onClick={() => setSaved.mutate({ id: s.message.id, saved: false, channel_id: s.message.channel_id }, { onError: (e) => toast({ variant: "destructive", title: "Could not remove", description: getApiErrorMessage(e) }) })}
                        >
                            Remove
                        </Button>
                    </div>
                ))
            )}
        </InboxShell>
    );
}

/** /messages/search — full-text search in conversations you can read. @api GET /messaging/search?q= */
export function SearchPage() {
    const [q, setQ] = useState("");
    const [debounced, setDebounced] = useState("");
    const search = useMessageSearch({ q: debounced });
    return (
        <InboxShell title="Search messages" icon={Search}>
            <form className="sticky top-0 z-10 border-b border-border bg-background p-3" onSubmit={(e) => { e.preventDefault(); setDebounced(q); }}>
                <div className="relative">
                    <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input autoFocus value={q} onChange={(e) => { setQ(e.target.value); if (e.target.value.trim().length >= 2) setDebounced(e.target.value); }} placeholder="Search messages…" className="pl-8" aria-label="Search messages" />
                </div>
            </form>
            {debounced.trim().length < 2 ? (
                <EmptyState icon={Search} title="Search your conversations" description="Type at least two characters. Only channels and DMs you can read are searched." />
            ) : search.isPending ? <ListSkeleton /> : search.error ? <ErrorState error={search.error} onRetry={() => search.refetch()} /> : search.data.data.length === 0 ? (
                <EmptyState icon={Search} title="No results" description={`Nothing matches “${debounced}”.`} />
            ) : (
                search.data.data.map((m) => <MessageCard key={m.id} message={m} />)
            )}
        </InboxShell>
    );
}

/** /messages/channels — browse and join public channels. @perm messaging.channels.read · create messaging.channels.create · @api GET /messaging/channels/browse */
export function BrowseChannelsPage({ onCreate }: { onCreate: () => void }) {
    const { params, setPage, search, setSearch } = useListParams({ limit: 30 });
    const browse = useBrowseChannels(params);
    const join = useJoinChannel();
    const navigate = useNavigate();
    return (
        <InboxShell
            title="Browse channels"
            icon={Hash}
            actions={<Can permission="messaging.channels.create"><Button size="sm" onClick={onCreate}><Plus /> Create</Button></Can>}
        >
            <div className="border-b border-border p-3">
                <div className="relative">
                    <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search channels…" className="pl-8" aria-label="Search channels" />
                </div>
            </div>
            {browse.isPending ? <ListSkeleton /> : browse.error ? <ErrorState error={browse.error} onRetry={() => browse.refetch()} /> : browse.data.data.length === 0 ? (
                <EmptyState icon={Hash} title={search ? "No channels match" : "No channels yet"} description="Create the first channel for your team." />
            ) : (
                <>
                    <ul>
                        {browse.data.data.map((c) => (
                            <li key={c.id} className="flex items-center gap-3 border-b border-border-soft px-4 py-3">
                                {c.kind === "PRIVATE" ? <Lock className="size-4 shrink-0 text-muted-foreground" /> : <Hash className="size-4 shrink-0 text-muted-foreground" />}
                                <button type="button" className="min-w-0 flex-1 text-left" onClick={() => navigate(MessagesPaths.channel(c.id))}>
                                    <div className="flex items-center gap-2 text-[13px] font-medium text-foreground">
                                        <span className="truncate">{c.name}</span>
                                        {c.is_member && <Badge variant="success">Joined</Badge>}
                                        {c.status === "ARCHIVED" && <Badge>Archived</Badge>}
                                    </div>
                                    <div className="truncate text-xs text-muted-foreground">
                                        <Users className="mr-1 inline size-3" />{formatNumber(c.member_count)} · {c.description ?? c.topic ?? "No description"}
                                    </div>
                                </button>
                                {!c.is_member && c.status === "ACTIVE" && (
                                    <Button size="sm" variant="outline" loading={join.isPending && join.variables === c.id} onClick={() => join.mutate(c.id, { onSuccess: () => navigate(MessagesPaths.channel(c.id)), onError: (e) => toast({ variant: "destructive", title: "Could not join", description: getApiErrorMessage(e) }) })}>
                                        Join
                                    </Button>
                                )}
                            </li>
                        ))}
                    </ul>
                    {browse.data.pagination.total_pages > 1 && <div className="p-3"><Pagination currentPage={browse.data.pagination.page} totalPages={browse.data.pagination.total_pages} onPageChange={setPage} /></div>}
                </>
            )}
        </InboxShell>
    );
}
