import axiosInstance from "@/config/api/axios";
import { ApiRoutes } from "@/config/api/routes";
import type { CapacityReport, HrSettings, PeopleOverview, UpdateHrSettingsDto } from "../interfaces/overview.interfaces";

export const getPeopleOverview = async (): Promise<PeopleOverview> => (await axiosInstance.get(ApiRoutes.people.overview)).data;
export const getCapacity = async (params: Record<string, unknown>): Promise<CapacityReport> => (await axiosInstance.get(ApiRoutes.people.capacity, { params })).data;
export const getHrSettings = async (): Promise<HrSettings> => (await axiosInstance.get(ApiRoutes.people.settings)).data;
export const updateHrSettings = async (dto: UpdateHrSettingsDto): Promise<HrSettings> => (await axiosInstance.put(ApiRoutes.people.settings, dto)).data;
