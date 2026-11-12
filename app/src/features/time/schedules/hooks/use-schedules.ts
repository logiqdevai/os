import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { patchEntity, removeEntity, useOptimisticMutation } from "@/lib/query/optimistic";
import { TIME_KEY } from "@/features/time/settings/hooks/use-time-settings";
import * as service from "../services/schedules.services";

const KEY = [...TIME_KEY, "schedules"] as const;

export const useSchedules = (enabled = true) => useQuery({ queryKey: [...KEY, "list"], queryFn: service.getSchedules, enabled });
export const useScheduleReports = (enabled = true) => useQuery({ queryKey: [...KEY, "reports"], queryFn: service.getScheduleReports, enabled, staleTime: 300_000 });

/** No success toasts (the table shows the result); failures are toasted once globally (meta.errorTitle). */
function useMutate<A, R>(fn: (a: A) => Promise<R>, errorTitle: string) {
    const qc = useQueryClient();
    return useMutation({ mutationFn: fn, meta: { errorTitle }, onSettled: () => qc.invalidateQueries({ queryKey: KEY }) });
}
export const useCreateSchedule = () => useMutate(service.createSchedule, "Could not create the schedule");
/** Optimistic (active toggle, edits); `inline` for the autosaving edit dialog. */
export const useUpdateSchedule = ({ inline = false }: { inline?: boolean } = {}) =>
    useOptimisticMutation({
        roots: [KEY],
        meta: { errorTitle: "Could not update the schedule", errorToast: !inline },
        mutationFn: service.updateSchedule,
        apply: (qc, { id, ...dto }) => patchEntity(qc, KEY, id, dto),
    });
export const useDeleteSchedule = () =>
    useOptimisticMutation({ roots: [KEY], meta: { errorTitle: "Could not delete the schedule" }, mutationFn: service.deleteSchedule, apply: (qc, id) => removeEntity(qc, KEY, id) });
/** "Send now": the Last run column shows the result after the refresh. */
export const useRunSchedule = () => useMutate(service.runSchedule, "Could not send the report");
export const useDownloadExport = () => useMutation({ mutationFn: service.downloadExport, meta: { errorTitle: "Could not download the export" } });
