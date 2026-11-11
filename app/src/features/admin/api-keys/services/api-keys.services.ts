import axiosInstance from "@/config/api/axios";
import { ApiRoutes } from "@/config/api/routes";
import type { Paginated } from "@/features/admin/teams/interfaces/teams.interfaces";
import type { ApiKey, ApiKeyWithSecret, CreateApiKeyDto } from "../interfaces/api-keys.interfaces";

const R = ApiRoutes.admin.apiKeys;

export const getApiKeys = async (params: Record<string, unknown>): Promise<Paginated<ApiKey>> => (await axiosInstance.get(R.list, { params })).data;
export const createApiKey = async (dto: CreateApiKeyDto): Promise<ApiKeyWithSecret> => (await axiosInstance.post(R.list, dto)).data;
export const rotateApiKey = async (id: string): Promise<ApiKeyWithSecret> => (await axiosInstance.post(R.rotate(id))).data;
export const revokeApiKey = async (id: string): Promise<ApiKey> => (await axiosInstance.post(R.revoke(id))).data;
