import axiosInstance from "@/config/api/axios";
import { ApiRoutes } from "@/config/api/routes";
import type { TagRef } from "../../common/interfaces/crm-common.interfaces";
import type { CreateTagDto, SetTaggingsDto, Tag } from "../interfaces/tags.interfaces";

const R = () => ApiRoutes.crm.tags;

export const getTags = async (entity_type?: string): Promise<Tag[]> => (await axiosInstance.get(R().list, { params: entity_type ? { entity_type } : {} })).data;
export const createTag = async (dto: CreateTagDto): Promise<Tag> => (await axiosInstance.post(R().list, dto)).data;
export const updateTag = async ({ id, ...dto }: Partial<CreateTagDto> & { id: string }): Promise<Tag> => (await axiosInstance.patch(R().detail(id), dto)).data;
export const deleteTag = async (id: string) => (await axiosInstance.delete(R().detail(id))).data;
export const setTaggings = async (dto: SetTaggingsDto): Promise<TagRef[]> => (await axiosInstance.put(R().taggings, dto)).data;
