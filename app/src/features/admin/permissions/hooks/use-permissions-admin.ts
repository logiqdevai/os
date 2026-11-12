import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEntityRemove } from "@/lib/query/optimistic";
import * as service from "../services/permissions.services";

export const useCatalog = (params: Record<string, unknown> = {}, enabled = true) =>
    useQuery({ queryKey: ["admin", "permissions", "catalog", params], queryFn: () => service.getCatalog({ limit: 2000, ...params }), placeholderData: keepPreviousData, staleTime: 5 * 60_000, enabled });

export const useGrants = (params: Record<string, unknown>, enabled = true) =>
    useQuery({ queryKey: ["admin", "grants", params], queryFn: () => service.getGrants(params), enabled });

function useInvalidate() {
    const qc = useQueryClient();
    return () => {
        qc.invalidateQueries({ queryKey: ["admin", "grants"] });
        qc.invalidateQueries({ queryKey: ["admin", "members"] });
    };
}

export const useCreateGrant = () => {
    const invalidate = useInvalidate();
    return useMutation({ mutationFn: service.createGrant, meta: { errorTitle: "Could not create grant" }, onSettled: invalidate });
};
/** Optimistic: the exception disappears at once (from grant lists and the member detail). */
export const useRevokeGrant = () =>
    useEntityRemove({ root: ["admin", "grants"], alsoInvalidate: [["admin", "members"]], mutationFn: service.revokeGrant, meta: { errorTitle: "Could not remove the exception" } });
export const useSimulate = () => useMutation({ mutationFn: service.simulate, meta: { errorTitle: "Could not simulate" } });
