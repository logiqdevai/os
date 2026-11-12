import axiosInstance from "@/config/api/axios";
import { ApiRoutes } from "@/config/api/routes";
import type { RetentionAction, RetentionDataClass, RetentionPolicy, RetentionRunResult } from "../interfaces/retention.interfaces";

export const getRetentionPolicies = async (): Promise<{ data: RetentionPolicy[] }> => (await axiosInstance.get(ApiRoutes.admin.retention.list)).data;
export const updateRetentionPolicy = async ({ data_class, ...dto }: { data_class: RetentionDataClass; retention_days?: number | null; action?: RetentionAction }): Promise<RetentionPolicy> =>
    (await axiosInstance.put(ApiRoutes.admin.retention.detail(data_class), dto)).data;
export const setLegalHold = async (dto: { enabled: boolean; reason?: string | null }): Promise<{ data: RetentionPolicy[] }> => (await axiosInstance.post(ApiRoutes.admin.retention.legalHold, dto)).data;
export const runRetention = async (): Promise<{ results: RetentionRunResult[] }> => (await axiosInstance.post(ApiRoutes.admin.retention.run)).data;
