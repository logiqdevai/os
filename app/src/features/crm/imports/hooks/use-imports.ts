import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CRM_KEY, useCrmInvalidate } from "../../common/hooks/use-crm-invalidate";
import type { ImportEntity } from "../interfaces/imports.interfaces";
import * as service from "../services/imports.services";

const KEY = [...CRM_KEY, "imports"] as const;

export const useImports = (params: Record<string, unknown>) => useQuery({ queryKey: [...KEY, "list", params], queryFn: () => service.getImports(params), placeholderData: keepPreviousData });
/** Polls every 2 s while the job is validating or importing. */
export const useImport = (id: string | undefined) =>
    useQuery({
        queryKey: [...KEY, "detail", id],
        queryFn: () => service.getImport(id as string),
        enabled: !!id,
        refetchInterval: (q) => (q.state.data && ["VALIDATING", "IMPORTING"].includes(q.state.data.status) ? 2000 : false),
    });
export const useSavedMappings = (entity: ImportEntity | undefined) => useQuery({ queryKey: [...KEY, "mappings", entity], queryFn: () => service.getSavedMappings(entity as ImportEntity), enabled: !!entity });

function useInvalidateImports() {
    const qc = useQueryClient();
    return () => qc.invalidateQueries({ queryKey: KEY });
}

export const useUploadImport = () => useMutation({ mutationFn: service.uploadImport, onSuccess: useInvalidateImports() });
export const useSetImportMapping = () => useMutation({ mutationFn: service.setImportMapping, onSuccess: useInvalidateImports() });
export const usePreviewImport = () => useMutation({ mutationFn: service.previewImport, onSuccess: useInvalidateImports() });
export const useStartImport = () => useMutation({ mutationFn: service.startImport, onSuccess: useInvalidateImports() });
export const useRollbackImport = () => useMutation({ mutationFn: service.rollbackImport, onSuccess: useCrmInvalidate() });
export const useDownloadImportErrors = () => useMutation({ mutationFn: service.downloadImportErrors });
export const useDeleteSavedMapping = () => useMutation({ mutationFn: service.deleteSavedMapping, onSuccess: useInvalidateImports() });
