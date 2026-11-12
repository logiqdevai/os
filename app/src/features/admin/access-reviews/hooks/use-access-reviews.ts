import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { SESSION_QUERY_KEY } from "@/features/session/hooks/use-session";
import * as service from "../services/access-reviews.services";
import { patchEntity, useOptimisticMutation } from "@/lib/query/optimistic";

const KEY = ["admin", "access-reviews"] as const;

export const useAccessReviews = (params: Record<string, unknown>) =>
    useQuery({ queryKey: [...KEY, "list", params], queryFn: () => service.getAccessReviews(params), placeholderData: keepPreviousData });
export const useAccessReview = (id: string | undefined) => useQuery({ queryKey: [...KEY, "detail", id], queryFn: () => service.getAccessReview(id as string), enabled: !!id });
export const useAccessReviewItems = (id: string | undefined, params: Record<string, unknown>) =>
    useQuery({ queryKey: [...KEY, "items", id, params], queryFn: () => service.getAccessReviewItems(id as string, params), enabled: !!id, placeholderData: keepPreviousData });

function useInvalidate(alsoSession = false) {
    const qc = useQueryClient();
    return () => {
        qc.invalidateQueries({ queryKey: KEY });
        if (alsoSession) {
            qc.invalidateQueries({ queryKey: SESSION_QUERY_KEY });
            qc.invalidateQueries({ queryKey: ["admin", "members"] });
        }
    };
}

export const useCreateAccessReview = () => {
    const invalidate = useInvalidate();
    return useMutation({ mutationFn: service.createAccessReview, meta: { errorTitle: "Could not create access review" }, onSettled: invalidate });
};
export const useStartAccessReview = () => {
    const invalidate = useInvalidate();
    return useMutation({ mutationFn: service.startAccessReview, meta: { errorTitle: "Could not start access review" }, onSettled: invalidate });
};
/** Applying changes roles / grants / module access, so member data and the session are refreshed too. */
export const useApplyAccessReview = () => {
    const invalidate = useInvalidate(true);
    return useMutation({ mutationFn: service.applyAccessReview, meta: { errorTitle: "Could not apply access review" }, onSettled: invalidate });
};
export const useCompleteAccessReview = () => {
    const invalidate = useInvalidate();
    return useMutation({ mutationFn: service.completeAccessReview, meta: { errorTitle: "Could not complete access review" }, onSettled: invalidate });
};
export const useCancelAccessReview = () => {
    const invalidate = useInvalidate();
    return useMutation({ mutationFn: service.cancelAccessReview, meta: { errorTitle: "Could not cancel access review" }, onSettled: invalidate });
};
/** Optimistic: the item shows Kept / Revoked / Changed at once; counts refresh after. */
export const useDecideAccessReviewItem = () =>
    useOptimisticMutation({
        roots: [KEY],
        mutationFn: service.decideAccessReviewItem,
        meta: { errorTitle: "Could not save the decision" },
        apply: (qc, v) => patchEntity(qc, KEY, v.itemId, { decision: v.decision, comment: v.comment ?? null, decided_at: new Date().toISOString() }),
    });
export const useReassignAccessReviewItem = () => {
    const invalidate = useInvalidate();
    return useMutation({ mutationFn: service.reassignAccessReviewItem, meta: { errorTitle: "Could not reassign access review item" }, onSettled: invalidate });
};
