import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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

export const useUpdateOrganization = () => {
    const invalidate = useInvalidate();
    return useMutation({ mutationFn: service.updateOrganization, onSuccess: invalidate });
};
export const useUpdateBranding = () => {
    const invalidate = useInvalidate();
    return useMutation({ mutationFn: service.updateBranding, onSuccess: invalidate });
};
export const useSetModule = () => {
    const invalidate = useInvalidate();
    return useMutation({ mutationFn: service.setModule, onSuccess: invalidate });
};
