import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CRM_KEY, useCrmInvalidate } from "../../common/hooks/use-crm-invalidate";
import * as service from "../services/deals.services";
import type { DealBoard } from "../interfaces/deals.interfaces";

const KEY = [...CRM_KEY, "deals"] as const;
const BOARD_KEY = [...KEY, "board"] as const;

export const useDeals = (params: Record<string, unknown>, enabled = true) =>
    useQuery({ queryKey: [...KEY, "list", params], queryFn: () => service.getDeals(params), placeholderData: keepPreviousData, enabled });
export const useDealBoard = (params: Record<string, unknown>, enabled = true) =>
    useQuery({ queryKey: [...BOARD_KEY, params], queryFn: () => service.getDealBoard(params), placeholderData: keepPreviousData, enabled });
export const useDeal = (id: string | undefined) => useQuery({ queryKey: [...KEY, "detail", id], queryFn: () => service.getDeal(id as string), enabled: !!id });

export const useCreateDeal = () => useMutation({ mutationFn: service.createDeal, onSuccess: useCrmInvalidate() });
export const useUpdateDeal = () => useMutation({ mutationFn: service.updateDeal, onSuccess: useCrmInvalidate() });
export const useReopenDeal = () => useMutation({ mutationFn: service.reopenDeal, onSuccess: useCrmInvalidate() });
export const useAssignDeal = () => useMutation({ mutationFn: service.assignDeal, onSuccess: useCrmInvalidate() });
export const useReplaceLineItems = () => useMutation({ mutationFn: service.replaceLineItems, onSuccess: useCrmInvalidate() });
export const useAddDealContact = () => useMutation({ mutationFn: service.addDealContact, onSuccess: useCrmInvalidate() });
export const useRemoveDealContact = () => useMutation({ mutationFn: service.removeDealContact, onSuccess: useCrmInvalidate() });
export const useArchiveDeal = () => useMutation({ mutationFn: service.archiveDeal, onSuccess: useCrmInvalidate() });
export const useDeleteDeal = () => useMutation({ mutationFn: service.deleteDeal, onSuccess: useCrmInvalidate() });
export const useExportDeals = () => useMutation({ mutationFn: service.exportDeals });

/**
 * Stage change with an optimistic board update (drag and drop): the card moves immediately and the board
 * rolls back if the API refuses (403, lost reason missing…).
 */
export const useChangeDealStage = () => {
    const qc = useQueryClient();
    const invalidate = useCrmInvalidate();
    return useMutation({
        mutationFn: service.changeDealStage,
        onMutate: async (vars) => {
            await qc.cancelQueries({ queryKey: BOARD_KEY });
            const snapshots = qc.getQueriesData<DealBoard>({ queryKey: BOARD_KEY });
            for (const [key, board] of snapshots) {
                if (!board) continue;
                const from = board.stages.find((s) => s.deals.some((d) => d.id === vars.id));
                const to = board.stages.find((s) => s.id === vars.stage_id);
                const deal = from?.deals.find((d) => d.id === vars.id);
                if (!from || !to || !deal || from.id === to.id) continue;
                qc.setQueryData<DealBoard>(key, {
                    ...board,
                    stages: board.stages.map((s) =>
                        s.id === from.id ? { ...s, count: s.count - 1, deals: s.deals.filter((d) => d.id !== vars.id) }
                            : s.id === to.id ? { ...s, count: s.count + 1, deals: [{ ...deal, stage_id: to.id, stage: { ...deal.stage, ...to }, probability: vars.probability ?? to.probability }, ...s.deals] }
                                : s,
                    ),
                });
            }
            return { snapshots };
        },
        onError: (_e, _v, context) => {
            context?.snapshots.forEach(([key, data]) => qc.setQueryData(key, data));
        },
        onSettled: invalidate,
    });
};
