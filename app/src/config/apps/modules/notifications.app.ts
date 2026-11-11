import { Activity, Inbox, Megaphone, Settings, Bell } from "lucide-react";
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
        ] },
    ],
};
