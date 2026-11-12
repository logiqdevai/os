import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as service from "../services/security.services";

const KEY = ["admin", "security-policy"] as const;

export const useSecurityPolicy = () => useQuery({ queryKey: KEY, queryFn: service.getSecurityPolicy });

export const useUpdateSecurityPolicy = () => {
    const qc = useQueryClient();
    return useMutation({ mutationFn: service.updateSecurityPolicy, onSuccess: (data) => qc.setQueryData(KEY, data) });
};
