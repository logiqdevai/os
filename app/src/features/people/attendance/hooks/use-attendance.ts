import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PEOPLE_KEY } from "@/features/people/employees/hooks/use-employees";
import * as service from "../services/attendance.services";
import { patchEntity, useOptimisticMutation } from "@/lib/query/optimistic";

const KEY = [...PEOPLE_KEY, "attendance"] as const;

export const useMyAttendance = (enabled = true) => useQuery({ queryKey: [...KEY, "me"], queryFn: service.getMyAttendance, enabled, retry: false, refetchInterval: 60_000 });
export const useAttendanceRecords = (params: Record<string, unknown>, enabled = true) =>
    useQuery({ queryKey: [...KEY, "records", params], queryFn: () => service.getAttendanceRecords(params), placeholderData: keepPreviousData, enabled });
export const useAttendanceBoard = (params: { date?: string; team_id?: string }, enabled = true) =>
    useQuery({ queryKey: [...KEY, "board", params], queryFn: () => service.getAttendanceBoard(params), placeholderData: keepPreviousData, enabled, refetchInterval: 60_000 });

function useMutate<A, R>(fn: (a: A) => Promise<R>, errorTitle: string) {
    const qc = useQueryClient();
    return useMutation({ mutationFn: fn, meta: { errorTitle }, onSettled: () => qc.invalidateQueries({ queryKey: KEY }) });
}
export const useClockIn = () => useMutate(service.clockIn, "Could not clock in");
export const useClockOut = () => useMutate(service.clockOut, "Could not clock out");
export const useStartBreak = () => useMutate(service.startBreak, "Could not start the break");
export const useEndBreak = () => useMutate(service.endBreak, "Could not end the break");
/** Optimistic: the overtime shows approved at once. */
export const useApproveOvertime = () =>
    useOptimisticMutation({
        roots: [KEY],
        mutationFn: service.approveOvertime,
        meta: { errorTitle: "Could not approve the overtime" },
        apply: (qc, id) => patchEntity(qc, KEY, id, { overtime_approved: true }),
    });
export const useAddManualAttendance = () => useMutate(service.addManualAttendance, "Could not add the attendance record");
