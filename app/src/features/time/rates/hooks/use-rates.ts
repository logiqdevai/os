import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { TIME_KEY } from "@/features/time/settings/hooks/use-time-settings";
import * as service from "../services/rates.services";

const KEY = [...TIME_KEY, "rates"] as const;

export const useRates = (params: Record<string, unknown>) =>
    useQuery({ queryKey: [...KEY, "list", params], queryFn: () => service.getRates(params), placeholderData: keepPreviousData });

function useInvalidate() {
    const qc = useQueryClient();
    return () => qc.invalidateQueries({ queryKey: KEY });
}
export const useCreateRate = () => {
    const invalidate = useInvalidate();
    return useMutation({ mutationFn: service.createRate, onSuccess: invalidate });
};
export const useUpdateRate = () => {
    const invalidate = useInvalidate();
    return useMutation({ mutationFn: service.updateRate, onSuccess: invalidate });
};
export const useArchiveRate = () => {
    const invalidate = useInvalidate();
    return useMutation({ mutationFn: service.archiveRate, onSuccess: invalidate });
};
