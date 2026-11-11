import { Activity, Building2, CheckCheck, Globe, LayoutDashboard, LifeBuoy, Settings, UserRoundPen, Users } from "lucide-react";
import type { AppDefinition } from "../app.types";

/** 07 Client portal (agency side) — every key below exists in api/prisma/seed/permission-catalog.ts. */
export const clientPortalApp: AppDefinition = {
    id: "client-portal",
    label: "Client portal",
    icon: Globe,
    basePath: "/client-portal",
    module: "CUSTOMER_PORTAL",
    viewPermissions: ["portal.users.read", "portal.users.manage", "portal.settings.manage", "portal.activity.read"],
    newAction: { label: "Invite portal user", to: "/client-portal/users/invite", permission: "portal.users.manage" },
    nav: [
        { items: [
            { label: "Overview", to: "/client-portal", icon: LayoutDashboard, end: true },
            { label: "Clients", to: "/client-portal/clients", icon: Building2, permissions: ["portal.users.read", "portal.users.manage", "portal.settings.manage"] },
            { label: "Portal users", to: "/client-portal/users", icon: Users, permissions: ["portal.users.read", "portal.users.manage"] },
            { label: "Requests", to: "/client-portal/requests", icon: LifeBuoy, permissions: ["support.tickets.read"] },
            { label: "Approvals", to: "/client-portal/approvals", icon: CheckCheck, permissions: ["projects.projects.read"] },
            { label: "Profile changes", to: "/client-portal/profile-changes", icon: UserRoundPen, permissions: ["portal.profile_changes.review"] },
        ] },
        { label: "Setup", items: [
            { label: "Activity", to: "/client-portal/activity", icon: Activity, permissions: ["portal.activity.read"] },
            { label: "Settings & branding", to: "/client-portal/settings", icon: Settings, permissions: ["portal.users.read", "portal.settings.manage"] },
        ] },
    ],
};
