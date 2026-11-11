import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { TIME_KEY } from "@/features/time/settings/hooks/use-time-settings";
import * as service from "../services/timesheets.services";

const KEY = [...TIME_KEY, "timesheets"] as const;

export const useWeek = (params: { period_start?: string; membership_id?: string }) =>
    useQuery({ queryKey: [...KEY, "week", params], queryFn: () => service.getWeek(params), placeholderData: keepPreviousData });
export const useTeamWeek = (params: Record<string, unknown>, enabled = true) =>
    useQuery({ queryKey: [...KEY, "team", params], queryFn: () => service.getTeamWeek(params), placeholderData: keepPreviousData, enabled });
export const useTimesheets = (params: Record<string, unknown>) =>
    useQuery({ queryKey: [...KEY, "list", params], queryFn: () => service.getTimesheets(params), placeholderData: keepPreviousData });
export const useTimesheet = (id: string | undefined) => useQuery({ queryKey: [...KEY, "detail", id], queryFn: () => service.getTimesheet(id as string), enabled: !!id });
export const useApprovals = (params: Record<string, unknown>, enabled = true) =>
    useQuery({ queryKey: [...KEY, "approvals", params], queryFn: () => service.getApprovals(params), placeholderData: keepPreviousData, enabled });

function useInvalidate() {
    const qc = useQueryClient();
    return () => qc.invalidateQueries({ queryKey: TIME_KEY });
}
export const useSubmitTimesheet = () => {
    const invalidate = useInvalidate();
    return useMutation({ mutationFn: service.submitTimesheet, onSuccess: invalidate });
};
export const useApproveTimesheet = () => {
    const invalidate = useInvalidate();
    return useMutation({ mutationFn: service.approveTimesheet, onSuccess: invalidate });
};
export const useRejectTimesheet = () => {
    const invalidate = useInvalidate();
    return useMutation({ mutationFn: service.rejectTimesheet, onSuccess: invalidate });
};
export const useReopenTimesheet = () => {
    const invalidate = useInvalidate();
    return useMutation({ mutationFn: service.reopenTimesheet, onSuccess: invalidate });
};
export const useUnlockTimesheet = () => {
    const invalidate = useInvalidate();
    return useMutation({ mutationFn: service.unlockTimesheet, onSuccess: invalidate });
};
export const useBulkDecideTimesheets = () => {
    const invalidate = useInvalidate();
    return useMutation({ mutationFn: service.bulkDecideTimesheets, onSuccess: invalidate });
};
