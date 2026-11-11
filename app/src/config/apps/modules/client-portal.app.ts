import { Building2, CheckCheck, Globe, LayoutDashboard, LifeBuoy, Settings, Users } from "lucide-react";
import type { AppDefinition } from "../app.types";

export const clientPortalApp: AppDefinition = {
    id: "client-portal",
    label: "Client portal",
    icon: Globe,
    basePath: "/client-portal",
    module: "CUSTOMER_PORTAL",
    viewPermissions: ["portal.users.read", "portal.users.manage", "portal.settings.manage"],
    newAction: { label: "Invite portal user", to: "/client-portal/users/invite", permission: "portal.users.manage" },
    nav: [
        { items: [
            { label: "Overview", to: "/client-portal", icon: LayoutDashboard, end: true },
            { label: "Clients", to: "/client-portal/clients", icon: Building2 },
            { label: "Portal users", to: "/client-portal/users", icon: Users },
            { label: "Requests", to: "/client-portal/requests", icon: LifeBuoy },
            { label: "Approvals", to: "/client-portal/approvals", icon: CheckCheck },
        ] },
        { label: "Setup", items: [
            { label: "Settings", to: "/client-portal/settings", icon: Settings, permissions: ["portal.settings.manage"] },
        ] },
    ],
};
