/** 14 Notifications & Activity Center API routes. */
export const NotificationsApiRoutes = {
    list: "/notifications",
    counts: "/notifications/unread-count",
    readAll: "/notifications/read-all",
    seen: "/notifications/seen",
    bulk: "/notifications/bulk",
    detail: (id: string) => `/notifications/${id}`,
    open: (id: string) => `/notifications/${id}/open`,
    actions: (id: string) => `/notifications/${id}/actions`,
    preferences: {
        settings: "/notifications/preferences/settings",
        events: "/notifications/preferences/events",
        event: (eventTypeId: string) => `/notifications/preferences/events/${eventTypeId}`,
        subscriptions: "/notifications/preferences/subscriptions",
        subscription: (id: string) => `/notifications/preferences/subscriptions/${id}`,
    },
    activity: "/activity",
    myActivity: "/activity/mine",
    announcements: {
        list: "/announcements",
        live: "/announcements/live",
        detail: (id: string) => `/announcements/${id}`,
        publish: (id: string) => `/announcements/${id}/publish`,
        withdraw: (id: string) => `/announcements/${id}/withdraw`,
        acknowledge: (id: string) => `/announcements/${id}/acknowledge`,
    },
};
