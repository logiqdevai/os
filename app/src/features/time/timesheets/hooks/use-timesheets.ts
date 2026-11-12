import { keepPreviousData, useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { patchEntity, removeEntity, useOptimisticMutation } from "@/lib/query/optimistic";
import { TIME_KEY } from "@/features/time/settings/hooks/use-time-settings";
import * as service from "../services/timesheets.services";

const KEY = [...TIME_KEY, "timesheets"] as const;
const APPROVALS = [...KEY, "approvals"] as const;

export const useWeek = (params: { period_start?: string; membership_id?: string }) =>
    useQuery({ queryKey: [...KEY, "week", params], queryFn: () => service.getWeek(params), placeholderData: keepPreviousData });
export const useTeamWeek = (params: Record<string, unknown>, enabled = true) =>
    useQuery({ queryKey: [...KEY, "team", params], queryFn: () => service.getTeamWeek(params), placeholderData: keepPreviousData, enabled });
export const useTimesheets = (params: Record<string, unknown>) =>
    useQuery({ queryKey: [...KEY, "list", params], queryFn: () => service.getTimesheets(params), placeholderData: keepPreviousData });
export const useTimesheet = (id: string | undefined) => useQuery({ queryKey: [...KEY, "detail", id], queryFn: () => service.getTimesheet(id as string), enabled: !!id });
export const useApprovals = (params: Record<string, unknown>, enabled = true) =>
    useQuery({ queryKey: [...KEY, "approvals", params], queryFn: () => service.getApprovals(params), placeholderData: keepPreviousData, enabled });

/*
 * Timesheet actions. No success toasts: the status badge / approvals queue shows the result. Failures are toasted once
 * globally. Decisions are optimistic: the timesheet leaves "Approvals" and shows its new status at once; the whole Time
 * area refreshes when they settle (entries get approved / locked on the server).
 */
const decided = (status: string) => (qc: QueryClient, { id }: { id: string }) => {
    removeEntity(qc, APPROVALS, id);
    patchEntity(qc, TIME_KEY, id, { status });
};

/** Submitting is an explicit, outward action: the dialog waits for the server (rules can refuse) and closes on success. */
export const useSubmitTimesheet = () => {
    const qc = useQueryClient();
    return useMutation({ mutationFn: service.submitTimesheet, meta: { errorTitle: "Could not submit the week" }, onSettled: () => qc.invalidateQueries({ queryKey: TIME_KEY }) });
};
export const useApproveTimesheet = () =>
    useOptimisticMutation({ roots: [TIME_KEY], meta: { errorTitle: "Could not approve the timesheet" }, mutationFn: service.approveTimesheet, apply: decided("APPROVED") });
export const useRejectTimesheet = () =>
    useOptimisticMutation({ roots: [TIME_KEY], meta: { errorTitle: "Could not return the timesheet" }, mutationFn: service.rejectTimesheet, apply: decided("REJECTED") });
export const useReopenTimesheet = () =>
    useOptimisticMutation({ roots: [TIME_KEY], meta: { errorTitle: "Could not reopen the timesheet" }, mutationFn: service.reopenTimesheet, apply: (qc, { id }) => patchEntity(qc, TIME_KEY, id, { status: "OPEN" }) });
export const useUnlockTimesheet = () => {
    const qc = useQueryClient();
    return useMutation({ mutationFn: service.unlockTimesheet, meta: { errorTitle: "Could not unlock the timesheet" }, onSettled: () => qc.invalidateQueries({ queryKey: TIME_KEY }) });
};
/** Bulk approve / return: the rows leave the queue at once; per-row failures come back and the caller toasts them. */
export const useBulkDecideTimesheets = () =>
    useOptimisticMutation({
        roots: [TIME_KEY],
        meta: { errorTitle: "Could not decide the timesheets" },
        mutationFn: service.bulkDecideTimesheets,
        apply: (qc, { ids }) => { for (const id of ids) removeEntity(qc, APPROVALS, id); },
    });
