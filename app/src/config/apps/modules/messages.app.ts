import { AtSign, Bookmark, Hash, House, MessageSquare, MessagesSquare, Search } from "lucide-react";
import type { AppDefinition } from "../app.types";

/** Module 12 Messaging. Every key below exists in api/prisma/seed/permission-catalog.ts. */
export const messagesApp: AppDefinition = {
    id: "messages",
    label: "Messages",
    icon: MessageSquare,
    basePath: "/messages",
    module: "MESSAGING",
    viewPermissions: ["messaging.channels.read"],
    newAction: { label: "New channel", to: "/messages/channels/new", permission: "messaging.channels.create" },
    separatorBefore: true,
    fill: true,
    nav: [
        { items: [
            { label: "Home", to: "/messages", icon: House, end: true },
            { label: "Threads", to: "/messages/threads", icon: MessagesSquare, permissions: ["messaging.messages.read"] },
            { label: "Mentions", to: "/messages/mentions", icon: AtSign, permissions: ["messaging.messages.read"] },
            { label: "Saved", to: "/messages/saved", icon: Bookmark, permissions: ["messaging.messages.read"] },
            { label: "Search", to: "/messages/search", icon: Search, permissions: ["messaging.messages.read"] },
            { label: "Browse channels", to: "/messages/channels", icon: Hash, permissions: ["messaging.channels.read"] },
        ] },
    ],
};
