import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
    return useMutation({ mutationFn: service.createBranch, onSuccess: invalidate });
};
export const useUpdateBranch = () => {
    const invalidate = useInvalidate();
    return useMutation({ mutationFn: service.updateBranch, onSuccess: invalidate });
};
export const useArchiveBranch = () => {
    const invalidate = useInvalidate();
    return useMutation({ mutationFn: service.archiveBranch, onSuccess: invalidate });
};
export const useRestoreBranch = () => {
    const invalidate = useInvalidate();
    return useMutation({ mutationFn: service.restoreBranch, onSuccess: invalidate });
};
