import { lazy } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { RequirePermission } from "@/components/access/can";

const OverviewPage = lazy(() => import("./pages/overview"));
const WorkflowsPage = lazy(() => import("./pages/workflows"));
const WorkflowBuilderPage = lazy(() => import("./pages/workflow-builder"));
const WorkflowDetailPage = lazy(() => import("./pages/workflow-detail"));
const RunsPage = lazy(() => import("./pages/runs"));
const RunDetailPage = lazy(() => import("./pages/run-detail"));
const EventLogPage = lazy(() => import("./pages/events"));
const ApprovalsPage = lazy(() => import("./pages/approvals"));
const WebhooksPage = lazy(() => import("./pages/webhooks"));
const JobsPage = lazy(() => import("./pages/jobs"));
const JobDetailPage = lazy(() => import("./pages/job-detail"));
const SettingsPage = lazy(() => import("./pages/settings"));

/** /automation/* — each route gated by its VIEW permission (app/mockups/modules/20-automation). */
export default function AutomationRoutes() {
    return (
        <Routes>
            <Route index element={<RequirePermission permission="automation.rules.read"><OverviewPage /></RequirePermission>} />
            <Route path="overview" element={<Navigate to="/automation" replace />} />
            <Route path="workflows" element={<RequirePermission permission="automation.rules.read"><WorkflowsPage /></RequirePermission>} />
            <Route path="workflows/new" element={<RequirePermission permission="automation.rules.create"><WorkflowBuilderPage /></RequirePermission>} />
            <Route path="workflows/:id" element={<RequirePermission permission="automation.rules.read"><WorkflowDetailPage /></RequirePermission>} />
            <Route path="workflows/:id/edit" element={<RequirePermission permission="automation.rules.update"><WorkflowBuilderPage /></RequirePermission>} />
            <Route path="runs" element={<RequirePermission permission="automation.runs.read"><RunsPage /></RequirePermission>} />
            <Route path="runs/:id" element={<RequirePermission permission="automation.runs.read"><RunDetailPage /></RequirePermission>} />
            <Route path="events" element={<RequirePermission permission="automation.runs.read"><EventLogPage /></RequirePermission>} />
            <Route path="approvals" element={<ApprovalsPage />} />
            <Route path="webhooks" element={<RequirePermission permission="automation.webhooks.read"><WebhooksPage /></RequirePermission>} />
            <Route path="jobs" element={<RequirePermission permission="automation.jobs.read"><JobsPage /></RequirePermission>} />
            <Route path="jobs/:id" element={<RequirePermission permission="automation.jobs.read"><JobDetailPage /></RequirePermission>} />
            <Route path="settings" element={<RequirePermission permission="automation.rules.read"><SettingsPage /></RequirePermission>} />
            <Route path="*" element={<Navigate to="/automation" replace />} />
        </Routes>
    );
}
