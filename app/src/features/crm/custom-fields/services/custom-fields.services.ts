import axiosInstance from "@/config/api/axios";
import { ApiRoutes } from "@/config/api/routes";
import type { CreateCustomFieldDto, CustomFieldDefinition, CustomFieldEntity, CustomFieldGroup, UpdateCustomFieldDto } from "../interfaces/custom-fields.interfaces";

const R = () => ApiRoutes.crm.custom_fields;

export const getCustomFields = async (params: { entity_type?: CustomFieldEntity; include_archived?: boolean }): Promise<CustomFieldDefinition[]> =>
    (await axiosInstance.get(R().list, { params })).data;
export const createCustomField = async (dto: CreateCustomFieldDto): Promise<CustomFieldDefinition> => (await axiosInstance.post(R().list, dto)).data;
export const updateCustomField = async ({ id, ...dto }: UpdateCustomFieldDto): Promise<CustomFieldDefinition> => (await axiosInstance.patch(R().detail(id), dto)).data;
export const archiveCustomField = async (id: string) => (await axiosInstance.post(R().archive(id))).data;
export const restoreCustomField = async (id: string) => (await axiosInstance.post(R().restore(id))).data;
export const deleteCustomField = async (id: string) => (await axiosInstance.delete(R().detail(id))).data;
export const reorderCustomFields = async (ids: string[]) => (await axiosInstance.put(R().order, { ids })).data;

export const getCustomFieldGroups = async (): Promise<CustomFieldGroup[]> => (await axiosInstance.get(R().groups)).data;
export const createCustomFieldGroup = async (dto: { name: string; description?: string }): Promise<CustomFieldGroup> => (await axiosInstance.post(R().groups, dto)).data;
export const updateCustomFieldGroup = async ({ id, ...dto }: { id: string; name?: string; sort_order?: number }) => (await axiosInstance.patch(R().group(id), dto)).data;
export const deleteCustomFieldGroup = async (id: string) => (await axiosInstance.delete(R().group(id))).data;
