import { useCallback, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { io, type Socket } from "socket.io-client";
import { environments } from "@/config/environments";
import { ApiRoutes } from "@/config/api/routes";
import { getAuthStoreState, useAuthStore } from "@/stores/auth";
import { SUPPORT_KEY } from "./use-support";
import type { SupportTypingEvent } from "../interfaces/support.interfaces";

const TYPING_TTL_MS = 7000;

/**
 * Live support inbox: one Socket.IO connection to the `/support` namespace (same bearer token + organization as REST).
 * Server pushes carry ids only; this hook refetches the affected queries so scope and visibility stay enforced by REST.
 * `inbox.updated` → lists + counts, `conversation.updated` → the open conversation (watched with a scope check).
 * `typing` → who is typing in the open conversation (visitor, AI assistant, colleagues — internal-note typing included);
 * `sendTyping` tells the visitor (public replies) and colleagues that you are writing.
 */
export function useSupportSocket(openConversationId: string | undefined) {
    const qc = useQueryClient();
    const token = useAuthStore((s) => s.access_token);
    const organizationId = useAuthStore((s) => s.organization_id);
    const socketRef = useRef<Socket | null>(null);
    const watchedRef = useRef<string | undefined>(undefined);
    const [connected, setConnected] = useState(false);
    const [typing, setTyping] = useState<SupportTypingEvent[]>([]);
    const lastSentRef = useRef(0);

    useEffect(() => {
        if (!token || !organizationId) return;
        const url = environments.API_URL.replace(/\/+$/, "") + ApiRoutes.support.socket_namespace;
        const socket = io(url, {
            auth: (cb) => cb({ token: getAuthStoreState().access_token, organization_id: getAuthStoreState().organization_id }),
            transports: ["websocket", "polling"],
            reconnectionDelayMax: 10_000,
        });
        socketRef.current = socket;
        let timer: ReturnType<typeof setTimeout> | undefined;
        // Bursts (a reply updates the conversation, its ticket and the counts) collapse into one refetch.
        const refreshLists = () => {
            clearTimeout(timer);
            timer = setTimeout(() => {
                qc.invalidateQueries({ queryKey: [...SUPPORT_KEY, "conversations"] });
                qc.invalidateQueries({ queryKey: [...SUPPORT_KEY, "conversation-counts"] });
            }, 300);
        };
        socket.on("connect", () => {
            setConnected(true);
            if (watchedRef.current) socket.emit("conversation.watch", { conversation_id: watchedRef.current });
        });
        socket.on("disconnect", () => setConnected(false));
        socket.on("inbox.updated", refreshLists);
        socket.on("conversation.updated", ({ conversation_id, event_key }: { conversation_id?: string; event_key?: string }) => {
            if (!conversation_id) return;
            qc.invalidateQueries({ queryKey: [...SUPPORT_KEY, "conversation", conversation_id] });
            if (event_key?.startsWith("support.ai.") || event_key === "support.conversation.replied") qc.invalidateQueries({ queryKey: [...SUPPORT_KEY, "ai-sessions", conversation_id] });
            // A new message ends the sender's typing state.
            if (event_key === "support.conversation.replied" || event_key === "support.conversation.customer_replied") setTyping((prev) => prev.filter((t) => t.conversation_id !== conversation_id || t.from === "agent"));
        });
        const timers = new Map<string, ReturnType<typeof setTimeout>>();
        socket.on("typing", (e: SupportTypingEvent) => {
            const key = `${e.conversation_id}|${e.from}|${e.membership_id ?? ""}`;
            clearTimeout(timers.get(key));
            const same = (t: SupportTypingEvent) => t.conversation_id === e.conversation_id && t.from === e.from && (t.membership_id ?? "") === (e.membership_id ?? "");
            setTyping((prev) => [...prev.filter((t) => !same(t)), ...(e.active ? [e] : [])]);
            if (e.active) timers.set(key, setTimeout(() => setTyping((prev) => prev.filter((t) => !same(t))), TYPING_TTL_MS));
        });
        return () => {
            clearTimeout(timer);
            timers.forEach(clearTimeout);
            socket.removeAllListeners();
            socket.disconnect();
            socketRef.current = null;
            setConnected(false);
        };
    }, [token, organizationId, qc]);

    useEffect(() => {
        const socket = socketRef.current;
        const prev = watchedRef.current;
        watchedRef.current = openConversationId;
        if (!socket?.connected) return;
        if (prev && prev !== openConversationId) socket.emit("conversation.unwatch", { conversation_id: prev });
        if (openConversationId) socket.emit("conversation.watch", { conversation_id: openConversationId });
    }, [openConversationId, connected]);

    const sendTyping = useCallback((conversationId: string, internal: boolean) => {
        const now = Date.now();
        if (now - lastSentRef.current < 2500) return;
        lastSentRef.current = now;
        socketRef.current?.emit("typing", { conversation_id: conversationId, internal, active: true });
    }, []);

    return { connected, typing: typing.filter((t) => t.conversation_id === openConversationId), sendTyping };
}
