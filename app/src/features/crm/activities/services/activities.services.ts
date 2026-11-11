import axiosInstance from "@/config/api/axios";
import { ApiRoutes } from "@/config/api/routes";
import type { Paginated } from "../../common/interfaces/crm-common.interfaces";
import type { Activity, ActivitySummary, CreateActivityDto, UpdateActivityDto } from "../interfaces/activities.interfaces";

const R = () => ApiRoutes.crm.activities;

export const getActivities = async (params: Record<string, unknown>): Promise<Paginated<Activity>> => (await axiosInstance.get(R().list, { params })).data;
export const getActivitySummary = async (): Promise<ActivitySummary> => (await axiosInstance.get(R().summary)).data;
export const createActivity = async (dto: CreateActivityDto): Promise<Activity> => (await axiosInstance.post(R().list, dto)).data;
export const updateActivity = async ({ id, ...dto }: UpdateActivityDto & { id: string }): Promise<Activity> => (await axiosInstance.patch(R().detail(id), dto)).data;
export const completeActivity = async ({ id, outcome }: { id: string; outcome?: string }): Promise<Activity> => (await axiosInstance.post(R().complete(id), { outcome })).data;
export const deleteActivity = async (id: string) => (await axiosInstance.delete(R().detail(id))).data;
