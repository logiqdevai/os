import axiosInstance from "@/config/api/axios";
import { ApiRoutes } from "@/config/api/routes";
import type { GroupMappingDto, SaveSsoConfigurationDto, SsoConfiguration, SsoGroupMapping } from "../interfaces/sso.interfaces";

export const getSsoConfigurations = async (): Promise<{ data: SsoConfiguration[] }> => (await axiosInstance.get(ApiRoutes.admin.sso.list)).data;
export const createSsoConfiguration = async (dto: SaveSsoConfigurationDto): Promise<SsoConfiguration> => (await axiosInstance.post(ApiRoutes.admin.sso.list, dto)).data;
/** The protocol cannot change after creation, so it is not sent. */
export const updateSsoConfiguration = async (dto: SaveSsoConfigurationDto & { id: string }): Promise<SsoConfiguration> =>
    (await axiosInstance.patch(ApiRoutes.admin.sso.detail(dto.id), { name: dto.name, auto_provision: dto.auto_provision, config: dto.config, secrets: dto.secrets })).data;
export const updateSsoSettings = async ({ id, ...dto }: { id: string; auto_provision?: boolean; name?: string }): Promise<SsoConfiguration> => (await axiosInstance.patch(ApiRoutes.admin.sso.detail(id), dto)).data;
export const deleteSsoConfiguration = async (id: string): Promise<{ success: boolean }> => (await axiosInstance.delete(ApiRoutes.admin.sso.detail(id))).data;
export const addGroupMapping = async ({ configId, ...dto }: GroupMappingDto & { configId: string }): Promise<SsoGroupMapping> => (await axiosInstance.post(ApiRoutes.admin.sso.mappings(configId), dto)).data;
export const updateGroupMapping = async ({ configId, mappingId, ...dto }: GroupMappingDto & { configId: string; mappingId: string }): Promise<SsoGroupMapping> =>
    (await axiosInstance.patch(ApiRoutes.admin.sso.mapping(configId, mappingId), dto)).data;
export const deleteGroupMapping = async ({ configId, mappingId }: { configId: string; mappingId: string }): Promise<{ success: boolean }> =>
    (await axiosInstance.delete(ApiRoutes.admin.sso.mapping(configId, mappingId))).data;
