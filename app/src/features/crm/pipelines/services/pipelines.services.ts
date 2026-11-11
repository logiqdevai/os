import axiosInstance from "@/config/api/axios";
import { ApiRoutes } from "@/config/api/routes";
import type { CreatePipelineDto, Pipeline, StageInput, UpdatePipelineDto } from "../interfaces/pipelines.interfaces";

const R = () => ApiRoutes.crm.pipelines;

export const getPipelines = async (params?: { archived?: boolean }): Promise<Pipeline[]> => (await axiosInstance.get(R().list, { params })).data;
export const createPipeline = async (dto: CreatePipelineDto): Promise<Pipeline> => (await axiosInstance.post(R().list, dto)).data;
export const updatePipeline = async ({ id, ...dto }: UpdatePipelineDto & { id: string }): Promise<Pipeline> => (await axiosInstance.patch(R().detail(id), dto)).data;
export const replaceStages = async ({ id, stages }: { id: string; stages: StageInput[] }): Promise<Pipeline> => (await axiosInstance.put(R().stages(id), { stages })).data;
export const archivePipeline = async (id: string): Promise<Pipeline> => (await axiosInstance.post(R().archive(id))).data;
