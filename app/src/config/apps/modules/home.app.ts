import { House, LayoutDashboard, ListChecks, Star } from "lucide-react";
import type { AppDefinition } from "../app.types";

export const homeApp: AppDefinition = {
    id: "home",
    label: "Home",
    icon: House,
    basePath: "/home",
    viewPermissions: [],
    newAction: { label: "New task", to: "/tasks/new", permission: "tasks.tasks.create" },
    nav: [
        { items: [
            { label: "Overview", to: "/home", icon: LayoutDashboard, end: true },
            { label: "My work", to: "/home/my-work", icon: ListChecks },
            { label: "Favorites & recent", to: "/home/favorites", icon: Star },
        ] },
    ],
};
