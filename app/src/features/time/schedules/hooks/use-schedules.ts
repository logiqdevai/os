import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { TIME_KEY } from "@/features/time/settings/hooks/use-time-settings";
import * as service from "../services/schedules.services";

const KEY = [...TIME_KEY, "schedules"] as const;

export const useSchedules = (enabled = true) => useQuery({ queryKey: [...KEY, "list"], queryFn: service.getSchedules, enabled });
export const useScheduleReports = (enabled = true) => useQuery({ queryKey: [...KEY, "reports"], queryFn: service.getScheduleReports, enabled, staleTime: 300_000 });

function useMutate<A, R>(fn: (a: A) => Promise<R>) {
    const qc = useQueryClient();
    return useMutation({ mutationFn: fn, onSuccess: () => qc.invalidateQueries({ queryKey: KEY }) });
}
export const useCreateSchedule = () => useMutate(service.createSchedule);
export const useUpdateSchedule = () => useMutate(service.updateSchedule);
export const useDeleteSchedule = () => useMutate(service.deleteSchedule);
export const useRunSchedule = () => useMutate(service.runSchedule);
export const useDownloadExport = () => useMutation({ mutationFn: service.downloadExport });
