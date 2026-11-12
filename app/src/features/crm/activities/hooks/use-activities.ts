import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { CRM_KEY, useCrmMutation, useCrmRemove, useCrmUpdate, type CrmMutationMeta } from "../../common/hooks/use-crm-invalidate";
import { useOptimisticMutation, patchEntity } from "@/lib/query/optimistic";
import * as service from "../services/activities.services";

const KEY = [...CRM_KEY, "activities"] as const;

export const useActivities = (params: Record<string, unknown>, enabled = true) =>
    useQuery({ queryKey: [...KEY, "list", params], queryFn: () => service.getActivities(params), placeholderData: keepPreviousData, enabled });
export const useActivitySummary = (enabled = true) => useQuery({ queryKey: [...KEY, "summary"], queryFn: service.getActivitySummary, enabled });

export const useCreateActivity = (meta: CrmMutationMeta = { errorTitle: "Could not save activity" }) => useCrmMutation(service.createActivity, meta);
export const useUpdateActivity = () => useCrmUpdate(KEY, service.updateActivity, { errorTitle: "Could not update activity" });
/** Optimistic: the activity shows as completed at once. */
export const useCompleteActivity = () =>
    useOptimisticMutation({
        roots: [KEY],
        alsoInvalidate: [CRM_KEY],
        meta: { errorTitle: "Could not complete activity" },
        mutationFn: service.completeActivity,
        apply: (qc, { id, outcome }) => patchEntity(qc, KEY, id, { status: "COMPLETED", completed_at: new Date().toISOString(), ...(outcome ? { outcome } : {}) }),
    });
export const useDeleteActivity = () => useCrmRemove(KEY, service.deleteActivity, { errorTitle: "Could not delete activity" });
