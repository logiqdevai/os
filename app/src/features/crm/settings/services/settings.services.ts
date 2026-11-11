import axiosInstance from "@/config/api/axios";
import { ApiRoutes } from "@/config/api/routes";
import type { MemberRef } from "../../common/interfaces/crm-common.interfaces";
import type { CrmSettings, SettingItemDto, SettingKind, SettingOption } from "../interfaces/settings.interfaces";

const R = () => ApiRoutes.crm.settings;

export const getCrmSettings = async (archived = false): Promise<CrmSettings> => (await axiosInstance.get(R().all, { params: archived ? { archived: true } : {} })).data;
export const createSettingOption = async ({ kind, ...dto }: SettingItemDto & { kind: SettingKind; name: string }): Promise<SettingOption> => (await axiosInstance.post(R().list(kind), dto)).data;
export const updateSettingOption = async ({ kind, id, ...dto }: SettingItemDto & { kind: SettingKind; id: string }): Promise<SettingOption> => (await axiosInstance.patch(R().item(kind, id), dto)).data;
export const archiveSettingOption = async ({ kind, id, archived }: { kind: SettingKind; id: string; archived: boolean }): Promise<SettingOption> =>
    (await axiosInstance.post(archived ? R().archive(kind, id) : R().restore(kind, id))).data;
export const reorderSettingOptions = async ({ kind, ids }: { kind: SettingKind; ids: string[] }): Promise<CrmSettings> => (await axiosInstance.put(R().order(kind), { ids })).data;
export const getCrmMembers = async (search?: string): Promise<MemberRef[]> => (await axiosInstance.get(ApiRoutes.crm.members, { params: search ? { search } : {} })).data;
