import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PEOPLE_KEY } from "@/features/people/employees/hooks/use-employees";
import * as service from "../services/attendance.services";

const KEY = [...PEOPLE_KEY, "attendance"] as const;

export const useMyAttendance = (enabled = true) => useQuery({ queryKey: [...KEY, "me"], queryFn: service.getMyAttendance, enabled, retry: false, refetchInterval: 60_000 });
export const useAttendanceRecords = (params: Record<string, unknown>, enabled = true) =>
    useQuery({ queryKey: [...KEY, "records", params], queryFn: () => service.getAttendanceRecords(params), placeholderData: keepPreviousData, enabled });
export const useAttendanceBoard = (params: { date?: string; team_id?: string }, enabled = true) =>
    useQuery({ queryKey: [...KEY, "board", params], queryFn: () => service.getAttendanceBoard(params), placeholderData: keepPreviousData, enabled, refetchInterval: 60_000 });

function useMutate<A, R>(fn: (a: A) => Promise<R>) {
    const qc = useQueryClient();
    return useMutation({ mutationFn: fn, onSuccess: () => qc.invalidateQueries({ queryKey: KEY }) });
}
export const useClockIn = () => useMutate(service.clockIn);
export const useClockOut = () => useMutate(service.clockOut);
export const useStartBreak = () => useMutate(service.startBreak);
export const useEndBreak = () => useMutate(service.endBreak);
export const useApproveOvertime = () => useMutate(service.approveOvertime);
export const useAddManualAttendance = () => useMutate(service.addManualAttendance);
