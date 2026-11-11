import { lazy, type ReactNode } from "react";
import { Route, Routes } from "react-router-dom";
import { RequirePermission } from "@/components/access/can";

const OverviewPage = lazy(() => import("./pages/overview"));
const MembersPage = lazy(() => import("./pages/members"));
const MemberDetailPage = lazy(() => import("./pages/member-detail"));
const InvitationsPage = lazy(() => import("./pages/invitations"));
const TeamsPage = lazy(() => import("./pages/teams"));
const TeamDetailPage = lazy(() => import("./pages/team-detail"));
const BranchesPage = lazy(() => import("./pages/branches"));
const RolesPage = lazy(() => import("./pages/roles"));
const RoleDetailPage = lazy(() => import("./pages/role-detail"));
const PermissionCatalogPage = lazy(() => import("./pages/permission-catalog"));
const SimulatePage = lazy(() => import("./pages/simulate"));
const ModulesPage = lazy(() => import("./pages/modules"));
const ApiKeysPage = lazy(() => import("./pages/api-keys"));
const ServiceAccountsPage = lazy(() => import("./pages/service-accounts"));
const ServiceAccountDetailPage = lazy(() => import("./pages/service-account-detail"));
const McpCallsPage = lazy(() => import("./pages/mcp-calls"));
const AuditPage = lazy(() => import("./pages/audit"));
const IntegrationsPage = lazy(() => import("./pages/integrations"));
const IntegrationDetailPage = lazy(() => import("./pages/integration-detail"));
const ProfilePage = lazy(() => import("./pages/profile"));
const BrandingPage = lazy(() => import("./pages/branding"));

const gate = (anyOf: string[], element: ReactNode) => <RequirePermission anyOf={anyOf}>{element}</RequirePermission>;

/** /admin/* — each route is gated by its VIEW permission (app/mockups/modules/01-admin). The API re-checks everything. */
export default function AdminRoutes() {
    return (
        <Routes>
            <Route index element={gate(["users.members.read", "organizations.audit.read", "organizations.settings.manage", "users.roles.read", "organizations.teams.read", "organizations.branches.read"], <OverviewPage />)} />
            <Route path="members" element={gate(["users.members.read"], <MembersPage />)} />
            <Route path="members/:id" element={gate(["users.members.read"], <MemberDetailPage />)} />
            <Route path="invitations" element={gate(["users.members.read", "users.members.invite"], <InvitationsPage />)} />
            <Route path="invitations/new" element={gate(["users.members.invite"], <InvitationsPage openInvite />)} />
            <Route path="teams" element={gate(["organizations.teams.read"], <TeamsPage />)} />
            <Route path="teams/:id" element={gate(["organizations.teams.read"], <TeamDetailPage />)} />
            <Route path="branches" element={gate(["organizations.branches.read"], <BranchesPage />)} />
            <Route path="branches/:id" element={gate(["organizations.branches.read"], <BranchesPage />)} />
            <Route path="roles" element={gate(["users.roles.read"], <RolesPage />)} />
            <Route path="roles/:id" element={gate(["users.roles.read"], <RoleDetailPage />)} />
            <Route path="permissions" element={gate(["users.permissions.read"], <PermissionCatalogPage />)} />
            <Route path="simulate" element={gate(["users.permissions.simulate"], <SimulatePage />)} />
            <Route path="modules" element={gate(["organizations.modules.manage"], <ModulesPage />)} />
            <Route path="api-keys" element={gate(["organizations.api_keys.manage"], <ApiKeysPage />)} />
            <Route path="service-accounts" element={gate(["organizations.service_accounts.manage"], <ServiceAccountsPage />)} />
            <Route path="service-accounts/:id" element={gate(["organizations.service_accounts.manage"], <ServiceAccountDetailPage />)} />
            <Route path="mcp-calls" element={gate(["organizations.mcp_calls.read"], <McpCallsPage />)} />
            <Route path="audit" element={gate(["organizations.audit.read"], <AuditPage />)} />
            <Route path="integrations" element={gate(["organizations.integrations.read"], <IntegrationsPage />)} />
            <Route path="integrations/:id" element={gate(["organizations.integrations.read"], <IntegrationDetailPage />)} />
            <Route path="profile" element={gate(["organizations.settings.manage"], <ProfilePage />)} />
            <Route path="branding" element={gate(["organizations.branding.manage"], <BrandingPage />)} />
            <Route path="*" element={gate(["users.members.read", "organizations.audit.read", "organizations.settings.manage"], <OverviewPage />)} />
        </Routes>
    );
}
