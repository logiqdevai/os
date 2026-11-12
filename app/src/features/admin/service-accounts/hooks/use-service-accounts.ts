import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { patchEntity, useEntityUpdate, useOptimisticMutation } from "@/lib/query/optimistic";
import * as service from "../services/service-accounts.services";

const KEY = ["admin", "service-accounts"] as const;

export const useServiceAccounts = (params: Record<string, unknown>, enabled = true) =>
    useQuery({ queryKey: [...KEY, "list", params], queryFn: () => service.getServiceAccounts(params), placeholderData: keepPreviousData, enabled });

export const useServiceAccount = (id: string | undefined) => useQuery({ queryKey: [...KEY, "detail", id], queryFn: () => service.getServiceAccount(id as string), enabled: !!id });

function useInvalidate() {
    const qc = useQueryClient();
    return () => {
        qc.invalidateQueries({ queryKey: KEY });
        qc.invalidateQueries({ queryKey: ["admin", "api-keys"] });
    };
}

export const useCreateServiceAccount = () => {
    const invalidate = useInvalidate();
    return useMutation({ mutationFn: service.createServiceAccount, meta: { errorTitle: "Could not create service account" }, onSettled: invalidate });
};
/** Optimistic: name / description change at once (saved on blur by the detail page). */
export const useUpdateServiceAccount = () =>
    useEntityUpdate({ root: KEY, mutationFn: service.updateServiceAccount, alsoInvalidate: [["admin", "api-keys"]], meta: { errorTitle: "Could not update the service account" } });
const STATUS = { suspend: "SUSPENDED", reactivate: "ACTIVE", revoke: "REVOKED" } as const;
/** Optimistic: the status badge changes at once. */
export const useSetServiceAccountStatus = () =>
    useOptimisticMutation({
        roots: [KEY],
        alsoInvalidate: [["admin", "api-keys"]],
        mutationFn: service.setServiceAccountStatus,
        meta: { errorTitle: "Could not change the service account" },
        apply: (qc, v) => patchEntity(qc, KEY, v.id, { status: STATUS[v.action] }),
    });
export const useAssignServiceAccountRole = () => {
    const invalidate = useInvalidate();
    return useMutation({ mutationFn: service.assignServiceAccountRole, meta: { errorTitle: "Could not assign service account role" }, onSettled: invalidate });
};
/** Optimistic: the role assignment disappears at once. */
export const useRemoveServiceAccountRole = () =>
    useOptimisticMutation({
        roots: [KEY],
        mutationFn: service.removeServiceAccountRole,
        meta: { errorTitle: "Could not remove the role" },
        apply: (qc, v) => patchEntity<{ id: string; role_assignments?: { id: string }[] }>(qc, KEY, v.id, (sa) => ({ ...sa, role_assignments: sa.role_assignments?.filter((r) => r.id !== v.assignment_id) })),
    });
