import { Bot, Building, Building2, FileClock, FlaskConical, Forward, Globe, KeyRound, KeySquare, Layers, LayoutDashboard, List, LockKeyhole, Mail, MonitorSmartphone, Palette, Plug, Shield, Sparkles, Users, UsersRound } from "lucide-react";
import type { AppDefinition } from "../app.types";

/** Admin (module 01). Every key below exists in api/prisma/seed/permission-catalog.ts. */
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
            { label: "Invitations", to: "/admin/invitations", icon: Mail, permissions: ["users.members.read", "users.members.invite"] },
            { label: "Teams", to: "/admin/teams", icon: UsersRound, permissions: ["organizations.teams.read"] },
            { label: "Branches", to: "/admin/branches", icon: Building2, permissions: ["organizations.branches.read"] },
        ] },
        { label: "Access control", items: [
            { label: "Roles", to: "/admin/roles", icon: Shield, permissions: ["users.roles.read"] },
            { label: "Permission catalog", to: "/admin/permissions", icon: List, permissions: ["users.permissions.read"] },
            { label: "Simulate access", to: "/admin/simulate", icon: FlaskConical, permissions: ["users.permissions.simulate"] },
            { label: "Module access", to: "/admin/modules", icon: Layers, permissions: ["organizations.modules.manage"] },
            { label: "Delegations", to: "/admin/delegations", icon: Forward, permissions: ["users.delegations.manage"] },
        ] },
        { label: "Security", items: [
            { label: "Sign-in & security", to: "/admin/security", icon: LockKeyhole, permissions: ["organizations.security.manage"] },
            { label: "Domains", to: "/admin/domains", icon: Globe, permissions: ["organizations.domains.manage"] },
            { label: "Single sign-on", to: "/admin/sso", icon: KeySquare, permissions: ["organizations.sso.manage"] },
            { label: "Sessions", to: "/admin/sessions", icon: MonitorSmartphone, permissions: ["users.sessions.read"] },
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
