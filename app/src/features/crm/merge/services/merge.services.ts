import axiosInstance from "@/config/api/axios";
import { ApiRoutes } from "@/config/api/routes";
import type { DuplicateEntity, DuplicateRule, DuplicatesResult, MergeDto, MergeEntity, MergePreview, MergeResult } from "../interfaces/merge.interfaces";

const R = () => ApiRoutes.crm;

export const getDuplicates = async (params: { entity_type: DuplicateEntity; match?: string; min_score?: number; limit?: number }): Promise<DuplicatesResult> =>
    (await axiosInstance.get(R().duplicates.list, { params })).data;
export const dismissDuplicate = async (dto: { entity_type: DuplicateEntity; record_a_id: string; record_b_id: string }) => (await axiosInstance.post(R().duplicates.dismiss, dto)).data;
export const getDuplicateRules = async (): Promise<DuplicateRule[]> => (await axiosInstance.get(R().duplicates.rules)).data;
export const saveDuplicateRule = async (dto: Omit<DuplicateRule, "id">): Promise<DuplicateRule> => (await axiosInstance.put(R().duplicates.rules, dto)).data;
export const getMergePreview = async (params: { entity_type: MergeEntity; ids: string[] }): Promise<MergePreview> =>
    (await axiosInstance.get(R().merge.preview, { params: { entity_type: params.entity_type, ids: params.ids.join(",") } })).data;
export const mergeRecords = async (dto: MergeDto): Promise<MergeResult> => (await axiosInstance.post(R().merge.run, dto)).data;
