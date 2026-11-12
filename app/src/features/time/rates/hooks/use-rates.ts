import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { patchEntity, removeEntity, useOptimisticMutation } from "@/lib/query/optimistic";
import { TIME_KEY } from "@/features/time/settings/hooks/use-time-settings";
import * as service from "../services/rates.services";

const KEY = [...TIME_KEY, "rates"] as const;

export const useRates = (params: Record<string, unknown>) =>
    useQuery({ queryKey: [...KEY, "list", params], queryFn: () => service.getRates(params), placeholderData: keepPreviousData });

/** No success toasts (the table shows the result); failures are toasted once globally. */
export const useCreateRate = () => {
    const qc = useQueryClient();
    return useMutation({ mutationFn: service.createRate, meta: { errorTitle: "Could not create the rate" }, onSettled: () => qc.invalidateQueries({ queryKey: KEY }) });
};
/** Optimistic row update; `inline` for the autosaving edit dialog (its <SaveStatus /> shows failures). */
export const useUpdateRate = ({ inline = false }: { inline?: boolean } = {}) =>
    useOptimisticMutation({
        roots: [KEY],
        meta: { errorTitle: "Could not save the rate", errorToast: !inline },
        mutationFn: service.updateRate,
        apply: (qc, { id, ...dto }) => patchEntity(qc, KEY, id, { ...dto, ...(dto.hourly_rate !== undefined && { hourly_rate: String(dto.hourly_rate) }) }),
    });
/** Archived rates leave the (active) list at once. */
export const useArchiveRate = () =>
    useOptimisticMutation({ roots: [KEY], meta: { errorTitle: "Could not archive the rate" }, mutationFn: service.archiveRate, apply: (qc, id) => removeEntity(qc, KEY, id) });
