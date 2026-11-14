import { lazy, useState, type ReactNode } from "react";
import { Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { RequirePermission } from "@/components/access/can";
import { usePermission } from "@/hooks/use-permission";
import { cn } from "@/lib/utils";
import { MessagingProvider } from "./components/messaging-context";
import { ChannelSidebar } from "./components/channel-sidebar";
import { OngoingCallStrip } from "./components/call-bar";
import { CreateChannelDialog, NewDmDialog } from "./components/messaging-dialogs";
import ConversationPage, { ConversationNotSelected } from "./pages/conversation";
import { BrowseChannelsPage, MentionsPage, SavedPage, SearchPage, ThreadsInboxPage } from "./pages/inbox";
import { MessagesPaths } from "./messages-paths";

const CallsPage = lazy(() => import("./pages/calls"));
const AdminOverviewPage = lazy(() => import("./pages/admin/overview"));
const ModerationPage = lazy(() => import("./pages/admin/moderation"));
const GuestsPage = lazy(() => import("./pages/admin/guests"));
const RetentionPage = lazy(() => import("./pages/admin/retention"));
const SettingsPage = lazy(() => import("./pages/admin/settings"));
const IntegrationsPage = lazy(() => import("./pages/admin/integrations"));

/** Full-height region that scrolls on its own: the Messages shell is fixed-height, so plain pages need their own scroll container. */
const Scroll = ({ children }: { children: ReactNode }) => <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>;
const gate = (anyOf: string[], element: ReactNode) => <RequirePermission anyOf={anyOf}><Scroll>{element}</Scroll></RequirePermission>;

/**
 * /messages/* — module 12 Messaging. Slack-like layout that fills the main area: channel sidebar + conversation (+ thread panel).
 * Mobile (< md): the channel list and the conversation are separate screens.
 * @perm messaging.channels.read (app) · messaging.messages.read (conversations) · admin screens: see MESSAGING_ADMIN_LINKS
 */
function MessagesLayout() {
    const location = useLocation();
    const navigate = useNavigate();
    const canCreate = usePermission("messaging.channels.create");
    const [dmOpen, setDmOpen] = useState(false);
    const atIndex = location.pathname.replace(/\/+$/, "") === MessagesPaths.root;
    const creating = location.pathname.startsWith(MessagesPaths.create);

    return (
        <MessagingProvider>
            <div className="flex h-full min-h-0 w-full">
                <ChannelSidebar onNewDm={() => setDmOpen(true)} className={cn("w-full shrink-0 md:w-64", atIndex ? "flex" : "hidden md:flex")} />
                <main className={cn("min-h-0 min-w-0 flex-1 *:min-w-0 *:flex-1", atIndex ? "hidden md:flex" : "flex")}>
                    <Routes>
                        <Route index element={<ConversationNotSelected />} />
                        <Route path="c/:channelId" element={<RequirePermission permission="messaging.messages.read"><ConversationPage /></RequirePermission>} />
                        <Route path="threads" element={<ThreadsInboxPage />} />
                        <Route path="mentions" element={<MentionsPage />} />
                        <Route path="saved" element={<SavedPage />} />
                        <Route path="search" element={<SearchPage />} />
                        <Route path="channels/*" element={<BrowseChannelsPage onCreate={() => navigate(MessagesPaths.create)} />} />
                        <Route path="calls" element={<Scroll><CallsPage /></Scroll>} />
                        <Route path="admin" element={gate(["messaging.analytics.read", "messaging.settings.manage"], <AdminOverviewPage />)} />
                        <Route path="admin/moderation" element={gate(["messaging.moderation.manage"], <ModerationPage />)} />
                        <Route path="admin/guests" element={gate(["messaging.external_users.manage"], <GuestsPage />)} />
                        <Route path="admin/retention" element={gate(["messaging.retention.manage", "messaging.data.export", "messaging.audit.read"], <RetentionPage />)} />
                        <Route path="admin/settings" element={gate(["messaging.settings.manage", "messaging.audit.read"], <SettingsPage />)} />
                        <Route path="admin/integrations" element={gate(["messaging.integrations.manage"], <IntegrationsPage />)} />
                        <Route path="*" element={<ConversationNotSelected />} />
                    </Routes>
                </main>
            </div>
            <OngoingCallStrip />
            <NewDmDialog open={dmOpen} onOpenChange={setDmOpen} />
            {canCreate && <CreateChannelDialog open={creating} onOpenChange={(o) => !o && navigate(MessagesPaths.browse, { replace: true })} />}
        </MessagingProvider>
    );
}

export default function MessagesRoutes() {
    return (
        <RequirePermission permission="messaging.channels.read">
            <MessagesLayout />
        </RequirePermission>
    );
}
