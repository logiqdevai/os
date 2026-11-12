import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { removeEntity, useOptimisticMutation } from "@/lib/query/optimistic";
import * as service from "../services/sessions.services";

const KEY = ["admin", "sessions"] as const;

export const useAdminSessions = (params: Record<string, unknown>) =>
    useQuery({ queryKey: [...KEY, "list", params], queryFn: () => service.getSessions(params), placeholderData: keepPreviousData });

function useInvalidate() {
    const qc = useQueryClient();
    return () => qc.invalidateQueries({ queryKey: KEY });
}

/** Optimistic: the session row disappears at once. */
export const useRevokeSession = () =>
    useOptimisticMutation({ roots: [KEY], mutationFn: service.revokeSession, meta: { errorTitle: "Could not revoke the session" }, apply: (qc, v) => removeEntity(qc, KEY, v.id) });
export const useRevokeAllSessions = () => {
    const invalidate = useInvalidate();
    return useMutation({ mutationFn: service.revokeAllSessions, meta: { errorTitle: "Could not revoke all sessions" }, onSettled: invalidate });
};
