import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { patchEntity, useOptimisticMutation } from "@/lib/query/optimistic";
import * as service from "../services/api-keys.services";

const KEY = ["admin", "api-keys"] as const;
const SERVICE_ACCOUNTS = ["admin", "service-accounts"] as const;

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
    return useMutation({ mutationFn: service.createApiKey, meta: { errorTitle: "Could not create API key" }, onSettled: invalidate });
};
export const useRotateApiKey = () => {
    const invalidate = useInvalidate();
    return useMutation({ mutationFn: service.rotateApiKey, meta: { errorTitle: "Could not rotate API key" }, onSettled: invalidate });
};
/** Optimistic: the key shows Revoked at once. */
export const useRevokeApiKey = () =>
    useOptimisticMutation({
        roots: [KEY, SERVICE_ACCOUNTS],
        mutationFn: service.revokeApiKey,
        meta: { errorTitle: "Could not revoke the API key" },
        apply: (qc, id) => {
            const revoked_at = new Date().toISOString();
            patchEntity(qc, KEY, id, { revoked_at });
            // Keys are also listed inside a service account's detail.
            qc.setQueriesData<{ api_keys?: { id: string; revoked_at: string | null }[] }>({ queryKey: SERVICE_ACCOUNTS }, (sa) =>
                sa?.api_keys ? { ...sa, api_keys: sa.api_keys.map((k) => (k.id === id ? { ...k, revoked_at } : k)) } : sa);
        },
    });
