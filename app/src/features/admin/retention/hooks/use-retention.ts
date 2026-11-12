import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as service from "../services/retention.services";

const KEY = ["admin", "retention"] as const;

export const useRetentionPolicies = () => useQuery({ queryKey: KEY, queryFn: service.getRetentionPolicies });

function useInvalidate() {
    const qc = useQueryClient();
    return () => qc.invalidateQueries({ queryKey: KEY });
}

export const useUpdateRetentionPolicy = () => {
    const invalidate = useInvalidate();
    return useMutation({ mutationFn: service.updateRetentionPolicy, onSuccess: invalidate });
};
export const useSetLegalHold = () => {
    const invalidate = useInvalidate();
    return useMutation({ mutationFn: service.setLegalHold, onSuccess: invalidate });
};
export const useRunRetention = () => {
    const invalidate = useInvalidate();
    return useMutation({ mutationFn: service.runRetention, onSuccess: invalidate });
};
