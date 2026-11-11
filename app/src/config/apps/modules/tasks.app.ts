import { Columns3, List, ListTodo, RefreshCw, Rocket, Settings, SquareCheckBig, Users } from "lucide-react";
import type { AppDefinition } from "../app.types";

export const tasksApp: AppDefinition = {
    id: "tasks",
    label: "Tasks",
    icon: SquareCheckBig,
    basePath: "/tasks",
    module: "TASKS",
    viewPermissions: ["tasks.tasks.read"],
    newAction: { label: "New task", to: "/tasks/new", permission: "tasks.tasks.create" },
    nav: [
        { items: [
            { label: "My tasks", to: "/tasks", icon: ListTodo, end: true },
            { label: "All tasks", to: "/tasks/all", icon: List },
            { label: "Board", to: "/tasks/board", icon: Columns3 },
            { label: "Cycles", to: "/tasks/cycles", icon: RefreshCw },
            { label: "Releases", to: "/tasks/releases", icon: Rocket },
            { label: "Workload", to: "/tasks/workload", icon: Users, permissions: ["tasks.workload.read"] },
        ] },
        { items: [
            { label: "Setup", to: "/tasks/settings", icon: Settings, permissions: ["tasks.workflows.manage"] },
        ] },
    ],
};
