import { lazy, Suspense, type ReactElement } from "react";
import { Route, Routes } from "react-router-dom";
import { PageSkeleton } from "@/components/ui/states";
import ErrorBoundary from "@/components/ui/error-boundary";
import PortalShell from "./components/portal-shell";
import { PortalGate } from "./components/portal-ui";

const Dashboard = lazy(() => import("./pages/dashboard"));
const Approvals = lazy(() => import("./pages/approvals"));
const Company = lazy(() => import("./pages/company"));
const Projects = lazy(() => import("./pages/projects").then((m) => ({ default: m.PortalProjectsPage })));
const Project = lazy(() => import("./pages/projects").then((m) => ({ default: m.PortalProjectPage })));
const Requests = lazy(() => import("./pages/requests").then((m) => ({ default: m.PortalRequestsPage })));
const NewRequest = lazy(() => import("./pages/requests").then((m) => ({ default: m.PortalNewRequestPage })));
const Request = lazy(() => import("./pages/requests").then((m) => ({ default: m.PortalRequestPage })));
const Messages = lazy(() => import("./pages/messages").then((m) => ({ default: m.PortalMessagesPage })));
const Conversation = lazy(() => import("./pages/messages").then((m) => ({ default: m.PortalConversationPage })));
const Documents = lazy(() => import("./pages/documents-billing").then((m) => ({ default: m.PortalDocumentsPage })));
const Agreements = lazy(() => import("./pages/documents-billing").then((m) => ({ default: m.PortalAgreementsPage })));
const Billing = lazy(() => import("./pages/documents-billing").then((m) => ({ default: m.PortalBillingPage })));
const Help = lazy(() => import("./pages/help").then((m) => ({ default: m.PortalHelpPage })));
const HelpArticle = lazy(() => import("./pages/help").then((m) => ({ default: m.PortalHelpArticlePage })));

const page = (el: ReactElement) => (
    <ErrorBoundary>
        <Suspense fallback={<PageSkeleton />}>{el}</Suspense>
    </ErrorBoundary>
);

/**
 * Customer portal — /portal/* (07), registered in routes/public-routes.tsx outside the agency shell.
 * Every page is gated by the customer role's portal.* keys and the portal feature toggles.
 */
export default function PortalRoutes() {
    return (
        <Routes>
            <Route element={<PortalShell />}>
                <Route index element={page(<Dashboard />)} />
                <Route path="projects" element={page(<PortalGate anyOf={["portal.projects.read"]} feature="projects"><Projects /></PortalGate>)} />
                <Route path="projects/:id" element={page(<PortalGate anyOf={["portal.projects.read"]} feature="projects"><Project /></PortalGate>)} />
                <Route path="approvals" element={page(<PortalGate anyOf={["portal.deliverables.approve"]} feature="projects"><Approvals /></PortalGate>)} />
                <Route path="requests" element={page(<PortalGate anyOf={["portal.requests.read", "portal.requests.create"]} feature="requests"><Requests /></PortalGate>)} />
                <Route path="requests/new" element={page(<PortalGate anyOf={["portal.requests.create"]} feature="requests"><NewRequest /></PortalGate>)} />
                <Route path="requests/:reference" element={page(<PortalGate anyOf={["portal.requests.read", "portal.requests.create"]} feature="requests"><Request /></PortalGate>)} />
                <Route path="messages" element={page(<PortalGate anyOf={["portal.conversations.participate"]} feature="conversations"><Messages /></PortalGate>)} />
                <Route path="messages/:id" element={page(<PortalGate anyOf={["portal.conversations.participate"]} feature="conversations"><Conversation /></PortalGate>)} />
                <Route path="documents" element={page(<PortalGate anyOf={["portal.documents.read"]} feature="documents"><Documents /></PortalGate>)} />
                <Route path="agreements" element={page(<PortalGate anyOf={["portal.proposals.read", "portal.contracts.read"]}><Agreements /></PortalGate>)} />
                <Route path="billing" element={page(<PortalGate anyOf={["portal.invoices.read"]} feature="billing"><Billing /></PortalGate>)} />
                <Route path="help" element={page(<PortalGate feature="knowledge"><Help /></PortalGate>)} />
                <Route path="help/:slug" element={page(<PortalGate feature="knowledge"><HelpArticle /></PortalGate>)} />
                <Route path="company" element={page(<Company />)} />
                <Route path="*" element={page(<Dashboard />)} />
            </Route>
        </Routes>
    );
}
