/** Frontend paths of the Messages app (module 12). */
export const MessagesPaths = {
    root: "/messages",
    channel: (id: string) => `/messages/c/${id}`,
    thread: (channelId: string, rootId: string) => `/messages/c/${channelId}?thread=${rootId}`,
    threads: "/messages/threads",
    mentions: "/messages/mentions",
    saved: "/messages/saved",
    search: "/messages/search",
    browse: "/messages/channels",
    create: "/messages/channels/new",
    calls: "/messages/calls",
    admin: "/messages/admin",
    adminModeration: "/messages/admin/moderation",
    adminGuests: "/messages/admin/guests",
    adminRetention: "/messages/admin/retention",
    adminSettings: "/messages/admin/settings",
    adminIntegrations: "/messages/admin/integrations",
} as const;
