import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
    return useMutation({ mutationFn: service.createInvitations, onSuccess: invalidate });
};
export const useResendInvitation = () => {
    const invalidate = useInvalidate();
    return useMutation({ mutationFn: service.resendInvitation, onSuccess: invalidate });
};
export const useCancelInvitation = () => {
    const invalidate = useInvalidate();
    return useMutation({ mutationFn: service.cancelInvitation, onSuccess: invalidate });
};
