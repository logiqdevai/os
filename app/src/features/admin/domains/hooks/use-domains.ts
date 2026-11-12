import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEntityRemove, useEntityUpdate } from "@/lib/query/optimistic";
import * as service from "../services/domains.services";

const KEY = ["admin", "domains"] as const;

export const useDomains = (params: Record<string, unknown>) =>
    useQuery({ queryKey: [...KEY, "list", params], queryFn: () => service.getDomains(params), placeholderData: keepPreviousData });

function useInvalidate() {
    const qc = useQueryClient();
    return () => qc.invalidateQueries({ queryKey: KEY });
}

export const useCreateDomain = () => {
    const invalidate = useInvalidate();
    return useMutation({ mutationFn: service.createDomain, meta: { errorTitle: "Could not create domain" }, onSettled: invalidate });
};
/** Optimistic: the discovery / auto-provision switches flip at once. */
export const useUpdateDomain = () => useEntityUpdate({ root: KEY, mutationFn: service.updateDomain, meta: { errorTitle: "Could not update the domain" } });
export const useVerifyDomain = () => {
    const invalidate = useInvalidate();
    return useMutation({ mutationFn: service.verifyDomain, meta: { errorTitle: "Could not verify domain" }, onSettled: invalidate });
};
/** Optimistic: the domain disappears at once. */
export const useDeleteDomain = () => useEntityRemove({ root: KEY, mutationFn: service.deleteDomain, meta: { errorTitle: "Could not delete the domain" } });
