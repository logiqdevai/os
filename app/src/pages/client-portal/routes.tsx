import { lazy } from "react";
import { Route, Routes } from "react-router-dom";
import { RequirePermission } from "@/components/access/can";

const OverviewPage = lazy(() => import("./pages/overview"));
const ClientsPage = lazy(() => import("./pages/clients"));
const ClientPage = lazy(() => import("./pages/client"));
const UsersPage = lazy(() => import("./pages/users"));
const RequestsPage = lazy(() => import("./pages/requests"));
const ApprovalsPage = lazy(() => import("./pages/approvals"));
const ProfileChangesPage = lazy(() => import("./pages/profile-changes"));
const ActivityPage = lazy(() => import("./pages/activity"));
const SettingsPage = lazy(() => import("./pages/settings"));

const VIEW = ["portal.users.read", "portal.users.manage", "portal.settings.manage", "portal.activity.read"];

/** /client-portal/* — agency administration of the customer portal (app/mockups/modules/07-portal). */
export default function ClientPortalRoutes() {
    return (
        <Routes>
            <Route index element={<RequirePermission anyOf={VIEW}><OverviewPage /></RequirePermission>} />
            <Route path="clients" element={<RequirePermission anyOf={["portal.users.read", "portal.users.manage", "portal.settings.manage"]}><ClientsPage /></RequirePermission>} />
            <Route path="clients/:companyId" element={<RequirePermission anyOf={["portal.users.read", "portal.users.manage", "portal.settings.manage"]}><ClientPage /></RequirePermission>} />
            <Route path="users" element={<RequirePermission anyOf={["portal.users.read", "portal.users.manage"]}><UsersPage /></RequirePermission>} />
            <Route path="users/invite" element={<RequirePermission permission="portal.users.manage"><UsersPage /></RequirePermission>} />
            <Route path="requests" element={<RequirePermission permission="support.tickets.read"><RequestsPage /></RequirePermission>} />
            <Route path="approvals" element={<RequirePermission permission="projects.projects.read"><ApprovalsPage /></RequirePermission>} />
            <Route path="profile-changes" element={<RequirePermission permission="portal.profile_changes.review"><ProfileChangesPage /></RequirePermission>} />
            <Route path="activity" element={<RequirePermission permission="portal.activity.read"><ActivityPage /></RequirePermission>} />
            <Route path="settings" element={<RequirePermission anyOf={VIEW}><SettingsPage /></RequirePermission>} />
            <Route path="*" element={<RequirePermission anyOf={VIEW}><OverviewPage /></RequirePermission>} />
        </Routes>
    );
}
