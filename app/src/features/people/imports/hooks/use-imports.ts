import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PEOPLE_KEY } from "@/features/people/employees/hooks/use-employees";
import * as service from "../services/imports.services";

const KEY = [...PEOPLE_KEY, "imports"] as const;

export const useEmployeeImports = (params: Record<string, unknown>, enabled = true) =>
    useQuery({ queryKey: [...KEY, "list", params], queryFn: () => service.getEmployeeImports(params), placeholderData: keepPreviousData, enabled });
/** Polls every 2 s while the import runs. */
export const useEmployeeImport = (id: string | null) =>
    useQuery({ queryKey: [...KEY, "detail", id], queryFn: () => service.getEmployeeImport(id as string), enabled: !!id, refetchInterval: (q) => (q.state.data?.status === "IMPORTING" ? 2000 : false) });

export const useUploadEmployeeImport = () => {
    const qc = useQueryClient();
    return useMutation({ mutationFn: service.uploadEmployeeImport, meta: { errorTitle: "Could not upload the file" }, onSuccess: () => qc.invalidateQueries({ queryKey: [...KEY, "list"] }) });
};
export const usePreviewEmployeeImport = () => useMutation({ mutationFn: service.previewEmployeeImport, meta: { errorTitle: "Could not preview the import" } });
export const useRunEmployeeImport = () => {
    const qc = useQueryClient();
    return useMutation({ mutationFn: service.runEmployeeImport, meta: { errorTitle: "Could not run the import" }, onSuccess: () => qc.invalidateQueries({ queryKey: KEY }) });
};
