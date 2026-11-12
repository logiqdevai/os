import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { patchEntity, useEntityRemove, useEntityUpdate, useOptimisticMutation } from "@/lib/query/optimistic";
import { TIME_KEY } from "@/features/time/settings/hooks/use-time-settings";
import * as service from "../services/time-entries.services";

const KEY = [...TIME_KEY, "entries"] as const;

export const useTimeEntries = (params: Record<string, unknown>, enabled = true) =>
    useQuery({ queryKey: [...KEY, "list", params], queryFn: () => service.getTimeEntries(params), placeholderData: keepPreviousData, enabled });
export const useTimeEntry = (id: string | undefined) => useQuery({ queryKey: [...KEY, "detail", id], queryFn: () => service.getTimeEntry(id as string), enabled: !!id });

/**
 * Entry writes change week grids, timesheets, reports and unbilled time: the whole Time cache is refreshed when a
 * write settles. No success toasts (the lists show the result); failures are toasted once globally (meta.errorTitle).
 */
function useTimeMutation<A, R>(fn: (a: A) => Promise<R>, errorTitle: string, errorToast = true) {
    const qc = useQueryClient();
    return useMutation({ mutationFn: fn, meta: { errorTitle, errorToast }, onSettled: () => qc.invalidateQueries({ queryKey: TIME_KEY }) });
}

/** Creating needs the server's computed rate and status: not optimistic; the dialog closes on success. */
export const useCreateTimeEntry = () => useTimeMutation(service.createTimeEntry, "Could not log time");
/**
 * Optimistic: the row shows the new values at once in every entries list; `optimistic` carries display objects.
 * `inline: true` for the autosaving edit dialog (its <SaveStatus /> shows failures instead of a toast).
 */
export const useUpdateTimeEntry = ({ inline = false }: { inline?: boolean } = {}) =>
    useEntityUpdate({ root: TIME_KEY, mutationFn: service.updateTimeEntry, meta: { errorTitle: "Could not save time", errorToast: !inline } });
export const useDeleteTimeEntry = () => useEntityRemove({ root: TIME_KEY, mutationFn: service.deleteTimeEntry, meta: { errorTitle: "Could not delete the entry" } });
export const useApproveTimeEntry = () =>
    useOptimisticMutation({ roots: [TIME_KEY], meta: { errorTitle: "Could not approve the entry" }, mutationFn: service.approveTimeEntry, apply: (qc, id: string) => patchEntity(qc, TIME_KEY, id, { status: "APPROVED" }) });
export const useRejectTimeEntry = () =>
    useOptimisticMutation({ roots: [TIME_KEY], meta: { errorTitle: "Could not reject the entry" }, mutationFn: service.rejectTimeEntry, apply: (qc, { id }: { id: string; reason: string }) => patchEntity(qc, TIME_KEY, id, { status: "REJECTED" }) });
export const useUnlockTimeEntry = () =>
    useOptimisticMutation({ roots: [TIME_KEY], meta: { errorTitle: "Could not unlock the entry" }, mutationFn: service.unlockTimeEntry, apply: (qc, { id }: { id: string; reason: string }) => patchEntity(qc, TIME_KEY, id, { is_locked: false }) });
/** The week grid keeps its own draft (the cells already show the values); this refreshes totals after saving. */
export const useSaveWeekGrid = ({ inline = false }: { inline?: boolean } = {}) => useTimeMutation(service.saveWeekGrid, "Could not save the week", !inline);
