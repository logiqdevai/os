import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
    return useMutation({ mutationFn: service.confirmMcpCall, onSuccess: invalidate });
};
export const useRejectMcpCall = () => {
    const invalidate = useInvalidate();
    return useMutation({ mutationFn: service.rejectMcpCall, onSuccess: invalidate });
};
