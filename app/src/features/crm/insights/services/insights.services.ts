import axiosInstance from "@/config/api/axios";
import { ApiRoutes } from "@/config/api/routes";
import type { CrmDashboard, CrmForecast } from "../interfaces/insights.interfaces";

export const getCrmDashboard = async (params: Record<string, unknown>): Promise<CrmDashboard> => (await axiosInstance.get(ApiRoutes.crm.dashboard, { params })).data;
export const getCrmForecast = async (params: Record<string, unknown>): Promise<CrmForecast> => (await axiosInstance.get(ApiRoutes.crm.forecast, { params })).data;
