import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { patchEntity, useOptimisticMutation } from "@/lib/query/optimistic";
import type { TimeTrackingSettings } from "../interfaces/time-settings.interfaces";
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

export const useProjectTimeSettings = (search?: string) =>
    useQuery({ queryKey: [...KEY, "project-settings", search ?? ""], queryFn: () => service.getProjectTimeSettings(search) });

/*
 * Settings writes: no success toasts (autosave shows <SaveStatus />, lists change in place); failures are toasted once
 * globally unless `inline` (the form shows the error itself).
 */
function useSettingsMutation<A, R>(fn: (a: A) => Promise<R>, errorTitle: string, errorToast = true) {
    const qc = useQueryClient();
    return useMutation({ mutationFn: fn, meta: { errorTitle, errorToast }, onSettled: () => qc.invalidateQueries({ queryKey: KEY }) });
}
/** Organization rules: optimistic (pickers that read the rules see them at once). */
export const useUpdateTimeSettings = ({ inline = false }: { inline?: boolean } = {}) =>
    useOptimisticMutation({
        roots: [KEY],
        meta: { errorTitle: "Could not save the time settings", errorToast: !inline },
        mutationFn: service.updateTimeSettings,
        apply: (qc, dto) => qc.setQueryData<TimeTrackingSettings>([...KEY, "org"], (s) => (s ? ({ ...s, ...dto } as TimeTrackingSettings) : s)),
    });
export const useCreateActivityType = () => useSettingsMutation(service.createActivityType, "Could not add the activity type");
export const useUpdateActivityType = () =>
    useOptimisticMutation({ roots: [KEY], meta: { errorTitle: "Could not update the activity type" }, mutationFn: service.updateActivityType, apply: (qc, { id, ...dto }) => patchEntity(qc, KEY, id, dto) });
/** Archive / restore toggle: the row flips at once. */
export const useArchiveActivityType = () =>
    useOptimisticMutation({
        roots: [KEY],
        meta: { errorTitle: "Could not update the activity type" },
        mutationFn: service.archiveActivityType,
        apply: (qc, { id, restore }) => patchEntity(qc, KEY, id, { archived_at: restore ? null : new Date().toISOString() }),
    });
/** Per-project billing defaults: the row shows the new values at once; `inline` for the autosaving dialog. */
export const useUpdateProjectTimeSettings = ({ inline = false }: { inline?: boolean } = {}) =>
    useOptimisticMutation({
        roots: [KEY],
        meta: { errorTitle: "Could not save the project settings", errorToast: !inline },
        mutationFn: service.updateProjectTimeSettings,
        apply: (qc, { projectId, ...dto }) =>
            patchEntity<{ settings: Record<string, unknown> | null }>(qc, KEY, projectId, (row) => ({ ...row, settings: { ...(row.settings ?? {}), ...dto } })),
    });
