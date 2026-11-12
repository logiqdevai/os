import { CalendarRange, Flag, Folder, LayoutDashboard, Settings, TriangleAlert, Users } from "lucide-react";
import type { AppDefinition } from "../app.types";

export const projectsApp: AppDefinition = {
    id: "projects",
    label: "Projects",
    icon: Folder,
    basePath: "/projects",
    module: "PROJECTS",
    viewPermissions: ["projects.projects.read"],
    newAction: { label: "New project", to: "/projects/new", permission: "projects.projects.create" },
    separatorBefore: true,
    nav: [
        { items: [
            { label: "Overview", to: "/projects/overview", icon: LayoutDashboard },
            { label: "All projects", to: "/projects", icon: Folder, end: true },
            { label: "Timeline", to: "/projects/timeline", icon: CalendarRange },
            { label: "Milestones", to: "/projects/milestones", icon: Flag },
            { label: "RAID log", to: "/projects/raid", icon: TriangleAlert },
            { label: "Workload", to: "/projects/workload", icon: Users, permissions: ["projects.portfolio.read", "projects.members.manage"] },
        ] },
        { items: [
            { label: "Setup", to: "/projects/settings", icon: Settings, permissions: ["projects.settings.manage"] },
        ] },
    ],
};
