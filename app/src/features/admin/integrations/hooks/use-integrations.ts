import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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

const make = <TArgs, TResult>(fn: (args: TArgs) => Promise<TResult>) => () => {
    const invalidate = useInvalidate();
    return useMutation({ mutationFn: fn, onSuccess: invalidate });
};

export const useCreateIntegration = make(service.createIntegration);
export const useUpdateIntegration = make(service.updateIntegration);
export const useReplaceSecrets = make(service.replaceSecrets);
export const useVerifyIntegration = make(service.verifyIntegration);
export const useSetDefaultIntegration = make(service.setDefaultIntegration);
export const useSetIntegrationEnabled = make(service.setIntegrationEnabled);
export const useDisconnectIntegration = make(service.disconnectIntegration);
