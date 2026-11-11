import { Fragment, useEffect, useLayoutEffect, useRef, type ReactNode } from "react";
import { isSameDay, isToday, isYesterday, parseISO } from "date-fns";
import { Loader2 } from "lucide-react";
import { formatDate } from "@/lib/format";
import type { Message } from "@/features/messaging/interfaces/messaging.interfaces";
import { MessageItem } from "./message-item";

const GROUP_MS = 5 * 60_000;

const dayLabel = (iso: string) => {
    const d = parseISO(iso);
    if (isToday(d)) return "Today";
    if (isYesterday(d)) return "Yesterday";
    return formatDate(d, "EEEE, d MMMM yyyy");
};

interface MessageListProps {
    messages: Message[];
    canPost: boolean;
    onOpenThread?: (rootId: string) => void;
    inThread?: boolean;
    hasMore?: boolean;
    loadingMore?: boolean;
    onLoadMore?: () => void;
    header?: ReactNode;
    empty?: ReactNode;
}

/** Scrollable message list: day separators, author grouping, sticks to the bottom for new messages, loads older on scroll-up. */
export function MessageList({ messages, canPost, onOpenThread, inThread, hasMore, loadingMore, onLoadMore, header, empty }: MessageListProps) {
    const ref = useRef<HTMLDivElement>(null);
    const atBottom = useRef(true);
    const prevHeight = useRef(0);
    const prevFirst = useRef<string | undefined>(undefined);
    const lastId = messages[messages.length - 1]?.id;

    // Keep position when older messages are prepended; follow new messages when the reader is at the bottom.
    useLayoutEffect(() => {
        const el = ref.current;
        if (!el) return;
        const first = messages[0]?.id;
        if (prevFirst.current && first !== prevFirst.current && prevHeight.current) {
            el.scrollTop += el.scrollHeight - prevHeight.current;
        } else if (atBottom.current) {
            el.scrollTop = el.scrollHeight;
        }
        prevFirst.current = first;
        prevHeight.current = el.scrollHeight;
    }, [messages, lastId]);

    useEffect(() => {
        const el = ref.current;
        if (el) el.scrollTop = el.scrollHeight;
    }, []);

    const onScroll = () => {
        const el = ref.current;
        if (!el) return;
        atBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
        prevHeight.current = el.scrollHeight;
        if (el.scrollTop < 120 && hasMore && !loadingMore) onLoadMore?.();
    };

    return (
        <div ref={ref} onScroll={onScroll} className="min-h-0 flex-1 overflow-y-auto overscroll-contain py-2" role="log" aria-live="polite" aria-relevant="additions">
            {hasMore && (
                <div className="flex justify-center py-2">
                    {loadingMore ? <Loader2 className="size-4 animate-spin text-muted-foreground" aria-label="Loading older messages" /> : (
                        <button type="button" className="text-xs text-primary hover:underline" onClick={onLoadMore}>Load earlier messages</button>
                    )}
                </div>
            )}
            {!hasMore && header}
            {messages.length === 0 && empty}
            {messages.map((m, i) => {
                const prev = messages[i - 1];
                const newDay = !prev || !isSameDay(parseISO(prev.created_at), parseISO(m.created_at));
                const compact =
                    !newDay && !!prev && prev.kind !== "SYSTEM" && m.kind !== "SYSTEM" && !prev.deleted_at &&
                    prev.author?.membership_id === m.author?.membership_id && prev.author?.user_id === m.author?.user_id &&
                    parseISO(m.created_at).getTime() - parseISO(prev.created_at).getTime() < GROUP_MS && (inThread || prev.reply_count === 0);
                return (
                    <Fragment key={m.client_message_id ?? m.id}>
                        {newDay && !inThread && (
                            <div className="sticky top-0 z-10 flex items-center gap-3 px-4 py-2" role="separator">
                                <span className="h-px flex-1 bg-border" />
                                <span className="rounded-full border border-border bg-background px-2.5 py-0.5 text-[11px] font-medium text-muted-foreground">{dayLabel(m.created_at)}</span>
                                <span className="h-px flex-1 bg-border" />
                            </div>
                        )}
                        <MessageItem message={m} compact={compact} onOpenThread={onOpenThread} inThread={inThread} canPost={canPost} />
                    </Fragment>
                );
            })}
        </div>
    );
}
