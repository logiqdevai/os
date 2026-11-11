import { useState } from "react";
import { Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { RequirePermission } from "@/components/access/can";
import { usePermission } from "@/hooks/use-permission";
import { cn } from "@/lib/utils";
import { MessagingProvider } from "./components/messaging-context";
import { ChannelSidebar } from "./components/channel-sidebar";
import { CreateChannelDialog, NewDmDialog } from "./components/messaging-dialogs";
import ConversationPage, { ConversationNotSelected } from "./pages/conversation";
import { BrowseChannelsPage, MentionsPage, SavedPage, SearchPage, ThreadsInboxPage } from "./pages/inbox";
import { MessagesPaths } from "./messages-paths";

/**
 * /messages/* — module 12 Messaging. Slack-like layout that fills the main area: channel sidebar + conversation (+ thread panel).
 * Mobile (< md): the channel list and the conversation are separate screens.
 * @perm messaging.channels.read (app) · messaging.messages.read (conversations)
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
                        <Route path="*" element={<ConversationNotSelected />} />
                    </Routes>
                </main>
            </div>
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
