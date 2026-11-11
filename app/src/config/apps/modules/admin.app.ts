import { Bot, Building, Building2, FileClock, KeyRound, Layers, LayoutDashboard, List, Mail, Palette, Plug, Shield, Sparkles, Users, UsersRound } from "lucide-react";
import type { AppDefinition } from "../app.types";

export const adminApp: AppDefinition = {
    id: "admin",
    label: "Admin",
    icon: Shield,
    basePath: "/admin",
    module: "ADMINISTRATION",
    viewPermissions: ["users.members.read", "users.roles.read", "organizations.settings.manage", "organizations.audit.read", "organizations.teams.read", "organizations.branches.read"],
    newAction: { label: "Invite member", to: "/admin/invitations/new", permission: "users.members.invite" },
    hidden: true,
    nav: [
        { items: [
            { label: "Overview", to: "/admin", icon: LayoutDashboard, end: true },
        ] },
        { label: "People & structure", items: [
            { label: "Members", to: "/admin/members", icon: Users, permissions: ["users.members.read"] },
            { label: "Invitations", to: "/admin/invitations", icon: Mail, permissions: ["users.members.invite"] },
            { label: "Teams", to: "/admin/teams", icon: UsersRound, permissions: ["organizations.teams.read"] },
            { label: "Branches", to: "/admin/branches", icon: Building2, permissions: ["organizations.branches.read"] },
        ] },
        { label: "Access control", items: [
            { label: "Roles", to: "/admin/roles", icon: Shield, permissions: ["users.roles.read"] },
            { label: "Permission catalog", to: "/admin/permissions", icon: List, permissions: ["users.permissions.read"] },
            { label: "Module access", to: "/admin/modules", icon: Layers, permissions: ["organizations.modules.manage"] },
        ] },
        { label: "Developers", items: [
            { label: "Integrations", to: "/admin/integrations", icon: Plug, permissions: ["organizations.integrations.read"] },
            { label: "API keys", to: "/admin/api-keys", icon: KeyRound, permissions: ["organizations.api_keys.manage"] },
            { label: "Service accounts", to: "/admin/service-accounts", icon: Bot, permissions: ["organizations.service_accounts.manage"] },
            { label: "MCP calls", to: "/admin/mcp-calls", icon: Sparkles, permissions: ["organizations.mcp_calls.read"] },
        ] },
        { label: "Organization", items: [
            { label: "Profile", to: "/admin/profile", icon: Building, permissions: ["organizations.settings.manage"] },
            { label: "Branding", to: "/admin/branding", icon: Palette, permissions: ["organizations.branding.manage"] },
            { label: "Audit log", to: "/admin/audit", icon: FileClock, permissions: ["organizations.audit.read"] },
        ] },
    ],
};
