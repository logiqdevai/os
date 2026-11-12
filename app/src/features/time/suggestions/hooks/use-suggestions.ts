import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { removeEntity, useOptimisticMutation } from "@/lib/query/optimistic";
import { TIME_KEY } from "@/features/time/settings/hooks/use-time-settings";
import type { TimeSuggestionStatus } from "../interfaces/suggestions.interfaces";
import * as service from "../services/suggestions.services";

const KEY = [...TIME_KEY, "suggestions"] as const;

export const useSuggestions = (status: TimeSuggestionStatus = "PENDING", enabled = true) => useQuery({ queryKey: [...KEY, status], queryFn: () => service.getSuggestions(status), enabled });

/**
 * No success toasts: accepted / dismissed suggestions leave the list at once (optimistic) and accepted ones show up in
 * the week. Accepting creates entries, so every Time query (week, entries, timesheets) refreshes on settle.
 * `silent` for the automatic scan on page open (a failure there is not worth a toast).
 */
export const useGenerateSuggestions = ({ silent = false }: { silent?: boolean } = {}) => {
    const qc = useQueryClient();
    return useMutation({ mutationFn: service.generateSuggestions, meta: { errorTitle: "Could not scan for suggestions", errorToast: !silent }, onSettled: () => qc.invalidateQueries({ queryKey: KEY }) });
};
export const useAcceptSuggestion = () =>
    useOptimisticMutation({ roots: [KEY], alsoInvalidate: [TIME_KEY], meta: { errorTitle: "Could not log the time" }, mutationFn: service.acceptSuggestion, apply: (qc, { id }) => removeEntity(qc, KEY, id) });
/** Accept all: the list empties at once; per-item failures come back on refresh and the caller toasts them. */
export const useAcceptSuggestions = () =>
    useOptimisticMutation({ roots: [KEY], alsoInvalidate: [TIME_KEY], meta: { errorTitle: "Could not accept the suggestions" }, mutationFn: service.acceptSuggestions, apply: (qc, ids) => { for (const id of ids) removeEntity(qc, KEY, id); } });
export const useDismissSuggestion = () =>
    useOptimisticMutation({ roots: [KEY], meta: { errorTitle: "Could not dismiss the suggestion" }, mutationFn: service.dismissSuggestion, apply: (qc, id) => removeEntity(qc, KEY, id) });
