import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { TIME_KEY } from "@/features/time/settings/hooks/use-time-settings";
import * as service from "../services/imports.services";

const KEY = [...TIME_KEY, "imports"] as const;

export const useTimeImports = (params: Record<string, unknown>, enabled = true) =>
    useQuery({ queryKey: [...KEY, "list", params], queryFn: () => service.getTimeImports(params), placeholderData: keepPreviousData, enabled });
/** Polls every 2 s while the import runs. */
export const useTimeImport = (id: string | null) =>
    useQuery({ queryKey: [...KEY, "detail", id], queryFn: () => service.getTimeImport(id as string), enabled: !!id, refetchInterval: (q) => (q.state.data?.status === "PROCESSING" ? 2000 : false) });
/** Wizard steps: each step shows its own result (mapping, preview, live progress); failures toast once globally. */
export const useUploadTimeImport = () => {
    const qc = useQueryClient();
    return useMutation({ mutationFn: service.uploadTimeImport, meta: { errorTitle: "Could not read the file" }, onSettled: () => qc.invalidateQueries({ queryKey: [...KEY, "list"] }) });
};
export const usePreviewTimeImport = () => useMutation({ mutationFn: service.previewTimeImport, meta: { errorTitle: "Could not check the file" } });
/** The job's live status (polled) shows the import running; no "Import started" toast. */
export const useRunTimeImport = () => {
    const qc = useQueryClient();
    return useMutation({ mutationFn: service.runTimeImport, meta: { errorTitle: "Could not start the import" }, onSettled: () => qc.invalidateQueries({ queryKey: TIME_KEY }) });
};
