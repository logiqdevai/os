import { lazy, type ReactNode } from "react";
import { Route, Routes } from "react-router-dom";
import { RequirePermission } from "@/components/access/can";

const OverviewPage = lazy(() => import("./pages/overview"));
const CampaignsListPage = lazy(() => import("./pages/campaigns-list"));
const CampaignWizardPage = lazy(() => import("./pages/campaign-wizard"));
const CampaignDetailPage = lazy(() => import("./pages/campaign-detail"));
const AnalyticsPage = lazy(() => import("./pages/analytics"));
const SegmentsPage = lazy(() => import("./pages/segments"));
const SegmentBuilderPage = lazy(() => import("./pages/segment-builder"));
const ListsPage = lazy(() => import("./pages/lists"));
const ListDetailPage = lazy(() => import("./pages/list-detail"));
const TemplatesPage = lazy(() => import("./pages/templates"));
const TemplateEditorPage = lazy(() => import("./pages/template-editor"));
const SuppressionsPage = lazy(() => import("./pages/suppressions"));
const MessagesLogPage = lazy(() => import("./pages/messages-log"));
const MessageDetailPage = lazy(() => import("./pages/message-detail"));
const SendersPage = lazy(() => import("./pages/senders"));

const gate = (anyOf: string[], element: ReactNode) => <RequirePermission anyOf={anyOf}>{element}</RequirePermission>;

/** /campaigns/* — module 11 Communication Center. Each route is gated by its VIEW permission; the API re-checks everything. */
export default function CampaignsRoutes() {
    return (
        <Routes>
            <Route index element={gate(["communications.campaigns.read"], <CampaignsListPage />)} />
            <Route path="overview" element={gate(["communications.campaigns.read", "communications.messages.read"], <OverviewPage />)} />
            <Route path="analytics" element={gate(["communications.analytics.read"], <AnalyticsPage />)} />
            <Route path="new" element={gate(["communications.campaigns.create"], <CampaignWizardPage />)} />
            <Route path="segments" element={gate(["communications.segments.read"], <SegmentsPage />)} />
            <Route path="segments/new" element={gate(["communications.segments.create"], <SegmentBuilderPage />)} />
            <Route path="segments/:id" element={gate(["communications.segments.read"], <SegmentBuilderPage />)} />
            <Route path="lists" element={gate(["communications.recipient_lists.read"], <ListsPage />)} />
            <Route path="lists/:id" element={gate(["communications.recipient_lists.read"], <ListDetailPage />)} />
            <Route path="templates" element={gate(["communications.templates.read"], <TemplatesPage />)} />
            <Route path="templates/new" element={gate(["communications.templates.create"], <TemplateEditorPage />)} />
            <Route path="templates/:id" element={gate(["communications.templates.read"], <TemplateEditorPage />)} />
            <Route path="suppressions" element={gate(["communications.suppressions.manage", "communications.consents.read"], <SuppressionsPage />)} />
            <Route path="messages" element={gate(["communications.messages.read"], <MessagesLogPage />)} />
            <Route path="messages/:id" element={gate(["communications.messages.read"], <MessageDetailPage />)} />
            <Route path="senders" element={gate(["communications.sender_identities.manage", "communications.settings.manage"], <SendersPage />)} />
            <Route path=":id/edit" element={gate(["communications.campaigns.update"], <CampaignWizardPage />)} />
            <Route path=":id" element={gate(["communications.campaigns.read"], <CampaignDetailPage />)} />
        </Routes>
    );
}
