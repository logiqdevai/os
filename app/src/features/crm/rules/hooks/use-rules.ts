import { useMutation, useQuery } from "@tanstack/react-query";
import { CRM_KEY, useCrmInvalidate } from "../../common/hooks/use-crm-invalidate";
import * as service from "../services/rules.services";

const KEY = [...CRM_KEY, "rules"] as const;

export const useRuleFields = (enabled = true) => useQuery({ queryKey: [...KEY, "fields"], queryFn: service.getRuleFields, staleTime: 60_000, enabled });
export const useAssignmentRules = (enabled = true) => useQuery({ queryKey: [...KEY, "assignment"], queryFn: service.getAssignmentRules, enabled });
export const useScoringRules = (enabled = true) => useQuery({ queryKey: [...KEY, "scoring"], queryFn: service.getScoringRules, enabled });
export const useTargetAttainment = (params: { date?: string; owner?: string; period?: string }, enabled = true) =>
    useQuery({ queryKey: [...CRM_KEY, "targets", "attainment", params], queryFn: () => service.getTargetAttainment(params), enabled });
export const useBranchOptions = (enabled: boolean) => useQuery({ queryKey: [...KEY, "branches"], queryFn: service.getBranchOptions, staleTime: 5 * 60_000, enabled });
export const useTargets = (params: { year?: number; period?: string }) => useQuery({ queryKey: [...CRM_KEY, "targets", "list", params], queryFn: () => service.getTargets(params) });

export const useCreateAssignmentRule = () => useMutation({ mutationFn: service.createAssignmentRule, onSuccess: useCrmInvalidate() });
export const useUpdateAssignmentRule = () => useMutation({ mutationFn: service.updateAssignmentRule, onSuccess: useCrmInvalidate() });
export const useDeleteAssignmentRule = () => useMutation({ mutationFn: service.deleteAssignmentRule, onSuccess: useCrmInvalidate() });
export const useCreateScoringRule = () => useMutation({ mutationFn: service.createScoringRule, onSuccess: useCrmInvalidate() });
export const useUpdateScoringRule = () => useMutation({ mutationFn: service.updateScoringRule, onSuccess: useCrmInvalidate() });
export const useDeleteScoringRule = () => useMutation({ mutationFn: service.deleteScoringRule, onSuccess: useCrmInvalidate() });
export const useRecalculateScores = () => useMutation({ mutationFn: service.recalculateScores, onSuccess: useCrmInvalidate() });
export const useCreateTarget = () => useMutation({ mutationFn: service.createTarget, onSuccess: useCrmInvalidate() });
export const useUpdateTarget = () => useMutation({ mutationFn: service.updateTarget, onSuccess: useCrmInvalidate() });
export const useDeleteTarget = () => useMutation({ mutationFn: service.deleteTarget, onSuccess: useCrmInvalidate() });
