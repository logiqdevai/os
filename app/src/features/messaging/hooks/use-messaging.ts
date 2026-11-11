import { keepPreviousData, useInfiniteQuery, useMutation, useQuery, useQueryClient, type InfiniteData, type QueryClient } from "@tanstack/react-query";
import * as service from "../services/messaging.services";
import type { Message, MessagePage, MyChannel, ReactionGroup, ThreadResponse } from "../interfaces/messaging.interfaces";

export const MESSAGING_KEY = ["messaging"] as const;
export const messagingKeys = {
    mine: [...MESSAGING_KEY, "channels", "mine"] as const,
    browse: (params: Record<string, unknown>) => [...MESSAGING_KEY, "channels", "browse", params] as const,
    channel: (id: string) => [...MESSAGING_KEY, "channel", id] as const,
    members: (id: string) => [...MESSAGING_KEY, "members", id] as const,
    messages: (channelId: string) => [...MESSAGING_KEY, "messages", channelId] as const,
    thread: (rootId: string) => [...MESSAGING_KEY, "thread", rootId] as const,
    pins: (channelId: string) => [...MESSAGING_KEY, "pins", channelId] as const,
    draft: (channelId: string, threadRootId?: string) => [...MESSAGING_KEY, "draft", channelId, threadRootId ?? "root"] as const,
    threads: [...MESSAGING_KEY, "inbox", "threads"] as const,
    mentions: [...MESSAGING_KEY, "inbox", "mentions"] as const,
    saved: [...MESSAGING_KEY, "inbox", "saved"] as const,
    search: (params: Record<string, unknown>) => [...MESSAGING_KEY, "search", params] as const,
    directory: [...MESSAGING_KEY, "directory"] as const,
    presence: [...MESSAGING_KEY, "presence"] as const,
};

// ------------------------------------------------------------------------------------------------
// Queries
// ------------------------------------------------------------------------------------------------

export const useMyChannels = () => useQuery({ queryKey: messagingKeys.mine, queryFn: service.getMyChannels, staleTime: 30_000 });
export const useBrowseChannels = (params: Record<string, unknown>) =>
    useQuery({ queryKey: messagingKeys.browse(params), queryFn: () => service.browseChannels(params), placeholderData: keepPreviousData });
export const useChannel = (id: string | undefined) => useQuery({ queryKey: messagingKeys.channel(id ?? ""), queryFn: () => service.getChannel(id as string), enabled: !!id });
export const useChannelMembers = (id: string | undefined, enabled = true) =>
    useQuery({ queryKey: messagingKeys.members(id ?? ""), queryFn: () => service.getChannelMembers(id as string), enabled: !!id && enabled });
export const usePins = (channelId: string | undefined, enabled = true) =>
    useQuery({ queryKey: messagingKeys.pins(channelId ?? ""), queryFn: () => service.getPins(channelId as string), enabled: !!channelId && enabled });
export const useThread = (rootId: string | undefined) => useQuery({ queryKey: messagingKeys.thread(rootId ?? ""), queryFn: () => service.getThread(rootId as string), enabled: !!rootId });
export const useDraft = (channelId: string | undefined, threadRootId?: string) =>
    useQuery({ queryKey: messagingKeys.draft(channelId ?? "", threadRootId), queryFn: () => service.getDraft(channelId as string, threadRootId), enabled: !!channelId, staleTime: Infinity, gcTime: 0 });
export const useThreadsInbox = () => useQuery({ queryKey: messagingKeys.threads, queryFn: service.getThreadsInbox });
export const useMentions = () => useQuery({ queryKey: messagingKeys.mentions, queryFn: service.getMentions });
export const useSavedMessages = () => useQuery({ queryKey: messagingKeys.saved, queryFn: service.getSaved });
export const useMessageSearch = (params: { q: string; channel_id?: string }) =>
    useQuery({ queryKey: messagingKeys.search(params), queryFn: () => service.searchMessages(params), enabled: params.q.trim().length >= 2, placeholderData: keepPreviousData });
export const useDirectory = () => useQuery({ queryKey: messagingKeys.directory, queryFn: () => service.getDirectory(), staleTime: 5 * 60_000 });
export const useOnlinePresence = () => useQuery({ queryKey: messagingKeys.presence, queryFn: service.getOnlinePresence, staleTime: 60_000 });

/** Channel messages, newest page first; `before` cursor loads older pages. */
export const useChannelMessages = (channelId: string | undefined) =>
    useInfiniteQuery({
        queryKey: messagingKeys.messages(channelId ?? ""),
        queryFn: ({ pageParam }) => service.getMessages(channelId as string, { before: pageParam, limit: 50 }),
        initialPageParam: undefined as string | undefined,
        getNextPageParam: (last) => (last.has_more ? last.data[0]?.id : undefined),
        enabled: !!channelId,
        staleTime: 60_000,
    });

/** Flatten pages into chronological order. */
export const flattenMessages = (data: InfiniteData<MessagePage> | undefined): Message[] => (data ? [...data.pages].reverse().flatMap((p) => p.data) : []);

// ------------------------------------------------------------------------------------------------
// Cache patching (used by mutations and the realtime socket)
// ------------------------------------------------------------------------------------------------

type MessagesCache = InfiniteData<MessagePage, string | undefined>;

const mapPages = (data: MessagesCache | undefined, fn: (m: Message) => Message | null): MessagesCache | undefined =>
    data && { ...data, pages: data.pages.map((p) => ({ ...p, data: p.data.map(fn).filter((m): m is Message => !!m) })) };

/** Insert or replace a top-level message (dedupe by id / client_message_id). */
export function upsertChannelMessage(qc: QueryClient, message: Message) {
    qc.setQueryData<MessagesCache>(messagingKeys.messages(message.channel_id), (data) => {
        if (!data) return data;
        let found = false;
        const pages = data.pages.map((p) => ({
            ...p,
            data: p.data.map((m) => {
                if (m.id === message.id || (message.client_message_id && m.client_message_id === message.client_message_id)) {
                    found = true;
                    return { ...m, ...message, is_saved: message.is_saved ?? m.is_saved, pending: message.pending };
                }
                return m;
            }),
        }));
        if (!found && pages.length) pages[0] = { ...pages[0], data: [...pages[0].data, message] };
        return { ...data, pages };
    });
}

export function patchMessageEverywhere(qc: QueryClient, channelId: string, id: string, patch: (m: Message) => Message | null) {
    qc.setQueryData<MessagesCache>(messagingKeys.messages(channelId), (data) => mapPages(data, (m) => (m.id === id ? patch(m) : m)));
    qc.setQueriesData<ThreadResponse>({ queryKey: [...MESSAGING_KEY, "thread"] }, (t) => {
        if (!t) return t;
        if (t.root.id === id) {
            const root = patch(t.root);
            return root ? { ...t, root } : t;
        }
        return { ...t, replies: t.replies.map((m) => (m.id === id ? patch(m) : m)).filter((m): m is Message => !!m) };
    });
}

export function upsertThreadReply(qc: QueryClient, message: Message) {
    if (!message.parent_message_id) return;
    qc.setQueryData<ThreadResponse>(messagingKeys.thread(message.parent_message_id), (t) => {
        if (!t) return t;
        const idx = t.replies.findIndex((m) => m.id === message.id || (!!message.client_message_id && m.client_message_id === message.client_message_id));
        if (idx >= 0) {
            const replies = [...t.replies];
            replies[idx] = { ...replies[idx], ...message, pending: message.pending };
            return { ...t, replies };
        }
        return { ...t, replies: [...t.replies, message], root: { ...t.root, reply_count: t.root.reply_count + 1, last_reply_at: message.created_at } };
    });
}

export function bumpReplyCount(qc: QueryClient, channelId: string, rootId: string, delta: number, at?: string) {
    qc.setQueryData<MessagesCache>(messagingKeys.messages(channelId), (data) =>
        mapPages(data, (m) => (m.id === rootId ? { ...m, reply_count: Math.max(0, m.reply_count + delta), last_reply_at: at ?? m.last_reply_at } : m)),
    );
}

export function setReactions(qc: QueryClient, channelId: string, id: string, reactions: ReactionGroup[]) {
    patchMessageEverywhere(qc, channelId, id, (m) => ({ ...m, reactions }));
}

export function patchMyChannel(qc: QueryClient, channelId: string, patch: Partial<MyChannel>) {
    qc.setQueryData<{ data: MyChannel[] }>(messagingKeys.mine, (d) => d && { data: d.data.map((c) => (c.id === channelId ? { ...c, ...patch } : c)) });
}

// ------------------------------------------------------------------------------------------------
// Mutations
// ------------------------------------------------------------------------------------------------

function useInvalidate() {
    const qc = useQueryClient();
    return () => qc.invalidateQueries({ queryKey: MESSAGING_KEY });
}

export const useCreateChannel = () => {
    const invalidate = useInvalidate();
    return useMutation({ mutationFn: service.createChannel, onSuccess: invalidate });
};
export const useUpdateChannel = () => {
    const qc = useQueryClient();
    return useMutation({ mutationFn: service.updateChannel, onSuccess: (c) => { qc.setQueryData(messagingKeys.channel(c.id), c); qc.invalidateQueries({ queryKey: messagingKeys.mine }); } });
};
export const useSetChannelArchived = () => {
    const invalidate = useInvalidate();
    return useMutation({ mutationFn: service.setChannelArchived, onSuccess: invalidate });
};
export const useJoinChannel = () => {
    const invalidate = useInvalidate();
    return useMutation({ mutationFn: service.joinChannel, onSuccess: invalidate });
};
export const useLeaveChannel = () => {
    const invalidate = useInvalidate();
    return useMutation({ mutationFn: service.leaveChannel, onSuccess: invalidate });
};
export const useAddChannelMembers = () => {
    const qc = useQueryClient();
    return useMutation({ mutationFn: service.addChannelMembers, onSuccess: (_d, v) => { qc.invalidateQueries({ queryKey: messagingKeys.members(v.id) }); qc.invalidateQueries({ queryKey: messagingKeys.channel(v.id) }); } });
};
export const useRemoveChannelMember = () => {
    const qc = useQueryClient();
    return useMutation({ mutationFn: service.removeChannelMember, onSuccess: (_d, v) => { qc.invalidateQueries({ queryKey: messagingKeys.members(v.id) }); qc.invalidateQueries({ queryKey: messagingKeys.channel(v.id) }); } });
};
export const useChannelPreferences = () => {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: service.updateChannelPreferences,
        onMutate: (v) => patchMyChannel(qc, v.id, { ...(v.is_favorite !== undefined && { is_favorite: v.is_favorite }), ...(v.muted_until !== undefined && { muted_until: v.muted_until }) }),
        onSettled: (_d, _e, v) => { qc.invalidateQueries({ queryKey: messagingKeys.mine }); qc.invalidateQueries({ queryKey: messagingKeys.channel(v.id) }); },
    });
};
export const useOpenDm = () => {
    const qc = useQueryClient();
    return useMutation({ mutationFn: service.openDm, onSuccess: () => qc.invalidateQueries({ queryKey: messagingKeys.mine }) });
};

export const usePostMessage = () => {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: service.postMessage,
        onSuccess: (m) => {
            if (m.parent_message_id) upsertThreadReply(qc, m);
            else upsertChannelMessage(qc, m);
        },
    });
};
export const useEditMessage = () => {
    const qc = useQueryClient();
    return useMutation({ mutationFn: service.editMessage, onSuccess: (m) => patchMessageEverywhere(qc, m.channel_id, m.id, (old) => ({ ...old, ...m })) });
};
export const useDeleteMessage = () => {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({ id }: { id: string; channel_id: string }) => service.deleteMessage(id),
        onSuccess: (_d, v) => patchMessageEverywhere(qc, v.channel_id, v.id, (m) => (m.reply_count > 0 ? { ...m, deleted_at: new Date().toISOString(), body: "", reactions: [], attachments: [] } : null)),
    });
};
export const useToggleReaction = () => {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({ id, emoji }: { id: string; emoji: string; channel_id: string }) => service.toggleReaction({ id, emoji }),
        onSuccess: (r, v) => setReactions(qc, v.channel_id, v.id, r.reactions),
    });
};
export const useSetPinned = () => {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: service.setPinned,
        onSuccess: (m) => {
            patchMessageEverywhere(qc, m.channel_id, m.id, (old) => ({ ...old, pinned_at: m.pinned_at }));
            qc.invalidateQueries({ queryKey: messagingKeys.pins(m.channel_id) });
            qc.invalidateQueries({ queryKey: messagingKeys.channel(m.channel_id) });
        },
    });
};
export const useSetSaved = () => {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({ id, saved }: { id: string; saved: boolean; channel_id: string }) => service.setSaved({ id, saved }),
        onSuccess: (r, v) => {
            patchMessageEverywhere(qc, v.channel_id, v.id, (m) => ({ ...m, is_saved: r.is_saved }));
            qc.invalidateQueries({ queryKey: messagingKeys.saved });
        },
    });
};
export const useMarkChannelRead = () => {
    const qc = useQueryClient();
    return useMutation({ mutationFn: service.markChannelRead, onMutate: (v) => patchMyChannel(qc, v.id, { unread_count: 0, mention_count: 0 }) });
};
export const useMarkThreadRead = () => {
    const qc = useQueryClient();
    return useMutation({ mutationFn: service.markThreadRead, onSuccess: () => qc.invalidateQueries({ queryKey: messagingKeys.threads }) });
};
export const useSetThreadFollow = () => {
    const qc = useQueryClient();
    return useMutation({ mutationFn: service.setThreadFollow, onSuccess: (_d, v) => { qc.invalidateQueries({ queryKey: messagingKeys.thread(v.id) }); qc.invalidateQueries({ queryKey: messagingKeys.threads }); } });
};
export const useSaveDraft = () => useMutation({ mutationFn: service.saveDraft });
export const useMarkMentionsRead = () => {
    const qc = useQueryClient();
    return useMutation({ mutationFn: service.markMentionsRead, onSuccess: () => qc.invalidateQueries({ queryKey: messagingKeys.mentions }) });
};
export const useUpdateMyPresence = () => useMutation({ mutationFn: service.updateMyPresence });
