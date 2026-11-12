import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { PEOPLE_KEY, usePeopleMutation } from "@/features/people/employees/hooks/use-employees";
import { patchEntity, removeEntity, useEntityRemove, useEntityUpdate, useOptimisticMutation } from "@/lib/query/optimistic";
import type { LeaveRequestDto, LeaveRequestStatus } from "../interfaces/leave.interfaces";
import * as service from "../services/leave.services";

const KEY = [...PEOPLE_KEY, "leave"] as const;

export const useLeaveRequests = (params: Record<string, unknown>, enabled = true) =>
    useQuery({ queryKey: [...KEY, "requests", params], queryFn: () => service.getLeaveRequests(params), placeholderData: keepPreviousData, enabled });
export const useLeaveRequest = (id: string | undefined) => useQuery({ queryKey: [...KEY, "request", id], queryFn: () => service.getLeaveRequest(id as string), enabled: !!id });
export const useLeavePreview = (dto: LeaveRequestDto | null) =>
    useQuery({ queryKey: [...KEY, "preview", dto], queryFn: () => service.previewLeave(dto as LeaveRequestDto), enabled: !!dto, retry: false });
export const useLeaveCalendar = (params: { from: string; to: string; team_id?: string }, enabled = true) =>
    useQuery({ queryKey: [...KEY, "calendar", params], queryFn: () => service.getLeaveCalendar(params), placeholderData: keepPreviousData, enabled });
export const useLeaveBalances = (params: Record<string, unknown>, enabled = true) =>
    useQuery({ queryKey: [...KEY, "balances", params], queryFn: () => service.getLeaveBalances(params), placeholderData: keepPreviousData, enabled });
export const useLeaveTransactions = (id: string | undefined) => useQuery({ queryKey: [...KEY, "transactions", id], queryFn: () => service.getLeaveTransactions(id as string), enabled: !!id });
export const useLeaveTypes = (enabled = true, archived = false) => useQuery({ queryKey: [...KEY, "types", archived], queryFn: () => service.getLeaveTypes(archived), enabled, staleTime: 60_000 });
export const useLeavePolicies = (enabled = true) => useQuery({ queryKey: [...KEY, "policies"], queryFn: service.getLeavePolicies, enabled });
export const usePolicyAssignments = (id: string | undefined) => useQuery({ queryKey: [...KEY, "policy-assignments", id], queryFn: () => service.getPolicyAssignments(id as string), enabled: !!id });
export const useBranchHolidays = (year?: number, enabled = true) => useQuery({ queryKey: [...KEY, "branch-holidays", year], queryFn: () => service.getBranchHolidays(year), enabled });
export const useHolidays = (year?: number, enabled = true) => useQuery({ queryKey: [...KEY, "holidays", year], queryFn: () => service.getHolidays(year), enabled });

const useMutate = usePeopleMutation;
const meta = (errorTitle: string) => ({ errorTitle });
/** Patch a leave request's status everywhere (lists, detail, calendar days follow on refresh). */
const decide = (status: LeaveRequestStatus, errorTitle: string, fn: (v: { id: string; note?: string }) => Promise<unknown>) =>
    function useDecide() {
        return useOptimisticMutation({
            roots: [KEY],
            alsoInvalidate: [PEOPLE_KEY],
            mutationFn: fn,
            meta: meta(errorTitle),
            apply: (qc, v) => patchEntity(qc, KEY, v.id, { status, decision_note: v.note ?? null }),
        });
    };

export const useCreateLeave = () => useMutate(service.createLeave, "Could not request leave", false);
/** Optimistic: the request shows Approved / Rejected at once; balances refresh after. */
export const useApproveLeave = decide("APPROVED", "Could not approve the leave", service.approveLeave);
export const useRejectLeave = decide("REJECTED", "Could not reject the leave", service.rejectLeave);
export const useCancelLeave = () =>
    useOptimisticMutation({
        roots: [KEY],
        alsoInvalidate: [PEOPLE_KEY],
        mutationFn: service.cancelLeave,
        meta: meta("Could not cancel the leave"),
        apply: (qc, v) => patchEntity(qc, KEY, v.id, { status: "CANCELLED" }),
    });
export const useAdjustBalance = () => useMutate(service.adjustBalance, "Could not adjust the balance");
export const useCreateHoliday = () => useMutate(service.createHoliday, "Could not add the holiday");
/** Optimistic: the holiday disappears at once. */
export const useRemoveHoliday = () => useEntityRemove({ root: KEY, mutationFn: service.removeHoliday, alsoInvalidate: [PEOPLE_KEY], meta: meta("Could not remove the holiday") });
export const useCreateLeaveType = () => useMutate(service.createLeaveType, "Could not create the leave type");
/** Optimistic: edits show at once in the leave-type list. */
export const useUpdateLeaveType = () => useEntityUpdate({ root: KEY, mutationFn: service.updateLeaveType, alsoInvalidate: [PEOPLE_KEY], meta: meta("Could not update the leave type") });
/** Optimistic: the type moves out of the current (active / archived) list at once. */
export const useSetLeaveTypeArchived = () =>
    useOptimisticMutation({ roots: [[...KEY, "types"]], alsoInvalidate: [PEOPLE_KEY], mutationFn: service.setLeaveTypeArchived, meta: meta("Could not update the leave type"), apply: (qc, v) => removeEntity(qc, [...KEY, "types"], v.id) });
export const useCreateLeavePolicy = () => useMutate(service.createLeavePolicy, "Could not create the leave policy");
/** Optimistic: edits show at once in the policy list. */
export const useUpdateLeavePolicy = () => useEntityUpdate({ root: KEY, mutationFn: service.updateLeavePolicy, alsoInvalidate: [PEOPLE_KEY], meta: meta("Could not update the leave policy") });
/** Optimistic: the policy disappears at once. */
export const useArchiveLeavePolicy = () => useEntityRemove({ root: [...KEY, "policies"], mutationFn: service.archiveLeavePolicy, alsoInvalidate: [PEOPLE_KEY], meta: meta("Could not archive the leave policy") });
export const useAssignLeavePolicy = () => useMutate(service.assignLeavePolicy, "Could not assign the leave policy");
/** Optimistic: edits show at once in the holiday list. */
export const useUpdateHoliday = () => useEntityUpdate({ root: KEY, mutationFn: service.updateHoliday, alsoInvalidate: [PEOPLE_KEY], meta: meta("Could not update the holiday") });
export const useCreateBranchHoliday = () => useMutate(service.createBranchHoliday, "Could not add the branch holiday");
/** Optimistic: the branch holiday disappears at once. */
export const useRemoveBranchHoliday = () => useEntityRemove({ root: KEY, mutationFn: service.removeBranchHoliday, alsoInvalidate: [PEOPLE_KEY], meta: meta("Could not remove the branch holiday") });
