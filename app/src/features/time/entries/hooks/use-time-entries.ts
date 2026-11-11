import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { TIME_KEY } from "@/features/time/settings/hooks/use-time-settings";
import * as service from "../services/time-entries.services";

const KEY = [...TIME_KEY, "entries"] as const;

export const useTimeEntries = (params: Record<string, unknown>, enabled = true) =>
    useQuery({ queryKey: [...KEY, "list", params], queryFn: () => service.getTimeEntries(params), placeholderData: keepPreviousData, enabled });
export const useTimeEntry = (id: string | undefined) => useQuery({ queryKey: [...KEY, "detail", id], queryFn: () => service.getTimeEntry(id as string), enabled: !!id });

/** Entry writes change week grids, timesheets, reports and unbilled time: refresh the whole Time cache. */
function useInvalidate() {
    const qc = useQueryClient();
    return () => qc.invalidateQueries({ queryKey: TIME_KEY });
}
export const useCreateTimeEntry = () => {
    const invalidate = useInvalidate();
    return useMutation({ mutationFn: service.createTimeEntry, onSuccess: invalidate });
};
export const useUpdateTimeEntry = () => {
    const invalidate = useInvalidate();
    return useMutation({ mutationFn: service.updateTimeEntry, onSuccess: invalidate });
};
export const useDeleteTimeEntry = () => {
    const invalidate = useInvalidate();
    return useMutation({ mutationFn: service.deleteTimeEntry, onSuccess: invalidate });
};
export const useApproveTimeEntry = () => {
    const invalidate = useInvalidate();
    return useMutation({ mutationFn: service.approveTimeEntry, onSuccess: invalidate });
};
export const useRejectTimeEntry = () => {
    const invalidate = useInvalidate();
    return useMutation({ mutationFn: service.rejectTimeEntry, onSuccess: invalidate });
};
export const useUnlockTimeEntry = () => {
    const invalidate = useInvalidate();
    return useMutation({ mutationFn: service.unlockTimeEntry, onSuccess: invalidate });
};
export const useSaveWeekGrid = () => {
    const invalidate = useInvalidate();
    return useMutation({ mutationFn: service.saveWeekGrid, onSuccess: invalidate });
};
