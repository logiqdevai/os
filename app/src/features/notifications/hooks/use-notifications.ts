import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import { getApiErrorMessage } from "@/lib/api-error";
import * as service from "../services/notifications.services";

export const NOTIFICATIONS_KEY = ["notifications"] as const;
const ANNOUNCEMENTS_KEY = ["announcements"] as const;
type Params = Record<string, unknown>;

/** Inbox list (own rows only). */
export const useNotifications = (params: Params, enabled = true) =>
    useQuery({ queryKey: [...NOTIFICATIONS_KEY, "list", params], queryFn: () => service.getNotifications(params), placeholderData: keepPreviousData, enabled });

/** Badge counts — polled every 30s (simple and robust; no socket needed) and refreshed on window focus. */
export const useNotificationCounts = (enabled = true) =>
    useQuery({ queryKey: [...NOTIFICATIONS_KEY, "counts"], queryFn: service.getNotificationCounts, refetchInterval: 30_000, refetchOnWindowFocus: true, staleTime: 10_000, enabled, retry: false });

export const useNotification = (id: string | undefined) =>
    useQuery({ queryKey: [...NOTIFICATIONS_KEY, "detail", id], queryFn: () => service.getNotification(id as string), enabled: !!id, retry: false });

function useInboxMutation<TArgs, TResult>(fn: (args: TArgs) => Promise<TResult>, success: string | null, failure: string) {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: fn,
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: NOTIFICATIONS_KEY });
            if (success) toast({ title: success });
        },
        onError: (e) => toast({ variant: "destructive", title: failure, description: getApiErrorMessage(e) }),
    });
}

export const useUpdateNotification = () => useInboxMutation(service.updateNotification, null, "Could not update notification");
export const useOpenNotification = () => useInboxMutation(service.openNotification, null, "Could not open notification");
export const useNotificationAction = () => {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: service.actOnNotification,
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: NOTIFICATIONS_KEY });
            qc.invalidateQueries({ queryKey: ANNOUNCEMENTS_KEY });
            toast({ title: "Done" });
        },
        onError: (e) => toast({ variant: "destructive", title: "Action failed", description: getApiErrorMessage(e) }),
    });
};
export const useReadAllNotifications = () => useInboxMutation((module?: string) => service.readAllNotifications(module), "All caught up", "Could not mark all read");
export const useMarkNotificationsSeen = () => {
    const qc = useQueryClient();
    return useMutation({ mutationFn: service.markNotificationsSeen, onSuccess: () => qc.invalidateQueries({ queryKey: [...NOTIFICATIONS_KEY, "counts"] }) });
};
export const useBulkNotifications = () => useInboxMutation(service.bulkNotifications, "Notifications updated", "Could not update notifications");

// Preferences
export const useRecipientSettings = () => useQuery({ queryKey: [...NOTIFICATIONS_KEY, "settings"], queryFn: service.getRecipientSettings });
export const useEventPreferences = () => useQuery({ queryKey: [...NOTIFICATIONS_KEY, "event-preferences"], queryFn: service.getEventPreferences });
export const useUpdateRecipientSettings = () => useInboxMutation(service.updateRecipientSettings, "Preferences saved", "Could not save preferences");
export const useSetEventPreference = () => useInboxMutation(service.setEventPreference, null, "Could not change this notification");
export const useResetEventPreference = () => useInboxMutation(service.resetEventPreference, "Reset to default", "Could not reset");

// Activity
export const useActivity = (params: Params, enabled = true) =>
    useQuery({ queryKey: ["activity", "feed", params], queryFn: () => service.getActivity(params), placeholderData: keepPreviousData, enabled });
export const useMyActivity = (params: Params, enabled = true) =>
    useQuery({ queryKey: ["activity", "mine", params], queryFn: () => service.getMyActivity(params), placeholderData: keepPreviousData, enabled });

// Announcements
export const useAnnouncements = (params: Params, enabled = true) =>
    useQuery({ queryKey: [...ANNOUNCEMENTS_KEY, "list", params], queryFn: () => service.getAnnouncements(params), placeholderData: keepPreviousData, enabled });
export const useLiveAnnouncements = (enabled = true) => useQuery({ queryKey: [...ANNOUNCEMENTS_KEY, "live"], queryFn: service.getLiveAnnouncements, enabled });
export const useAnnouncement = (id: string | undefined) =>
    useQuery({ queryKey: [...ANNOUNCEMENTS_KEY, "detail", id], queryFn: () => service.getAnnouncement(id as string), enabled: !!id });

function useAnnouncementMutation<TArgs, TResult>(fn: (args: TArgs) => Promise<TResult>, success: string, failure: string) {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: fn,
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ANNOUNCEMENTS_KEY });
            qc.invalidateQueries({ queryKey: NOTIFICATIONS_KEY });
            toast({ title: success });
        },
        onError: (e) => toast({ variant: "destructive", title: failure, description: getApiErrorMessage(e) }),
    });
}
export const useCreateAnnouncement = () => useAnnouncementMutation(service.createAnnouncement, "Announcement saved", "Could not save announcement");
export const useUpdateAnnouncement = () => useAnnouncementMutation(service.updateAnnouncement, "Announcement saved", "Could not save announcement");
export const useDeleteAnnouncement = () => useAnnouncementMutation(service.deleteAnnouncement, "Announcement deleted", "Could not delete announcement");
export const usePublishAnnouncement = () => useAnnouncementMutation(service.publishAnnouncement, "Announcement published", "Could not publish");
export const useWithdrawAnnouncement = () => useAnnouncementMutation(service.withdrawAnnouncement, "Announcement withdrawn", "Could not withdraw");
export const useAcknowledgeAnnouncement = () => useAnnouncementMutation(service.acknowledgeAnnouncement, "Acknowledged", "Could not acknowledge");
