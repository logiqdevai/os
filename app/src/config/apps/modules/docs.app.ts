import { BookOpen, ClipboardList, House, Layers, LayoutTemplate, ListChecks, Trash2 } from "lucide-react";
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
            { label: "Spaces", to: "/docs/spaces", icon: Layers },
            { label: "Templates", to: "/docs/templates", icon: LayoutTemplate },
        ] },
        { label: "Knowledge", items: [
            { label: "Checklists", to: "/docs/checklists", icon: ListChecks },
            { label: "Forms", to: "/docs/forms", icon: ClipboardList },
        ] },
        { items: [
            { label: "Trash", to: "/docs/trash", icon: Trash2 },
        ] },
    ],
};
