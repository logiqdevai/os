import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CRM_KEY, useCrmMutation, useCrmRemove, type CrmMutationMeta } from "../../common/hooks/use-crm-invalidate";
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

/** Import-only write. By default the wizard shows API errors inline, so these do not toast. */
function useImportMutation<TData, TVars>(mutationFn: (vars: TVars) => Promise<TData>, meta: CrmMutationMeta = { errorToast: false }) {
    const qc = useQueryClient();
    return useMutation<TData, Error, TVars>({ mutationFn, meta, onSettled: () => qc.invalidateQueries({ queryKey: KEY }) });
}

export const useUploadImport = () => useImportMutation(service.uploadImport);
export const useSetImportMapping = (meta?: CrmMutationMeta) => useImportMutation(service.setImportMapping, meta);
export const usePreviewImport = () => useImportMutation(service.previewImport);
export const useStartImport = () => useCrmMutation(service.startImport, { errorTitle: "Could not start the import" });
export const useRollbackImport = () => useCrmMutation(service.rollbackImport, { errorTitle: "Could not roll back the import" });
export const useDownloadImportErrors = () => useMutation({ mutationFn: service.downloadImportErrors, meta: { errorTitle: "Could not download the error file" } });
export const useDeleteSavedMapping = () => useCrmRemove(KEY, service.deleteSavedMapping, { errorTitle: "Could not delete mapping" });
