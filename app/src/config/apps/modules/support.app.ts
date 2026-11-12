import { BookOpen, Bot, ChartColumn, Inbox, LifeBuoy, MessageSquareText, Plug, Settings, Siren, Ticket, Timer, Workflow } from "lucide-react";
import type { AppDefinition } from "../app.types";

/** 13 Support — every key below exists in api/prisma/seed/permission-catalog.ts. */
export const supportApp: AppDefinition = {
    id: "support",
    label: "Support",
    icon: LifeBuoy,
    basePath: "/support",
    module: "SUPPORT",
    viewPermissions: ["support.conversations.read", "support.tickets.read", "support.knowledge.read", "support.analytics.read", "support.settings.manage"],
    newAction: { label: "New ticket", to: "/support/tickets/new", permission: "support.tickets.create" },
    fill: true,
    nav: [
        { items: [
            { label: "Inbox", to: "/support", icon: Inbox, permissions: ["support.conversations.read"], end: true },
            { label: "Tickets", to: "/support/tickets", icon: Ticket, permissions: ["support.tickets.read"] },
            { label: "Incidents", to: "/support/incidents", icon: Siren, permissions: ["support.tickets.read"] },
            { label: "AI review", to: "/support/ai-review", icon: Bot, permissions: ["support.ai.use"] },
        ] },
        { label: "Help center", items: [
            { label: "Articles", to: "/support/knowledge", icon: BookOpen, permissions: ["support.knowledge.read"] },
        ] },
        { label: "Operations", items: [
            { label: "SLA policies", to: "/support/sla", icon: Timer, permissions: ["support.tickets.read", "support.sla_policies.manage"] },
            { label: "Saved replies", to: "/support/macros", icon: MessageSquareText, permissions: ["support.conversations.reply", "support.canned_responses.manage"] },
            { label: "Analytics", to: "/support/analytics", icon: ChartColumn, permissions: ["support.analytics.read"] },
            { label: "Automation", to: "/support/automation", icon: Workflow, permissions: ["automation.rules.read"] },
        ] },
        { label: "Setup", items: [
            { label: "Inboxes & channels", to: "/support/channels", icon: Plug, permissions: ["support.inboxes.read", "support.inboxes.manage"] },
            { label: "Settings", to: "/support/settings", icon: Settings, permissions: ["support.settings.manage"] },
        ] },
    ],
};
