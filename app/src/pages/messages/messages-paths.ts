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
} as const;
