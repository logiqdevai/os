import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { TIME_KEY } from "@/features/time/settings/hooks/use-time-settings";
import * as service from "../services/timers.services";

const KEY = [...TIME_KEY, "timer"] as const;

export const useCurrentTimer = (enabled = true) => useQuery({ queryKey: KEY, queryFn: service.getCurrentTimer, enabled, refetchOnWindowFocus: true });

function useInvalidate(all = false) {
    const qc = useQueryClient();
    return () => qc.invalidateQueries({ queryKey: all ? TIME_KEY : KEY });
}
export const useStartTimer = () => {
    const invalidate = useInvalidate(true);
    return useMutation({ mutationFn: service.startTimer, onSuccess: invalidate });
};
export const useUpdateTimer = () => {
    const invalidate = useInvalidate();
    return useMutation({ mutationFn: service.updateTimer, onSuccess: invalidate });
};
export const useStopTimer = () => {
    const invalidate = useInvalidate(true);
    return useMutation({ mutationFn: service.stopTimer, onSuccess: invalidate });
};
export const usePauseTimer = () => {
    const invalidate = useInvalidate();
    return useMutation({ mutationFn: service.pauseTimer, onSuccess: invalidate });
};
export const useResumeTimer = () => {
    const invalidate = useInvalidate();
    return useMutation({ mutationFn: service.resumeTimer, onSuccess: invalidate });
};
export const useDiscardTimer = () => {
    const invalidate = useInvalidate();
    return useMutation({ mutationFn: service.discardTimer, onSuccess: invalidate });
};
