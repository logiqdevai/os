import { lazy } from "react";
import { Navigate, Route, Routes, useParams } from "react-router-dom";
import { DocsShortcuts } from "./components/docs-shortcuts";
import { RequirePermission } from "@/components/access/can";

const HomePage = lazy(() => import("./pages/home"));
const SpacesPage = lazy(() => import("./pages/spaces"));
const SpaceDetailPage = lazy(() => import("./pages/space-detail"));
const DocsPage = lazy(() => import("./pages/page"));
const NewPageRedirect = lazy(() => import("./pages/page/new-page"));
const TemplatesPage = lazy(() => import("./pages/templates"));
const ChecklistsPage = lazy(() => import("./pages/checklists"));
const ChecklistDetailPage = lazy(() => import("./pages/checklist-detail"));
const ChecklistRunPage = lazy(() => import("./pages/checklist-run"));
const FormsPage = lazy(() => import("./pages/forms"));
const FormDetailPage = lazy(() => import("./pages/form-detail"));
const FormFillPage = lazy(() => import("./pages/form-fill"));
const TrashPage = lazy(() => import("./pages/trash"));
const AskPage = lazy(() => import("./pages/ask"));
const AnalyticsPage = lazy(() => import("./pages/analytics"));

/** /docs/* — each route gated by its VIEW permission (app/mockups/modules/15-docs). */
function EditRedirect() {
    const { id } = useParams<{ id: string }>();
    return <Navigate to={`/docs/pages/${id}`} replace />;
}

export default function DocsRoutes() {
    return (
        <>
        <DocsShortcuts />
<Routes>
            <Route index element={<RequirePermission permission="docs.pages.read"><HomePage /></RequirePermission>} />
            <Route path="spaces" element={<RequirePermission permission="docs.pages.read"><SpacesPage /></RequirePermission>} />
            <Route path="spaces/:id" element={<RequirePermission permission="docs.pages.read"><SpaceDetailPage /></RequirePermission>} />
            <Route path="pages/new" element={<RequirePermission permission="docs.pages.create"><NewPageRedirect /></RequirePermission>} />
            <Route path="pages/:id" element={<RequirePermission permission="docs.pages.read"><DocsPage /></RequirePermission>} />
            {/* Pages are edited in place (Notion): the old editor URL opens the page. */}
            <Route path="pages/:id/edit" element={<EditRedirect />} />
            <Route path="templates" element={<RequirePermission permission="docs.pages.read"><TemplatesPage /></RequirePermission>} />
            <Route path="checklists" element={<RequirePermission permission="docs.pages.read"><ChecklistsPage /></RequirePermission>} />
            <Route path="checklists/:id" element={<RequirePermission permission="docs.pages.read"><ChecklistDetailPage /></RequirePermission>} />
            <Route path="checklist-runs/:id" element={<RequirePermission permission="docs.pages.read"><ChecklistRunPage /></RequirePermission>} />
            <Route path="forms" element={<FormsPage />} />
            <Route path="forms/new" element={<RequirePermission permission="docs.forms.create"><FormDetailPage /></RequirePermission>} />
            <Route path="forms/:id" element={<RequirePermission permission="docs.forms.read"><FormDetailPage /></RequirePermission>} />
            <Route path="forms/:id/fill" element={<FormFillPage />} />
            <Route path="ask" element={<RequirePermission permission="docs.ai.query"><AskPage /></RequirePermission>} />
            <Route path="analytics" element={<RequirePermission permission="docs.analytics.read"><AnalyticsPage /></RequirePermission>} />
            <Route path="trash" element={<RequirePermission permission="docs.pages.read"><TrashPage /></RequirePermission>} />
            <Route path="*" element={<Navigate to="/docs" replace />} />
        </Routes>
        </>
    );
}
