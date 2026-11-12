import axiosInstance from "@/config/api/axios";
import { ApiRoutes } from "@/config/api/routes";
import type { Paginated } from "@/features/people/employees/interfaces/employees.interfaces";
import type { EmployeeImportDetail, EmployeeImportJob, EmployeeImportPreview } from "../interfaces/imports.interfaces";

const R = ApiRoutes.people.imports;

export const getEmployeeImports = async (params: Record<string, unknown>): Promise<Paginated<EmployeeImportJob>> => (await axiosInstance.get(R.list, { params })).data;
export const getEmployeeImport = async (id: string): Promise<EmployeeImportDetail> => (await axiosInstance.get(R.detail(id))).data;
export const uploadEmployeeImport = async (dto: { file_name: string; csv: string }): Promise<EmployeeImportDetail> => (await axiosInstance.post(R.list, dto)).data;
export const previewEmployeeImport = async ({ id, ...dto }: { id: string; columns: Record<string, string>; update_existing: boolean }): Promise<EmployeeImportPreview> =>
    (await axiosInstance.put(R.mapping(id), dto)).data;
export const runEmployeeImport = async (id: string): Promise<EmployeeImportJob> => (await axiosInstance.post(R.run(id))).data;
