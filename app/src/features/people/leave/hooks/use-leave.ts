import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PEOPLE_KEY } from "@/features/people/employees/hooks/use-employees";
import type { LeaveRequestDto } from "../interfaces/leave.interfaces";
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
export const useLeaveTypes = (enabled = true) => useQuery({ queryKey: [...KEY, "types"], queryFn: service.getLeaveTypes, enabled, staleTime: 60_000 });
export const useHolidays = (year?: number, enabled = true) => useQuery({ queryKey: [...KEY, "holidays", year], queryFn: () => service.getHolidays(year), enabled });

function useMutate<A, R>(fn: (a: A) => Promise<R>) {
    const qc = useQueryClient();
    return useMutation({ mutationFn: fn, onSuccess: () => qc.invalidateQueries({ queryKey: PEOPLE_KEY }) });
}
export const useCreateLeave = () => useMutate(service.createLeave);
export const useApproveLeave = () => useMutate(service.approveLeave);
export const useRejectLeave = () => useMutate(service.rejectLeave);
export const useCancelLeave = () => useMutate(service.cancelLeave);
export const useAdjustBalance = () => useMutate(service.adjustBalance);
export const useCreateHoliday = () => useMutate(service.createHoliday);
export const useRemoveHoliday = () => useMutate(service.removeHoliday);
