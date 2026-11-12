import { lazy } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { RequirePermission } from "@/components/access/can";

const BrowserPage = lazy(() => import("./pages/browser"));
const DocumentDetailPage = lazy(() => import("./pages/document-detail"));
const RecentPage = lazy(() => import("./pages/recent"));
const SharedPage = lazy(() => import("./pages/shared"));
const ApprovalsPage = lazy(() => import("./pages/approvals"));
const TrashPage = lazy(() => import("./pages/trash"));
const VaultPage = lazy(() => import("./pages/vault"));
const TemplatesPage = lazy(() => import("./pages/templates"));
const RetentionPage = lazy(() => import("./pages/retention"));

/** /files/* — each route gated by its VIEW permission (app/mockups/modules/17-files). */
export default function FilesRoutes() {
    return (
        <Routes>
            <Route index element={<RequirePermission permission="documents.documents.read"><BrowserPage /></RequirePermission>} />
            <Route path="upload" element={<Navigate to="/files?upload=1" replace />} />
            <Route path="documents/:id" element={<RequirePermission permission="documents.documents.read"><DocumentDetailPage /></RequirePermission>} />
            <Route path="recent" element={<RequirePermission permission="documents.documents.read"><RecentPage /></RequirePermission>} />
            <Route path="shared" element={<RequirePermission permission="documents.documents.read"><SharedPage /></RequirePermission>} />
            <Route path="approvals" element={<RequirePermission permission="documents.documents.read"><ApprovalsPage /></RequirePermission>} />
            <Route path="trash" element={<RequirePermission permission="documents.documents.read"><TrashPage /></RequirePermission>} />
            <Route path="vault" element={<RequirePermission permission="documents.vault.read"><VaultPage /></RequirePermission>} />
            <Route path="templates" element={<RequirePermission permission="documents.documents.read"><TemplatesPage /></RequirePermission>} />
            <Route path="retention" element={<RequirePermission permission="documents.retention.manage"><RetentionPage /></RequirePermission>} />
            <Route path="*" element={<Navigate to="/files" replace />} />
        </Routes>
    );
}
