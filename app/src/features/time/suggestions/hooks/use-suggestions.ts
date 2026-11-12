import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { TIME_KEY } from "@/features/time/settings/hooks/use-time-settings";
import type { TimeSuggestionStatus } from "../interfaces/suggestions.interfaces";
import * as service from "../services/suggestions.services";

const KEY = [...TIME_KEY, "suggestions"] as const;

export const useSuggestions = (status: TimeSuggestionStatus = "PENDING", enabled = true) => useQuery({ queryKey: [...KEY, status], queryFn: () => service.getSuggestions(status), enabled });

/** Accepting creates entries, so every Time query (week, entries, timesheets) is refreshed. */
function useMutate<A, R>(fn: (a: A) => Promise<R>) {
    const qc = useQueryClient();
    return useMutation({ mutationFn: fn, onSuccess: () => qc.invalidateQueries({ queryKey: TIME_KEY }) });
}
export const useGenerateSuggestions = () => useMutate(service.generateSuggestions);
export const useAcceptSuggestion = () => useMutate(service.acceptSuggestion);
export const useAcceptSuggestions = () => useMutate(service.acceptSuggestions);
export const useDismissSuggestion = () => useMutate(service.dismissSuggestion);
