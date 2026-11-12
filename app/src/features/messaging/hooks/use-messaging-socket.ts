import { useCallback, useEffect, useRef, useState } from "react";
import { useQueryClient, type InfiniteData } from "@tanstack/react-query";
import { io, type Socket } from "socket.io-client";
import { environments } from "@/config/environments";
import { ApiRoutes } from "@/config/api/routes";
import { getAuthStoreState, useAuthStore } from "@/stores/auth";
import type { Message, MessagePage, MyChannel, Presence, ReactionGroup, TypingEvent } from "../interfaces/messaging.interfaces";
import { MESSAGING_KEY, bumpReplyCount, messagingKeys, patchMessageEverywhere, patchMyChannel, setReactions, upsertChannelMessage, upsertThreadReply } from "./use-messaging";

const TYPING_TTL_MS = 6000;

export interface MessagingSocketState {
    connected: boolean;
    /** The live socket (null until created) — used by call media for WebRTC signaling. */
    socket: Socket | null;
    /** channel id (or `channel:threadRoot`) → people typing. */
    typing: Record<string, TypingEvent[]>;
    /** membership id → presence. */
    presence: Record<string, Presence>;
    /** Tell the socket layer which channel is on screen (no unread bump for it). */
    setActiveChannel: (channelId: string | null) => void;
    /** Throttled typing signal. */
    sendTyping: (channelId: string, threadRootId?: string | null) => void;
    /** Receive events of an open channel you have not joined. */
    watchChannel: (channelId: string) => void;
}

export const typingKey = (channelId: string, threadRootId?: string | null) => (threadRootId ? `${channelId}:${threadRootId}` : channelId);

/**
 * One Socket.IO connection to the `/messaging` namespace for the signed-in member. Authenticates with the same bearer token and
 * organization as REST, then keeps the TanStack Query caches (messages, threads, sidebar counts, presence) in sync with server events.
 */
export function useMessagingSocket(myMembershipId: string | undefined): MessagingSocketState {
    const qc = useQueryClient();
    const token = useAuthStore((s) => s.access_token);
    const organizationId = useAuthStore((s) => s.organization_id);
    const socketRef = useRef<Socket | null>(null);
    const activeRef = useRef<string | null>(null);
    const lastTypingRef = useRef<Record<string, number>>({});
    const [connected, setConnected] = useState(false);
    const [socketState, setSocketState] = useState<Socket | null>(null);
    const [typing, setTyping] = useState<Record<string, TypingEvent[]>>({});
    const [presence, setPresence] = useState<Record<string, Presence>>({});

    useEffect(() => {
        if (!token || !organizationId || !myMembershipId) return;
        const url = environments.API_URL.replace(/\/+$/, "") + ApiRoutes.messaging.socket_namespace;
        const socket = io(url, {
            auth: (cb) => cb({ token: getAuthStoreState().access_token, organization_id: getAuthStoreState().organization_id }),
            transports: ["websocket", "polling"],
            reconnectionDelayMax: 10_000,
        });
        socketRef.current = socket;
        let firstConnect = true;
        const typingTimers = new Map<string, ReturnType<typeof setTimeout>>();

        socket.on("connect", () => {
            setConnected(true);
            setSocketState(socket);
            if (!firstConnect) qc.invalidateQueries({ queryKey: MESSAGING_KEY });
            firstConnect = false;
            if (activeRef.current) socket.emit("channel.watch", { channel_id: activeRef.current });
        });
        socket.on("disconnect", () => setConnected(false));

        socket.on("message.created", ({ channel_id, message }: { channel_id: string; message: Message }) => {
            const mine = message.author?.membership_id === myMembershipId;
            if (message.parent_message_id) {
                upsertThreadReply(qc, message);
                if (!mine) bumpReplyCount(qc, channel_id, message.parent_message_id, 1, message.created_at);
                else bumpReplyCount(qc, channel_id, message.parent_message_id, 0, message.created_at);
                qc.invalidateQueries({ queryKey: messagingKeys.threads });
                return;
            }
            upsertChannelMessage(qc, message);
            const sidebar = qc.getQueryData<{ data: MyChannel[] }>(messagingKeys.mine);
            const row = sidebar?.data.find((c) => c.id === channel_id);
            if (!row) {
                qc.invalidateQueries({ queryKey: messagingKeys.mine });
                return;
            }
            const counts = !mine && message.kind !== "SYSTEM" && activeRef.current !== channel_id ? { unread_count: row.unread_count + 1 } : {};
            patchMyChannel(qc, channel_id, { last_message_at: message.created_at, ...counts });
            if (message.author) clearTyping(typingKey(channel_id), message.author.membership_id);
        });
        socket.on("message.updated", ({ channel_id, message }: { channel_id: string; message: Message }) => {
            patchMessageEverywhere(qc, channel_id, message.id, (old) => ({ ...old, ...message, is_saved: old.is_saved }));
        });
        socket.on("message.deleted", ({ channel_id, message_id, parent_message_id, has_replies }: { channel_id: string; message_id: string; parent_message_id: string | null; has_replies: boolean }) => {
            patchMessageEverywhere(qc, channel_id, message_id, (m) => (has_replies ? { ...m, deleted_at: new Date().toISOString(), body: "", reactions: [], attachments: [] } : null));
            if (parent_message_id) {
                bumpReplyCount(qc, channel_id, parent_message_id, -1);
                qc.setQueryData(messagingKeys.thread(parent_message_id), (t: { root: Message; replies: Message[] } | undefined) =>
                    t && { ...t, root: { ...t.root, reply_count: Math.max(0, t.root.reply_count - 1) } });
            }
        });
        socket.on("reaction.updated", ({ channel_id, message_id, reactions }: { channel_id: string; message_id: string; reactions: ReactionGroup[] }) => setReactions(qc, channel_id, message_id, reactions));
        socket.on("read", ({ channel_id }: { channel_id: string }) => patchMyChannel(qc, channel_id, { unread_count: 0, mention_count: 0 }));
        socket.on("mention.created", ({ channel_id }: { channel_id: string }) => {
            const row = qc.getQueryData<{ data: MyChannel[] }>(messagingKeys.mine)?.data.find((c) => c.id === channel_id);
            if (row && activeRef.current !== channel_id) patchMyChannel(qc, channel_id, { mention_count: row.mention_count + 1 });
            qc.invalidateQueries({ queryKey: messagingKeys.mentions });
        });
        socket.on("saved.updated", ({ message_id, is_saved }: { message_id: string; is_saved: boolean }) => {
            qc.setQueriesData<InfiniteData<MessagePage>>({ queryKey: [...MESSAGING_KEY, "messages"] }, (d) =>
                d && { ...d, pages: d.pages.map((p) => ({ ...p, data: p.data.map((m) => (m.id === message_id ? { ...m, is_saved } : m)) })) });
            qc.invalidateQueries({ queryKey: messagingKeys.saved });
        });
        const refreshChannel = ({ channel_id }: { channel_id: string }) => {
            qc.invalidateQueries({ queryKey: messagingKeys.mine });
            qc.invalidateQueries({ queryKey: messagingKeys.channel(channel_id) });
            qc.invalidateQueries({ queryKey: messagingKeys.members(channel_id) });
        };
        socket.on("channel.created", refreshChannel);
        socket.on("channel.updated", refreshChannel);
        socket.on("channel.removed", refreshChannel);
        socket.on("member.updated", refreshChannel);
        // Huddles / calls (12 §44): refresh the call bar and the calls page.
        socket.on("call.updated", () => qc.invalidateQueries({ queryKey: ["messaging", "calls"] }));

        socket.on("typing", (e: TypingEvent) => {
            if (e.membership_id === myMembershipId) return;
            const key = typingKey(e.channel_id, e.thread_root_id);
            setTyping((prev) => ({ ...prev, [key]: [...(prev[key] ?? []).filter((t) => t.membership_id !== e.membership_id), e] }));
            const timerKey = `${key}|${e.membership_id}`;
            clearTimeout(typingTimers.get(timerKey));
            typingTimers.set(timerKey, setTimeout(() => clearTyping(key, e.membership_id), TYPING_TTL_MS));
        });
        socket.on("presence", (p: Presence) => setPresence((prev) => ({ ...prev, [p.membership_id]: p })));

        function clearTyping(key: string, membershipId: string | null) {
            setTyping((prev) => (prev[key]?.some((t) => t.membership_id === membershipId) ? { ...prev, [key]: prev[key].filter((t) => t.membership_id !== membershipId) } : prev));
        }

        return () => {
            typingTimers.forEach(clearTimeout);
            socket.removeAllListeners();
            socket.disconnect();
            socketRef.current = null;
            setSocketState(null);
            setConnected(false);
        };
    }, [token, organizationId, myMembershipId, qc]);

    const setActiveChannel = useCallback((channelId: string | null) => {
        const prev = activeRef.current;
        activeRef.current = channelId;
        if (prev && prev !== channelId) socketRef.current?.emit("channel.unwatch", { channel_id: prev });
    }, []);

    const sendTyping = useCallback((channelId: string, threadRootId?: string | null) => {
        const key = typingKey(channelId, threadRootId);
        const now = Date.now();
        if (now - (lastTypingRef.current[key] ?? 0) < 3000) return;
        lastTypingRef.current[key] = now;
        socketRef.current?.emit("typing", { channel_id: channelId, thread_root_id: threadRootId ?? null });
    }, []);

    const watchChannel = useCallback((channelId: string) => {
        socketRef.current?.emit("channel.watch", { channel_id: channelId });
    }, []);

    return { connected, socket: socketState, typing, presence, setActiveChannel, sendTyping, watchChannel };
}
