import { lazy, type ReactNode } from "react";
import { Route, Routes } from "react-router-dom";
import { RequirePermission } from "@/components/access/can";

const InboxPage = lazy(() => import("./pages/inbox"));
const TicketsPage = lazy(() => import("./pages/tickets"));
const NewTicketPage = lazy(() => import("./pages/ticket-new"));
const TicketPage = lazy(() => import("./pages/ticket"));
const KnowledgePage = lazy(() => import("./pages/knowledge"));
const ArticleEditorPage = lazy(() => import("./pages/article"));
const SlaPage = lazy(() => import("./pages/sla"));
const MacrosPage = lazy(() => import("./pages/macros"));
const ChannelsPage = lazy(() => import("./pages/channels"));
const AnalyticsPage = lazy(() => import("./pages/analytics"));
const SettingsPage = lazy(() => import("./pages/settings"));

/** The Support app fills the main area (three-pane inbox); every other screen scrolls inside this wrapper. */
function Scroll({ children }: { children: ReactNode }) {
    return <div className="h-full overflow-y-auto">{children}</div>;
}

/** /support/* — each route is gated by its VIEW permission (app/mockups/modules/13-support). */
export default function SupportRoutes() {
    return (
        <Routes>
            <Route index element={<RequirePermission permission="support.conversations.read"><InboxPage /></RequirePermission>} />
            <Route path="c/:conversationId" element={<RequirePermission permission="support.conversations.read"><InboxPage /></RequirePermission>} />
            <Route path="tickets" element={<Scroll><RequirePermission permission="support.tickets.read"><TicketsPage /></RequirePermission></Scroll>} />
            <Route path="tickets/new" element={<Scroll><RequirePermission permission="support.tickets.create"><NewTicketPage /></RequirePermission></Scroll>} />
            <Route path="tickets/:reference" element={<Scroll><RequirePermission permission="support.tickets.read"><TicketPage /></RequirePermission></Scroll>} />
            <Route path="knowledge" element={<Scroll><RequirePermission permission="support.knowledge.read"><KnowledgePage /></RequirePermission></Scroll>} />
            <Route path="knowledge/new" element={<Scroll><RequirePermission permission="support.knowledge.create"><ArticleEditorPage /></RequirePermission></Scroll>} />
            <Route path="knowledge/:articleId" element={<Scroll><RequirePermission permission="support.knowledge.read"><ArticleEditorPage /></RequirePermission></Scroll>} />
            <Route path="sla" element={<Scroll><RequirePermission anyOf={["support.tickets.read", "support.sla_policies.manage"]}><SlaPage /></RequirePermission></Scroll>} />
            <Route path="macros" element={<Scroll><RequirePermission anyOf={["support.conversations.reply", "support.canned_responses.manage"]}><MacrosPage /></RequirePermission></Scroll>} />
            <Route path="channels" element={<Scroll><RequirePermission anyOf={["support.inboxes.read", "support.inboxes.manage"]}><ChannelsPage /></RequirePermission></Scroll>} />
            <Route path="analytics" element={<Scroll><RequirePermission permission="support.analytics.read"><AnalyticsPage /></RequirePermission></Scroll>} />
            <Route path="settings" element={<Scroll><RequirePermission permission="support.settings.manage"><SettingsPage /></RequirePermission></Scroll>} />
            <Route path="*" element={<Scroll><RequirePermission permission="support.tickets.read"><TicketsPage /></RequirePermission></Scroll>} />
        </Routes>
    );
}
