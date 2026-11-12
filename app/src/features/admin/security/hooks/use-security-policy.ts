import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as service from "../services/security.services";

const KEY = ["admin", "security-policy"] as const;

export const useSecurityPolicy = () => useQuery({ queryKey: KEY, queryFn: service.getSecurityPolicy });

export const useUpdateSecurityPolicy = () => {
    const qc = useQueryClient();
    // Autosaved: a refusal (e.g. lock-out protection) is shown by the page's <SaveStatus />, not a toast.
    return useMutation({ mutationFn: service.updateSecurityPolicy, meta: { errorToast: false }, onSuccess: (data) => qc.setQueryData(KEY, data) });
};
