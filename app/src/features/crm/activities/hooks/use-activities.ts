import { keepPreviousData, useMutation, useQuery } from "@tanstack/react-query";
import { CRM_KEY, useCrmInvalidate } from "../../common/hooks/use-crm-invalidate";
import * as service from "../services/activities.services";

const KEY = [...CRM_KEY, "activities"] as const;

export const useActivities = (params: Record<string, unknown>, enabled = true) =>
    useQuery({ queryKey: [...KEY, "list", params], queryFn: () => service.getActivities(params), placeholderData: keepPreviousData, enabled });
export const useActivitySummary = (enabled = true) => useQuery({ queryKey: [...KEY, "summary"], queryFn: service.getActivitySummary, enabled });

export const useCreateActivity = () => useMutation({ mutationFn: service.createActivity, onSuccess: useCrmInvalidate() });
export const useUpdateActivity = () => useMutation({ mutationFn: service.updateActivity, onSuccess: useCrmInvalidate() });
export const useCompleteActivity = () => useMutation({ mutationFn: service.completeActivity, onSuccess: useCrmInvalidate() });
export const useDeleteActivity = () => useMutation({ mutationFn: service.deleteActivity, onSuccess: useCrmInvalidate() });
