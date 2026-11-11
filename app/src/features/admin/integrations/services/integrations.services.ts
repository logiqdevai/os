import axiosInstance from "@/config/api/axios";
import { ApiRoutes } from "@/config/api/routes";
import type { Paginated } from "@/features/admin/teams/interfaces/teams.interfaces";
import type { CreateIntegrationDto, IntegrationConnection, IntegrationDetail, IntegrationProviderSpec, UpdateIntegrationDto } from "../interfaces/integrations.interfaces";

const R = ApiRoutes.admin.integrations;

export const getProviders = async (): Promise<IntegrationProviderSpec[]> => (await axiosInstance.get(R.providers)).data;
export const getIntegrations = async (params: Record<string, unknown>): Promise<Paginated<IntegrationConnection>> => (await axiosInstance.get(R.list, { params })).data;
export const getIntegration = async (id: string): Promise<IntegrationDetail> => (await axiosInstance.get(R.detail(id))).data;
export const createIntegration = async (dto: CreateIntegrationDto): Promise<IntegrationDetail> => (await axiosInstance.post(R.list, dto)).data;
export const updateIntegration = async ({ id, ...dto }: UpdateIntegrationDto & { id: string }): Promise<IntegrationDetail> => (await axiosInstance.patch(R.detail(id), dto)).data;
export const replaceSecrets = async ({ id, secrets }: { id: string; secrets: Record<string, string> }): Promise<IntegrationDetail> => (await axiosInstance.put(R.secrets(id), { secrets })).data;
export const verifyIntegration = async (id: string): Promise<IntegrationDetail> => (await axiosInstance.post(R.verify(id))).data;
export const setDefaultIntegration = async (id: string): Promise<IntegrationDetail> => (await axiosInstance.post(R.default(id))).data;
export const setIntegrationEnabled = async ({ id, enabled }: { id: string; enabled: boolean }): Promise<IntegrationDetail> =>
    (await axiosInstance.post(enabled ? R.enable(id) : R.disable(id))).data;
export const disconnectIntegration = async (id: string): Promise<IntegrationDetail> => (await axiosInstance.delete(R.detail(id))).data;
