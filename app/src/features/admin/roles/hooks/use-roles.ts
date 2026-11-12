import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as service from "../services/roles.services";

const KEY = ["admin", "roles"] as const;

export const useRoles = (params: Record<string, unknown>, options: { enabled?: boolean } = {}) =>
    useQuery({ queryKey: [...KEY, "list", params], queryFn: () => service.getRoles(params), placeholderData: keepPreviousData, enabled: options.enabled ?? true });

/** Published roles that can be assigned (templates + custom), for pickers. */
export const useAssignableRoles = (enabled = true) =>
    useQuery({
        queryKey: [...KEY, "assignable"],
        queryFn: async () => (await service.getRoles({ status: "PUBLISHED", limit: 200, order_by: "name", order_direction: "asc" })).data.filter((r) => r.type !== "CUSTOMER_PORTAL"),
        enabled,
        staleTime: 60_000,
    });

export const useRole = (id: string | undefined) => useQuery({ queryKey: [...KEY, "detail", id], queryFn: () => service.getRole(id as string), enabled: !!id });

function useInvalidate() {
    const qc = useQueryClient();
    return () => {
        qc.invalidateQueries({ queryKey: KEY });
        qc.invalidateQueries({ queryKey: ["session"] });
    };
}

export const useCreateRole = () => {
    const invalidate = useInvalidate();
    return useMutation({ mutationFn: service.createRole, meta: { errorTitle: "Could not create role" }, onSettled: invalidate });
};
/** `errorToast: false` when autosaved (the role page shows failures in its <SaveStatus />). */
export const useUpdateRole = (errorToast = true) => {
    const invalidate = useInvalidate();
    return useMutation({ mutationFn: service.updateRole, meta: { errorTitle: "Could not update the role", errorToast }, onSettled: invalidate });
};
export const usePublishRole = () => {
    const invalidate = useInvalidate();
    return useMutation({ mutationFn: service.publishRole, meta: { errorTitle: "Could not publish role" }, onSettled: invalidate });
};
export const useDeprecateRole = () => {
    const invalidate = useInvalidate();
    return useMutation({ mutationFn: service.deprecateRole, meta: { errorTitle: "Could not deprecate role" }, onSettled: invalidate });
};
