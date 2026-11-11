import { CalendarDays, Clock, Layers, LayoutDashboard, List, Star, Tags, Users } from "lucide-react";
import type { AppDefinition } from "../app.types";

export const peopleApp: AppDefinition = {
    id: "people",
    label: "People",
    icon: Users,
    basePath: "/people",
    module: "EMPLOYEES",
    viewPermissions: ["employees.directory.read", "employees.employees.read"],
    newAction: { label: "Add employee", to: "/people/new", permission: "employees.employees.create" },
    separatorBefore: true,
    nav: [
        { items: [
            { label: "Dashboard", to: "/people/dashboard", icon: LayoutDashboard, permissions: ["employees.employees.read"] },
            { label: "Employees", to: "/people", icon: Users, end: true },
        ] },
        { label: "Leave", items: [
            { label: "Requests", to: "/people/leave", icon: CalendarDays, permissions: ["employees.leave.read_own", "employees.leave.read_all"] },
            { label: "Balances", to: "/people/leave/balances", icon: List, permissions: ["employees.leave.read_own", "employees.leave.read_all"] },
        ] },
        { label: "Time & workload", items: [
            { label: "Attendance", to: "/people/attendance", icon: Clock, permissions: ["employees.attendance.read_own", "employees.attendance.read_all"] },
            { label: "Capacity", to: "/people/capacity", icon: Layers, permissions: ["employees.capacity.read"] },
        ] },
        { label: "Growth", items: [
            { label: "Skills", to: "/people/skills", icon: Tags, permissions: ["employees.skills.read"] },
            { label: "Performance", to: "/people/performance", icon: Star, permissions: ["employees.performance.read_own", "employees.performance.read_all"] },
        ] },
    ],
};
