import { CalendarDays, ChartColumn, CheckCheck, Clock, DollarSign, List, Users } from "lucide-react";
import type { AppDefinition } from "../app.types";

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
            { label: "My timesheet", to: "/time", icon: CalendarDays, end: true },
            { label: "Entries", to: "/time/entries", icon: List },
        ] },
        { label: "Team", items: [
            { label: "Team timesheets", to: "/time/team", icon: Users, permissions: ["time.entries.read_team", "time.entries.read_all"] },
            { label: "Approvals", to: "/time/approvals", icon: CheckCheck, permissions: ["time.timesheets.approve"] },
        ] },
        { label: "Billing", items: [
            { label: "Billing rates", to: "/time/rates", icon: DollarSign, permissions: ["time.rates.read"] },
            { label: "Reports", to: "/time/reports", icon: ChartColumn, permissions: ["time.reports.read"] },
        ] },
    ],
};
