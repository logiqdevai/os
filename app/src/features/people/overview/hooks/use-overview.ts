import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PEOPLE_KEY } from "@/features/people/employees/hooks/use-employees";
import * as service from "../services/overview.services";

export const usePeopleOverview = (enabled = true) => useQuery({ queryKey: [...PEOPLE_KEY, "overview"], queryFn: service.getPeopleOverview, enabled });
export const useCapacity = (params: Record<string, unknown>, enabled = true) =>
    useQuery({ queryKey: [...PEOPLE_KEY, "capacity", params], queryFn: () => service.getCapacity(params), placeholderData: keepPreviousData, enabled });
export const useHrSettings = (enabled = true) => useQuery({ queryKey: [...PEOPLE_KEY, "settings"], queryFn: service.getHrSettings, enabled, staleTime: 60_000 });
export const useUpdateHrSettings = () => {
    const qc = useQueryClient();
    return useMutation({ mutationFn: service.updateHrSettings, onSuccess: () => qc.invalidateQueries({ queryKey: PEOPLE_KEY }) });
};
