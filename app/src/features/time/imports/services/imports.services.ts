import axiosInstance from "@/config/api/axios";
import { ApiRoutes } from "@/config/api/routes";
import type { Paginated } from "@/features/people/employees/interfaces/employees.interfaces";
import type { TimeImportDetail, TimeImportJob, TimeImportPreview } from "../interfaces/imports.interfaces";

const R = ApiRoutes.time.imports;

export const getTimeImports = async (params: Record<string, unknown>): Promise<Paginated<TimeImportJob>> => (await axiosInstance.get(R.list, { params })).data;
export const getTimeImport = async (id: string): Promise<TimeImportDetail> => (await axiosInstance.get(R.detail(id))).data;
export const uploadTimeImport = async (dto: { file_name: string; csv: string }): Promise<TimeImportDetail> => (await axiosInstance.post(R.list, dto)).data;
export const previewTimeImport = async ({ id, columns }: { id: string; columns: Record<string, string> }): Promise<TimeImportPreview> => (await axiosInstance.put(R.mapping(id), { columns })).data;
export const runTimeImport = async (id: string): Promise<TimeImportJob> => (await axiosInstance.post(R.run(id))).data;
