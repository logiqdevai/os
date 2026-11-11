import { Activity, Bell, FileText, Filter, Inbox, Megaphone, ScrollText, Settings, SlidersHorizontal, Zap } from "lucide-react";
import type { AppDefinition } from "../app.types";

/** 14 Notifications & Activity Center. The own inbox needs no key; every key below exists in the permission catalog. */
export const notificationsApp: AppDefinition = {
    id: "notifications",
    label: "Notifications",
    icon: Bell,
    basePath: "/notifications",
    module: "NOTIFICATIONS",
    viewPermissions: [],
    newAction: { label: "Preferences", to: "/notifications/preferences", permission: "notifications.preferences.manage_own" },
    nav: [
        { items: [
            { label: "Inbox", to: "/notifications", icon: Inbox, end: true },
        ] },
        { label: "Activity", items: [
            { label: "Activity feed", to: "/notifications/activity", icon: Activity, permissions: ["notifications.activity.read"] },
        ] },
        { label: "My settings", items: [
            { label: "Preferences", to: "/notifications/preferences", icon: Settings, permissions: ["notifications.preferences.manage_own"] },
        ] },
        { label: "Administration", items: [
            { label: "Announcements", to: "/notifications/announcements", icon: Megaphone, permissions: ["notifications.announcements.manage"] },
            { label: "Event catalog", to: "/notifications/admin/events", icon: Zap, permissions: ["notifications.defaults.manage", "notifications.event_types.manage", "notifications.templates.manage", "notifications.delivery_rules.manage"] },
            { label: "Templates", to: "/notifications/admin/templates", icon: FileText, permissions: ["notifications.templates.manage"] },
            { label: "Organization defaults", to: "/notifications/admin/defaults", icon: SlidersHorizontal, permissions: ["notifications.defaults.manage"] },
            { label: "Delivery rules", to: "/notifications/admin/rules", icon: Filter, permissions: ["notifications.delivery_rules.manage"] },
            { label: "Delivery log", to: "/notifications/admin/log", icon: ScrollText, permissions: ["notifications.audit.read"] },
            { label: "Settings", to: "/notifications/admin/settings", icon: Settings, permissions: ["notifications.settings.manage"] },
        ] },
    ],
};
