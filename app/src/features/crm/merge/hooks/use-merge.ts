import { useQuery } from "@tanstack/react-query";
import { CRM_KEY, useCrmMutation } from "../../common/hooks/use-crm-invalidate";
import { useOptimisticMutation } from "@/lib/query/optimistic";
import type { DuplicateEntity, DuplicatesResult, MergeEntity } from "../interfaces/merge.interfaces";
import * as service from "../services/merge.services";

const KEY = [...CRM_KEY, "merge"] as const;

export const useDuplicates = (params: { entity_type: DuplicateEntity; match?: string; min_score?: number }, enabled = true) =>
    useQuery({ queryKey: [...KEY, "duplicates", params], queryFn: () => service.getDuplicates({ ...params, limit: 100 }), enabled });
export const useDuplicateRules = (enabled = true) => useQuery({ queryKey: [...KEY, "rules"], queryFn: service.getDuplicateRules, enabled });
export const useMergePreview = (entity_type: MergeEntity | undefined, ids: string[]) =>
    useQuery({ queryKey: [...KEY, "preview", entity_type, ids], queryFn: () => service.getMergePreview({ entity_type: entity_type as MergeEntity, ids }), enabled: !!entity_type && ids.length >= 2, gcTime: 0 });

/** Optimistic: the pair leaves the duplicates list at once. */
export const useDismissDuplicate = () =>
    useOptimisticMutation({
        roots: [[...KEY, "duplicates"]],
        alsoInvalidate: [CRM_KEY],
        meta: { errorTitle: "Could not dismiss" },
        mutationFn: service.dismissDuplicate,
        apply: (qc, v) =>
            qc.setQueriesData<DuplicatesResult>({ queryKey: [...KEY, "duplicates"] }, (d) => {
                if (!d?.data) return d;
                const ids = [v.record_a_id, v.record_b_id];
                const data = d.data.filter((p) => !(ids.includes(p.records[0].id) && ids.includes(p.records[1].id)));
                return { ...d, data, total: Math.max(0, d.total - (d.data.length - data.length)) };
            }),
    });
export const useSaveDuplicateRule = () => useCrmMutation(service.saveDuplicateRule, { errorTitle: "Could not save the rule" });
export const useMergeRecords = () => useCrmMutation(service.mergeRecords, { errorTitle: "Could not merge" });
