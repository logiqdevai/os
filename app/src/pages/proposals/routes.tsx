import { lazy } from "react";
import { Route, Routes } from "react-router-dom";
import { RequirePermission } from "@/components/access/can";

const ListPage = lazy(() => import("./index"));
const NewPage = lazy(() => import("./pages/new"));
const DetailPage = lazy(() => import("./pages/detail"));
const AnalyticsPage = lazy(() => import("./pages/analytics"));
const TemplatesPage = lazy(() => import("./pages/templates"));
const TrackingPage = lazy(() => import("./pages/tracking"));

/** /proposals/* — module 03 (app/mockups/modules/03-proposals). Every route is gated by its VIEW permission. */
export default function ProposalsRoutes() {
    return (
        <Routes>
            <Route index element={<RequirePermission permission="proposals.proposals.read"><ListPage /></RequirePermission>} />
            <Route path="new" element={<RequirePermission permission="proposals.proposals.create"><NewPage /></RequirePermission>} />
            <Route path="analytics" element={<RequirePermission permission="proposals.analytics.read"><AnalyticsPage /></RequirePermission>} />
            <Route path="tracking" element={<RequirePermission permission="proposals.proposals.read"><TrackingPage /></RequirePermission>} />
            <Route path="templates" element={<RequirePermission anyOf={["proposals.templates.manage", "proposals.approval_rules.manage"]}><TemplatesPage /></RequirePermission>} />
            <Route path=":id" element={<RequirePermission permission="proposals.proposals.read"><DetailPage /></RequirePermission>} />
            <Route path="*" element={<RequirePermission permission="proposals.proposals.read"><ListPage /></RequirePermission>} />
        </Routes>
    );
}
