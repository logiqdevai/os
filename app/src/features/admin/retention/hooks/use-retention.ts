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
    return useMutation({ mutationFn: service.updateRetentionPolicy, meta: { errorToast: false } /* autosaved per row; the row's <SaveStatus /> shows failures */, onSettled: invalidate });
};
export const useSetLegalHold = () => {
    const invalidate = useInvalidate();
    return useMutation({ mutationFn: service.setLegalHold, meta: { errorTitle: "Could not set legal hold" }, onSettled: invalidate });
};
export const useRunRetention = () => {
    const invalidate = useInvalidate();
    return useMutation({ mutationFn: service.runRetention, meta: { errorTitle: "Could not run retention" }, onSettled: invalidate });
};
