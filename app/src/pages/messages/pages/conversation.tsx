import { useEffect, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Archive, ArchiveRestore, ChevronLeft, FolderKanban, Hash, Info, Lock, LogOut, MoreHorizontal, Pin, Star, Users, Volume2, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import ConfirmationDialog from "@/components/ui/confirmation-dialog";
import { useIsMobile } from "@/hooks/use-mobile";
import { usePermissions } from "@/hooks/use-permission";
import { usePageMetadata } from "@/hooks/use-page-metadata";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
    flattenMessages, useChannel, useChannelMessages, useChannelPreferences, useJoinChannel, useLeaveChannel, useMarkChannelRead, usePins, useSetChannelArchived,
} from "@/features/messaging/hooks/use-messaging";
import { typingKey } from "@/features/messaging/hooks/use-messaging-socket";
import { Composer } from "../components/composer";
import { MessageList } from "../components/message-list";
import { MessageBody } from "../components/message-body";
import { ThreadPanel } from "../components/thread-panel";
import { TypingIndicator } from "../components/typing-indicator";
import { ChannelDetailsDialog, ChannelMembersDialog } from "../components/messaging-dialogs";
import { useMessaging } from "../components/messaging-context";
import { PersonAvatar } from "../components/person-avatar";
import { ActiveCallBar, StartHuddleButton } from "../components/call-bar";
import { MessagesPaths } from "../messages-paths";

/**
 * /messages/c/:channelId(?thread=<rootId>) — one conversation: header, messages with day separators, composer, thread panel.
 * @perm messaging.messages.read · post messaging.messages.post · pin messaging.messages.pin · members messaging.channel_members.manage
 * @api GET /messaging/channels/:id · GET /:id/messages?before= · POST /:id/messages · POST /:id/read · socket /messaging
 */
export default function ConversationPage() {
    const { channelId } = useParams();
    const [sp, setSp] = useSearchParams();
    const threadId = sp.get("thread") ?? undefined;
    const navigate = useNavigate();
    const isMobile = useIsMobile();
    const { can } = usePermissions();
    const { setActiveChannel, watchChannel, typing, myMembershipId, presenceOf } = useMessaging();
    const channel = useChannel(channelId);
    const messages = useChannelMessages(channelId);
    const markRead = useMarkChannelRead();
    const join = useJoinChannel();
    const leave = useLeaveChannel();
    const archive = useSetChannelArchived();
    const prefs = useChannelPreferences();
    const [membersOpen, setMembersOpen] = useState(false);
    const [detailsOpen, setDetailsOpen] = useState(false);
    const [confirmLeave, setConfirmLeave] = useState(false);
    const [pinsOpen, setPinsOpen] = useState(false);
    const pins = usePins(channelId, pinsOpen);
    const c = channel.data;
    usePageMetadata({ title: c ? (c.kind === "PUBLIC" || c.kind === "PRIVATE" ? `#${c.label}` : c.label) : "Messages" });

    const list = flattenMessages(messages.data);
    const lastId = [...list].reverse().find((m) => !m.pending)?.id;
    const { mutate: markChannel } = markRead;

    useEffect(() => {
        if (!channelId) return;
        setActiveChannel(channelId);
        return () => setActiveChannel(null);
    }, [channelId, setActiveChannel]);

    useEffect(() => {
        if (c && !c.is_member && channelId) watchChannel(channelId);
    }, [c, channelId, watchChannel]);

    useEffect(() => {
        if (!channelId || !lastId || !c?.is_member || lastId.startsWith("tmp-")) return;
        const t = setTimeout(() => markChannel({ id: channelId, message_id: lastId }), 400);
        return () => clearTimeout(t);
    }, [channelId, lastId, c?.is_member, markChannel]);

    if (channel.isPending) {
        return (
            <div className="flex h-full flex-col">
                <div className="flex h-12 items-center border-b border-border px-4"><Skeleton className="h-5 w-40" /></div>
                <div className="flex-1 space-y-4 p-4">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="flex gap-3"><Skeleton className="size-8" /><div className="flex-1 space-y-1.5"><Skeleton className="h-3 w-32" /><Skeleton className="h-4 w-3/4" /></div></div>)}</div>
            </div>
        );
    }
    if (channel.error || !c) return <div className="p-4"><ErrorState error={channel.error} onRetry={() => channel.refetch()} /></div>;

    const isDm = c.kind === "DIRECT" || c.kind === "GROUP_DIRECT";
    const archived = c.status === "ARCHIVED";
    const canPost = c.can_post && c.is_member && !archived && can("messaging.messages.post");
    const other = c.kind === "DIRECT" ? c.participants.find((p) => p.membership_id !== myMembershipId) : undefined;
    const muted = !!c.muted_until && new Date(c.muted_until) > new Date();
    const closeThread = () => setSp((p) => { const n = new URLSearchParams(p); n.delete("thread"); return n; }, { replace: true });
    const openThread = (rootId: string) => setSp((p) => { const n = new URLSearchParams(p); n.set("thread", rootId); return n; });
    const Icon = c.kind === "PRIVATE" ? Lock : Hash;
    const title = isDm ? c.label : c.name ?? c.label;

    const intro = (
        <div className="px-4 pb-4 pt-6">
            {isDm ? (
                <div className="flex items-center gap-3">
                    {other && <PersonAvatar name={other.name} src={other.profile_photo_url} presence={presenceOf(other.membership_id)} />}
                    <div>
                        <div className="text-base font-semibold text-foreground">{c.label}</div>
                        <p className="text-[13px] text-muted-foreground">This is the start of your conversation{other ? ` with ${other.name}` : ""}.</p>
                    </div>
                </div>
            ) : (
                <>
                    <div className="flex items-center gap-1.5 text-lg font-semibold text-foreground"><Icon className="size-5" /> {c.name}</div>
                    <p className="mt-1 text-[13px] text-muted-foreground">Created {formatDate(c.created_at)}. {c.description ?? "This is the very beginning of the channel."}</p>
                </>
            )}
        </div>
    );

    const conversation = (
        <div className="flex h-full min-w-0 flex-1 flex-col">
            <header className="flex h-12 shrink-0 items-center gap-2 border-b border-border px-2 md:px-4">
                <Button variant="ghost" size="icon-sm" className="md:hidden" onClick={() => navigate(MessagesPaths.root)} aria-label="Back to channels"><ChevronLeft /></Button>
                <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
                        {isDm ? other && <PersonAvatar size="sm" name={other.name} src={other.profile_photo_url} presence={presenceOf(other.membership_id)} /> : <Icon className="size-4 shrink-0 text-muted-foreground" />}
                        <span className="truncate">{title}</span>
                        {archived && <span className="rounded-xs bg-secondary px-1.5 text-[11px] font-medium text-muted-foreground">Archived</span>}
                        {c.project && (
                            <Link to={`/projects/${c.project.id}`} className="inline-flex shrink-0 items-center gap-1 rounded-xs bg-info-soft px-1.5 text-[11px] font-medium text-info hover:underline" title={`Channel for project ${c.project.name}`}>
                                <FolderKanban className="size-3" /> {c.project.code ?? c.project.name}
                            </Link>
                        )}
                        {c.team && <span className="inline-flex shrink-0 items-center gap-1 rounded-xs bg-secondary px-1.5 text-[11px] font-medium text-muted-foreground" title={`Channel for team ${c.team.name}`}><Users className="size-3" /> {c.team.name}</span>}
                        {c.is_confidential && <span className="rounded-xs bg-danger-soft px-1.5 text-[11px] font-medium text-danger">Confidential</span>}
                    </div>
                    {c.topic && <div className="truncate text-xs text-muted-foreground">{c.topic}</div>}
                </div>
                {c.is_member && (
                    <Button variant="ghost" size="icon-sm" aria-label={c.is_favorite ? "Remove from favorites" : "Add to favorites"} onClick={() => prefs.mutate({ id: c.id, is_favorite: !c.is_favorite })}>
                        <Star className={cn(c.is_favorite && "fill-current text-warning")} />
                    </Button>
                )}
                <Popover open={pinsOpen} onOpenChange={setPinsOpen}>
                    <PopoverTrigger asChild>
                        <Button variant="ghost" size="sm" className="hidden sm:inline-flex" aria-label="Pinned messages"><Pin /> {c.pin_count || ""}</Button>
                    </PopoverTrigger>
                    <PopoverContent align="end" className="w-80 p-0">
                        <div className="border-b border-border px-3 py-2 text-[13px] font-medium text-foreground">Pinned messages</div>
                        <div className="max-h-80 overflow-y-auto">
                            {pins.isPending ? <div className="p-3"><Skeleton className="h-10 w-full" /></div> : !pins.data?.data.length ? (
                                <EmptyState compact icon={Pin} title="Nothing pinned" description="Pin important messages from their menu." />
                            ) : pins.data.data.map((p) => (
                                <div key={p.id} className="border-b border-border-soft px-3 py-2 last:border-0">
                                    <div className="text-xs font-medium text-foreground">{p.author?.name} <span className="font-normal text-muted-foreground">· {formatDate(p.created_at, "d MMM HH:mm")}</span></div>
                                    <MessageBody body={p.body} className="line-clamp-3 text-[13px]" />
                                </div>
                            ))}
                        </div>
                    </PopoverContent>
                </Popover>
                {c.is_member && <StartHuddleButton channelId={c.id} disabled={archived} />}
                <Button variant="ghost" size="sm" onClick={() => setMembersOpen(true)} aria-label="Members"><Users /> <span className="tabular">{c.member_count}</span></Button>
                <DropdownMenu>
                    <DropdownMenuTrigger asChild><Button variant="ghost" size="icon-sm" aria-label="Conversation settings"><MoreHorizontal /></Button></DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        {c.is_member && (
                            <DropdownMenuItem onSelect={() => prefs.mutate({ id: c.id, muted_until: muted ? null : new Date("2999-12-31").toISOString() })}>
                                {muted ? <Volume2 /> : <VolumeX />} {muted ? "Unmute" : "Mute"}
                            </DropdownMenuItem>
                        )}
                        {!isDm && c.can_manage && <DropdownMenuItem onSelect={() => setDetailsOpen(true)}><Info /> Edit topic and description</DropdownMenuItem>}
                        {!isDm && c.can_manage && (
                            <DropdownMenuItem onSelect={() => archive.mutate({ id: c.id, archived: !archived })}>
                                {archived ? <ArchiveRestore /> : <Archive />} {archived ? "Unarchive" : "Archive channel"}
                            </DropdownMenuItem>
                        )}
                        {!isDm && c.is_member && (
                            <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem className="text-danger focus:text-danger" onSelect={() => setConfirmLeave(true)}><LogOut /> Leave channel</DropdownMenuItem>
                            </>
                        )}
                    </DropdownMenuContent>
                </DropdownMenu>
            </header>
            <ActiveCallBar channelId={c.id} myMembershipId={myMembershipId ?? null} />

            {messages.error ? (
                <div className="flex-1 p-4"><ErrorState error={messages.error} onRetry={() => messages.refetch()} /></div>
            ) : messages.isPending ? (
                <div className="flex-1 space-y-4 p-4">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
            ) : (
                <MessageList
                    key={c.id}
                    messages={list}
                    canPost={canPost}
                    onOpenThread={openThread}
                    hasMore={messages.hasNextPage}
                    loadingMore={messages.isFetchingNextPage}
                    onLoadMore={() => messages.fetchNextPage()}
                    header={intro}
                />
            )}

            <div className="shrink-0 px-2 pb-2 md:px-4 md:pb-4">
                <TypingIndicator people={typing[typingKey(c.id)] ?? []} />
                {!c.is_member && !isDm && !archived ? (
                    <div className="flex flex-col items-center gap-2 rounded-lg border border-border bg-card p-3 text-center sm:flex-row sm:justify-between sm:text-left">
                        <span className="text-[13px] text-muted-foreground">You are viewing #{c.name}. Join to post and get notified.</span>
                        <Button size="sm" loading={join.isPending} onClick={() => join.mutate(c.id)}>Join channel</Button>
                    </div>
                ) : (
                    <Composer
                        key={c.id}
                        channelId={c.id}
                        placeholder={isDm ? `Message ${c.label}` : `Message #${c.name}`}
                        disabled={!canPost}
                        disabledReason={archived ? "This channel is archived and read-only." : "Only some members can post in this channel."}
                        autoFocus={!isMobile}
                    />
                )}
            </div>
        </div>
    );

    return (
        <div className="flex h-full min-h-0">
            {conversation}
            {threadId && !isMobile && (
                <aside className="hidden w-[380px] shrink-0 border-l border-border md:block xl:w-[420px]">
                    <ThreadPanel rootId={threadId} channelLabel={isDm ? c.label : `#${c.name}`} canPost={canPost} onClose={closeThread} />
                </aside>
            )}
            {isMobile && (
                <Sheet open={!!threadId} onOpenChange={(o) => !o && closeThread()}>
                    <SheetContent side="right" className="w-full p-0 sm:max-w-full">
                        <SheetTitle className="sr-only">Thread</SheetTitle>
                        {threadId && <ThreadPanel rootId={threadId} channelLabel={isDm ? c.label : `#${c.name}`} canPost={canPost} onClose={closeThread} />}
                    </SheetContent>
                </Sheet>
            )}
            <ChannelMembersDialog channel={c} open={membersOpen} onOpenChange={setMembersOpen} />
            {!isDm && <ChannelDetailsDialog channel={c} open={detailsOpen} onOpenChange={setDetailsOpen} />}
            <ConfirmationDialog
                isOpen={confirmLeave}
                onClose={() => setConfirmLeave(false)}
                title={`Leave #${c.name}?`}
                description={c.kind === "PRIVATE" ? "You will need an invitation to come back." : "You can join again from Browse channels."}
                confirmText="Leave"
                variant="destructive"
                onConfirm={() => { leave.mutate(c.id); setConfirmLeave(false); navigate(MessagesPaths.root); }}
            />
        </div>
    );
}

export function ConversationNotSelected() {
    return (
        <div className="hidden h-full flex-1 items-center justify-center md:flex">
            <EmptyState icon={Hash} title="Pick a conversation" description={<>Choose a channel or a person on the left, or <Link className="text-primary hover:underline" to={MessagesPaths.browse}>browse channels</Link>.</>} />
        </div>
    );
}
