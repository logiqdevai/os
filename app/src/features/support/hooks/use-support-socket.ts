import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { io, type Socket } from "socket.io-client";
import { environments } from "@/config/environments";
import { ApiRoutes } from "@/config/api/routes";
import { getAuthStoreState, useAuthStore } from "@/stores/auth";
import { SUPPORT_KEY } from "./use-support";

/**
 * Live support inbox: one Socket.IO connection to the `/support` namespace (same bearer token + organization as REST).
 * Server pushes carry ids only; this hook refetches the affected queries so scope and visibility stay enforced by REST.
 * `inbox.updated` → lists + counts, `conversation.updated` → the open conversation (watched with a scope check).
 */
export function useSupportSocket(openConversationId: string | undefined) {
    const qc = useQueryClient();
    const token = useAuthStore((s) => s.access_token);
    const organizationId = useAuthStore((s) => s.organization_id);
    const socketRef = useRef<Socket | null>(null);
    const watchedRef = useRef<string | undefined>(undefined);
    const [connected, setConnected] = useState(false);

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
        socket.on("conversation.updated", ({ conversation_id }: { conversation_id?: string }) => {
            if (conversation_id) qc.invalidateQueries({ queryKey: [...SUPPORT_KEY, "conversation", conversation_id] });
        });
        return () => {
            clearTimeout(timer);
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

    return { connected };
}
