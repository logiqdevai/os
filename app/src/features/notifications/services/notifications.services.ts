import axiosInstance from "@/config/api/axios";
import { ApiRoutes } from "@/config/api/routes";
import type {
    ActivityItem, Announcement, AnnouncementAudienceOptions, AnnouncementDetail, AnnouncementDto, EventPreferenceRow, NotificationChannel, NotificationCounts, NotificationItem, Paginated,
    RecipientSettings, UpdateRecipientSettingsDto,
} from "../interfaces/notifications.interfaces";

const R = ApiRoutes.notifications;
type Params = Record<string, unknown>;

export const getNotifications = async (params: Params): Promise<Paginated<NotificationItem>> => (await axiosInstance.get(R.list, { params })).data;
export const getNotificationCounts = async (): Promise<NotificationCounts> => (await axiosInstance.get(R.counts)).data;
export const getNotification = async (id: string): Promise<NotificationItem> => (await axiosInstance.get(R.detail(id))).data;
export const updateNotification = async ({ id, ...dto }: { id: string; read?: boolean; archived?: boolean; snoozed_until?: string | null }): Promise<NotificationItem> =>
    (await axiosInstance.patch(R.detail(id), dto)).data;
export const openNotification = async (id: string): Promise<{ id: string; action_url: string | null }> => (await axiosInstance.post(R.open(id))).data;
export const actOnNotification = async ({ id, action }: { id: string; action: string }): Promise<NotificationItem> => (await axiosInstance.post(R.actions(id), { action })).data;
export const readAllNotifications = async (module?: string): Promise<{ updated: number }> => (await axiosInstance.post(R.readAll, module ? { module } : {})).data;
export const markNotificationsSeen = async (): Promise<{ updated: number }> => (await axiosInstance.post(R.seen)).data;
export const bulkNotifications = async (dto: { ids: string[]; action: "read" | "unread" | "archive" | "unarchive" }): Promise<{ updated: number }> =>
    (await axiosInstance.post(R.bulk, dto)).data;

export const getRecipientSettings = async (): Promise<RecipientSettings> => (await axiosInstance.get(R.preferences.settings)).data;
export const updateRecipientSettings = async (dto: UpdateRecipientSettingsDto): Promise<RecipientSettings> => (await axiosInstance.patch(R.preferences.settings, dto)).data;
export const getEventPreferences = async (): Promise<EventPreferenceRow[]> => (await axiosInstance.get(R.preferences.events)).data;
export const setEventPreference = async ({ eventTypeId, channel, enabled }: { eventTypeId: string; channel: NotificationChannel; enabled: boolean }) =>
    (await axiosInstance.put(R.preferences.event(eventTypeId), { channel, enabled })).data;
export const resetEventPreference = async (eventTypeId: string) => (await axiosInstance.delete(R.preferences.event(eventTypeId))).data;

export const getActivity = async (params: Params): Promise<Paginated<ActivityItem>> => (await axiosInstance.get(R.activity, { params })).data;
export const getMyActivity = async (params: Params): Promise<Paginated<ActivityItem>> => (await axiosInstance.get(R.myActivity, { params })).data;

export const getAnnouncements = async (params: Params): Promise<Paginated<Announcement>> => (await axiosInstance.get(R.announcements.list, { params })).data;
export const getAnnouncementAudienceOptions = async (): Promise<AnnouncementAudienceOptions> => (await axiosInstance.get(R.announcements.audienceOptions)).data;
export const getLiveAnnouncements = async (): Promise<Announcement[]> => (await axiosInstance.get(R.announcements.live)).data;
export const getAnnouncement = async (id: string): Promise<AnnouncementDetail> => (await axiosInstance.get(R.announcements.detail(id))).data;
export const createAnnouncement = async (dto: AnnouncementDto): Promise<Announcement> => (await axiosInstance.post(R.announcements.list, dto)).data;
export const updateAnnouncement = async ({ id, ...dto }: AnnouncementDto & { id: string }): Promise<Announcement> => (await axiosInstance.patch(R.announcements.detail(id), dto)).data;
export const deleteAnnouncement = async (id: string) => (await axiosInstance.delete(R.announcements.detail(id))).data;
export const publishAnnouncement = async (id: string): Promise<Announcement & { recipients: number }> => (await axiosInstance.post(R.announcements.publish(id))).data;
export const withdrawAnnouncement = async (id: string): Promise<Announcement> => (await axiosInstance.post(R.announcements.withdraw(id))).data;
export const acknowledgeAnnouncement = async (id: string) => (await axiosInstance.post(R.announcements.acknowledge(id))).data;
