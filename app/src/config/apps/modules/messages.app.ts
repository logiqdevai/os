import { Archive, AtSign, BarChart3, Bookmark, Flag, Hash, Headphones, House, MessageSquare, MessagesSquare, Plug, Search, Settings, UserRoundPlus } from "lucide-react";
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
    ownSidebar: true,
    nav: [
        { items: [
            { label: "Home", to: "/messages", icon: House, end: true },
            { label: "Threads", to: "/messages/threads", icon: MessagesSquare, permissions: ["messaging.messages.read"] },
            { label: "Mentions", to: "/messages/mentions", icon: AtSign, permissions: ["messaging.messages.read"] },
            { label: "Saved", to: "/messages/saved", icon: Bookmark, permissions: ["messaging.messages.read"] },
            { label: "Search", to: "/messages/search", icon: Search, permissions: ["messaging.messages.read"] },
            { label: "Browse channels", to: "/messages/channels", icon: Hash, permissions: ["messaging.channels.read"] },
            { label: "Huddles & calls", to: "/messages/calls", icon: Headphones, permissions: ["messaging.channels.read"] },
        ] },
        { label: "Admin", items: [
            { label: "Overview", to: "/messages/admin", icon: BarChart3, permissions: ["messaging.analytics.read", "messaging.settings.manage"], end: true },
            { label: "Moderation", to: "/messages/admin/moderation", icon: Flag, permissions: ["messaging.moderation.manage"] },
            { label: "Guests & external", to: "/messages/admin/guests", icon: UserRoundPlus, permissions: ["messaging.external_users.manage"] },
            { label: "Retention & export", to: "/messages/admin/retention", icon: Archive, permissions: ["messaging.retention.manage", "messaging.data.export", "messaging.audit.read"] },
            { label: "Settings", to: "/messages/admin/settings", icon: Settings, permissions: ["messaging.settings.manage", "messaging.audit.read"] },
            { label: "Integrations", to: "/messages/admin/integrations", icon: Plug, permissions: ["messaging.integrations.manage"] },
        ] },
    ],
};
