import { BarChart3, BookOpen, ClipboardList, House, Layers, LayoutTemplate, ListChecks, Sparkles, Trash2 } from "lucide-react";
import type { AppDefinition } from "../app.types";

export const docsApp: AppDefinition = {
    id: "docs",
    label: "Docs",
    icon: BookOpen,
    basePath: "/docs",
    module: "BUSINESS_DOCS",
    viewPermissions: ["docs.pages.read"],
    newAction: { label: "New page", to: "/docs/pages/new", permission: "docs.pages.create" },
    nav: [
        { items: [
            { label: "Home", to: "/docs", icon: House, end: true },
            { label: "Ask the docs", to: "/docs/ask", icon: Sparkles, permissions: ["docs.ai.query"] },
            { label: "Spaces", to: "/docs/spaces", icon: Layers },
            { label: "Templates", to: "/docs/templates", icon: LayoutTemplate },
        ] },
        { label: "Knowledge", items: [
            { label: "Checklists", to: "/docs/checklists", icon: ListChecks },
            { label: "Forms", to: "/docs/forms", icon: ClipboardList },
        ] },
        { items: [
            { label: "Analytics", to: "/docs/analytics", icon: BarChart3, permissions: ["docs.analytics.read"] },
            { label: "Trash", to: "/docs/trash", icon: Trash2 },
        ] },
    ],
};
