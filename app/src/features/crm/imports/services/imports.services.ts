import axiosInstance from "@/config/api/axios";
import { ApiRoutes } from "@/config/api/routes";
import { downloadCsv } from "../../common/services/crm-download.services";
import type { Paginated } from "../../common/interfaces/crm-common.interfaces";
import type { DuplicateStrategy, ImportEntity, ImportJob, ImportJobListItem, ImportPreview, SavedImportMapping } from "../interfaces/imports.interfaces";

const R = () => ApiRoutes.crm.imports;

export const getImports = async (params: Record<string, unknown>): Promise<Paginated<ImportJobListItem>> => (await axiosInstance.get(R().list, { params })).data;
export const getImport = async (id: string): Promise<ImportJob> => (await axiosInstance.get(R().detail(id))).data;
export const uploadImport = async ({ file, entity_type }: { file: File; entity_type: ImportEntity }): Promise<ImportJob> => {
    const form = new FormData();
    form.append("file", file);
    form.append("entity_type", entity_type);
    return (await axiosInstance.post(R().list, form, { headers: { "Content-Type": "multipart/form-data" } })).data;
};
export const setImportMapping = async ({ id, ...dto }: { id: string; field_mapping: Record<string, string>; duplicate_strategy: DuplicateStrategy; save_as?: string }): Promise<ImportJob> =>
    (await axiosInstance.put(R().mapping(id), dto)).data;
export const previewImport = async (id: string): Promise<ImportPreview> => (await axiosInstance.post(R().preview(id))).data;
export const startImport = async (id: string): Promise<ImportJob> => (await axiosInstance.post(R().start(id))).data;
export const rollbackImport = async (id: string): Promise<{ deleted: number; kept: number }> => (await axiosInstance.post(R().rollback(id))).data;
export const downloadImportErrors = (id: string) => downloadCsv(R().errors(id), {}, "import-errors.csv");
export const getSavedMappings = async (entity_type: ImportEntity): Promise<SavedImportMapping[]> => (await axiosInstance.get(R().mappings, { params: { entity_type } })).data;
export const deleteSavedMapping = async (id: string) => (await axiosInstance.delete(R().mapping_delete(id))).data;
