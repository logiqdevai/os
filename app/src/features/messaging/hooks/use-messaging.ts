import { keepPreviousData, useInfiniteQuery, useMutation, useQuery, useQueryClient, type InfiniteData, type QueryClient, type QueryKey } from "@tanstack/react-query";
import { restore, snapshot } from "@/lib/query/optimistic";
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
/** Teams and projects a new channel can be created for (with their members). */
export const useChannelSources = (enabled = true) => useQuery({ queryKey: [...MESSAGING_KEY, "channel-sources"], queryFn: () => service.getChannelSources(), enabled, staleTime: 30_000 });
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
export const useOnlinePresence = () => useQuery({ queryKey: messagingKeys.presence, queryFn: service.getOnlinePresence, staleTime: 15_000, refetchInterval: 30_000 });

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
// Mutations — Linear-style: the UI changes at once, a refused request rolls back, failures are toasted once by the
// global MutationCache (meta.errorTitle). No success toasts. The socket keeps every cache in sync afterwards.
// ------------------------------------------------------------------------------------------------

type Meta = { errorTitle?: string; errorToast?: boolean };

/** Message caches touched by message-level changes: the channel's pages and every open thread. */
const messageRoots = (channelId: string): QueryKey[] => [messagingKeys.messages(channelId), [...MESSAGING_KEY, "thread"]];

/**
 * Optimistic messaging mutation: `apply` patches the caches under `roots` before the request, a failure restores them.
 * Nothing is refetched on success (the response / socket event carries the result) unless `refresh` says so.
 */
function useMessagingOptimistic<TVars, TData>({ mutationFn, roots, apply, onDone, refresh, meta }: {
    mutationFn: (v: TVars) => Promise<TData>;
    roots: (v: TVars) => QueryKey[];
    apply: (qc: QueryClient, v: TVars) => void;
    onDone?: (qc: QueryClient, data: TData, v: TVars) => void;
    refresh?: (v: TVars) => QueryKey[];
    meta: Meta;
}) {
    const qc = useQueryClient();
    return useMutation({
        mutationFn,
        meta,
        onMutate: async (v: TVars) => {
            const snap = await snapshot(qc, roots(v));
            apply(qc, v);
            return { snap };
        },
        onError: (_e, _v, ctx) => restore(qc, ctx?.snap),
        onSuccess: (data, v) => onDone?.(qc, data, v),
        onSettled: (_d, _e, v) => { for (const queryKey of refresh?.(v) ?? []) qc.invalidateQueries({ queryKey }); },
    });
}

function useInvalidating<TVars, TData>(fn: (v: TVars) => Promise<TData>, meta: Meta, keys: (v: TVars, data?: TData) => QueryKey[] = () => [MESSAGING_KEY]) {
    const qc = useQueryClient();
    return useMutation({ mutationFn: fn, meta, onSettled: (d, _e, v) => { for (const queryKey of keys(v, d)) qc.invalidateQueries({ queryKey }); } });
}

/** Creating is explicit (dialog); the new channel opens. */
export const useCreateChannel = () => useInvalidating(service.createChannel, { errorTitle: "Could not create the channel" });
/** Channel name / topic / description edits show at once in the header and the sidebar. */
const useChannelUpdate = (meta: Meta) =>
    useMessagingOptimistic({
        mutationFn: service.updateChannel,
        meta,
        roots: (v) => [messagingKeys.channel(v.id), messagingKeys.mine],
        apply: (qc, { id, ...patch }) => {
            qc.setQueryData(messagingKeys.channel(id), (c: object | undefined) => c && { ...c, ...patch });
            patchMyChannel(qc, id, patch as Partial<MyChannel>);
        },
        onDone: (qc, c) => qc.setQueryData(messagingKeys.channel(c.id), c),
        refresh: () => [messagingKeys.mine],
    });
export const useUpdateChannel = () => useChannelUpdate({ errorTitle: "Could not update the channel" });
/** Autosaved channel details dialog: failures show in its <SaveStatus />. */
export const useAutosaveChannel = () => useChannelUpdate({ errorToast: false });
/** Archive / restore shows at once on the channel; the sidebar refreshes. */
export const useSetChannelArchived = () =>
    useMessagingOptimistic({
        mutationFn: service.setChannelArchived,
        meta: { errorTitle: "Could not update the channel" },
        roots: (v) => [messagingKeys.channel(v.id)],
        apply: (qc, v) => qc.setQueryData(messagingKeys.channel(v.id), (c: object | undefined) => c && { ...c, status: v.archived ? "ARCHIVED" : "ACTIVE", archived_at: v.archived ? new Date().toISOString() : null }),
        refresh: () => [MESSAGING_KEY],
    });
export const useJoinChannel = () => useInvalidating(service.joinChannel, { errorTitle: "Could not join the channel" });
/** The channel leaves the sidebar at once. */
export const useLeaveChannel = () =>
    useMessagingOptimistic({
        mutationFn: service.leaveChannel,
        meta: { errorTitle: "Could not leave the channel" },
        roots: () => [messagingKeys.mine],
        apply: (qc, id: string) => qc.setQueryData<{ data: MyChannel[] }>(messagingKeys.mine, (d) => d && { data: d.data.filter((c) => c.id !== id) }),
        refresh: () => [MESSAGING_KEY],
    });
export const useAddChannelMembers = () => useInvalidating(service.addChannelMembers, { errorTitle: "Could not add the members" }, (v) => [messagingKeys.members(v.id), messagingKeys.channel(v.id)]);
/** The member row disappears at once. */
export const useRemoveChannelMember = () =>
    useMessagingOptimistic({
        mutationFn: service.removeChannelMember,
        meta: { errorTitle: "Could not remove the member" },
        roots: (v) => [messagingKeys.members(v.id)],
        apply: (qc, v) => qc.setQueryData<{ data: { id: string }[] }>(messagingKeys.members(v.id), (d) => d && { ...d, data: d.data.filter((m) => m.id !== v.member_id) }),
        refresh: (v) => [messagingKeys.members(v.id), messagingKeys.channel(v.id)],
    });
/** Star / mute flips at once in the sidebar and the channel header. */
export const useChannelPreferences = () =>
    useMessagingOptimistic({
        mutationFn: service.updateChannelPreferences,
        meta: { errorTitle: "Could not update the channel" },
        roots: (v) => [messagingKeys.mine, messagingKeys.channel(v.id)],
        apply: (qc, v) => {
            const patch = { ...(v.is_favorite !== undefined && { is_favorite: v.is_favorite }), ...(v.muted_until !== undefined && { muted_until: v.muted_until }) };
            patchMyChannel(qc, v.id, patch);
            qc.setQueryData(messagingKeys.channel(v.id), (c: object | undefined) => c && { ...c, ...patch });
        },
        refresh: (v) => [messagingKeys.mine, messagingKeys.channel(v.id)],
    });
export const useOpenDm = () => useInvalidating(service.openDm, { errorTitle: "Could not open the conversation" }, () => [messagingKeys.mine]);

/**
 * Send a message. Pass `optimistic` (the message as it should look, with a client_message_id) and it shows in the
 * channel / thread at once as "sending"; the REST response and the socket echo merge into it. A refused message stays
 * in place marked "failed" with Retry (send the same vars again).
 */
export const usePostMessage = () => {
    const qc = useQueryClient();
    const put = (m: Message) => (m.parent_message_id ? upsertThreadReply(qc, m) : upsertChannelMessage(qc, m));
    return useMutation({
        meta: { errorTitle: "Message not sent" },
        mutationFn: ({ optimistic: _o, ...v }: Parameters<typeof service.postMessage>[0] & { optimistic?: Message }) => service.postMessage(v),
        onMutate: (v) => { if (v.optimistic) put({ ...v.optimistic, pending: "sending" }); },
        onSuccess: (m) => put({ ...m, pending: undefined }),
        onError: (_e, v) => { if (v.optimistic) put({ ...v.optimistic, pending: "failed" }); },
    });
};
/** The new text shows at once ("edited"); the previous text comes back if the API refuses. */
export const useEditMessage = () =>
    useMessagingOptimistic({
        mutationFn: ({ channel_id: _c, ...v }: { id: string; body: string; channel_id: string }) => service.editMessage(v),
        meta: { errorTitle: "Could not edit the message" },
        roots: (v) => messageRoots(v.channel_id),
        apply: (qc, v) => patchMessageEverywhere(qc, v.channel_id, v.id, (m) => ({ ...m, body: v.body, is_edited: true, edited_at: new Date().toISOString() })),
        onDone: (qc, m) => patchMessageEverywhere(qc, m.channel_id, m.id, (old) => ({ ...old, ...m, is_saved: old.is_saved })),
    });
/** The message disappears at once (or becomes "deleted" when it has replies). */
export const useDeleteMessage = () =>
    useMessagingOptimistic({
        mutationFn: ({ id }: { id: string; channel_id: string }) => service.deleteMessage(id),
        meta: { errorTitle: "Could not delete the message" },
        roots: (v) => messageRoots(v.channel_id),
        apply: (qc, v) => patchMessageEverywhere(qc, v.channel_id, v.id, (m) => (m.reply_count > 0 ? { ...m, deleted_at: new Date().toISOString(), body: "", reactions: [], attachments: [] } : null)),
    });

/** Add / remove my reaction locally (the server's groups replace it when the request returns). */
function toggleMyReaction(reactions: ReactionGroup[], emoji: string, me: string | undefined): ReactionGroup[] {
    if (!me) return reactions;
    const group = reactions.find((r) => r.emoji === emoji);
    if (!group) return [...reactions, { emoji, count: 1, membership_ids: [me] }];
    const mine = group.membership_ids.includes(me);
    const next = { ...group, count: group.count + (mine ? -1 : 1), membership_ids: mine ? group.membership_ids.filter((x) => x !== me) : [...group.membership_ids, me] };
    return next.count > 0 ? reactions.map((r) => (r.emoji === emoji ? next : r)) : reactions.filter((r) => r.emoji !== emoji);
}
/** Pass `me` (your membership id) so the reaction shows at once. */
export const useToggleReaction = () =>
    useMessagingOptimistic({
        mutationFn: ({ id, emoji }: { id: string; emoji: string; channel_id: string; me?: string }) => service.toggleReaction({ id, emoji }),
        meta: { errorTitle: "Could not react" },
        roots: (v) => messageRoots(v.channel_id),
        apply: (qc, v) => patchMessageEverywhere(qc, v.channel_id, v.id, (m) => ({ ...m, reactions: toggleMyReaction(m.reactions, v.emoji, v.me) })),
        onDone: (qc, r, v) => setReactions(qc, v.channel_id, v.id, r.reactions),
    });
/** Pass `channel_id`: the pin shows at once; the pins list and channel header refresh. */
export const useSetPinned = () =>
    useMessagingOptimistic({
        mutationFn: ({ channel_id: _c, ...v }: { id: string; pinned: boolean; channel_id: string }) => service.setPinned(v),
        meta: { errorTitle: "Could not pin the message" },
        roots: (v) => [...messageRoots(v.channel_id), messagingKeys.pins(v.channel_id)],
        apply: (qc, v) => {
            patchMessageEverywhere(qc, v.channel_id, v.id, (m) => ({ ...m, pinned_at: v.pinned ? new Date().toISOString() : null }));
            if (!v.pinned) qc.setQueryData<{ data: Message[] }>(messagingKeys.pins(v.channel_id), (d) => d && { data: d.data.filter((m) => m.id !== v.id) });
        },
        onDone: (qc, m) => patchMessageEverywhere(qc, m.channel_id, m.id, (old) => ({ ...old, pinned_at: m.pinned_at })),
        refresh: (v) => [messagingKeys.pins(v.channel_id), messagingKeys.channel(v.channel_id)],
    });
/** The bookmark flips at once. */
export const useSetSaved = () =>
    useMessagingOptimistic({
        mutationFn: ({ id, saved }: { id: string; saved: boolean; channel_id: string }) => service.setSaved({ id, saved }),
        meta: { errorTitle: "Could not save the message" },
        roots: (v) => [...messageRoots(v.channel_id), messagingKeys.saved],
        apply: (qc, v) => {
            patchMessageEverywhere(qc, v.channel_id, v.id, (m) => ({ ...m, is_saved: v.saved }));
            if (!v.saved) qc.setQueryData<{ data: { id: string; message?: { id: string } }[] }>(messagingKeys.saved, (d) => d && { data: d.data.filter((x) => x.id !== v.id && x.message?.id !== v.id) });
        },
        refresh: () => [messagingKeys.saved],
    });
/** Background read state: the unread badge clears at once; failures stay silent. */
export const useMarkChannelRead = () => {
    const qc = useQueryClient();
    return useMutation({ mutationFn: service.markChannelRead, meta: { errorToast: false }, onMutate: (v) => patchMyChannel(qc, v.id, { unread_count: 0, mention_count: 0 }) });
};
export const useMarkThreadRead = () => useInvalidating(service.markThreadRead, { errorToast: false }, () => [messagingKeys.threads]);
/** Follow / unfollow shows at once in the thread panel. */
export const useSetThreadFollow = () =>
    useMessagingOptimistic({
        mutationFn: service.setThreadFollow,
        meta: { errorTitle: "Could not update the thread" },
        roots: (v) => [messagingKeys.thread(v.id)],
        apply: (qc, v) => qc.setQueryData<ThreadResponse>(messagingKeys.thread(v.id), (t) => t && { ...t, following: v.follow }),
        refresh: (v) => [messagingKeys.thread(v.id), messagingKeys.threads],
    });
/** Draft autosave of the composer: background, never interrupts with a toast. */
export const useSaveDraft = () => useMutation({ mutationFn: service.saveDraft, meta: { errorToast: false } });
export const useMarkMentionsRead = () => useInvalidating(service.markMentionsRead, { errorToast: false }, () => [messagingKeys.mentions]);
export const useUpdateMyPresence = () => useInvalidating(service.updateMyPresence, { errorTitle: "Could not update your status" }, () => [messagingKeys.presence]);
