import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { SESSION_QUERY_KEY } from "@/features/session/hooks/use-session";
import * as service from "../services/delegations.services";

const KEY = ["admin", "delegations"] as const;

export const useDelegations = (params: Record<string, unknown>) =>
    useQuery({ queryKey: [...KEY, "list", params], queryFn: () => service.getDelegations(params), placeholderData: keepPreviousData });

/** Delegations change effective permissions: refresh the list and the session (the caller may be the delegate). */
function useInvalidate() {
    const qc = useQueryClient();
    return () => {
        qc.invalidateQueries({ queryKey: KEY });
        qc.invalidateQueries({ queryKey: SESSION_QUERY_KEY });
    };
}

export const useCreateDelegation = () => {
    const invalidate = useInvalidate();
    return useMutation({ mutationFn: service.createDelegation, onSuccess: invalidate });
};
export const useRevokeDelegation = () => {
    const invalidate = useInvalidate();
    return useMutation({ mutationFn: service.revokeDelegation, onSuccess: invalidate });
};
