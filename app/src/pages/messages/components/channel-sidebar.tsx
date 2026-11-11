import { useState, type ReactNode } from "react";
import { NavLink } from "react-router-dom";
import { AtSign, Bookmark, ChevronDown, Hash, Lock, MessagesSquare, Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/states";
import { Can } from "@/components/access/can";
import { cn } from "@/lib/utils";
import { useMyChannels } from "@/features/messaging/hooks/use-messaging";
import type { MyChannel } from "@/features/messaging/interfaces/messaging.interfaces";
import { useMessaging } from "./messaging-context";
import { PersonAvatar } from "./person-avatar";
import { MessagesPaths } from "../messages-paths";

const isDm = (c: MyChannel) => c.kind === "DIRECT" || c.kind === "GROUP_DIRECT";

function ChannelIcon({ channel }: { channel: MyChannel }) {
    const { presenceOf, myMembershipId } = useMessaging();
    if (isDm(channel)) {
        const other = channel.participants.find((p) => p.membership_id !== myMembershipId) ?? channel.participants[0];
        if (channel.kind === "DIRECT" && other) return <PersonAvatar size="sm" name={other.name} src={other.profile_photo_url} presence={presenceOf(other.membership_id)} />;
        return <span className="grid size-5 place-items-center rounded-md bg-secondary text-[10px] font-medium text-muted-foreground">{channel.participants.length}</span>;
    }
    const Icon = channel.kind === "PRIVATE" ? Lock : Hash;
    return <Icon className="size-4 shrink-0 text-muted-foreground" />;
}

function ChannelRow({ channel, onNavigate }: { channel: MyChannel; onNavigate?: () => void }) {
    const unread = channel.unread_count > 0;
    const muted = !!channel.muted_until && new Date(channel.muted_until) > new Date();
    return (
        <NavLink
            to={MessagesPaths.channel(channel.id)}
            onClick={onNavigate}
            className={({ isActive }) =>
                cn(
                    "flex h-8 items-center gap-2 rounded-md px-2 text-[13px] transition-colors",
                    isActive ? "bg-accent text-foreground" : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
                    unread && !muted && "font-medium text-foreground",
                    muted && "opacity-60",
                )
            }
        >
            <ChannelIcon channel={channel} />
            <span className="min-w-0 flex-1 truncate">{channel.label}</span>
            {channel.mention_count > 0 ? (
                <span className="grid h-4 min-w-4 place-items-center rounded-full bg-danger px-1 text-[10px] font-semibold text-destructive-foreground tabular">{channel.mention_count}</span>
            ) : unread && !muted ? (
                <span className="grid h-4 min-w-4 place-items-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground tabular">{channel.unread_count > 99 ? "99+" : channel.unread_count}</span>
            ) : null}
        </NavLink>
    );
}

function Group({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
    const [open, setOpen] = useState(true);
    return (
        <div className="space-y-0.5">
            <div className="flex items-center justify-between pr-1">
                <button type="button" onClick={() => setOpen(!open)} className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-muted-foreground hover:text-foreground" aria-expanded={open}>
                    <ChevronDown className={cn("size-3 transition-transform", !open && "-rotate-90")} /> {title}
                </button>
                {action}
            </div>
            {open && children}
        </div>
    );
}

/**
 * Channel list inside the Messages page (the shell's context panel keeps the app navigation).
 * @api GET /messaging/channels (unread_count / mention_count per channel, kept live by the socket)
 */
export function ChannelSidebar({ onNewDm, onNavigate, className }: { onNewDm: () => void; onNavigate?: () => void; className?: string }) {
    const channels = useMyChannels();
    const { connected } = useMessaging();
    const all = (channels.data?.data ?? []).filter((c) => c.status === "ACTIVE");
    const favorites = all.filter((c) => c.is_favorite);
    const rooms = all.filter((c) => !c.is_favorite && !isDm(c)).sort((a, b) => a.label.localeCompare(b.label));
    const dms = all.filter((c) => !c.is_favorite && isDm(c)).sort((a, b) => (b.last_message_at ?? "").localeCompare(a.last_message_at ?? ""));

    const link = (to: string, label: string, Icon: typeof AtSign) => (
        <NavLink to={to} onClick={onNavigate} className={({ isActive }) => cn("flex h-8 items-center gap-2 rounded-md px-2 text-[13px]", isActive ? "bg-accent text-foreground" : "text-muted-foreground hover:bg-accent/60 hover:text-foreground")}>
            <Icon className="size-4" /> {label}
        </NavLink>
    );

    return (
        <aside className={cn("flex min-h-0 flex-col border-r border-border bg-card", className)} aria-label="Channels">
            <div className="flex h-12 shrink-0 items-center justify-between gap-2 border-b border-border px-3">
                <span className="flex items-center gap-2 text-sm font-medium text-foreground">
                    Messages
                    <span className={cn("size-1.5 rounded-full", connected ? "bg-success" : "bg-muted-foreground")} title={connected ? "Live" : "Reconnecting…"} />
                </span>
                <Button variant="ghost" size="icon-sm" onClick={onNewDm} aria-label="New message"><Plus /></Button>
            </div>
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-2">
                <div className="space-y-0.5">
                    {link(MessagesPaths.threads, "Threads", MessagesSquare)}
                    {link(MessagesPaths.mentions, "Mentions", AtSign)}
                    {link(MessagesPaths.saved, "Saved", Bookmark)}
                    {link(MessagesPaths.search, "Search", Search)}
                </div>
                {channels.isPending ? (
                    <div className="space-y-1.5 px-1">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-7 w-full" />)}</div>
                ) : channels.error ? (
                    <ErrorState error={channels.error} onRetry={() => channels.refetch()} />
                ) : (
                    <>
                        {favorites.length > 0 && (
                            <Group title="Favorites">{favorites.map((c) => <ChannelRow key={c.id} channel={c} onNavigate={onNavigate} />)}</Group>
                        )}
                        <Group title="Channels" action={<Can permission="messaging.channels.create"><Button variant="ghost" size="icon-sm" asChild aria-label="Create channel"><NavLink to={MessagesPaths.create} onClick={onNavigate}><Plus /></NavLink></Button></Can>}>
                            {rooms.map((c) => <ChannelRow key={c.id} channel={c} onNavigate={onNavigate} />)}
                            <NavLink to={MessagesPaths.browse} onClick={onNavigate} className="flex h-8 items-center gap-2 rounded-md px-2 text-[13px] text-muted-foreground hover:bg-accent/60 hover:text-foreground">
                                <Search className="size-4" /> Browse channels
                            </NavLink>
                        </Group>
                        <Group title="Direct messages" action={<Button variant="ghost" size="icon-sm" onClick={onNewDm} aria-label="New direct message"><Plus /></Button>}>
                            {dms.length === 0 ? <p className="px-2 py-1 text-xs text-muted-foreground">No conversations yet.</p> : dms.map((c) => <ChannelRow key={c.id} channel={c} onNavigate={onNavigate} />)}
                        </Group>
                    </>
                )}
            </div>
        </aside>
    );
}
