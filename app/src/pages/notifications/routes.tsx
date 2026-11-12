import { lazy } from "react";
import { Route, Routes } from "react-router-dom";
import { RequirePermission } from "@/components/access/can";

const InboxPage = lazy(() => import("./pages/inbox"));
const NotificationDetailPage = lazy(() => import("./pages/detail"));
const PreferencesPage = lazy(() => import("./pages/preferences"));
const PushDevicesPage = lazy(() => import("./pages/devices"));
const ActivityPage = lazy(() => import("./pages/activity"));
const AnnouncementsPage = lazy(() => import("./pages/announcements"));
const EventCatalogPage = lazy(() => import("./pages/admin/events"));
const EventTypeDetailPage = lazy(() => import("./pages/admin/events/detail"));
const TemplatesPage = lazy(() => import("./pages/admin/templates"));
const OrgDefaultsPage = lazy(() => import("./pages/admin/defaults"));
const DeliveryRulesPage = lazy(() => import("./pages/admin/rules"));
const DeliveryLogPage = lazy(() => import("./pages/admin/log"));
const NotificationSettingsPage = lazy(() => import("./pages/admin/settings"));

/** Catalog view: any notifications administration key (mockup 14 "Event catalog"). */
const CATALOG_VIEW = ["notifications.defaults.manage", "notifications.event_types.manage", "notifications.templates.manage", "notifications.delivery_rules.manage"];

/** /notifications/* (app/mockups/modules/14-notifications). The own inbox needs no key; other screens are gated by their VIEW key. */
export default function NotificationsRoutes() {
    return (
        <Routes>
            <Route index element={<InboxPage />} />
            <Route path="inbox" element={<InboxPage />} />
            <Route path="preferences" element={<RequirePermission permission="notifications.preferences.manage_own"><PreferencesPage /></RequirePermission>} />
            <Route path="preferences/devices" element={<RequirePermission permission="notifications.preferences.manage_own"><PushDevicesPage /></RequirePermission>} />
            <Route path="activity" element={<RequirePermission permission="notifications.activity.read"><ActivityPage /></RequirePermission>} />
            <Route path="announcements" element={<RequirePermission permission="notifications.announcements.manage"><AnnouncementsPage /></RequirePermission>} />
            <Route path="admin/events" element={<RequirePermission anyOf={CATALOG_VIEW}><EventCatalogPage /></RequirePermission>} />
            <Route path="admin/events/:id" element={<RequirePermission anyOf={CATALOG_VIEW}><EventTypeDetailPage /></RequirePermission>} />
            <Route path="admin/templates" element={<RequirePermission permission="notifications.templates.manage"><TemplatesPage /></RequirePermission>} />
            <Route path="admin/defaults" element={<RequirePermission permission="notifications.defaults.manage"><OrgDefaultsPage /></RequirePermission>} />
            <Route path="admin/rules" element={<RequirePermission permission="notifications.delivery_rules.manage"><DeliveryRulesPage /></RequirePermission>} />
            <Route path="admin/log" element={<RequirePermission permission="notifications.audit.read"><DeliveryLogPage /></RequirePermission>} />
            <Route path="admin/settings" element={<RequirePermission permission="notifications.settings.manage"><NotificationSettingsPage /></RequirePermission>} />
            <Route path=":id" element={<NotificationDetailPage />} />
        </Routes>
    );
}
