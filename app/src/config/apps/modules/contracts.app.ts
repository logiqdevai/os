import { BookOpen, CalendarClock, LayoutDashboard, ListChecks, PenLine, Send } from "lucide-react";
import type { AppDefinition } from "../app.types";

export const contractsApp: AppDefinition = {
    id: "contracts",
    label: "Contracts",
    icon: PenLine,
    basePath: "/contracts",
    module: "CONTRACTS",
    viewPermissions: ["contracts.contracts.read"],
    newAction: { label: "New contract", to: "/contracts/new", permission: "contracts.contracts.create" },
    nav: [
        { items: [
            { label: "Dashboard", to: "/contracts/dashboard", icon: LayoutDashboard },
            { label: "All contracts", to: "/contracts", icon: PenLine, end: true },
            { label: "Signature requests", to: "/contracts/signatures", icon: Send, permissions: ["contracts.signatures.read"] },
            { label: "Obligations", to: "/contracts/obligations", icon: ListChecks },
            { label: "Renewals", to: "/contracts/renewals", icon: CalendarClock },
        ] },
        { label: "Library", items: [
            { label: "Templates & clauses", to: "/contracts/templates", icon: BookOpen, permissions: ["contracts.templates.manage", "contracts.clauses.manage", "contracts.types.manage", "contracts.approval_rules.manage"] },
        ] },
    ],
};
