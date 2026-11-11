import { Ban, BarChart3, FileText, Filter, Globe, Inbox, LayoutDashboard, Layers, List, Mail } from "lucide-react";
import type { AppDefinition } from "../app.types";

/** Module 11 Communication Center. Every key below exists in api/prisma/seed/permission-catalog.ts. */
export const campaignsApp: AppDefinition = {
    id: "campaigns",
    label: "Campaigns",
    icon: Mail,
    basePath: "/campaigns",
    module: "COMMUNICATION",
    viewPermissions: ["communications.campaigns.read", "communications.messages.read"],
    newAction: { label: "New campaign", to: "/campaigns/new", permission: "communications.campaigns.create" },
    nav: [
        { items: [
            { label: "Overview", to: "/campaigns/overview", icon: LayoutDashboard },
            { label: "All campaigns", to: "/campaigns", icon: Layers, permissions: ["communications.campaigns.read"], end: true },
            { label: "Analytics", to: "/campaigns/analytics", icon: BarChart3, permissions: ["communications.analytics.read"] },
        ] },
        { label: "Audience", items: [
            { label: "Segments", to: "/campaigns/segments", icon: Filter, permissions: ["communications.segments.read"] },
            { label: "Recipient lists", to: "/campaigns/lists", icon: List, permissions: ["communications.recipient_lists.read"] },
            { label: "Suppressions & consent", to: "/campaigns/suppressions", icon: Ban, permissions: ["communications.suppressions.manage", "communications.consents.read"] },
        ] },
        { label: "Content", items: [
            { label: "Templates", to: "/campaigns/templates", icon: FileText, permissions: ["communications.templates.read"] },
            { label: "Message log", to: "/campaigns/messages", icon: Inbox, permissions: ["communications.messages.read"] },
        ] },
        { label: "Setup", items: [
            { label: "Senders & settings", to: "/campaigns/senders", icon: Globe, permissions: ["communications.sender_identities.manage", "communications.settings.manage"] },
        ] },
    ],
};
