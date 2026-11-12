import { useMutation, useQuery } from "@tanstack/react-query";
import { CRM_KEY, useCrmInvalidate } from "../../common/hooks/use-crm-invalidate";
import type { DuplicateEntity, MergeEntity } from "../interfaces/merge.interfaces";
import * as service from "../services/merge.services";

const KEY = [...CRM_KEY, "merge"] as const;

export const useDuplicates = (params: { entity_type: DuplicateEntity; match?: string; min_score?: number }, enabled = true) =>
    useQuery({ queryKey: [...KEY, "duplicates", params], queryFn: () => service.getDuplicates({ ...params, limit: 100 }), enabled });
export const useDuplicateRules = (enabled = true) => useQuery({ queryKey: [...KEY, "rules"], queryFn: service.getDuplicateRules, enabled });
export const useMergePreview = (entity_type: MergeEntity | undefined, ids: string[]) =>
    useQuery({ queryKey: [...KEY, "preview", entity_type, ids], queryFn: () => service.getMergePreview({ entity_type: entity_type as MergeEntity, ids }), enabled: !!entity_type && ids.length >= 2, gcTime: 0 });

export const useDismissDuplicate = () => useMutation({ mutationFn: service.dismissDuplicate, onSuccess: useCrmInvalidate() });
export const useSaveDuplicateRule = () => useMutation({ mutationFn: service.saveDuplicateRule, onSuccess: useCrmInvalidate() });
export const useMergeRecords = () => useMutation({ mutationFn: service.mergeRecords, onSuccess: useCrmInvalidate() });
