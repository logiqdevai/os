import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as service from "../services/sessions.services";

const KEY = ["admin", "sessions"] as const;

export const useAdminSessions = (params: Record<string, unknown>) =>
    useQuery({ queryKey: [...KEY, "list", params], queryFn: () => service.getSessions(params), placeholderData: keepPreviousData });

function useInvalidate() {
    const qc = useQueryClient();
    return () => qc.invalidateQueries({ queryKey: KEY });
}

export const useRevokeSession = () => {
    const invalidate = useInvalidate();
    return useMutation({ mutationFn: service.revokeSession, onSuccess: invalidate });
};
export const useRevokeAllSessions = () => {
    const invalidate = useInvalidate();
    return useMutation({ mutationFn: service.revokeAllSessions, onSuccess: invalidate });
};
