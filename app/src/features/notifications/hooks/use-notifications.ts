import { keepPreviousData, useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { patchEntity, useEntityRemove, useOptimisticMutation } from "@/lib/query/optimistic";
import * as service from "../services/notifications.services";
import type { EventPreferenceRow, NotificationCounts, NotificationItem, Paginated, RecipientSettings } from "../interfaces/notifications.interfaces";

export const NOTIFICATIONS_KEY = ["notifications"] as const;
const ANNOUNCEMENTS_KEY = ["announcements"] as const;
const LIST_KEY = [...NOTIFICATIONS_KEY, "list"] as const;
const DETAIL_KEY = [...NOTIFICATIONS_KEY, "detail"] as const;
const COUNTS_KEY = [...NOTIFICATIONS_KEY, "counts"] as const;
const SETTINGS_KEY = [...NOTIFICATIONS_KEY, "settings"] as const;
const EVENT_PREFS_KEY = [...NOTIFICATIONS_KEY, "event-preferences"] as const;
type Params = Record<string, unknown>;

/** Inbox list (own rows only). */
export const useNotifications = (params: Params, enabled = true) =>
    useQuery({ queryKey: [...LIST_KEY, params], queryFn: () => service.getNotifications(params), placeholderData: keepPreviousData, enabled });

/** Badge counts — polled every 30s (simple and robust; no socket needed) and refreshed on window focus. */
export const useNotificationCounts = (enabled = true) =>
    useQuery({ queryKey: COUNTS_KEY, queryFn: service.getNotificationCounts, refetchInterval: 30_000, refetchOnWindowFocus: true, staleTime: 10_000, enabled, retry: false });

export const useNotification = (id: string | undefined) =>
    useQuery({ queryKey: [...DETAIL_KEY, id], queryFn: () => service.getNotification(id as string), enabled: !!id, retry: false });

// ------------------------------------------------------------------ optimistic inbox helpers

const isSnoozed = (n: NotificationItem) => !!n.snoozed_until && new Date(n.snoozed_until).getTime() > Date.now();
/** Mirrors the API's inbox tabs (notifications.service stateWhere). */
function inState(n: NotificationItem, state: unknown): boolean {
    switch (state ?? "unread") {
        case "unread": return !n.read_at && !n.archived_at && !isSnoozed(n);
        case "read": return !!n.read_at && !n.archived_at;
        case "archived": return !!n.archived_at;
        case "snoozed": return !n.archived_at && isSnoozed(n);
        case "action": return n.requires_action && !n.action_taken && !n.archived_at;
        default: return !n.archived_at && !isSnoozed(n);
    }
}
const countsOf = (n: NotificationItem) => ({ unread: inState(n, "unread") ? 1 : 0, action: inState(n, "action") ? 1 : 0 });

/** The cached copy of a notification (any list or the detail), if the inbox has it. */
function findNotification(qc: QueryClient, id: string): NotificationItem | undefined {
    for (const [, data] of qc.getQueriesData<unknown>({ queryKey: NOTIFICATIONS_KEY })) {
        const rows = Array.isArray((data as Paginated<NotificationItem> | undefined)?.data) ? (data as Paginated<NotificationItem>).data : [data];
        const hit = rows.find((r) => !!r && typeof r === "object" && (r as NotificationItem).id === id && "event_key" in (r as object));
        if (hit) return hit as NotificationItem;
    }
    return undefined;
}

/**
 * Apply a change to notifications everywhere they are cached: rows leave the inbox tabs they no longer belong to,
 * stay patched in the ones they still match, the detail is patched and the unread / action badges follow.
 */
function applyToInbox(qc: QueryClient, ids: string[], change: (n: NotificationItem) => Partial<NotificationItem>) {
    let unread = 0;
    let action = 0;
    const next = new Map<string, NotificationItem>();
    for (const id of ids) {
        const before = findNotification(qc, id);
        if (!before) continue;
        const after = { ...before, ...change(before) };
        next.set(id, after);
        const b = countsOf(before);
        const a = countsOf(after);
        unread += a.unread - b.unread;
        action += a.action - b.action;
    }
    if (!next.size) return;
    for (const [key, data] of qc.getQueriesData<Paginated<NotificationItem>>({ queryKey: LIST_KEY })) {
        if (!data?.data) continue;
        const state = (key[2] as Params | undefined)?.state;
        let removed = 0;
        const rows = data.data.flatMap((r) => {
            const n = next.get(r.id);
            if (!n) return [r];
            if (!inState(n, state)) { removed += 1; return []; }
            return [n];
        });
        qc.setQueryData(key, { ...data, data: rows, pagination: { ...data.pagination, total: Math.max(0, data.pagination.total - removed) } });
    }
    for (const n of next.values()) patchEntity<NotificationItem>(qc, DETAIL_KEY, n.id, n);
    if (unread || action) {
        qc.setQueryData<NotificationCounts>(COUNTS_KEY, (c) => (c ? { ...c, unread: Math.max(0, c.unread + unread), action: Math.max(0, c.action + action) } : c));
    }
}

type UpdateVars = Parameters<typeof service.updateNotification>[0];
const now = () => new Date().toISOString();
const changeOf = (v: Omit<UpdateVars, "id">) => (): Partial<NotificationItem> => ({
    ...(v.read !== undefined && { read_at: v.read ? now() : null }),
    ...(v.archived !== undefined && { archived_at: v.archived ? now() : null }),
    ...(v.snoozed_until !== undefined && { snoozed_until: v.snoozed_until }),
});

/** Read / unread / archive / snooze — the row moves at once and the badges follow; rolled back if the API refuses. */
export const useUpdateNotification = () =>
    useOptimisticMutation({
        roots: [NOTIFICATIONS_KEY],
        mutationFn: service.updateNotification,
        apply: (qc, { id, ...v }: UpdateVars) => applyToInbox(qc, [id], changeOf(v)),
        meta: { errorTitle: "Could not update notification" },
    });

/** Opening marks the notification read at once; the caller navigates to the link the API returns. */
export const useOpenNotification = () =>
    useOptimisticMutation({
        roots: [NOTIFICATIONS_KEY],
        mutationFn: service.openNotification,
        apply: (qc, id: string) => applyToInbox(qc, [id], (n) => ({ read_at: n.read_at ?? now() })),
        meta: { errorTitle: "Could not open notification" },
    });

/** Approve / acknowledge…: the buttons give way to "Handled" at once and the row leaves "Waiting on you". */
export const useNotificationAction = () =>
    useOptimisticMutation({
        roots: [NOTIFICATIONS_KEY],
        alsoInvalidate: [ANNOUNCEMENTS_KEY],
        mutationFn: service.actOnNotification,
        apply: (qc, { id, action }: { id: string; action: string }) => applyToInbox(qc, [id], (n) => ({ action_taken: action, action_taken_at: now(), read_at: n.read_at ?? now() })),
        meta: { errorTitle: "Action failed" },
    });

/** Every cached notification (optionally of one module). */
function cachedIds(qc: QueryClient, module?: string) {
    const ids = new Set<string>();
    for (const [, data] of qc.getQueriesData<Paginated<NotificationItem>>({ queryKey: LIST_KEY })) {
        for (const n of data?.data ?? []) if (!module || n.module === module) ids.add(n.id);
    }
    return [...ids];
}

export const useReadAllNotifications = () =>
    useOptimisticMutation({
        roots: [NOTIFICATIONS_KEY],
        mutationFn: (module?: string) => service.readAllNotifications(module),
        apply: (qc, module?: string) => {
            const scoped = module && module !== "all" ? module : undefined;
            applyToInbox(qc, cachedIds(qc, scoped), (n) => ({ read_at: n.read_at ?? now() }));
            if (!scoped) qc.setQueryData<NotificationCounts>(COUNTS_KEY, (c) => (c ? { ...c, unread: 0 } : c));
        },
        meta: { errorTitle: "Could not mark all read" },
    });

/** Opening the inbox clears the rail badge at once. */
export const useMarkNotificationsSeen = () =>
    useOptimisticMutation({
        roots: [COUNTS_KEY],
        mutationFn: service.markNotificationsSeen,
        apply: (qc) => qc.setQueryData<NotificationCounts>(COUNTS_KEY, (c) => (c ? { ...c, unseen: 0 } : c)),
        meta: { errorToast: false },
    });

type BulkVars = Parameters<typeof service.bulkNotifications>[0];
export const useBulkNotifications = () =>
    useOptimisticMutation({
        roots: [NOTIFICATIONS_KEY],
        mutationFn: service.bulkNotifications,
        apply: (qc, { ids, action }: BulkVars) =>
            applyToInbox(qc, ids, () => (action === "read" ? { read_at: now() } : action === "unread" ? { read_at: null } : { archived_at: action === "archive" ? now() : null })),
        meta: { errorTitle: "Could not update notifications" },
    });

// ------------------------------------------------------------------ preferences

export const useRecipientSettings = () => useQuery({ queryKey: SETTINGS_KEY, queryFn: service.getRecipientSettings });
export const useEventPreferences = () => useQuery({ queryKey: EVENT_PREFS_KEY, queryFn: service.getEventPreferences });

/** Each switch / select saves on change; the page shows the new value at once and rolls back if refused. */
export const useUpdateRecipientSettings = () =>
    useOptimisticMutation({
        roots: [SETTINGS_KEY],
        mutationFn: service.updateRecipientSettings,
        apply: (qc, dto) => qc.setQueryData<RecipientSettings>(SETTINGS_KEY, (s) => (s ? { ...s, ...dto } : s)),
        meta: { errorTitle: "Could not save preferences" },
    });

type EventPrefVars = Parameters<typeof service.setEventPreference>[0];
export const useSetEventPreference = () =>
    useOptimisticMutation({
        roots: [EVENT_PREFS_KEY],
        mutationFn: service.setEventPreference,
        apply: (qc, { eventTypeId, channel, enabled }: EventPrefVars) =>
            qc.setQueryData<EventPreferenceRow[]>(EVENT_PREFS_KEY, (rows) =>
                rows?.map((r) => (r.event_type.id !== eventTypeId ? r : { ...r, channels: r.channels.map((c) => (c.channel === channel ? { ...c, enabled, source: "own" as const } : c)) })),
            ),
        meta: { errorTitle: "Could not change this notification" },
    });
/** Reset to default: the defaults are only known to the API, so the row refreshes when it answers. */
export const useResetEventPreference = () => {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: service.resetEventPreference,
        meta: { errorTitle: "Could not reset" },
        onSettled: () => qc.invalidateQueries({ queryKey: EVENT_PREFS_KEY }),
    });
};

// ------------------------------------------------------------------ push devices and digest history

const DEVICES_KEY = [...NOTIFICATIONS_KEY, "devices"] as const;
export const usePushConfig = (enabled = true) => useQuery({ queryKey: [...DEVICES_KEY, "config"], queryFn: service.getPushConfig, enabled, staleTime: 5 * 60_000, retry: false });
export const usePushDevices = () => useQuery({ queryKey: DEVICES_KEY, queryFn: service.getPushDevices });
/** Errors are shown by the caller ("Enable browser notifications") or ignored (silent re-registration on load). */
export const useRegisterPushDevice = () => {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: service.registerPushDevice,
        meta: { errorToast: false },
        onSettled: () => {
            qc.invalidateQueries({ queryKey: DEVICES_KEY });
            qc.invalidateQueries({ queryKey: SETTINGS_KEY });
        },
    });
};
/** The device disappears from the list at once and comes back if the API refuses. */
export const useRemovePushDevice = () =>
    useEntityRemove({ root: DEVICES_KEY, mutationFn: service.removePushDevice, alsoInvalidate: [SETTINGS_KEY], meta: { errorTitle: "Could not remove the device" } });
/** Outward action: the button shows "Sent" (see Devices page); a refused push is reported as an error. */
export const useTestPushDevice = () => useMutation({ mutationFn: service.testPushDevice, meta: { errorTitle: "Test failed" } });
export const useMyDigests = (params: Params) =>
    useQuery({ queryKey: [...NOTIFICATIONS_KEY, "my-digests", params], queryFn: () => service.getMyDigests(params), placeholderData: keepPreviousData });

// ------------------------------------------------------------------ activity

export const useActivity = (params: Params, enabled = true) =>
    useQuery({ queryKey: ["activity", "feed", params], queryFn: () => service.getActivity(params), placeholderData: keepPreviousData, enabled });
export const useMyActivity = (params: Params, enabled = true) =>
    useQuery({ queryKey: ["activity", "mine", params], queryFn: () => service.getMyActivity(params), placeholderData: keepPreviousData, enabled });

// ------------------------------------------------------------------ announcements

export const useAnnouncements = (params: Params, enabled = true) =>
    useQuery({ queryKey: [...ANNOUNCEMENTS_KEY, "list", params], queryFn: () => service.getAnnouncements(params), placeholderData: keepPreviousData, enabled });
export const useLiveAnnouncements = (enabled = true) => useQuery({ queryKey: [...ANNOUNCEMENTS_KEY, "live"], queryFn: service.getLiveAnnouncements, enabled });
export const useAnnouncementAudienceOptions = (enabled = true) =>
    useQuery({ queryKey: [...ANNOUNCEMENTS_KEY, "audience-options"], queryFn: service.getAnnouncementAudienceOptions, enabled, staleTime: 60_000 });
export const useAnnouncement = (id: string | undefined) =>
    useQuery({ queryKey: [...ANNOUNCEMENTS_KEY, "detail", id], queryFn: () => service.getAnnouncement(id as string), enabled: !!id });

/** Announcement mutation: no success toast (the list shows the new state); failures are toasted globally with `failure`. */
function useAnnouncementMutation<TArgs, TResult>(fn: (args: TArgs) => Promise<TResult>, failure: string) {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: fn,
        meta: { errorTitle: failure },
        onSettled: () => {
            qc.invalidateQueries({ queryKey: ANNOUNCEMENTS_KEY });
            qc.invalidateQueries({ queryKey: NOTIFICATIONS_KEY });
        },
    });
}
export const useCreateAnnouncement = () => useAnnouncementMutation(service.createAnnouncement, "Could not save announcement");
export const useUpdateAnnouncement = () => useAnnouncementMutation(service.updateAnnouncement, "Could not save announcement");
export const useDeleteAnnouncement = () =>
    useEntityRemove({ root: ANNOUNCEMENTS_KEY, mutationFn: service.deleteAnnouncement, alsoInvalidate: [NOTIFICATIONS_KEY], meta: { errorTitle: "Could not delete announcement" } });
export const usePublishAnnouncement = () => useAnnouncementMutation(service.publishAnnouncement, "Could not publish");
export const useWithdrawAnnouncement = () => useAnnouncementMutation(service.withdrawAnnouncement, "Could not withdraw");
/** The banner's "Acknowledge" shows as done at once. */
export const useAcknowledgeAnnouncement = () =>
    useOptimisticMutation({
        roots: [ANNOUNCEMENTS_KEY],
        alsoInvalidate: [NOTIFICATIONS_KEY],
        mutationFn: service.acknowledgeAnnouncement,
        apply: (qc, id: string) => patchEntity(qc, ANNOUNCEMENTS_KEY, id, { acknowledged_at: new Date().toISOString() }),
        meta: { errorTitle: "Could not acknowledge" },
    });
