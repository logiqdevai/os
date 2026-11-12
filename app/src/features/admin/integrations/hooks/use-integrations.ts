import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { patchEntity, useOptimisticMutation } from "@/lib/query/optimistic";
import * as service from "../services/integrations.services";

const KEY = ["admin", "integrations"] as const;

export const useIntegrationProviders = () => useQuery({ queryKey: [...KEY, "providers"], queryFn: service.getProviders, staleTime: Infinity });

export const useIntegrations = (params: Record<string, unknown>) =>
    useQuery({ queryKey: [...KEY, "list", params], queryFn: () => service.getIntegrations(params), placeholderData: keepPreviousData });

export const useIntegration = (id: string | undefined) => useQuery({ queryKey: [...KEY, "detail", id], queryFn: () => service.getIntegration(id as string), enabled: !!id });

function useInvalidate() {
    const qc = useQueryClient();
    return () => {
        qc.invalidateQueries({ queryKey: KEY });
        qc.invalidateQueries({ queryKey: ["admin", "overview"] });
    };
}

/** Integration mutation: no success toast; failures are toasted once globally with `errorTitle` (unless shown inline). */
const make = <TArgs, TResult>(fn: (args: TArgs) => Promise<TResult>, errorTitle: string, errorToast = true) => () => {
    const invalidate = useInvalidate();
    return useMutation({ mutationFn: fn, meta: { errorTitle, errorToast }, onSettled: invalidate });
};

export const useCreateIntegration = make(service.createIntegration, "Could not connect the integration");
/** Autosaved by the integration settings form, which shows failures in its <SaveStatus />. */
export const useUpdateIntegration = make(service.updateIntegration, "Could not update the integration", false);
export const useReplaceSecrets = make(service.replaceSecrets, "Could not replace the credentials");
export const useVerifyIntegration = make(service.verifyIntegration, "Could not verify the integration");
/** Optimistic: the Default badge moves at once. */
export const useSetDefaultIntegration = () =>
    useOptimisticMutation({
        roots: [KEY],
        alsoInvalidate: [["admin", "overview"]],
        mutationFn: service.setDefaultIntegration,
        meta: { errorTitle: "Could not make it the default" },
        apply: (qc, id) => patchEntity(qc, KEY, id, { is_default: true }),
    });
/** Optimistic: the switch / status flips at once. */
export const useSetIntegrationEnabled = () =>
    useOptimisticMutation({
        roots: [KEY],
        alsoInvalidate: [["admin", "overview"]],
        mutationFn: service.setIntegrationEnabled,
        meta: { errorTitle: "Could not change the integration" },
        apply: (qc, v) => patchEntity(qc, KEY, v.id, { status: v.enabled ? "ACTIVE" : "DISABLED" }),
    });
export const useDisconnectIntegration = make(service.disconnectIntegration, "Could not disconnect the integration");
