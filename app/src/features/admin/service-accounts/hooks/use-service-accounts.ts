import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as service from "../services/service-accounts.services";

const KEY = ["admin", "service-accounts"] as const;

export const useServiceAccounts = (params: Record<string, unknown>, enabled = true) =>
    useQuery({ queryKey: [...KEY, "list", params], queryFn: () => service.getServiceAccounts(params), placeholderData: keepPreviousData, enabled });

export const useServiceAccount = (id: string | undefined) => useQuery({ queryKey: [...KEY, "detail", id], queryFn: () => service.getServiceAccount(id as string), enabled: !!id });

function useInvalidate() {
    const qc = useQueryClient();
    return () => {
        qc.invalidateQueries({ queryKey: KEY });
        qc.invalidateQueries({ queryKey: ["admin", "api-keys"] });
    };
}

export const useCreateServiceAccount = () => {
    const invalidate = useInvalidate();
    return useMutation({ mutationFn: service.createServiceAccount, onSuccess: invalidate });
};
export const useUpdateServiceAccount = () => {
    const invalidate = useInvalidate();
    return useMutation({ mutationFn: service.updateServiceAccount, onSuccess: invalidate });
};
export const useSetServiceAccountStatus = () => {
    const invalidate = useInvalidate();
    return useMutation({ mutationFn: service.setServiceAccountStatus, onSuccess: invalidate });
};
export const useAssignServiceAccountRole = () => {
    const invalidate = useInvalidate();
    return useMutation({ mutationFn: service.assignServiceAccountRole, onSuccess: invalidate });
};
export const useRemoveServiceAccountRole = () => {
    const invalidate = useInvalidate();
    return useMutation({ mutationFn: service.removeServiceAccountRole, onSuccess: invalidate });
};
