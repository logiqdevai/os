import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
    return useMutation({ mutationFn: service.createDomain, onSuccess: invalidate });
};
export const useUpdateDomain = () => {
    const invalidate = useInvalidate();
    return useMutation({ mutationFn: service.updateDomain, onSuccess: invalidate });
};
export const useVerifyDomain = () => {
    const invalidate = useInvalidate();
    return useMutation({ mutationFn: service.verifyDomain, onSuccess: invalidate });
};
export const useDeleteDomain = () => {
    const invalidate = useInvalidate();
    return useMutation({ mutationFn: service.deleteDomain, onSuccess: invalidate });
};
