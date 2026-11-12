import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { OrganizationModuleRow } from "../interfaces/organization.interfaces";
import { useOptimisticMutation } from "@/lib/query/optimistic";
import * as service from "../services/organization.services";

const KEY = ["admin", "organization"] as const;

export const useOrganization = () => useQuery({ queryKey: [...KEY, "profile"], queryFn: service.getOrganization });
export const useOrganizationModules = () => useQuery({ queryKey: [...KEY, "modules"], queryFn: service.getModules });

function useInvalidate() {
    const qc = useQueryClient();
    return () => {
        qc.invalidateQueries({ queryKey: KEY });
        // Name, logo and enabled modules feed the app shell through the session bootstrap.
        qc.invalidateQueries({ queryKey: ["session"] });
    };
}

/** Autosaved by Organization settings (failures show in its <SaveStatus />, no toast). */
export const useUpdateOrganization = () => {
    const invalidate = useInvalidate();
    return useMutation({ mutationFn: service.updateOrganization, meta: { errorToast: false }, onSettled: invalidate });
};
/** Autosaved by Branding (failures show in its <SaveStatus />, no toast). */
export const useUpdateBranding = () => {
    const invalidate = useInvalidate();
    return useMutation({ mutationFn: service.updateBranding, meta: { errorToast: false }, onSettled: invalidate });
};
/** Optimistic: the module switch flips at once. */
export const useSetModule = () =>
    useOptimisticMutation({
        roots: [[...KEY, "modules"]],
        alsoInvalidate: [KEY, ["session"]],
        mutationFn: service.setModule,
        meta: { errorTitle: "Could not change the module" },
        apply: (qc, v) => qc.setQueryData<OrganizationModuleRow[]>([...KEY, "modules"], (rows) => rows?.map((r) => (r.module === v.module ? { ...r, enabled: v.enabled } : r))),
    });
