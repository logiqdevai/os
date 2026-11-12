import { keepPreviousData, useMutation, useQuery, type QueryClient } from "@tanstack/react-query";
import { CRM_KEY, useCrmArchive, useCrmMutation, useCrmRemove, useCrmUpdate, type CrmMutationMeta } from "../../common/hooks/use-crm-invalidate";
import { patchEntity, useOptimisticMutation } from "@/lib/query/optimistic";
import * as service from "../services/deals.services";
import type { ChangeStageDto, DealBoard, DealStageRef } from "../interfaces/deals.interfaces";

const KEY = [...CRM_KEY, "deals"] as const;
const BOARD_KEY = [...KEY, "board"] as const;

export const useDeals = (params: Record<string, unknown>, enabled = true) =>
    useQuery({ queryKey: [...KEY, "list", params], queryFn: () => service.getDeals(params), placeholderData: keepPreviousData, enabled });
export const useDealBoard = (params: Record<string, unknown>, enabled = true) =>
    useQuery({ queryKey: [...BOARD_KEY, params], queryFn: () => service.getDealBoard(params), placeholderData: keepPreviousData, enabled });
export const useDeal = (id: string | undefined) => useQuery({ queryKey: [...KEY, "detail", id], queryFn: () => service.getDeal(id as string), enabled: !!id });

export const useCreateDeal = (meta: CrmMutationMeta = { errorTitle: "Could not create deal" }) => useCrmMutation(service.createDeal, meta);
/** Optimistic; pass display objects through `optimistic` (e.g. `{ owner }`). */
export const useUpdateDeal = () => useCrmUpdate(KEY, service.updateDeal, { errorTitle: "Could not update deal" });
export const useAssignDeal = () => useCrmUpdate(KEY, service.assignDeal, { errorTitle: "Could not assign deal" });
/** Autosaved by the line-items editor, which shows failures in its <SaveStatus /> (no toast). */
export const useReplaceLineItems = () => useCrmMutation(service.replaceLineItems, { errorToast: false });
export const useAddDealContact = () => useCrmMutation(service.addDealContact, { errorTitle: "Could not add contact" });
/** Optimistic: the contact leaves the deal's contact list at once. */
export const useRemoveDealContact = () =>
    useOptimisticMutation({
        roots: [KEY],
        alsoInvalidate: [CRM_KEY],
        meta: { errorTitle: "Could not remove contact" },
        mutationFn: service.removeDealContact,
        apply: (qc, { id, contact_id }) =>
            patchEntity<{ id: string; contacts?: { contact_id: string }[] }>(qc, KEY, id, (d) => (d.contacts ? { ...d, contacts: d.contacts.filter((c) => c.contact_id !== contact_id) } : d)),
    });
export const useArchiveDeal = () => useCrmArchive(KEY, service.archiveDeal, { errorTitle: "Could not archive deal" });
export const useDeleteDeal = () => useCrmRemove(KEY, service.deleteDeal, { errorTitle: "Could not delete deal" });
export const useExportDeals = () => useMutation({ mutationFn: service.exportDeals, meta: { errorTitle: "Could not export" } });

/** Move a deal card to another stage on every cached board. */
function moveOnBoards(qc: QueryClient, id: string, stageId: string, probability: number | undefined) {
    for (const [key, board] of qc.getQueriesData<DealBoard>({ queryKey: BOARD_KEY })) {
        if (!board?.stages) continue;
        const from = board.stages.find((s) => s.deals.some((d) => d.id === id));
        const to = board.stages.find((s) => s.id === stageId);
        const deal = from?.deals.find((d) => d.id === id);
        if (!from || !to || !deal || from.id === to.id) continue;
        qc.setQueryData<DealBoard>(key, {
            ...board,
            stages: board.stages.map((s) =>
                s.id === from.id ? { ...s, count: s.count - 1, deals: s.deals.filter((d) => d.id !== id) }
                    : s.id === to.id ? { ...s, count: s.count + 1, deals: [{ ...deal, stage_id: to.id, stage: { ...deal.stage, ...to }, probability: probability ?? to.probability }, ...s.deals] }
                        : s,
            ),
        });
    }
}

type StageVars = ChangeStageDto & { id: string; /** Display object of the target stage (never sent). */ stage?: DealStageRef };

/**
 * Stage change (board drag and drop, detail stage bar, close won/lost): the card moves and the detail page shows the
 * new stage at once; everything rolls back if the API refuses (403, lost reason missing…).
 */
export const useChangeDealStage = () =>
    useOptimisticMutation<unknown, StageVars>({
        roots: [KEY],
        alsoInvalidate: [CRM_KEY],
        meta: { errorTitle: "Could not change the stage" },
        mutationFn: ({ stage: _s, ...dto }) => service.changeDealStage(dto),
        apply: (qc, { id, stage_id, probability, stage }) => {
            moveOnBoards(qc, id, stage_id, probability);
            if (stage) {
                const status = stage.is_won ? "WON" : stage.is_lost ? "LOST" : "OPEN";
                patchEntity(qc, KEY, id, { stage_id, stage, status, probability: probability ?? stage.probability });
            }
        },
    });

/** Reopen a won/lost deal (optionally into a given stage): the page shows it open at once. */
export const useReopenDeal = () =>
    useOptimisticMutation<unknown, { id: string; stage_id?: string; stage?: DealStageRef }>({
        roots: [KEY],
        alsoInvalidate: [CRM_KEY],
        meta: { errorTitle: "Could not reopen the deal" },
        mutationFn: ({ stage: _s, ...dto }) => service.reopenDeal(dto),
        apply: (qc, { id, stage_id, stage }) => patchEntity(qc, KEY, id, { status: "OPEN", ...(stage_id && stage ? { stage_id, stage } : {}) }),
    });
