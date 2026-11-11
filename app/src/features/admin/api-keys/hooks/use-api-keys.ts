import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as service from "../services/api-keys.services";

const KEY = ["admin", "api-keys"] as const;

export const useApiKeys = (params: Record<string, unknown>) =>
    useQuery({ queryKey: [...KEY, "list", params], queryFn: () => service.getApiKeys(params), placeholderData: keepPreviousData });

function useInvalidate() {
    const qc = useQueryClient();
    return () => {
        qc.invalidateQueries({ queryKey: KEY });
        qc.invalidateQueries({ queryKey: ["admin", "service-accounts"] });
    };
}

export const useCreateApiKey = () => {
    const invalidate = useInvalidate();
    return useMutation({ mutationFn: service.createApiKey, onSuccess: invalidate });
};
export const useRotateApiKey = () => {
    const invalidate = useInvalidate();
    return useMutation({ mutationFn: service.rotateApiKey, onSuccess: invalidate });
};
export const useRevokeApiKey = () => {
    const invalidate = useInvalidate();
    return useMutation({ mutationFn: service.revokeApiKey, onSuccess: invalidate });
};
