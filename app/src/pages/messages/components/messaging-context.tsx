import { createContext, useContext, useMemo, type ReactNode } from "react";
import { useSessionData } from "@/features/session/hooks/use-session";
import { useDirectory, useOnlinePresence } from "@/features/messaging/hooks/use-messaging";
import { useMessagingSocket, type MessagingSocketState } from "@/features/messaging/hooks/use-messaging-socket";
import { useCallMedia, type CallMediaState } from "@/features/messaging/hooks/use-call-media";
import type { DirectoryMember, PresenceState } from "@/features/messaging/interfaces/messaging.interfaces";

interface MessagingContextValue extends MessagingSocketState {
    myMembershipId: string | undefined;
    directory: DirectoryMember[];
    presenceOf: (membershipId: string | null | undefined) => PresenceState;
    /** In-app audio / camera of the huddle you are in (survives navigation inside Messages). */
    call: CallMediaState;
}

const MessagingContext = createContext<MessagingContextValue | null>(null);

/** One socket + directory + presence + call media for the whole Messages app. */
export function MessagingProvider({ children }: { children: ReactNode }) {
    const session = useSessionData();
    const myMembershipId = session?.active_organization?.membership_id;
    const socket = useMessagingSocket(myMembershipId);
    const call = useCallMedia(socket.socket);
    const directory = useDirectory();
    const online = useOnlinePresence();

    const value = useMemo<MessagingContextValue>(() => {
        const base = new Map<string, PresenceState>();
        for (const m of directory.data?.data ?? []) base.set(m.membership_id, m.presence.state);
        for (const p of online.data?.data ?? []) base.set(p.membership_id, p.state);
        for (const [id, p] of Object.entries(socket.presence)) base.set(id, p.state);
        return {
            ...socket,
            call,
            myMembershipId,
            directory: directory.data?.data ?? [],
            presenceOf: (id) => (id ? base.get(id) ?? "OFFLINE" : "OFFLINE"),
        };
    }, [socket, call, myMembershipId, directory.data, online.data]);

    return <MessagingContext.Provider value={value}>{children}</MessagingContext.Provider>;
}

export function useMessaging() {
    const ctx = useContext(MessagingContext);
    if (!ctx) throw new Error("useMessaging must be used inside MessagingProvider");
    return ctx;
}
