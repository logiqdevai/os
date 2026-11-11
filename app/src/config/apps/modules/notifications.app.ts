import { Activity, Bell, Inbox, Megaphone, Settings } from "lucide-react";
import type { AppDefinition } from "../app.types";

export const notificationsApp: AppDefinition = {
    id: "notifications",
    label: "Notifications",
    icon: Bell,
    basePath: "/notifications",
    module: "NOTIFICATIONS",
    viewPermissions: [],
    newAction: { label: "Preferences", to: "/notifications/preferences" },
    nav: [
        { items: [
            { label: "Inbox", to: "/notifications", icon: Inbox, end: true },
        ] },
        { label: "Activity", items: [
            { label: "Activity feed", to: "/notifications/activity", icon: Activity, permissions: ["notifications.activity.read"] },
        ] },
        { label: "My settings", items: [
            { label: "Preferences", to: "/notifications/preferences", icon: Settings },
        ] },
        { label: "Administration", items: [
            { label: "Announcements", to: "/notifications/announcements", icon: Megaphone, permissions: ["notifications.announcements.manage"] },
        ] },
    ],
};
