import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { patchEntity, useEntityUpdate, useOptimisticMutation } from "@/lib/query/optimistic";
import * as service from "../services/branches.services";

const KEY = ["admin", "branches"] as const;

export const useBranches = (params: Record<string, unknown> = { limit: 500 }, options: { enabled?: boolean } = {}) =>
    useQuery({ queryKey: [...KEY, "list", params], queryFn: () => service.getBranches(params), placeholderData: keepPreviousData, enabled: options.enabled ?? true });

export const useBranch = (id: string | undefined) => useQuery({ queryKey: [...KEY, "detail", id], queryFn: () => service.getBranch(id as string), enabled: !!id });

function useInvalidate() {
    const qc = useQueryClient();
    return () => {
        qc.invalidateQueries({ queryKey: KEY });
        qc.invalidateQueries({ queryKey: ["session"] });
    };
}

export const useCreateBranch = () => {
    const invalidate = useInvalidate();
    return useMutation({ mutationFn: service.createBranch, meta: { errorTitle: "Could not create branch" }, onSettled: invalidate });
};
/** Optimistic: the branch changes at once in every list and the detail (autosaved by the branch page). */
export const useUpdateBranch = (errorToast = true) =>
    useEntityUpdate({ root: KEY, mutationFn: service.updateBranch, alsoInvalidate: [["session"]], meta: { errorTitle: "Could not update the branch", errorToast } });
/** Optimistic: the branch shows Archived / Active at once. */
export const useArchiveBranch = () =>
    useOptimisticMutation({ roots: [KEY], alsoInvalidate: [["session"]], mutationFn: service.archiveBranch, meta: { errorTitle: "Could not archive the branch" }, apply: (qc, id) => patchEntity(qc, KEY, id, { status: "ARCHIVED", archived_at: new Date().toISOString() }) });
export const useRestoreBranch = () =>
    useOptimisticMutation({ roots: [KEY], alsoInvalidate: [["session"]], mutationFn: service.restoreBranch, meta: { errorTitle: "Could not restore the branch" }, apply: (qc, id) => patchEntity(qc, KEY, id, { status: "ACTIVE", archived_at: null }) });
