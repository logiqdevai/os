import { useQuery } from "@tanstack/react-query";
import { CRM_KEY, useCrmMutation, useCrmRemove } from "../../common/hooks/use-crm-invalidate";
import { useOptimisticMutation } from "@/lib/query/optimistic";
import type { Pipeline } from "../interfaces/pipelines.interfaces";
import * as service from "../services/pipelines.services";

const KEY = [...CRM_KEY, "pipelines"] as const;

export const usePipelines = (enabled = true) => useQuery({ queryKey: [...KEY, "active"], queryFn: () => service.getPipelines(), staleTime: 60_000, enabled });

export const useCreatePipeline = () => useCrmMutation(service.createPipeline, { errorTitle: "Could not create pipeline" });
/** Optimistic; making one pipeline the default clears the flag on the others at once. */
export const useUpdatePipeline = () =>
    useOptimisticMutation({
        roots: [KEY],
        alsoInvalidate: [CRM_KEY],
        meta: { errorTitle: "Could not update pipeline" },
        mutationFn: service.updatePipeline,
        apply: (qc, { id, ...body }) =>
            qc.setQueriesData<Pipeline[]>({ queryKey: KEY }, (d) =>
                d?.map((p) => (p.id === id ? { ...p, ...body } : body.is_default ? { ...p, is_default: false } : p)),
            ),
    });
export const useReplaceStages = () => useCrmMutation(service.replaceStages, { errorTitle: "Could not save stages" });
export const useArchivePipeline = () => useCrmRemove(KEY, service.archivePipeline, { errorTitle: "Could not archive pipeline" });
