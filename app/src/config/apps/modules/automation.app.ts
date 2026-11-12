import { Bot, CheckCheck, Clock, Globe, Inbox, LayoutDashboard, List, Settings2, ShieldCheck, Zap } from "lucide-react";
import type { AppDefinition } from "../app.types";

export const automationApp: AppDefinition = {
    id: "automation",
    label: "Automation",
    icon: Zap,
    basePath: "/automation",
    module: "AUTOMATION",
    viewPermissions: ["automation.rules.read"],
    newAction: { label: "New workflow", to: "/automation/workflows/new", permission: "automation.rules.create" },
    nav: [
        { items: [
            { label: "Overview", to: "/automation", icon: LayoutDashboard, end: true },
            { label: "Workflows", to: "/automation/workflows", icon: Zap },
            { label: "Approvals", to: "/automation/approvals", icon: CheckCheck },
            { label: "Approval policies", to: "/automation/approval-policies", icon: ShieldCheck, permissions: ["automation.rules.read"] },
        ] },
        { label: "Executions", items: [
            { label: "Runs", to: "/automation/runs", icon: List, permissions: ["automation.runs.read"] },
            { label: "Event log", to: "/automation/events", icon: Inbox, permissions: ["automation.runs.read"] },
        ] },
        { label: "Integrations", items: [
            { label: "Webhooks", to: "/automation/webhooks", icon: Globe, permissions: ["automation.webhooks.read"] },
            { label: "Scheduled jobs", to: "/automation/jobs", icon: Clock, permissions: ["automation.jobs.read"] },
            { label: "AI agents & MCP", to: "/automation/agents", icon: Bot, permissions: ["automation.rules.read"] },
        ] },
        { items: [
            { label: "Settings", to: "/automation/settings", icon: Settings2 },
        ] },
    ],
};
