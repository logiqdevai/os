import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { SsoConfiguration } from "../interfaces/sso.interfaces";
import { useEntityRemove, useEntityUpdate, useOptimisticMutation } from "@/lib/query/optimistic";
import * as service from "../services/sso.services";

const KEY = ["admin", "sso"] as const;

export const useSsoConfigurations = () => useQuery({ queryKey: KEY, queryFn: service.getSsoConfigurations });

function useInvalidate() {
    const qc = useQueryClient();
    return () => qc.invalidateQueries({ queryKey: KEY });
}

export const useCreateSsoConfiguration = () => {
    const invalidate = useInvalidate();
    return useMutation({ mutationFn: service.createSsoConfiguration, meta: { errorTitle: "Could not create SSO configuration" }, onSettled: invalidate });
};
export const useUpdateSsoConfiguration = () => {
    const invalidate = useInvalidate();
    return useMutation({ mutationFn: service.updateSsoConfiguration, meta: { errorTitle: "Could not update SSO configuration" }, onSettled: invalidate });
};
/** Optimistic: the auto-provision switch / name change at once. */
export const useUpdateSsoSettings = () => useEntityUpdate({ root: KEY, mutationFn: service.updateSsoSettings, meta: { errorTitle: "Could not update the SSO settings" } });
/** Optimistic: the provider disappears at once. */
export const useDeleteSsoConfiguration = () => useEntityRemove({ root: KEY, mutationFn: service.deleteSsoConfiguration, meta: { errorTitle: "Could not delete the SSO provider" } });
export const useAddGroupMapping = () => {
    const invalidate = useInvalidate();
    return useMutation({ mutationFn: service.addGroupMapping, meta: { errorTitle: "Could not add group mapping" }, onSettled: invalidate });
};
export const useUpdateGroupMapping = () => {
    const invalidate = useInvalidate();
    return useMutation({ mutationFn: service.updateGroupMapping, meta: { errorTitle: "Could not update group mapping" }, onSettled: invalidate });
};
/** Optimistic: the mapping disappears at once. */
export const useDeleteGroupMapping = () =>
    useOptimisticMutation({ roots: [KEY], mutationFn: service.deleteGroupMapping, meta: { errorTitle: "Could not delete the group mapping" }, apply: (qc, v) => qc.setQueryData<SsoConfiguration[]>(KEY, (list) => list?.map((c) => (c.id === v.configId ? { ...c, group_mappings: c.group_mappings.filter((m) => m.id !== v.mappingId) } : c))) });
