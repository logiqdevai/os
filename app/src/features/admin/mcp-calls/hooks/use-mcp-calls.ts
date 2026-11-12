import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { patchEntity, useOptimisticMutation } from "@/lib/query/optimistic";
import * as service from "../services/mcp-calls.services";

const KEY = ["admin", "mcp-calls"] as const;

export const useMcpCalls = (params: Record<string, unknown>) =>
    useQuery({ queryKey: [...KEY, "list", params], queryFn: () => service.getMcpCalls(params), placeholderData: keepPreviousData, refetchInterval: 30_000 });

function useInvalidate() {
    const qc = useQueryClient();
    return () => {
        qc.invalidateQueries({ queryKey: KEY });
        qc.invalidateQueries({ queryKey: ["admin", "overview"] });
    };
}

export const useConfirmMcpCall = () => {
    const invalidate = useInvalidate();
    return useMutation({ mutationFn: service.confirmMcpCall, meta: { errorTitle: "Could not confirm MCP call" }, onSettled: invalidate });
};
/** Optimistic: the call shows Rejected at once (confirming runs the tool, so it waits for the result). */
export const useRejectMcpCall = () =>
    useOptimisticMutation({ roots: [KEY], alsoInvalidate: [["admin", "overview"]], mutationFn: service.rejectMcpCall, meta: { errorTitle: "Could not reject the call" }, apply: (qc, id) => patchEntity(qc, KEY, id, { status: "REJECTED" }) });
