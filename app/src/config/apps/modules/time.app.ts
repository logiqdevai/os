import { CalendarClock, CalendarDays, ChartColumn, CheckCheck, Clock, DollarSign, FolderKanban, List, Receipt, Settings, Sparkles, Upload, Users } from "lucide-react";
import type { AppDefinition } from "../app.types";

/** 18 Time — every key below exists in api/prisma/seed/permission-catalog.ts. */
export const timeApp: AppDefinition = {
    id: "time",
    label: "Time",
    icon: Clock,
    basePath: "/time",
    module: "TIME_TRACKING",
    viewPermissions: ["time.entries.read_own", "time.entries.read_team", "time.entries.read_all"],
    newAction: { label: "Add entry", to: "/time/new", permission: "time.entries.create_own" },
    nav: [
        { items: [
            { label: "My timesheet", to: "/time", icon: CalendarDays, end: true, permissions: ["time.entries.read_own"] },
            { label: "Entries", to: "/time/entries", icon: List },
            { label: "Suggestions", to: "/time/suggestions", icon: Sparkles, permissions: ["time.entries.create_own"] },
        ] },
        { label: "Team", items: [
            { label: "Team timesheets", to: "/time/team", icon: Users, permissions: ["time.entries.read_team", "time.entries.read_all"] },
            { label: "Approvals", to: "/time/approvals", icon: CheckCheck, permissions: ["time.timesheets.approve"] },
        ] },
        { label: "Billing", items: [
            { label: "Reports", to: "/time/reports", icon: ChartColumn, permissions: ["time.reports.read"] },
            { label: "Scheduled reports", to: "/time/schedules", icon: CalendarClock, permissions: ["time.entries.export"] },
            { label: "Ready to invoice", to: "/time/unbilled", icon: Receipt, permissions: ["time.entries.read_all"] },
            { label: "Billing rates", to: "/time/rates", icon: DollarSign, permissions: ["time.rates.read"] },
        ] },
        { label: "Admin", items: [
            { label: "Project settings", to: "/time/projects", icon: FolderKanban, permissions: ["time.settings.manage"] },
            { label: "Import", to: "/time/import", icon: Upload, permissions: ["time.imports.manage"] },
            { label: "Settings", to: "/time/settings", icon: Settings, permissions: ["time.settings.manage"] },
        ] },
    ],
};
