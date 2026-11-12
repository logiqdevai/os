import { lazy } from "react";
import { Route, Routes } from "react-router-dom";
import { RequirePermission } from "@/components/access/can";

const ListPage = lazy(() => import("./pages/list"));
const OverviewPage = lazy(() => import("./pages/overview"));
const NewPage = lazy(() => import("./pages/new"));
const DetailPage = lazy(() => import("./pages/detail"));
const MilestonesPage = lazy(() => import("./pages/milestones"));
const RaidPage = lazy(() => import("./pages/raid"));
const WorkloadPage = lazy(() => import("./pages/workload"));
const SettingsPage = lazy(() => import("./pages/settings"));
const TimelinePage = lazy(() => import("./pages/timeline"));

/** /projects/* — 05 Project Management (app/mockups/modules/05-projects). Each route is gated by its VIEW permission. */
export default function ProjectsRoutes() {
    return (
        <Routes>
            <Route index element={<RequirePermission permission="projects.projects.read"><ListPage /></RequirePermission>} />
            <Route path="overview" element={<RequirePermission permission="projects.projects.read"><OverviewPage /></RequirePermission>} />
            <Route path="new" element={<RequirePermission permission="projects.projects.create"><NewPage /></RequirePermission>} />
            <Route path="milestones" element={<RequirePermission permission="projects.projects.read"><MilestonesPage /></RequirePermission>} />
            <Route path="timeline" element={<RequirePermission permission="projects.projects.read"><TimelinePage /></RequirePermission>} />
            <Route path="raid" element={<RequirePermission permission="projects.projects.read"><RaidPage /></RequirePermission>} />
            <Route path="workload" element={<RequirePermission anyOf={["projects.portfolio.read", "projects.members.manage"]}><WorkloadPage /></RequirePermission>} />
            <Route path="settings" element={<RequirePermission permission="projects.settings.manage"><SettingsPage /></RequirePermission>} />
            <Route path=":projectId" element={<RequirePermission permission="projects.projects.read"><DetailPage /></RequirePermission>} />
        </Routes>
    );
}
