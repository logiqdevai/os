import { Globe, Inbox, LayoutDashboard, List, Zap } from "lucide-react";
import type { AppDefinition } from "../app.types";

export const automationApp: AppDefinition = {
    id: "automation",
    label: "Automation",
    icon: Zap,
    basePath: "/automation",
    module: "AUTOMATION",
    viewPermissions: ["automation.rules.read"],
    newAction: { label: "New workflow", to: "/automation/workflows/new", permission: "automation.rules.manage" },
    nav: [
        { items: [
            { label: "Overview", to: "/automation", icon: LayoutDashboard, end: true },
            { label: "Workflows", to: "/automation/workflows", icon: Zap },
        ] },
        { label: "Executions", items: [
            { label: "Runs", to: "/automation/runs", icon: List, permissions: ["automation.runs.read"] },
            { label: "Event log", to: "/automation/events", icon: Inbox, permissions: ["automation.runs.read"] },
        ] },
        { label: "Integrations", items: [
            { label: "Webhooks", to: "/automation/webhooks", icon: Globe, permissions: ["automation.webhooks.read"] },
        ] },
    ],
};
