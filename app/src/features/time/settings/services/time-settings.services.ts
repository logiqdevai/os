import axiosInstance from "@/config/api/axios";
import { ApiRoutes } from "@/config/api/routes";
import type { ActivityTypeDto, TimeActivityType, TimeMember, TimeProjectOption, TimeTaskOption, TimeTrackingSettings, UpdateTimeSettingsDto } from "../interfaces/time-settings.interfaces";

const R = ApiRoutes.time;

export const getTimeSettings = async (): Promise<TimeTrackingSettings> => (await axiosInstance.get(R.settings)).data;
export const updateTimeSettings = async (dto: UpdateTimeSettingsDto): Promise<TimeTrackingSettings> => (await axiosInstance.patch(R.settings, dto)).data;

export const getActivityTypes = async (includeArchived = false): Promise<TimeActivityType[]> =>
    (await axiosInstance.get(R.activity_types.list, { params: includeArchived ? { include_archived: "true" } : undefined })).data;
export const createActivityType = async (dto: ActivityTypeDto): Promise<TimeActivityType> => (await axiosInstance.post(R.activity_types.list, dto)).data;
export const updateActivityType = async ({ id, ...dto }: Partial<ActivityTypeDto> & { id: string }): Promise<TimeActivityType> =>
    (await axiosInstance.patch(R.activity_types.detail(id), dto)).data;
export const archiveActivityType = async ({ id, restore }: { id: string; restore?: boolean }): Promise<TimeActivityType> =>
    (await axiosInstance.post(restore ? R.activity_types.restore(id) : R.activity_types.archive(id))).data;

export const getTimeProjects = async (search?: string): Promise<TimeProjectOption[]> =>
    (await axiosInstance.get(R.lookups.projects, { params: search ? { search } : undefined })).data;
export const getTimeTasks = async (projectId?: string | null, search?: string): Promise<TimeTaskOption[]> =>
    (await axiosInstance.get(R.lookups.tasks, { params: { ...(projectId && { project_id: projectId }), ...(search && { search }) } })).data;
export const getTimeMembers = async (scope: "team" | "all" = "all"): Promise<TimeMember[]> => (await axiosInstance.get(R.lookups.members, { params: { scope } })).data;
