import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as service from "../services/time-settings.services";

/** Root query key of the Time area: entry writes invalidate everything under it. */
export const TIME_KEY = ["time"] as const;
const KEY = [...TIME_KEY, "settings"] as const;

export const useTimeSettings = (enabled = true) => useQuery({ queryKey: [...KEY, "org"], queryFn: service.getTimeSettings, enabled, staleTime: 60_000 });
export const useActivityTypes = (includeArchived = false) =>
    useQuery({ queryKey: [...KEY, "activity-types", includeArchived], queryFn: () => service.getActivityTypes(includeArchived), staleTime: 60_000 });
export const useTimeProjects = (search?: string) =>
    useQuery({ queryKey: [...KEY, "projects", search ?? ""], queryFn: () => service.getTimeProjects(search), staleTime: 60_000 });
export const useTimeTasks = (projectId?: string | null, search?: string) =>
    useQuery({ queryKey: [...KEY, "tasks", projectId ?? "", search ?? ""], queryFn: () => service.getTimeTasks(projectId, search), enabled: !!projectId, staleTime: 30_000 });
export const useTimeMembers = (scope: "team" | "all" = "all", enabled = true) =>
    useQuery({ queryKey: [...KEY, "members", scope], queryFn: () => service.getTimeMembers(scope), enabled, staleTime: 60_000 });

function useInvalidate() {
    const qc = useQueryClient();
    return () => qc.invalidateQueries({ queryKey: KEY });
}
export const useUpdateTimeSettings = () => {
    const invalidate = useInvalidate();
    return useMutation({ mutationFn: service.updateTimeSettings, onSuccess: invalidate });
};
export const useCreateActivityType = () => {
    const invalidate = useInvalidate();
    return useMutation({ mutationFn: service.createActivityType, onSuccess: invalidate });
};
export const useUpdateActivityType = () => {
    const invalidate = useInvalidate();
    return useMutation({ mutationFn: service.updateActivityType, onSuccess: invalidate });
};
export const useArchiveActivityType = () => {
    const invalidate = useInvalidate();
    return useMutation({ mutationFn: service.archiveActivityType, onSuccess: invalidate });
};
