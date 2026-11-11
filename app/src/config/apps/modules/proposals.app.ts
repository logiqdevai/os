import { ChartColumn, FileText, LayoutTemplate } from "lucide-react";
import type { AppDefinition } from "../app.types";

export const proposalsApp: AppDefinition = {
    id: "proposals",
    label: "Proposals",
    icon: FileText,
    basePath: "/proposals",
    module: "PROPOSALS",
    viewPermissions: ["proposals.proposals.read"],
    newAction: { label: "New proposal", to: "/proposals/new", permission: "proposals.proposals.create" },
    nav: [
        { items: [
            { label: "All proposals", to: "/proposals", icon: FileText, end: true },
            { label: "Analytics", to: "/proposals/analytics", icon: ChartColumn, permissions: ["proposals.analytics.read"] },
        ] },
        { label: "Setup", items: [
            { label: "Templates", to: "/proposals/templates", icon: LayoutTemplate, permissions: ["proposals.templates.manage"] },
        ] },
    ],
};
