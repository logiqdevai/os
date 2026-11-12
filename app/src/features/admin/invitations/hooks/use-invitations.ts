import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { patchEntity, useOptimisticMutation } from "@/lib/query/optimistic";
import * as service from "../services/invitations.services";

const KEY = ["admin", "invitations"] as const;

export const useInvitations = (params: Record<string, unknown>) =>
    useQuery({ queryKey: [...KEY, "list", params], queryFn: () => service.getInvitations(params), placeholderData: keepPreviousData });

function useInvalidate() {
    const qc = useQueryClient();
    return () => {
        qc.invalidateQueries({ queryKey: KEY });
        qc.invalidateQueries({ queryKey: ["admin", "overview"] });
    };
}

export const useCreateInvitations = () => {
    const invalidate = useInvalidate();
    return useMutation({ mutationFn: service.createInvitations, meta: { errorTitle: "Could not create invitations" }, onSettled: invalidate });
};
export const useResendInvitation = () => {
    const invalidate = useInvalidate();
    return useMutation({ mutationFn: service.resendInvitation, meta: { errorTitle: "Could not resend invitation" }, onSettled: invalidate });
};
/** Optimistic: the invitation shows Cancelled at once. */
export const useCancelInvitation = () =>
    useOptimisticMutation({ roots: [KEY], alsoInvalidate: [["admin", "overview"]], mutationFn: service.cancelInvitation, meta: { errorTitle: "Could not cancel the invitation" }, apply: (qc, id) => patchEntity(qc, KEY, id, { status: "CANCELLED" }) });
