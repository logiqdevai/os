import { lazy } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { RequirePermission } from "@/components/access/can";

const HomePage = lazy(() => import("./pages/home"));
const SpacesPage = lazy(() => import("./pages/spaces"));
const SpaceDetailPage = lazy(() => import("./pages/space-detail"));
const PageViewPage = lazy(() => import("./pages/page-view"));
const PageEditorPage = lazy(() => import("./pages/page-editor"));
const TemplatesPage = lazy(() => import("./pages/templates"));
const ChecklistsPage = lazy(() => import("./pages/checklists"));
const ChecklistDetailPage = lazy(() => import("./pages/checklist-detail"));
const ChecklistRunPage = lazy(() => import("./pages/checklist-run"));
const FormsPage = lazy(() => import("./pages/forms"));
const FormDetailPage = lazy(() => import("./pages/form-detail"));
const FormFillPage = lazy(() => import("./pages/form-fill"));
const TrashPage = lazy(() => import("./pages/trash"));

/** /docs/* — each route gated by its VIEW permission (app/mockups/modules/15-docs). */
export default function DocsRoutes() {
    return (
        <Routes>
            <Route index element={<RequirePermission permission="docs.pages.read"><HomePage /></RequirePermission>} />
            <Route path="spaces" element={<RequirePermission permission="docs.pages.read"><SpacesPage /></RequirePermission>} />
            <Route path="spaces/:id" element={<RequirePermission permission="docs.pages.read"><SpaceDetailPage /></RequirePermission>} />
            <Route path="pages/new" element={<RequirePermission permission="docs.pages.create"><PageEditorPage /></RequirePermission>} />
            <Route path="pages/:id" element={<RequirePermission permission="docs.pages.read"><PageViewPage /></RequirePermission>} />
            <Route path="pages/:id/edit" element={<RequirePermission permission="docs.pages.update"><PageEditorPage /></RequirePermission>} />
            <Route path="templates" element={<RequirePermission permission="docs.pages.read"><TemplatesPage /></RequirePermission>} />
            <Route path="checklists" element={<RequirePermission permission="docs.pages.read"><ChecklistsPage /></RequirePermission>} />
            <Route path="checklists/:id" element={<RequirePermission permission="docs.pages.read"><ChecklistDetailPage /></RequirePermission>} />
            <Route path="checklist-runs/:id" element={<RequirePermission permission="docs.pages.read"><ChecklistRunPage /></RequirePermission>} />
            <Route path="forms" element={<FormsPage />} />
            <Route path="forms/new" element={<RequirePermission permission="docs.forms.create"><FormDetailPage /></RequirePermission>} />
            <Route path="forms/:id" element={<RequirePermission permission="docs.forms.read"><FormDetailPage /></RequirePermission>} />
            <Route path="forms/:id/fill" element={<FormFillPage />} />
            <Route path="trash" element={<RequirePermission permission="docs.pages.read"><TrashPage /></RequirePermission>} />
            <Route path="*" element={<Navigate to="/docs" replace />} />
        </Routes>
    );
}
