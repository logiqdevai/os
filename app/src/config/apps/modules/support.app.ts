import { BookOpen, ChartColumn, Inbox, LifeBuoy, Send, Settings, Ticket, Timer } from "lucide-react";
import type { AppDefinition } from "../app.types";

export const supportApp: AppDefinition = {
    id: "support",
    label: "Support",
    icon: LifeBuoy,
    basePath: "/support",
    module: "SUPPORT",
    viewPermissions: ["support.conversations.read", "support.tickets.read"],
    newAction: { label: "New ticket", to: "/support/tickets/new", permission: "support.tickets.create" },
    fill: true,
    nav: [
        { items: [
            { label: "Inbox", to: "/support", icon: Inbox, permissions: ["support.conversations.read"], end: true },
            { label: "Tickets", to: "/support/tickets", icon: Ticket, permissions: ["support.tickets.read"] },
        ] },
        { label: "Help center", items: [
            { label: "Articles", to: "/support/knowledge", icon: BookOpen, permissions: ["support.knowledge.read"] },
        ] },
        { label: "Operations", items: [
            { label: "SLA policies", to: "/support/sla", icon: Timer, permissions: ["support.settings.manage"] },
            { label: "Canned responses", to: "/support/macros", icon: Send },
            { label: "Analytics", to: "/support/analytics", icon: ChartColumn, permissions: ["support.analytics.read"] },
        ] },
        { label: "Setup", items: [
            { label: "Inboxes & channels", to: "/support/channels", icon: Inbox, permissions: ["support.inboxes.read"] },
            { label: "Settings", to: "/support/settings", icon: Settings, permissions: ["support.settings.manage"] },
        ] },
    ],
};
