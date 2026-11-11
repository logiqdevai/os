import { lazy } from "react";
import { Route, Routes } from "react-router-dom";
import { RequirePermission } from "@/components/access/can";

const InboxPage = lazy(() => import("./pages/inbox"));
const NotificationDetailPage = lazy(() => import("./pages/detail"));
const PreferencesPage = lazy(() => import("./pages/preferences"));
const ActivityPage = lazy(() => import("./pages/activity"));
const AnnouncementsPage = lazy(() => import("./pages/announcements"));

/** /notifications/* (app/mockups/modules/14-notifications). The own inbox needs no key; other screens are gated by their VIEW key. */
export default function NotificationsRoutes() {
    return (
        <Routes>
            <Route index element={<InboxPage />} />
            <Route path="inbox" element={<InboxPage />} />
            <Route path="preferences" element={<RequirePermission permission="notifications.preferences.manage_own"><PreferencesPage /></RequirePermission>} />
            <Route path="activity" element={<RequirePermission permission="notifications.activity.read"><ActivityPage /></RequirePermission>} />
            <Route path="announcements" element={<RequirePermission permission="notifications.announcements.manage"><AnnouncementsPage /></RequirePermission>} />
            <Route path=":id" element={<NotificationDetailPage />} />
        </Routes>
    );
}
