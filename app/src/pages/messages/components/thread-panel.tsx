import { useEffect } from "react";
import { Bell, BellOff, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/states";
import { toast } from "@/hooks/use-toast";
import { getApiErrorMessage } from "@/lib/api-error";
import { useMarkThreadRead, useSetThreadFollow, useThread } from "@/features/messaging/hooks/use-messaging";
import { typingKey } from "@/features/messaging/hooks/use-messaging-socket";
import { Composer } from "./composer";
import { MessageItem } from "./message-item";
import { MessageList } from "./message-list";
import { useMessaging } from "./messaging-context";
import { TypingIndicator } from "./typing-indicator";

/**
 * Thread side panel (desktop) / full-height sheet body (mobile): root message, replies, reply composer, follow toggle.
 * @api GET /messaging/messages/:id/thread · POST /messaging/channels/:id/messages {parent_message_id} · PUT/DELETE /messaging/messages/:id/follow
 */
export function ThreadPanel({ rootId, channelLabel, canPost, onClose }: { rootId: string; channelLabel: string; canPost: boolean; onClose: () => void }) {
    const thread = useThread(rootId);
    const follow = useSetThreadFollow();
    const markRead = useMarkThreadRead();
    const { typing } = useMessaging();
    const replies = thread.data?.replies.length ?? 0;
    const { mutate: markThread } = markRead;

    useEffect(() => {
        if (thread.data) markThread(rootId);
    }, [rootId, replies, thread.data, markThread]);

    const root = thread.data?.root;
    const who = root ? typing[typingKey(root.channel_id, rootId)] ?? [] : [];

    return (
        <div className="flex h-full min-h-0 flex-col bg-background">
            <div className="flex h-12 shrink-0 items-center gap-2 border-b border-border px-3">
                <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-foreground">Thread</div>
                    <div className="truncate text-xs text-muted-foreground">{channelLabel}</div>
                </div>
                {thread.data && (
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => follow.mutate({ id: rootId, follow: !thread.data.following }, { onError: (e) => toast({ variant: "destructive", title: "Could not update", description: getApiErrorMessage(e) }) })}
                    >
                        {thread.data.following ? <BellOff /> : <Bell />} {thread.data.following ? "Unfollow" : "Follow"}
                    </Button>
                )}
                <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label="Close thread"><X /></Button>
            </div>
            {thread.isPending ? (
                <div className="space-y-3 p-4">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
            ) : thread.error ? (
                <ErrorState error={thread.error} onRetry={() => thread.refetch()} />
            ) : root && (
                <>
                    <MessageList
                        messages={thread.data.replies}
                        canPost={canPost}
                        inThread
                        header={
                            <div className="border-b border-border-soft pb-2">
                                <MessageItem message={root} inThread canPost={canPost} />
                                <div className="px-4 pt-1 text-xs text-muted-foreground">{root.reply_count} {root.reply_count === 1 ? "reply" : "replies"}</div>
                            </div>
                        }
                    />
                    <div className="shrink-0 px-3 pb-3">
                        <TypingIndicator people={who} />
                        <Composer key={rootId} channelId={root.channel_id} threadRootId={rootId} placeholder="Reply…" disabled={!canPost || !!root.deleted_at} disabledReason={root.deleted_at ? "The original message was deleted." : "You can read this conversation but not post in it."} autoFocus />
                    </div>
                </>
            )}
        </div>
    );
}
