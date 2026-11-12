import { useQuery } from "@tanstack/react-query";
import { CRM_KEY, useCrmMutation, useCrmRemove, type CrmMutationMeta } from "../../common/hooks/use-crm-invalidate";
import { useOptimisticMutation } from "@/lib/query/optimistic";
import type { AssignmentRule, ScoringRule } from "../interfaces/rules.interfaces";
import * as service from "../services/rules.services";

const KEY = [...CRM_KEY, "rules"] as const;
const TARGETS_KEY = [...CRM_KEY, "targets"] as const;

export const useRuleFields = (enabled = true) => useQuery({ queryKey: [...KEY, "fields"], queryFn: service.getRuleFields, staleTime: 60_000, enabled });
export const useAssignmentRules = (enabled = true) => useQuery({ queryKey: [...KEY, "assignment"], queryFn: service.getAssignmentRules, enabled });
export const useScoringRules = (enabled = true) => useQuery({ queryKey: [...KEY, "scoring"], queryFn: service.getScoringRules, enabled });
export const useTargetAttainment = (params: { date?: string; owner?: string; period?: string }, enabled = true) =>
    useQuery({ queryKey: [...TARGETS_KEY, "attainment", params], queryFn: () => service.getTargetAttainment(params), enabled });
export const useBranchOptions = (enabled: boolean) => useQuery({ queryKey: [...KEY, "branches"], queryFn: service.getBranchOptions, staleTime: 5 * 60_000, enabled });
export const useTargets = (params: { year?: number; period?: string }) => useQuery({ queryKey: [...TARGETS_KEY, "list", params], queryFn: () => service.getTargets(params) });

/** Rule and target dialogs show API errors inline. */
const INLINE: CrmMutationMeta = { errorToast: false };

export const useCreateAssignmentRule = () => useCrmMutation(service.createAssignmentRule, INLINE);
/** Optimistic (enable toggle, reorder): the list re-sorts by priority at once. Dialog saves pass `{ errorToast: false }`. */
export const useUpdateAssignmentRule = (meta: CrmMutationMeta = { errorTitle: "Could not update rule" }) =>
    useOptimisticMutation({
        roots: [KEY],
        alsoInvalidate: [CRM_KEY],
        meta,
        mutationFn: service.updateAssignmentRule,
        apply: (qc, { id, ...body }) =>
            qc.setQueriesData<AssignmentRule[]>({ queryKey: [...KEY, "assignment"] }, (d) =>
                d?.map((r) => (r.id === id ? { ...r, ...body } : r)).sort((a, b) => a.priority - b.priority),
            ),
    });
export const useDeleteAssignmentRule = () => useCrmRemove(KEY, service.deleteAssignmentRule, { errorTitle: "Could not delete rule" });
export const useCreateScoringRule = () => useCrmMutation(service.createScoringRule, INLINE);
/** Optimistic (enable toggle). Dialog saves pass `{ errorToast: false }`. */
export const useUpdateScoringRule = (meta: CrmMutationMeta = { errorTitle: "Could not update rule" }) =>
    useOptimisticMutation({
        roots: [KEY],
        alsoInvalidate: [CRM_KEY],
        meta,
        mutationFn: service.updateScoringRule,
        apply: (qc, { id, ...body }) => qc.setQueriesData<ScoringRule[]>({ queryKey: [...KEY, "scoring"] }, (d) => d?.map((r) => (r.id === id ? { ...r, ...body } : r))),
    });
export const useDeleteScoringRule = () => useCrmRemove(KEY, service.deleteScoringRule, { errorTitle: "Could not delete rule" });
export const useRecalculateScores = () => useCrmMutation(service.recalculateScores, { errorTitle: "Could not recalculate" });
export const useCreateTarget = () => useCrmMutation(service.createTarget, INLINE);
export const useUpdateTarget = () => useCrmMutation(service.updateTarget, INLINE);
export const useDeleteTarget = () => useCrmRemove(TARGETS_KEY, service.deleteTarget, { errorTitle: "Could not delete target" });
