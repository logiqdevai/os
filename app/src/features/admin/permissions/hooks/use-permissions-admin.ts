import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
    return useMutation({ mutationFn: service.createGrant, onSuccess: invalidate });
};
export const useRevokeGrant = () => {
    const invalidate = useInvalidate();
    return useMutation({ mutationFn: service.revokeGrant, onSuccess: invalidate });
};
export const useSimulate = () => useMutation({ mutationFn: service.simulate });
