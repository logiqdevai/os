import { AtSign, Bookmark, Hash, House, MessageSquare, MessagesSquare } from "lucide-react";
import type { AppDefinition } from "../app.types";

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
            { label: "Threads", to: "/messages/threads", icon: MessagesSquare },
            { label: "Mentions", to: "/messages/mentions", icon: AtSign },
            { label: "Saved", to: "/messages/saved", icon: Bookmark },
            { label: "Browse channels", to: "/messages/channels", icon: Hash },
        ] },
    ],
};
