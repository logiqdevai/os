import { CalendarDays, CalendarRange, Clock, Layers, LayoutDashboard, Scale, Star, Tags, UserRound, Users } from "lucide-react";
import type { AppDefinition } from "../app.types";

/** 10 People — every key below exists in api/prisma/seed/permission-catalog.ts. */
export const peopleApp: AppDefinition = {
    id: "people",
    label: "People",
    icon: Users,
    basePath: "/people",
    module: "EMPLOYEES",
    viewPermissions: ["employees.directory.read", "employees.employees.read", "employees.leave.read_own", "employees.attendance.read_own"],
    newAction: { label: "Add employee", to: "/people/new", permission: "employees.employees.create" },
    separatorBefore: true,
    nav: [
        { items: [
            { label: "Dashboard", to: "/people/dashboard", icon: LayoutDashboard, permissions: ["employees.employees.read", "employees.leave.read_all", "employees.capacity.read"] },
            { label: "Employees", to: "/people", icon: Users, end: true, permissions: ["employees.employees.read", "employees.directory.read"] },
            { label: "My profile", to: "/people/me", icon: UserRound, permissions: ["employees.profile.update_own", "employees.leave.read_own"] },
        ] },
        { label: "Leave", items: [
            { label: "Requests", to: "/people/leave", icon: CalendarDays, end: true, permissions: ["employees.leave.read_own", "employees.leave.read_all", "employees.leave.approve"] },
            { label: "Calendar", to: "/people/leave/calendar", icon: CalendarRange, permissions: ["employees.leave.read_own", "employees.leave.read_all"] },
            { label: "Balances", to: "/people/leave/balances", icon: Scale, permissions: ["employees.leave.read_own", "employees.leave.read_all"] },
        ] },
        { label: "Time & workload", items: [
            { label: "Attendance", to: "/people/attendance", icon: Clock, permissions: ["employees.attendance.read_own", "employees.attendance.read_all", "employees.attendance.record_own"] },
            { label: "Capacity", to: "/people/capacity", icon: Layers, permissions: ["employees.capacity.read"] },
        ] },
        { label: "Growth", items: [
            { label: "Skills", to: "/people/skills", icon: Tags, permissions: ["employees.skills.read"] },
            { label: "Performance", to: "/people/performance", icon: Star, permissions: ["employees.performance.read_own", "employees.performance.read_all"] },
        ] },
    ],
};
